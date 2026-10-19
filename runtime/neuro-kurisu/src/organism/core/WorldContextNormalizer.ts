import type { WorldContext } from './types.ts';

const clamp01 = (x: unknown, fallback = 0) => {
  const n = Number(x);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
};

/**
 * Canonical boundary for externally supplied world observations.
 * Partial/malformed observations are normal in an embodied runtime: a sensor
 * can be absent, stale or only provide one modality. Downstream world models
 * should therefore consume one safe shape rather than defensively branching
 * on every field themselves.
 */
export function normalizeWorldContext(raw?: Partial<WorldContext> | null, defaults: { tick?: number; at?: number } = {}): WorldContext | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const objects = Array.isArray(raw.objects) ? raw.objects.slice(0, 128).map((o, i) => ({
    id: String(o?.id ?? `object:${i}`),
    label: String(o?.label ?? 'unknown').slice(0, 180),
    location: String(o?.location ?? raw.location ?? 'unknown').slice(0, 180),
    value: clamp01(o?.value, 0),
    visible: Boolean(o?.visible),
    collected: Boolean(o?.collected),
    ...(o?.confidence01 !== undefined ? { confidence01: clamp01(o.confidence01, 0) } : {}),
    ...(o?.evidenceKind ? { evidenceKind: o.evidenceKind } : {}),
    ...(o?.sourceId ? { sourceId: String(o.sourceId).slice(0, 120) } : {}),
  })) : [];
  const facts = Array.isArray(raw.facts) ? raw.facts.map(String).slice(-192) : [];
  const events = Array.isArray(raw.events) ? raw.events.map(String).slice(-64) : [];
  return {
    tick: Number.isFinite(Number(raw.tick)) ? Number(raw.tick) : Number(defaults.tick ?? 0),
    location: String(raw.location ?? 'unknown').slice(0, 180),
    energy: clamp01(raw.energy, 0.5),
    attention: clamp01(raw.attention, 0.5),
    uncertainty: clamp01(raw.uncertainty, 1),
    facts,
    objects,
    events,
  };
}
