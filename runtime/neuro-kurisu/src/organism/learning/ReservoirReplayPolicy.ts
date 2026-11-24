/** Uniform bounded reservoir baseline for continual-learning replay experiments.
 * Implements Algorithm R with an explicit seed so runs are reproducible.
 * It is a comparator, not a production default: uniform sampling may under-represent
 * recent distribution shifts and rare context/action strata.
 */
export interface ReservoirCandidate {
  id: string;
  tick: number;
  contextKey: string;
  action: string;
  surprise?: number;
}

export interface ReservoirOptions {
  capacity?: number;
  seed?: number;
}

function stableTick(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function seededRandom(seed: number): () => number {
  let state = (Number.isFinite(seed) ? Math.trunc(seed) : 1) >>> 0;
  return () => {
    // Mulberry32: compact deterministic PRNG; seed is for experiment repeatability,
    // not cryptographic use.
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Return a uniform sample without replacement, in chronological output order.
 * Duplicate IDs are ignored (first occurrence wins) so duplicate ingestion cannot
 * overweight one experience. Capacity is clamped to [0, 512].
 */
export function selectReservoirBatch<T extends ReservoirCandidate>(
  input: readonly T[],
  options: ReservoirOptions = {},
): T[] {
  const rawCapacity = options.capacity === undefined ? 64 : Math.floor(Number.isFinite(options.capacity) ? options.capacity : 64);
  const capacity = Math.max(0, Math.min(512, rawCapacity));
  if (capacity === 0 || input.length === 0) return [];
  const seen = new Set<string>();
  const random = seededRandom(options.seed ?? 1);
  const reservoir: T[] = [];
  let eligibleCount = 0;
  for (const item of input) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    eligibleCount += 1;
    if (reservoir.length < capacity) {
      reservoir.push(item);
      continue;
    }
    const slot = Math.floor(random() * eligibleCount);
    if (slot < capacity) reservoir[slot] = item;
  }
  return reservoir.sort((a, b) => stableTick(a.tick) - stableTick(b.tick) || a.id.localeCompare(b.id));
}
