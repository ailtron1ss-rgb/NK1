/**
 * Runtime Evidence Bus — bounded integration spine for external outcomes.
 *
 * This is deliberately not a second event store. The durable operational
 * journal remains authoritative; this bus provides a bounded, normalized view
 * that can safely be snapshotted for diagnostics and recovery.
 */
export type RuntimeEvidenceKind =
  | 'observation'
  | 'prediction'
  | 'action'
  | 'outcome'
  | 'resource'
  | 'model'
  | 'goal'
  | 'contradiction';

const EVIDENCE_KINDS: readonly RuntimeEvidenceKind[] = [
  'observation', 'prediction', 'action', 'outcome',
  'resource', 'model', 'goal', 'contradiction',
];
const DEFAULT_CAPACITY = 384;
const MIN_CAPACITY = 128;
const MAX_CAPACITY = 4096;
const MAX_PARENT_IDS = 8;
const MAX_PAYLOAD_DEPTH = 4;
const MAX_PAYLOAD_KEYS = 48;
const MAX_PAYLOAD_ARRAY_ITEMS = 32;
const MAX_PAYLOAD_STRING_CHARS = 2048;
const MAX_PAYLOAD_BUDGET = 16_384;

export interface RuntimeEvidenceEvent {
  id: string;
  at: number;
  tick: number;
  kind: RuntimeEvidenceKind;
  source: string;
  confidence01: number;
  external01: boolean;
  parentIds: string[];
  payload: Record<string, unknown>;
  /** True when the payload was safely bounded before entering the bus. */
  payloadTruncated?: boolean;
}

export interface RuntimeEvidenceSnapshot {
  version: 2;
  capacity: number;
  total: number;
  /** Lifetime event counts, retained across restore where valid. */
  externalCount: number;
  byKind: Record<RuntimeEvidenceKind, number>;
  recent: RuntimeEvidenceEvent[];
  linkedParentEvents: number;
  danglingParentLinks: number;
  lineageIntegrity01: number;
  coverage01: number;
  recentWindowTicks: number;
  /** Monotonic local event sequence. Optional for backward compatibility. */
  sequence?: number;
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const isKind = (v: unknown): v is RuntimeEvidenceKind =>
  typeof v === 'string' && EVIDENCE_KINDS.includes(v as RuntimeEvidenceKind);

const emptyCounts = (): Record<RuntimeEvidenceKind, number> => ({
  observation: 0, prediction: 0, action: 0, outcome: 0,
  resource: 0, model: 0, goal: 0, contradiction: 0,
});

function nonNegativeInteger(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : fallback;
}

function boundedString(value: unknown, fallback: string, maxChars: number): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxChars) : fallback;
}

interface PayloadBudget { remaining: number; truncated: boolean; }

function sanitizePayloadValue(value: unknown, budget: PayloadBudget, depth: number): unknown {
  if (value === null || typeof value === 'boolean') {
    budget.remaining -= 5;
    return value;
  }
  if (typeof value === 'number') {
    budget.remaining -= 24;
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const clipped = value.length > MAX_PAYLOAD_STRING_CHARS
      ? value.slice(0, MAX_PAYLOAD_STRING_CHARS)
      : value;
    if (clipped.length !== value.length) budget.truncated = true;
    if (clipped.length > budget.remaining) {
      budget.truncated = true;
      const safe = clipped.slice(0, Math.max(0, budget.remaining));
      budget.remaining = 0;
      return safe;
    }
    budget.remaining -= clipped.length;
    return clipped;
  }
  if (budget.remaining <= 0 || depth >= MAX_PAYLOAD_DEPTH) {
    budget.truncated = true;
    return null;
  }
  if (Array.isArray(value)) {
    const safe: unknown[] = [];
    const limit = Math.min(value.length, MAX_PAYLOAD_ARRAY_ITEMS);
    if (value.length > limit) budget.truncated = true;
    for (let i = 0; i < limit && budget.remaining > 0; i += 1) {
      safe.push(sanitizePayloadValue(value[i], budget, depth + 1));
    }
    if (safe.length < limit) budget.truncated = true;
    return safe;
  }
  if (isRecord(value)) {
    // Avoid invoking getters or copying class instances into persisted evidence.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      budget.truncated = true;
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const entries = Object.entries(descriptors).filter(([key, descriptor]) =>
      !['__proto__', 'prototype', 'constructor'].includes(key) &&
      Object.prototype.hasOwnProperty.call(descriptor, 'value'));
    if (entries.length !== Object.keys(descriptors).length) budget.truncated = true;
    const safe: Record<string, unknown> = Object.create(null);
    const limit = Math.min(entries.length, MAX_PAYLOAD_KEYS);
    if (entries.length > limit) budget.truncated = true;
    for (const [key, descriptor] of entries.slice(0, limit)) {
      if (budget.remaining <= 0) { budget.truncated = true; break; }
      budget.remaining -= key.length;
      if (budget.remaining < 0) { budget.truncated = true; break; }
      safe[key] = sanitizePayloadValue(descriptor.value, budget, depth + 1);
    }
    return safe;
  }
  // functions, symbols, bigint and other opaque runtime values are not evidence.
  budget.truncated = true;
  return null;
}

function sanitizePayload(raw: unknown): { payload: Record<string, unknown>; truncated: boolean } {
  const budget: PayloadBudget = { remaining: MAX_PAYLOAD_BUDGET, truncated: false };
  if (!isRecord(raw)) {
    return { payload: {}, truncated: raw !== undefined && raw !== null };
  }
  const payload = sanitizePayloadValue(raw, budget, 0);
  return {
    payload: isRecord(payload) ? payload : {},
    truncated: budget.truncated,
  };
}

function normalizeParentIds(raw: unknown, eventId?: string): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const id = item.trim().slice(0, 180);
    if (!id || id === eventId || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= MAX_PARENT_IDS) break;
  }
  return result;
}

function parseSequenceFromId(id: string): number {
  // IDs from earlier versions used randomness; those simply return zero here.
  const match = /^reb:\d+:([1-9]\d*):[a-z-]+$/.exec(id);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) ? n : 0;
}

export class RuntimeEvidenceBus {
  private readonly capacity: number;
  private events: RuntimeEvidenceEvent[] = [];
  private kindCounts = emptyCounts();
  private externalCount = 0;
  private total = 0;
  private sequence = 0;

  constructor(capacity = DEFAULT_CAPACITY) {
    const requested = Number.isFinite(capacity) ? Math.floor(capacity) : DEFAULT_CAPACITY;
    this.capacity = Math.max(MIN_CAPACITY, Math.min(MAX_CAPACITY, requested));
  }

  publish(input: {
    tick: number;
    kind: RuntimeEvidenceKind;
    source: string;
    confidence01?: number;
    external01?: boolean;
    parentIds?: string[];
    payload?: Record<string, unknown>;
    at?: number;
  }): RuntimeEvidenceEvent {
    if (!isKind(input?.kind)) throw new TypeError('runtime evidence kind is invalid');
    if (!Number.isFinite(input.tick) || input.tick < 0) {
      throw new RangeError('runtime evidence tick must be a finite non-negative number');
    }

    const tick = Math.floor(input.tick);
    const at = Number.isFinite(input.at) && Number(input.at) >= 0 ? Number(input.at) : Date.now();
    // Sequence-based IDs are reproducible and remain unique after compatible restore.
    this.sequence = Math.max(this.sequence + 1, this.total + 1);
    const id = `reb:${tick}:${this.sequence}:${input.kind}`;
    const sanitized = sanitizePayload(input.payload ?? {});
    const event: RuntimeEvidenceEvent = {
      id,
      at,
      tick,
      kind: input.kind,
      source: boundedString(input.source, 'unknown', 120),
      confidence01: clamp01(input.confidence01 ?? 0.5),
      external01: input.external01 === true,
      parentIds: normalizeParentIds(input.parentIds, id),
      payload: sanitized.payload,
      ...(sanitized.truncated ? { payloadTruncated: true } : {}),
    };

    this.events.unshift(event);
    if (this.events.length > this.capacity) this.events.length = this.capacity;
    this.kindCounts[event.kind] += 1;
    if (event.external01) this.externalCount += 1;
    this.total += 1;
    return structuredClone(event);
  }

  restore(raw?: Partial<RuntimeEvidenceSnapshot> | null): void {
    const requestedCapacity = nonNegativeInteger(raw?.capacity, this.capacity);
    const maxToKeep = Math.max(MIN_CAPACITY, Math.min(this.capacity, MAX_CAPACITY, requestedCapacity || this.capacity));
    const rawEvents = Array.isArray(raw?.recent) ? raw.recent : [];
    const seenIds = new Set<string>();
    const normalized: RuntimeEvidenceEvent[] = [];
    let parsedSequence = 0;

    for (const candidate of rawEvents) {
      if (!isRecord(candidate)) continue;
      const id = boundedString(candidate.id, '', 180);
      const kind = candidate.kind;
      const tick = Number(candidate.tick);
      const at = Number(candidate.at);
      if (!id || !isKind(kind) || !Number.isFinite(tick) || tick < 0 ||
          !Number.isFinite(at) || at < 0 || seenIds.has(id)) continue;
      seenIds.add(id);
      parsedSequence = Math.max(parsedSequence, parseSequenceFromId(id));
      const sanitized = sanitizePayload(candidate.payload ?? {});
      const parents = normalizeParentIds(candidate.parentIds, id);
      normalized.push({
        id,
        at,
        tick: Math.floor(tick),
        kind,
        source: boundedString(candidate.source, 'unknown', 120),
        confidence01: clamp01(typeof candidate.confidence01 === 'number' ? candidate.confidence01 : 0),
        external01: candidate.external01 === true,
        parentIds: parents,
        payload: sanitized.payload,
        ...((candidate.payloadTruncated === true || sanitized.truncated) ? { payloadTruncated: true } : {}),
      });
      if (normalized.length >= maxToKeep) break;
    }

    // `recent` is newest-first; preserve that order and reject duplicate/malformed rows.
    this.events = normalized;
    const rawTotal = nonNegativeInteger(raw?.total, normalized.length);
    const candidateCounts = isRecord(raw?.byKind) ? raw!.byKind as Record<string, unknown> : null;
    const restoredCounts = emptyCounts();
    let countsValid = Boolean(candidateCounts);
    if (candidateCounts) {
      for (const kind of EVIDENCE_KINDS) {
        const count = candidateCounts[kind];
        if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
          countsValid = false;
          break;
        }
        restoredCounts[kind] = count;
      }
    }
    const restoredSum = Object.values(restoredCounts).reduce((sum, n) => sum + n, 0);
    countsValid = countsValid && restoredSum === rawTotal;

    if (countsValid) {
      this.kindCounts = restoredCounts;
      this.total = rawTotal;
      this.externalCount = Math.min(rawTotal, nonNegativeInteger(raw?.externalCount, 0));
    } else {
      this.kindCounts = emptyCounts();
      this.externalCount = 0;
      for (const event of this.events) {
        this.kindCounts[event.kind] += 1;
        if (event.external01) this.externalCount += 1;
      }
      this.total = this.events.length;
    }
    const rawSequence = nonNegativeInteger(raw?.sequence, 0);
    this.sequence = Math.max(this.total, rawSequence, parsedSequence);
  }

  recent(limit = 64): RuntimeEvidenceEvent[] {
    const safeLimit = Number.isFinite(limit) ? Math.floor(limit) : 64;
    return structuredClone(this.events.slice(0, Math.max(1, Math.min(256, safeLimit))));
  }

  metrics() {
    const latest = this.events[0]?.tick ?? 0;
    const oldest = this.events.at(-1)?.tick ?? latest;
    const bufferedByKind = emptyCounts();
    let bufferedExternalCount = 0;
    for (const event of this.events) {
      bufferedByKind[event.kind] += 1;
      if (event.external01) bufferedExternalCount += 1;
    }
    return {
      total: this.total,
      buffered: this.events.length,
      capacity: this.capacity,
      latestTick: latest,
      bufferedTickSpan: Math.max(0, latest - oldest),
      externalCount: this.externalCount,
      bufferedExternalCount,
      byKind: { ...this.kindCounts },
      bufferedByKind,
      sequence: this.sequence,
    };
  }

  snapshot(): RuntimeEvidenceSnapshot {
    const known = new Set(this.events.map((e) => e.id));
    let linked = 0;
    let dangling = 0;
    for (const event of this.events) {
      for (const parentId of event.parentIds) {
        if (known.has(parentId)) linked += 1;
        else dangling += 1;
      }
    }
    const maxTick = this.events[0]?.tick ?? 0;
    const minTick = this.events.at(-1)?.tick ?? maxTick;
    const span = Math.max(0, maxTick - minTick);
    const coverage = clamp01(this.events.length / Math.max(1, Math.min(this.capacity, 96)));
    return {
      version: 2,
      capacity: this.capacity,
      total: this.total,
      externalCount: this.externalCount,
      byKind: { ...this.kindCounts },
      recent: this.recent(48),
      linkedParentEvents: linked,
      danglingParentLinks: dangling,
      lineageIntegrity01: clamp01(linked / (linked + dangling || 1)),
      coverage01: coverage,
      recentWindowTicks: span,
      sequence: this.sequence,
    };
  }
}
