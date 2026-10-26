/**
 * Hexis-inspired evidence ingress adapter for NK1.
 *
 * This is an adapter contract, not a second memory store and not a persistence
 * layer. It preserves provenance and makes duplicate evidence explicit before
 * an existing NK1 memory/learning authority decides whether to revise a belief.
 */
export type HexisEvidenceStance = "supports" | "contradicts" | "contextualizes";
export type HexisEvidenceSource = {
  kind: string;
  ref: string;
  label?: string;
  author?: string;
};
export type HexisEvidenceInput = {
  memoryId: string;
  evidenceId: string;
  stance: HexisEvidenceStance;
  source: HexisEvidenceSource;
  observedAt: string;
  confidence: number;
  note?: string;
  protectedMemory?: boolean;
};
export type CanonicalHexisEvidence = Readonly<{
  schema: "nk1.hexis-evidence.v1";
  memoryId: string;
  evidenceId: string;
  stance: HexisEvidenceStance;
  source: Readonly<{ kind: string; ref: string; label?: string; author?: string }>;
  observedAt: string;
  confidence: number;
  note?: string;
  protectedMemory: boolean;
  idempotencyKey: string;
}>;
export type EvidenceIngressResult =
  | { accepted: true; duplicate: false; evidence: CanonicalHexisEvidence }
  | { accepted: true; duplicate: true; evidence: CanonicalHexisEvidence }
  | { accepted: false; reason: string };

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/;
const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
const MAX_TEXT = 4096;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Read only own data properties; caller-controlled getters are never executed. */
function dataSnapshot(value: unknown, allowed: readonly string[]): Record<string, unknown> | null {
  try {
    if (!isRecord(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const allowedKeys = new Set(allowed);
    const ownKeys = Reflect.ownKeys(descriptors);
    // Keep this boundary schema-strict: unknown and symbol keys are not silently
    // discarded, and accessor properties are never evaluated.
    for (const key of ownKeys) {
      if (typeof key !== "string" || !allowedKeys.has(key)) return null;
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor)) return null;
    }
    const result: Record<string, unknown> = Object.create(null);
    for (const key of allowed) {
      const descriptor = descriptors[key];
      if (!descriptor) continue;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    // Proxies can throw from getPrototypeOf / ownKeys / descriptor traps.
    // Treat that as malformed untrusted ingress rather than crashing the caller.
    return null;
  }
}

function cleanText(value: unknown, max = MAX_TEXT): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f-\u009f]/.test(normalized)) return undefined;
  return normalized;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && ID_RE.test(value) && value.trim() === value;
}

/**
 * Canonicalizes a Hexis-style provenance/evidence envelope for NK1.
 * Existing evidence IDs are supplied by the caller's authoritative ledger;
 * the adapter does not persist, promote, or mutate a memory.
 */
export function adaptHexisEvidence(
  input: unknown,
  knownEvidenceIds: ReadonlySet<string> = new Set<string>(),
): EvidenceIngressResult {
  const row = dataSnapshot(input, [
    "memoryId", "evidenceId", "stance", "source", "observedAt",
    "confidence", "note", "protectedMemory",
  ]);
  if (!row) return { accepted: false, reason: "invalid-evidence-envelope" };
  if (!validId(row.memoryId) || !validId(row.evidenceId)) {
    return { accepted: false, reason: "invalid-evidence-identity" };
  }
  if (row.stance !== "supports" && row.stance !== "contradicts" && row.stance !== "contextualizes") {
    return { accepted: false, reason: "invalid-evidence-stance" };
  }
  if (typeof row.confidence !== "number" || !Number.isFinite(row.confidence) || row.confidence < 0 || row.confidence > 1) {
    return { accepted: false, reason: "invalid-evidence-confidence" };
  }
  if (row.protectedMemory !== undefined && typeof row.protectedMemory !== "boolean") {
    return { accepted: false, reason: "invalid-protected-memory-flag" };
  }
  const observedAt = cleanText(row.observedAt, 64);
  if (!observedAt || !Number.isFinite(Date.parse(observedAt))) {
    return { accepted: false, reason: "invalid-evidence-timestamp" };
  }
  const sourceRow = dataSnapshot(row.source, ["kind", "ref", "label", "author"]);
  if (!sourceRow) return { accepted: false, reason: "invalid-evidence-source" };
  const kind = cleanText(sourceRow.kind, 96);
  const ref = cleanText(sourceRow.ref, 512);
  if (!kind || !TOKEN_RE.test(kind) || !ref) return { accepted: false, reason: "invalid-evidence-source-identity" };
  const label = sourceRow.label === undefined ? undefined : cleanText(sourceRow.label, 256);
  const author = sourceRow.author === undefined ? undefined : cleanText(sourceRow.author, 256);
  if ((sourceRow.label !== undefined && !label) || (sourceRow.author !== undefined && !author)) {
    return { accepted: false, reason: "invalid-evidence-source-metadata" };
  }
  const note = row.note === undefined ? undefined : cleanText(row.note, 2048);
  if (row.note !== undefined && !note) return { accepted: false, reason: "invalid-evidence-note" };

  const evidence: CanonicalHexisEvidence = Object.freeze({
    schema: "nk1.hexis-evidence.v1",
    memoryId: row.memoryId,
    evidenceId: row.evidenceId,
    stance: row.stance,
    source: Object.freeze({ kind, ref, ...(label ? { label } : {}), ...(author ? { author } : {}) }),
    observedAt: new Date(observedAt).toISOString(),
    confidence: row.confidence,
    ...(note ? { note } : {}),
    protectedMemory: row.protectedMemory === true,
    idempotencyKey: `${row.memoryId.length}:${row.memoryId}${row.evidenceId.length}:${row.evidenceId}`,
  });
  try {
    if (knownEvidenceIds.has(evidence.idempotencyKey) || knownEvidenceIds.has(row.evidenceId)) {
      return { accepted: true, duplicate: true, evidence };
    }
  } catch {
    return { accepted: false, reason: "invalid-evidence-dedupe-index" };
  }
  return { accepted: true, duplicate: false, evidence };
}
