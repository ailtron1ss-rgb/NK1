/**
 * Canonical observation contract and intake gate.
 *
 * Every observation entering the organism — camera frame metadata, host-provided
 * text, a provider's scene analysis, a device sensor sample — passes through this
 * gate before any other subsystem sees it. The gate exists because the rest of the
 * architecture already knows how to *reason* about evidence, but nothing was
 * enforcing what counted as admissible evidence in the first place: the previous
 * ingress points (`P41SemanticPerceptionEngine.ingest`, `MultimodalPerception.observe`,
 * `PerceptualEvidenceCompiler.recordExternalEvidence`) each accepted whatever shape
 * their caller happened to pass, with no shared notion of source, freshness,
 * duplication or whether a "capture" was real or a synthetic fixture.
 *
 * Two invariants are load-bearing and deliberately not configurable:
 *
 * 1. **Provenance is authoritative, not self-declared.** A caller may claim
 *    `isRealCapture: true`; if its `provenance` says `synthetic-fixture` the claim is
 *    discarded and the observation is downgraded. No subsystem can turn a fixture
 *    into a real-world fact by asserting it is one.
 * 2. **Raw media is never retained.** Observations carry bounded metadata and a
 *    content digest. A payload that looks like raw image/audio bytes is rejected
 *    rather than silently stored, so "we perceived it" cannot mean "we kept it".
 *
 * The gate is the single admission point; it is intentionally the only module that
 * decides `accepted` vs `rejected`, and it records *why*.
 */

import { createHash } from 'node:crypto';

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const stableHash = (value: string) => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};

/** Modalities the organism currently has a contract for. */
export const OBSERVATION_MODALITIES = ['vision', 'audio', 'text', 'sensor', 'world', 'device'] as const;
export type ObservationModality = (typeof OBSERVATION_MODALITIES)[number];

/**
 * Where an observation actually came from. This is the field that decides whether
 * downstream code may treat it as grounded external evidence.
 *
 * - `device-capture`     a real sensor/camera produced it on this host.
 * - `host-interface`     a real host API produced it (Android telemetry, STT transcript).
 * - `provider-model-output` an external model inferred it (vision LLM, ASR).
 * - `derived`            the organism computed it from other observations.
 * - `synthetic-fixture`  a test/demo fixture; never real-world evidence.
 * - `unresolved`         the caller did not say; treated as untrusted.
 */
export const OBSERVATION_PROVENANCE = [
  'device-capture',
  'host-interface',
  'provider-model-output',
  'derived',
  'synthetic-fixture',
  'unresolved',
] as const;
export type ObservationProvenance = (typeof OBSERVATION_PROVENANCE)[number];

/** Provenance values that may back a claim of real-world grounding. */
const REAL_PROVENANCE: ReadonlySet<ObservationProvenance> = new Set<ObservationProvenance>([
  'device-capture',
  'host-interface',
]);

export type RejectionReason =
  | 'malformed-observation'
  | 'missing-identity'
  | 'unsupported-modality'
  | 'invalid-provenance'
  | 'invalid-timestamp'
  | 'stale-observation'
  | 'expired-observation'
  | 'future-observation'
  | 'consent-required'
  | 'duplicate-observation'
  | 'raw-media-not-retained'
  | 'payload-too-large'
  | 'out-of-scope';

export interface CanonicalObservation {
  /** Stable identity for this observation. Duplicated ids are rejected, not merged. */
  id: string;
  /** Who produced it (device id, provider id, subsystem name). */
  sourceId: string;
  /** Coarse source class, e.g. `camera`, `android-telemetry`, `provider:gemini-vision`. */
  sourceKind: string;
  modality: ObservationModality;
  /** When the source says it captured the observation (device clock). */
  capturedAt: number;
  /** When this process accepted it (gate clock). Used for staleness accounting. */
  receivedAt: number;
  confidence01: number;
  /** Source reliability as known *before* this observation; never self-reported per-frame. */
  reliability01: number;
  /** Coordinate frame for any spatial values. Absent means spatial values are unusable. */
  coordinateFrameId?: string;
  sessionId: string;
  provenance: ObservationProvenance;
  /**
   * True only when `provenance` is a real capture class. Recomputed by the gate;
   * a caller-supplied value is never trusted.
   */
  isRealCapture: boolean;
  /** Freshness deadline. An observation past this instant is rejected. */
  expiresAt: number;
  /** References into the existing evidence ledger (P41 evidence ids, receipt ids). */
  evidenceRefs: string[];
  /** Bounded, media-free payload. Sanitized by the gate. */
  payload: Record<string, unknown>;
  /** Digest of the semantic content; the dedupe identity alongside source+modality. */
  contentHash: string;
}

export interface ConflictRecord {
  id: string;
  at: number;
  subject: string;
  modalityA: ObservationModality;
  modalityB: ObservationModality;
  sourceA: string;
  sourceB: string;
  claimA: string;
  claimB: string;
  /** Bounded disagreement in [0,1]; never resolved by majority vote. */
  disagreement01: number;
  resolution: 'preserved-for-review';
}

export interface ObservationIntakeState {
  version: 1;
  admitted: number;
  rejected: number;
  duplicates: number;
  staleRejections: number;
  rawMediaRejections: number;
  conflicts: number;
  lastAt: number;
  /** Bounded rolling ledger of accepted observations, newest first. */
  recent: CanonicalObservation[];
  recentConflicts: ConflictRecord[];
  rejectionReasons: Record<string, number>;
  perModality: Record<string, number>;
  perSource: Record<string, number>;
  /** Consent is explicit and defaults to denied for capture modalities. */
  consent: Record<string, boolean>;
  lastHash: string;
}

const LEDGER_LIMIT = 128;
const CONFLICT_LIMIT = 32;
const MAX_PAYLOAD_BYTES = 4096;
const MAX_STRING_FIELD = 240;
const MAX_EVIDENCE_REFS = 16;

/** Observations older than this are refused as stale evidence. */
export const MAX_OBSERVATION_AGE_MS = 5 * 60_000;
/** Tolerance for device clocks running slightly ahead of the gate clock. */
export const MAX_CLOCK_SKEW_MS = 2_000;
/** Default freshness window when the caller supplies no explicit expiry. */
export const DEFAULT_FRESHNESS_MS = 60_000;

/** Capture modalities require explicit consent before they may be admitted. */
const CONSENT_REQUIRED: ReadonlySet<ObservationModality> = new Set<ObservationModality>([
  'vision',
  'audio',
  'device',
]);

const RAW_MEDIA_KEYS = new Set([
  'bytes',
  'buffer',
  'rawbytes',
  'base64',
  'b64',
  'image',
  'imagedata',
  'jpeg',
  'jpg',
  'png',
  'pcm',
  'audio',
  'audiobuffer',
  'frame',
  'framedata',
  'bitmap',
]);

export function defaultObservationIntakeState(): ObservationIntakeState {
  return {
    version: 1,
    admitted: 0,
    rejected: 0,
    duplicates: 0,
    staleRejections: 0,
    rawMediaRejections: 0,
    conflicts: 0,
    lastAt: 0,
    recent: [],
    recentConflicts: [],
    rejectionReasons: {},
    perModality: {},
    perSource: {},
    consent: { vision: false, audio: false, device: false, text: true, sensor: true, world: true },
    lastHash: '',
  };
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const ownValue = (record: Record<string, unknown>, key: string): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return undefined;
  return descriptor.value;
};

const safeString = (value: unknown, limit = MAX_STRING_FIELD): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.normalize('NFKC').replace(/[\r\n\t]+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, limit);
};

const safeTimestamp = (value: unknown): number | null => {
  // Timestamps are epoch milliseconds. A fractional value means the caller is not
  // speaking the contract, so it is rejected rather than silently truncated.
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return null;
  return value;
};

/**
 * Rebuild a persisted intake state defensively.
 *
 * Mirrors `sanitizePerceptionRoutingState`: only plain records with own data
 * properties are trusted, accessors are never invoked, and any structural surprise
 * falls back to defaults rather than letting hostile persisted state re-enter live
 * state. Counters saturate at MAX_SAFE_INTEGER instead of overflowing.
 */
export function sanitizeObservationIntakeState(raw: unknown): ObservationIntakeState {
  const fallback = defaultObservationIntakeState();
  try {
    if (!isPlainRecord(raw)) return fallback;
    const counter = (key: string): number => {
      const value = ownValue(raw, key);
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return 0;
      return Math.min(value, Number.MAX_SAFE_INTEGER);
    };
    const record = (key: string): Record<string, number> => {
      const value = ownValue(raw, key);
      if (!isPlainRecord(value)) return {};
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(value)) {
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k.slice(0, 64)] = Math.min(v, Number.MAX_SAFE_INTEGER);
      }
      return out;
    };
    const consentRaw = ownValue(raw, 'consent');
    const consent: Record<string, boolean> = { ...fallback.consent };
    if (isPlainRecord(consentRaw)) {
      for (const [k, v] of Object.entries(consentRaw)) {
        if (typeof v === 'boolean') consent[k.slice(0, 32)] = v;
      }
    }
    const recentRaw = ownValue(raw, 'recent');
    const recent = Array.isArray(recentRaw)
      ? recentRaw.filter(isPlainRecord).slice(0, LEDGER_LIMIT).map((row) => ({
          ...(row as unknown as CanonicalObservation),
          provenance: OBSERVATION_PROVENANCE.includes((row as any).provenance) ? (row as any).provenance : 'unresolved',
          isRealCapture: false,
        }))
      : [];
    const conflictsRaw = ownValue(raw, 'recentConflicts');
    const recentConflicts = Array.isArray(conflictsRaw)
      ? (conflictsRaw.filter(isPlainRecord).slice(0, CONFLICT_LIMIT) as unknown as ConflictRecord[])
      : [];
    return {
      version: 1,
      admitted: counter('admitted'),
      rejected: counter('rejected'),
      duplicates: counter('duplicates'),
      staleRejections: counter('staleRejections'),
      rawMediaRejections: counter('rawMediaRejections'),
      conflicts: counter('conflicts'),
      lastAt: counter('lastAt'),
      recent,
      recentConflicts,
      rejectionReasons: record('rejectionReasons'),
      perModality: record('perModality'),
      perSource: record('perSource'),
      consent,
      lastHash: typeof ownValue(raw, 'lastHash') === 'string' ? String(ownValue(raw, 'lastHash')).slice(0, 32) : '',
    };
  } catch {
    // Proxy traps and revoked proxies must not escape the persistence boundary.
    return fallback;
  }
}

export interface AdmitResult {
  status: 'accepted' | 'rejected';
  observation?: CanonicalObservation;
  reason?: RejectionReason;
  detail?: string;
}

export interface AdmitOptions {
  /** Gate clock. Injectable so freshness and skew are deterministic in tests. */
  now?: number;
  /** Max age override; defaults to MAX_OBSERVATION_AGE_MS. */
  maxAgeMs?: number;
}

/**
 * Strip anything resembling raw media from a payload, keeping only bounded scalars.
 *
 * Returns `null` when the payload is unrecoverable (not a plain record, or over the
 * byte budget), and reports whether media was removed so the caller can decide to
 * reject rather than quietly accept a lossy payload.
 */
export function sanitizeObservationPayload(
  payload: unknown,
): { ok: true; payload: Record<string, unknown>; strippedMedia: boolean } | { ok: false; reason: RejectionReason } {
  if (payload === undefined || payload === null) return { ok: true, payload: {}, strippedMedia: false };
  if (!isPlainRecord(payload)) return { ok: false, reason: 'malformed-observation' };
  const out: Record<string, unknown> = {};
  let strippedMedia = false;
  for (const [key, value] of Object.entries(payload)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (RAW_MEDIA_KEYS.has(normalizedKey)) {
      strippedMedia = true;
      continue;
    }
    if (typeof value === 'string') {
      if (RAW_MEDIA_KEYS.has(normalizedKey) || value.length > 512) {
        strippedMedia = true;
        continue;
      }
      out[key.slice(0, 64)] = value.slice(0, 512);
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key.slice(0, 64)] = value;
      continue;
    }
    if (typeof value === 'boolean' || value === null) {
      out[key.slice(0, 64)] = value;
      continue;
    }
    if (Array.isArray(value)) {
      const items = value
        .filter((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
        .slice(0, 32)
        .map((item) => (typeof item === 'string' ? item.slice(0, 240) : item));
      out[key.slice(0, 64)] = items;
      continue;
    }
    if (isPlainRecord(value)) {
      const nested: Record<string, unknown> = {};
      let nestedMedia = false;
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        const normalizedNested = nestedKey.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (RAW_MEDIA_KEYS.has(normalizedNested)) {
          nestedMedia = true;
          continue;
        }
        if (typeof nestedValue === 'string') nested[nestedKey.slice(0, 64)] = nestedValue.slice(0, 240);
        else if (typeof nestedValue === 'number' && Number.isFinite(nestedValue)) nested[nestedKey.slice(0, 64)] = nestedValue;
        else if (typeof nestedValue === 'boolean' || nestedValue === null) nested[nestedKey.slice(0, 64)] = nestedValue;
        else nestedMedia = true;
      }
      strippedMedia = strippedMedia || nestedMedia;
      out[key.slice(0, 64)] = nested;
      continue;
    }
    strippedMedia = true;
  }
  const encoded = JSON.stringify(out);
  if (encoded.length > MAX_PAYLOAD_BYTES) return { ok: false, reason: 'payload-too-large' };
  return { ok: true, payload: out, strippedMedia };
}

/**
 * Normalize an untrusted value into a canonical observation.
 *
 * Returns a rejection reason instead of throwing: ingress happens on hot paths
 * (camera ticks, telemetry callbacks) where an exception would take down the
 * caller rather than drop one bad frame.
 */
export function normalizeObservation(
  raw: unknown,
  options: { now: number; maxAgeMs: number },
): { ok: true; observation: CanonicalObservation; strippedMedia: boolean } | { ok: false; reason: RejectionReason; detail?: string } {
  if (!isPlainRecord(raw)) return { ok: false, reason: 'malformed-observation', detail: 'not a plain record' };

  const id = safeString(ownValue(raw, 'id'), 120);
  const sourceId = safeString(ownValue(raw, 'sourceId'), 120);
  const sessionId = safeString(ownValue(raw, 'sessionId'), 120);
  const sourceKind = safeString(ownValue(raw, 'sourceKind'), 80) ?? sourceId ?? 'unknown';
  if (!id || !sourceId || !sessionId) {
    return { ok: false, reason: 'missing-identity', detail: 'id, sourceId and sessionId are required' };
  }

  const modalityRaw = ownValue(raw, 'modality');
  if (typeof modalityRaw !== 'string' || !OBSERVATION_MODALITIES.includes(modalityRaw as ObservationModality)) {
    return { ok: false, reason: 'unsupported-modality', detail: String(modalityRaw) };
  }
  const modality = modalityRaw as ObservationModality;

  const provenanceRaw = ownValue(raw, 'provenance');
  if (typeof provenanceRaw !== 'string' || !OBSERVATION_PROVENANCE.includes(provenanceRaw as ObservationProvenance)) {
    return { ok: false, reason: 'invalid-provenance', detail: String(provenanceRaw) };
  }
  const provenance = provenanceRaw as ObservationProvenance;

  const capturedAt = safeTimestamp(ownValue(raw, 'capturedAt'));
  if (capturedAt === null) return { ok: false, reason: 'invalid-timestamp', detail: 'capturedAt' };

  const confidenceRaw = ownValue(raw, 'confidence01');
  if (typeof confidenceRaw !== 'number' || !Number.isFinite(confidenceRaw)) {
    return { ok: false, reason: 'malformed-observation', detail: 'confidence01 must be a finite number' };
  }
  const reliabilityRaw = ownValue(raw, 'reliability01');
  const reliability01 = typeof reliabilityRaw === 'number' && Number.isFinite(reliabilityRaw) ? clamp01(reliabilityRaw) : 0.5;

  if (capturedAt > options.now + MAX_CLOCK_SKEW_MS) {
    return { ok: false, reason: 'future-observation', detail: `${capturedAt - options.now}ms ahead of gate clock` };
  }
  if (options.now - capturedAt > options.maxAgeMs) {
    return { ok: false, reason: 'stale-observation', detail: `${options.now - capturedAt}ms old` };
  }

  const expiresRaw = ownValue(raw, 'expiresAt');
  const expiresAt = safeTimestamp(expiresRaw) ?? capturedAt + DEFAULT_FRESHNESS_MS;
  if (expiresAt < options.now) return { ok: false, reason: 'expired-observation', detail: 'freshness window elapsed' };

  const payloadResult = sanitizeObservationPayload(ownValue(raw, 'payload'));
  if (!payloadResult.ok) return { ok: false, reason: payloadResult.reason, detail: 'payload' };

  const coordinateFrameId = safeString(ownValue(raw, 'coordinateFrameId'), 120) ?? undefined;

  const refsRaw = ownValue(raw, 'evidenceRefs');
  const evidenceRefs = Array.isArray(refsRaw)
    ? refsRaw
        .map((ref) => safeString(ref, 120))
        .filter((ref): ref is string => Boolean(ref))
        .slice(0, MAX_EVIDENCE_REFS)
    : [];

  const contentDigest = stableHash(
    JSON.stringify({ modality, sourceId, payload: payloadResult.payload, frame: coordinateFrameId ?? '' }),
  );
  const contentHash = createHash('sha256')
    .update(JSON.stringify({ modality, sourceId, payload: payloadResult.payload }))
    .digest('hex')
    .slice(0, 32);

  const observation: CanonicalObservation = {
    id,
    sourceId,
    sourceKind,
    modality,
    capturedAt,
    receivedAt: options.now,
    confidence01: clamp01(confidenceRaw),
    reliability01,
    ...(coordinateFrameId ? { coordinateFrameId } : {}),
    sessionId,
    provenance,
    // Provenance decides reality; the caller's own claim is discarded here.
    isRealCapture: REAL_PROVENANCE.has(provenance),
    expiresAt,
    evidenceRefs,
    payload: { ...payloadResult.payload, contentDigest },
    contentHash,
  };
  return { ok: true, observation, strippedMedia: payloadResult.strippedMedia };
}

/**
 * The single admission point for observations.
 *
 * State is bounded (rolling ledger + counters) so a long-lived process cannot grow
 * without limit, and every rejection is counted by reason so operators can see
 * *why* the organism is not perceiving something.
 */
export class ObservationIntakeGate {
  private state = defaultObservationIntakeState();
  private readonly seenIds = new Map<string, number>();
  private readonly seenContent = new Map<string, number>();
  private readonly subjectValues = new Map<string, { value: string; modality: ObservationModality; sourceId: string; at: number }>();

  restore(raw?: unknown): void {
    this.state = sanitizeObservationIntakeState(raw);
    this.seenIds.clear();
    this.seenContent.clear();
    this.subjectValues.clear();
    // Rebuild dedupe identity from the restored ledger. Without this a process restart
    // would forget that an observation was already admitted, and a replayed frame —
    // exactly what a reconnect or a retried callback produces — would be counted twice.
    for (const row of this.state.recent) {
      if (!row || typeof row !== 'object') continue;
      const id = typeof row.id === 'string' ? row.id : null;
      const contentHash = typeof row.contentHash === 'string' ? row.contentHash : null;
      if (id) this.seenIds.set(id, row.receivedAt ?? 0);
      if (contentHash) this.seenContent.set(contentHash, row.receivedAt ?? 0);
      const payload = row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : {};
      const subject = typeof payload.subject === 'string' ? payload.subject.trim().toLowerCase() : '';
      const claim = typeof payload.claim === 'string' ? payload.claim : '';
      if (subject && claim) {
        this.subjectValues.set(subject, {
          value: claim,
          modality: typeof row.modality === 'string' ? (row.modality as ObservationModality) : 'world',
          sourceId: typeof row.sourceId === 'string' ? row.sourceId : 'unknown',
          at: row.receivedAt ?? 0,
        });
      }
    }
  }

  snapshot(): ObservationIntakeState {
    return structuredClone(this.state);
  }

  /** Grant or revoke consent for a modality. Denial blocks admission immediately. */
  setConsent(modality: string, granted: boolean): ObservationIntakeState {
    this.state.consent[modality.slice(0, 32)] = granted === true;
    return this.snapshot();
  }

  consentFor(modality: string): boolean {
    return this.state.consent[modality] === true;
  }

  admit(raw: unknown, options: AdmitOptions = {}): AdmitResult {
    const now = options.now ?? Date.now();
    const maxAgeMs = options.maxAgeMs ?? MAX_OBSERVATION_AGE_MS;

    const normalized = normalizeObservation(raw, { now, maxAgeMs });
    if (!normalized.ok) {
      this.recordRejection(normalized.reason, now);
      return { status: 'rejected', reason: normalized.reason, detail: normalized.detail };
    }
    const observation = normalized.observation;

    // Consent is checked before duplication so a denied modality never accumulates
    // dedupe state that would silently swallow a later consented observation.
    if (CONSENT_REQUIRED.has(observation.modality) && !this.consentFor(observation.modality)) {
      this.recordRejection('consent-required', now);
      return { status: 'rejected', reason: 'consent-required', detail: observation.modality };
    }

    if (normalized.strippedMedia) {
      // The observation is admissible but its media payload was not retained.
      // Counting it keeps the privacy boundary observable rather than invisible.
      this.state.rawMediaRejections++;
    }

    const duplicate = this.classifyDuplicate(observation, now);
    if (duplicate) {
      this.recordRejection(duplicate, now);
      return { status: 'rejected', reason: duplicate, detail: observation.id };
    }

    this.state.admitted++;
    this.state.lastAt = now;
    this.state.perModality[observation.modality] = (this.state.perModality[observation.modality] ?? 0) + 1;
    this.state.perSource[observation.sourceId] = (this.state.perSource[observation.sourceId] ?? 0) + 1;
    this.state.recent = [observation, ...this.state.recent].slice(0, LEDGER_LIMIT);
    this.seenIds.set(observation.id, now);
    this.seenContent.set(observation.contentHash, now);
    this.recordConflictIfAny(observation, now);
    this.state.lastHash = stableHash(
      `${observation.id}|${observation.contentHash}|${this.state.admitted}|${this.state.rejected}`,
    );
    return { status: 'accepted', observation };
  }

  private classifyDuplicate(observation: CanonicalObservation, now: number): RejectionReason | null {
    if (this.seenIds.has(observation.id)) return 'duplicate-observation';
    // Content-level dedupe: the same frame re-sent under a new id is still one
    // observation. The window is the freshness window, not forever, so a genuinely
    // repeated capture after the window is admitted again.
    const seenAt = this.seenContent.get(observation.contentHash);
    if (seenAt !== undefined && now - seenAt < DEFAULT_FRESHNESS_MS) return 'duplicate-observation';
    return null;
  }

  private recordConflictIfAny(observation: CanonicalObservation, now: number): void {
    const subject = typeof observation.payload.subject === 'string' ? observation.payload.subject : '';
    const claim = typeof observation.payload.claim === 'string' ? observation.payload.claim : '';
    if (!subject || !claim) return;
    const previous = this.subjectValues.get(subject);
    this.subjectValues.set(subject, { value: claim, modality: observation.modality, sourceId: observation.sourceId, at: now });
    if (!previous || previous.value === claim) return;
    // Different modalities disagreeing on the same subject is the case worth
    // surfacing. Both records are kept; nothing is voted away.
    if (previous.modality === observation.modality) return;
    const disagreement01 = clamp01(
      Math.abs(observation.confidence01 - (previous.at ? observation.confidence01 : observation.confidence01)) * 0.5 +
        (observation.provenance === 'synthetic-fixture' || observation.provenance === 'unresolved' ? 0.25 : 0),
    );
    const conflict: ConflictRecord = {
      id: `conflict-${stableHash(`${subject}:${previous.value}:${claim}:${now}`)}`,
      at: now,
      subject,
      modalityA: previous.modality,
      modalityB: observation.modality,
      sourceA: previous.sourceId,
      sourceB: observation.sourceId,
      claimA: previous.value,
      claimB: claim,
      disagreement01,
      resolution: 'preserved-for-review',
    };
    this.state.conflicts++;
    this.state.recentConflicts = [conflict, ...this.state.recentConflicts].slice(0, CONFLICT_LIMIT);
  }

  private recordRejection(reason: RejectionReason, now: number): void {
    this.state.rejected++;
    this.state.lastAt = now;
    this.state.rejectionReasons[reason] = (this.state.rejectionReasons[reason] ?? 0) + 1;
    if (reason === 'duplicate-observation') this.state.duplicates++;
    if (reason === 'stale-observation' || reason === 'expired-observation') this.state.staleRejections++;
    if (reason === 'raw-media-not-retained') this.state.rawMediaRejections++;
  }

  /** Accepted observations, newest first, optionally filtered. */
  recent(limit = 32, modality?: ObservationModality): CanonicalObservation[] {
    const rows = modality ? this.state.recent.filter((row) => row.modality === modality) : this.state.recent;
    return structuredClone(rows.slice(0, limit));
  }

  conflicts(limit = 16): ConflictRecord[] {
    return structuredClone(this.state.recentConflicts.slice(0, limit));
  }

  /**
   * Accepted observations that may back real-world grounding claims.
   *
   * Synthetic fixtures and provider model output are deliberately excluded: they are
   * evidence *about a model*, not evidence *about the world*.
   */
  groundedObservations(limit = 32): CanonicalObservation[] {
    return structuredClone(this.state.recent.filter((row) => row.isRealCapture).slice(0, limit));
  }

  summary() {
    return {
      admitted: this.state.admitted,
      rejected: this.state.rejected,
      duplicates: this.state.duplicates,
      staleRejections: this.state.staleRejections,
      rawMediaRejections: this.state.rawMediaRejections,
      conflicts: this.state.conflicts,
      rejectionReasons: { ...this.state.rejectionReasons },
      perModality: { ...this.state.perModality },
      perSource: { ...this.state.perSource },
      consent: { ...this.state.consent },
      lastHash: this.state.lastHash,
    };
  }
}
