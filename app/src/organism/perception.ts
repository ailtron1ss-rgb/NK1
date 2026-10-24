/**
 * Canonical perception boundary for the organism.
 *
 * This module deliberately separates raw observations from beliefs:
 * inputs are untrusted, time-bounded evidence; callers must not promote
 * them directly to facts without verification and provenance.
 */
export type PerceptionModality =
  | "text" | "audio" | "vision" | "environment" | "memory" | "tool";

export type ObservationStatus = "current" | "stale" | "invalid";

export interface WorldObservation {
  /** Stable source event ID; repeated delivery must be idempotent. */
  id: string;
  source: string;
  modality: PerceptionModality;
  subject: string;
  predicate: string;
  value: string | number | boolean;
  observedAt: number;
  receivedAt: number;
  confidence: number;
  /** Optional source lineage. Never inferred from the content itself. */
  parentIds?: string[];
  /** Optional unit for numeric observations (e.g. ms, °C, metres). */
  unit?: string;
}

export interface NormalizedObservation extends WorldObservation {
  confidence: number;
  status: ObservationStatus;
  ageMs: number;
  freshness: number;
}

export interface WorldClaim {
  subject: string;
  predicate: string;
  value: string | number | boolean;
  confidence: number;
  supportingObservationIds: string[];
  conflictingObservationIds: string[];
  status: "supported" | "uncertain" | "conflicted";
}

export interface PerceptionPolicy {
  maxAgeMs: number;
  futureClockSkewMs: number;
  halfLifeMs: number;
  minConfidence: number;
  maxParentIds: number;
}

const DEFAULT_POLICY: PerceptionPolicy = {
  maxAgeMs: 5 * 60_000,
  futureClockSkewMs: 30_000,
  halfLifeMs: 60_000,
  minConfidence: 0.05,
  maxParentIds: 32,
};

const finite = (value: number): boolean => Number.isFinite(value);
const bounded01 = (value: number): number => Math.max(0, Math.min(1, value));
const cleanText = (value: string): string => value.normalize("NFKC").trim();

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "boolean"
    || (typeof value === "string" && cleanText(value).length > 0 && cleanText(value).length <= 4096)
    || (typeof value === "number" && finite(value));
}

/** Reject malformed evidence instead of silently repairing its provenance. */
export function normalizeObservation(
  input: WorldObservation,
  now: number,
  policy: Partial<PerceptionPolicy> = {},
): NormalizedObservation {
  const p = { ...DEFAULT_POLICY, ...policy };
  const invalid = (): NormalizedObservation => ({
    ...input,
    confidence: 0,
    status: "invalid",
    ageMs: 0,
    freshness: 0,
  });

  if (!input || typeof input !== "object" || !finite(now)
    || typeof input.id !== "string" || !cleanText(input.id)
    || typeof input.source !== "string" || !cleanText(input.source)
    || typeof input.subject !== "string" || !cleanText(input.subject)
    || typeof input.predicate !== "string" || !cleanText(input.predicate)
    || !isScalar(input.value)
    || !finite(input.observedAt) || !finite(input.receivedAt)
    || !finite(input.confidence)
    || !["text", "audio", "vision", "environment", "memory", "tool"].includes(input.modality)
    || (input.parentIds !== undefined && (!Array.isArray(input.parentIds)
      || input.parentIds.length > p.maxParentIds
      || input.parentIds.some(id => typeof id !== "string" || !cleanText(id))
      || new Set(input.parentIds.map(cleanText)).size !== input.parentIds.length))) {
    return invalid();
  }

  const observedAt = input.observedAt;
  const ageMs = Math.max(0, now - observedAt);
  const future = observedAt > now + p.futureClockSkewMs;
  const status: ObservationStatus = future ? "invalid" : ageMs > p.maxAgeMs ? "stale" : "current";
  const freshness = status === "current"
    ? Math.exp((-Math.LN2 * ageMs) / Math.max(1, p.halfLifeMs))
    : 0;

  return {
    ...input,
    id: cleanText(input.id),
    source: cleanText(input.source),
    subject: cleanText(input.subject),
    predicate: cleanText(input.predicate),
    confidence: status === "invalid" ? 0 : bounded01(input.confidence),
    parentIds: input.parentIds?.map(cleanText),
    status,
    ageMs,
    freshness,
  };
}

/**
 * Fuse observations for the same subject/predicate.
 * Independent sources add support; duplicate source-event IDs do not.
 * Opposing values are surfaced as conflicts rather than averaged away.
 */
export function buildWorldClaims(
  observations: readonly NormalizedObservation[],
  minConfidence = DEFAULT_POLICY.minConfidence,
): WorldClaim[] {
  const groups = new Map<string, NormalizedObservation[]>();
  const seenIds = new Set<string>();

  for (const item of observations) {
    if (item.status !== "current" || item.confidence < minConfidence || seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    const key = JSON.stringify([item.subject, item.predicate]);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  const claims: WorldClaim[] = [];
  for (const group of groups.values()) {
    const values = new Map<string, NormalizedObservation[]>();
    for (const item of group) {
      const key = JSON.stringify([typeof item.value, item.value, item.unit ?? null]);
      const bucket = values.get(key) ?? [];
      bucket.push(item);
      values.set(key, bucket);
    }

    const ranked = [...values.values()].map(items => ({
      items,
      weight: 1 - items.reduce((remaining, item) =>
        remaining * (1 - bounded01(item.confidence * item.freshness)), 1),
    })).sort((a, b) => b.weight - a.weight);
    const winner = ranked[0];
    if (!winner) continue;
    const support = winner.items.map(item => item.id);
    const conflicts = ranked.slice(1).flatMap(bucket => bucket.items.map(item => item.id));
    const confidence = bounded01(winner.weight * (conflicts.length ? 0.65 : 1));

    claims.push({
      subject: winner.items[0].subject,
      predicate: winner.items[0].predicate,
      value: winner.items[0].value,
      confidence,
      supportingObservationIds: support,
      conflictingObservationIds: conflicts,
      status: conflicts.length > 0 ? "conflicted" : confidence >= 0.7 ? "supported" : "uncertain",
    });
  }
  return claims;
}

/** Return only claims safe to expose as the current working world model. */
export function currentWorldModel(
  observations: readonly WorldObservation[],
  now: number,
  policy: Partial<PerceptionPolicy> = {},
): WorldClaim[] {
  return buildWorldClaims(observations.map(item => normalizeObservation(item, now, policy)));
}
