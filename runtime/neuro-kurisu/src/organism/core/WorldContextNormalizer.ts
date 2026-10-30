import type { WorldContext } from './types.ts';

const clamp01 = (value: unknown, fallback = 0): number => {
  let numeric: number;
  if (typeof value === 'number') numeric = value;
  else if (typeof value === 'string' && value.trim() !== '') numeric = Number(value);
  else return fallback;
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : fallback;
};

const isFiniteNumeric = (value: unknown): boolean => {
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value));
};

const finiteNumber = (value: unknown, fallback: number): number => {
  let numeric: number;
  if (typeof value === 'number') numeric = value;
  else if (typeof value === 'string' && value.trim() !== '') numeric = Number(value);
  else return fallback;
  return Number.isFinite(numeric) ? numeric : fallback;
};

const safeString = (value: unknown, fallback: string, maxLength: number): string => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.normalize('NFKC').trim();
  return normalized ? normalized.slice(0, maxLength) : fallback;
};

const stringList = (value: unknown, limit: number, maxLength: number): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.normalize('NFKC').trim())
    .filter(Boolean)
    .map(item => item.slice(0, maxLength))
    .slice(-limit);
};

const EVIDENCE_KINDS = new Set(['observed', 'model-output', 'derived', 'conflict', 'unresolved']);

/**
 * Canonical boundary for externally supplied world observations.
 * Missing/malformed values must remain unknown instead of being coerced into
 * observations (e.g. Number(null) === 0 and Boolean("false") === true).
 */
export function normalizeWorldContext(
  raw?: Partial<WorldContext> | null,
  defaults: { tick?: number; at?: number } = {},
): WorldContext | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;

  const fallbackTick = finiteNumber(defaults.tick, 0);
  const rawLocation = safeString(raw.location, 'unknown', 180);
  const objects = Array.isArray(raw.objects)
    ? raw.objects.slice(0, 128).map((object, index) => {
      const candidate = object as unknown as Record<string, unknown> | null;
      const id = safeString(candidate?.id, `object:${index}`, 120);
      const label = safeString(candidate?.label, 'unknown', 180);
      const sourceId = safeString(candidate?.sourceId, '', 120);
      const evidenceKind = typeof candidate?.evidenceKind === 'string'
        && EVIDENCE_KINDS.has(candidate.evidenceKind)
        ? candidate.evidenceKind as 'observed' | 'model-output' | 'derived' | 'conflict' | 'unresolved'
        : undefined;
      const objectLocation = safeString(candidate?.location, rawLocation, 180);
      const confidence = isFiniteNumeric(candidate?.confidence01)
        ? clamp01(candidate?.confidence01, 0)
        : undefined;
      // A producer may explicitly state that a placeholder value is unknown.
      // Do not turn its numeric storage sentinel (for example 0) into a fact.
      const valueKnown = candidate?.valueKnown === false ? false : isFiniteNumeric(candidate?.value);
      const visibilityKnown = candidate?.visibilityKnown === false ? false : typeof candidate?.visible === 'boolean';
      const collectionKnown = candidate?.collectionKnown === false ? false : typeof candidate?.collected === 'boolean';

      return {
        id,
        label,
        location: objectLocation,
        value: valueKnown ? clamp01(candidate?.value, 0) : 0,
        valueKnown,
        visible: candidate?.visible === true,
        visibilityKnown,
        collected: candidate?.collected === true,
        collectionKnown,
        ...(confidence !== undefined ? { confidence01: confidence } : {}),
        ...(evidenceKind ? { evidenceKind } : {}),
        ...(sourceId ? { sourceId } : {}),
      };
    })
    : [];

  const tick = finiteNumber(raw.tick, fallbackTick);
  return {
    tick,
    location: rawLocation,
    energy: clamp01(raw.energy, 0.5),
    attention: clamp01(raw.attention, 0.5),
    uncertainty: clamp01(raw.uncertainty, 1),
    facts: stringList(raw.facts, 192, 512),
    objects,
    events: stringList(raw.events, 64, 512),
  };
}
