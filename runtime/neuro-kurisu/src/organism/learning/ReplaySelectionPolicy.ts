/** Bounded, deterministic multi-timescale replay selection for continual learning.
 * Adapted conceptually from continual-RL replay research; no upstream source copied.
 * Selection quality is a proxy and must not be confused with measured task improvement.
 */
export interface ReplayCandidate {
  id: string;
  tick: number;
  contextKey: string;
  action: string;
  surprise?: number;
}

export interface ReplaySelectionOptions {
  /** Maximum number of samples returned (hard resource ceiling). */
  maxBatchSize?: number;
  /** Number of newest samples guaranteed a place before historical selection. */
  recentQuota?: number;
}

const finite = (value: number | undefined): number => Number.isFinite(value) ? Number(value) : 0;
const chronological = <T extends ReplayCandidate>(a: T, b: T): number => a.tick - b.tick || a.id.localeCompare(b.id);
const bySurprise = <T extends ReplayCandidate>(a: T, b: T): number =>
  finite(b.surprise) - finite(a.surprise) || chronological(a, b);

/**
 * Keeps a guaranteed recent window, then represents historical context/action strata,
 * and finally fills remaining capacity by surprise with deterministic age/ID tie breaks.
 * Inputs with <= capacity are returned chronologically without sampling.
 */
export function selectReplayBatch<T extends ReplayCandidate>(
  input: readonly T[],
  options: ReplaySelectionOptions = {},
): T[] {
  const maxBatchSize = Math.max(1, Math.min(512, Math.floor(finite(options.maxBatchSize ?? 64)) || 64));
  const recentQuota = Math.max(0, Math.min(maxBatchSize, Math.floor(finite(options.recentQuota ?? Math.floor(maxBatchSize / 2)))));
  const ordered = [...input].sort(chronological);
  const unique = new Map<string, T>();
  for (const item of ordered) if (!unique.has(item.id)) unique.set(item.id, item);
  const candidates = [...unique.values()];
  if (candidates.length <= maxBatchSize) return candidates;
  if (recentQuota >= maxBatchSize) return candidates.slice(-maxBatchSize);

  const recent = recentQuota === 0 ? [] : candidates.slice(-recentQuota);
  const historical = recentQuota === 0 ? candidates : candidates.slice(0, -recentQuota);
  const strata = new Map<string, T[]>();
  for (const item of historical) {
    const key = `${item.contextKey}|${item.action}`;
    const group = strata.get(key) ?? [];
    group.push(item);
    strata.set(key, group);
  }

  const selected = new Map<string, T>();
  for (const item of recent) selected.set(item.id, item);
  const representatives = [...strata.values()].map(group => [...group].sort(bySurprise)[0]).sort(bySurprise);
  for (const item of representatives) {
    if (selected.size >= maxBatchSize) break;
    selected.set(item.id, item);
  }
  if (selected.size < maxBatchSize) {
    for (const item of [...historical].sort(bySurprise)) {
      if (selected.size >= maxBatchSize) break;
      selected.set(item.id, item);
    }
  }
  return [...selected.values()].sort(chronological);
}
