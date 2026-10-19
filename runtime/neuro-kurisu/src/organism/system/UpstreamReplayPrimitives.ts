/**
 * Upstream-derived replay primitives integrated into Neuro-Kurisu.
 *
 * Sources:
 * - ContinualAI/Avalanche (MIT): ReservoirSamplingBuffer algorithm.
 *   https://github.com/ContinualAI/avalanche/blob/master/avalanche/training/storage_policy.py
 * - thu-ml/Tianshou (MIT): PrioritizedReplayBuffer sampling and importance weights.
 *   https://github.com/thu-ml/tianshou/blob/master/tianshou/data/buffer/prio.py
 * - Schaul et al. (2015), Prioritized Experience Replay.
 *
 * The project intentionally does not vendor LGPL/AGPL code. These helpers are
 * standalone TypeScript implementations of the cited algorithms under the
 * project's own source terms, with attribution retained here.
 */

const clamp01 = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(x) ? x : lo));

/** Small deterministic RNG so replay selection stays reproducible across restarts. */
export function nextReplayRandom(state: number): { state: number; value01: number } {
  let x = state >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  return { state: x || 0x6d2b79f5, value01: (x >>> 0) / 0x100000000 };
}

export interface ReservoirState { capacity: number; seen: number; rngState: number; }

/**
 * Reservoir sampling from Avalanche, specialized for bounded mobile state.
 * Every stream item has equal inclusion probability once the reservoir is full.
 */
export class ReservoirSampler<T> {
  private items: T[] = [];
  private state: ReservoirState;

  constructor(capacity: number, seed = 0x6d2b79f5) {
    this.state = { capacity: Math.max(1, Math.floor(capacity)), seen: 0, rngState: seed >>> 0 || 0x6d2b79f5 };
  }

  restore(items: T[], raw?: Partial<ReservoirState> | null) {
    this.state = {
      ...this.state,
      ...(raw ?? {}),
      capacity: Math.max(1, Math.floor(Number(raw?.capacity ?? this.state.capacity))),
      seen: Math.max(items.length, Math.floor(Number(raw?.seen ?? items.length))),
      rngState: (Number(raw?.rngState ?? this.state.rngState) >>> 0) || 0x6d2b79f5,
    };
    this.items = items.slice(-this.state.capacity);
  }

  push(item: T) {
    this.state.seen += 1;
    if (this.items.length < this.state.capacity) {
      this.items.push(item);
      return { inserted: true, replaced: false, index: this.items.length - 1 };
    }
    const rng = nextReplayRandom(this.state.rngState);
    this.state.rngState = rng.state;
    const index = Math.floor(rng.value01 * this.state.seen);
    if (index >= this.state.capacity) return { inserted: false, replaced: false, index: -1 };
    this.items[index] = item;
    return { inserted: true, replaced: true, index };
  }

  resize(capacity: number) {
    this.state.capacity = Math.max(1, Math.floor(capacity));
    if (this.items.length > this.state.capacity) this.items = this.items.slice(0, this.state.capacity);
  }

  values(): T[] { return this.items.slice(); }
  snapshot(): ReservoirState { return { ...this.state }; }
  size(): number { return this.items.length; }
}

/**
 * Avalanche-inspired balanced exemplar storage. Capacity is shared across
 * observed keys so common actions cannot monopolize long-term replay.
 */
export class BalancedReservoirSampler<T, K extends string> {
  private readonly groups = new Map<K, ReservoirSampler<T>>();
  private seen = 0;
  private readonly capacity: number;
  private readonly keyOf: (item: T) => K;
  private readonly seed: number;

  constructor(capacity: number, keyOf: (item: T) => K, seed = 0x6d2b79f5) {
    this.capacity = Math.max(1, Math.floor(capacity));
    this.keyOf = keyOf;
    this.seed = seed >>> 0 || 0x6d2b79f5;
  }

  push(item: T) {
    const key = this.keyOf(item);
    const created = !this.groups.has(key);
    if (created) this.groups.set(key, new ReservoirSampler<T>(1, (this.seed ^ this.groups.size * 0x9e3779b9) >>> 0));
    this.seen += 1;
    this.trimGroups();
    const group = this.groups.get(key);
    if (!group) return { inserted: false, replaced: false, evictedGroup: true };
    this.resizeGroups();
    return { ...group.push(item), evictedGroup: false };
  }

  restore(items: readonly T[], rawStates: Record<string, ReservoirState> = {}, seen = items.length) {
    this.groups.clear();
    this.seen = Math.max(items.length, Math.floor(Number(seen) || items.length));
    const grouped = new Map<K, T[]>();
    for (const item of items) {
      const key = this.keyOf(item);
      const bucket = grouped.get(key) ?? [];
      bucket.push(item);
      grouped.set(key, bucket);
    }
    for (const [key, bucket] of grouped) {
      const state = rawStates[String(key)];
      const group = new ReservoirSampler<T>(Math.max(1, Math.floor(this.capacity / Math.max(1, grouped.size))), (this.seed ^ grouped.size * 0x9e3779b9) >>> 0);
      group.restore(bucket, state);
      this.groups.set(key, group);
    }
    this.trimGroups();
    this.resizeGroups();
  }

  private trimGroups() {
    while (this.groups.size > this.capacity) {
      const keys = [...this.groups.keys()];
      const selectionState = ((this.seed ^ Math.imul(this.seen, 0x9e3779b9) ^ keys.length) >>> 0) || 0x6d2b79f5;
      const rng = nextReplayRandom(selectionState);
      const victim = keys[Math.min(keys.length - 1, Math.floor(rng.value01 * keys.length))]!;
      this.groups.delete(victim);
    }
  }

  private resizeGroups() {
    const keys = [...this.groups.keys()];
    if (!keys.length) return;
    const base = Math.floor(this.capacity / keys.length);
    let remainder = this.capacity - base * keys.length;
    for (const key of keys) {
      const target = Math.max(1, base + (remainder-- > 0 ? 1 : 0));
      this.groups.get(key)!.resize(target);
    }
  }

  values(): T[] { return [...this.groups.values()].flatMap((group) => group.values()); }
  groupCounts(): Record<string, number> { return Object.fromEntries([...this.groups.entries()].map(([key, group]) => [String(key), group.size()])); }
  groupStates(): Record<string, ReservoirState> { return Object.fromEntries([...this.groups.entries()].map(([key, group]) => [String(key), group.snapshot()])); }
  streamCount(): number { return this.seen; }
}

export interface PrioritizedSample<T> { index: number; item: T; probability01: number; importanceWeight01: number; }

/**
 * Lightweight prioritized replay sampler based on Tianshou's PER contract:
 * p_i = (priority_i + eps)^alpha and w_i = (p_i / p_min)^(-beta).
 *
 * A linear prefix scan is intentionally used here instead of a heavyweight
 * dependency: the organism's replay capacity is currently <= 128 on mobile.
 */
export class PrioritizedReplaySampler<T> {
  readonly alpha: number;
  beta: number;
  readonly epsilon: number;

  constructor(alpha = 0.6, beta = 0.4, epsilon = 1e-6) {
    this.alpha = alpha;
    this.beta = beta;
    this.epsilon = epsilon;
  }

  setBeta(beta: number) {
    this.beta = clamp01(beta);
  }

  sample(items: readonly T[], count: number, priorityOf: (item: T) => number, rngState: number): { state: number; samples: PrioritizedSample<T>[] } {
    if (!items.length || count <= 0) return { state: rngState >>> 0, samples: [] };
    const powers = items.map((item) => Math.pow(Math.max(this.epsilon, Number(priorityOf(item)) || 0), this.alpha));
    const total = powers.reduce((sum, value) => sum + value, 0);
    const positive = total > 0 ? total : items.length;
    const positivePowers = powers.filter((value) => value > 0);
    const minPower = Math.max(this.epsilon, positivePowers.length ? Math.min(...positivePowers) : this.epsilon);
    const picked = new Set<number>();
    const samples: PrioritizedSample<T>[] = [];
    let state = rngState >>> 0 || 0x6d2b79f5;
    const targetCount = Math.min(items.length, Math.floor(count));
    for (let k = 0; k < targetCount; k += 1) {
      let chosen = -1;
      for (let attempt = 0; attempt < 8 && chosen < 0; attempt += 1) {
        const rng = nextReplayRandom(state);
        state = rng.state;
        let cursor = rng.value01 * positive;
        if (total <= 0) cursor = rng.value01 * items.length;
        for (let index = 0; index < powers.length; index += 1) {
          const mass = total > 0 ? powers[index]! : 1;
          cursor -= mass;
          if (cursor <= 0) {
            if (!picked.has(index)) chosen = index;
            break;
          }
        }
      }
      if (chosen < 0) {
        for (let index = 0; index < items.length; index += 1) {
          if (!picked.has(index)) { chosen = index; break; }
        }
      }
      if (chosen < 0) break;
      picked.add(chosen);
      const probability01 = total > 0 ? powers[chosen]! / total : 1 / items.length;
      const importance = Math.pow(Math.max(this.epsilon, powers[chosen]! / minPower), -this.beta);
      samples.push({
        index: chosen,
        item: items[chosen]!,
        probability01,
        importanceWeight01: clamp01(importance),
      });
    }
    const maxWeight = Math.max(...samples.map((sample) => sample.importanceWeight01), 1e-9);
    for (const sample of samples) sample.importanceWeight01 = clamp01(sample.importanceWeight01 / maxWeight);
    return { state, samples };
  }
}

/** DreamerV3-inspired robust scalar transform for noisy learning targets. */
export function symlog(x: number): number {
  const value = Number.isFinite(x) ? x : 0;
  return Math.sign(value) * Math.log1p(Math.abs(value));
}

export function symexp(x: number): number {
  const value = Number.isFinite(x) ? x : 0;
  return Math.sign(value) * Math.expm1(Math.abs(value));
}

export function robustPercentileNormalize(values: readonly number[], value: number, lowQ = 0.05, highQ = 0.95): number {
  if (!values.length) return clamp01(value);
  const ordered = values.slice().sort((a, b) => a - b);
  const pick = (q: number) => ordered[Math.min(ordered.length - 1, Math.max(0, Math.round((ordered.length - 1) * clamp(q, 0, 1))))]!;
  const lo = pick(lowQ);
  const hi = pick(highQ);
  if (Math.abs(hi - lo) < 1e-9) return clamp01(value);
  return clamp01((value - lo) / (hi - lo));
}
