/**
 * Assimilation of `research/neurocore-v143/src/neurocore/current/adaptive_compute.py`
 * (bounded adaptive compute policy) into the NK1 runtime.
 *
 * Potential benefit: on Termux/mobile the expensive part of a maintenance pass is not the
 * scoring itself but running the *full* evaluation for every candidate. This selector turns
 * a difficulty signal into a boolean mask with hard bounds: at least `minimumDeepFraction`
 * and at most `maximumDeepFraction` of a batch may take the expensive path. The threshold is
 * the semantic trigger, the fraction bounds are the resource contract, and ties break by
 * index so a run is reproducible.
 *
 * Deliberately distinct from `AdaptiveComputeGovernor` (BIG PASS 209), which produces a
 * scalar budget/sparsity plan for the whole tick. This module answers a different question:
 * *which items in a batch* may take the expensive path.
 */
export interface DeepWorkConfig {
  shallowThreshold01?: number;
  deltaWeight?: number;
  entropyWeight?: number;
  minimumDeepFraction01?: number;
  maximumDeepFraction01?: number;
  forceFirstDeep?: boolean;
}

export interface DeepWorkSelection {
  mask: boolean[];
  deepCount: number;
  deepFraction01: number;
  reason: 'empty' | 'forced' | 'threshold' | 'raised-to-minimum' | 'capped-at-maximum';
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));

export class DeepWorkSelector {
  private readonly threshold: number;
  private readonly deltaWeight: number;
  private readonly entropyWeight: number;
  private readonly minimumFraction: number;
  private readonly maximumFraction: number;
  private readonly forceFirstDeep: boolean;

  constructor(config: DeepWorkConfig = {}) {
    this.threshold = clamp01(Number(config.shallowThreshold01 ?? 0.22));
    const deltaWeight = Math.max(0, Number(config.deltaWeight ?? 0.7));
    const entropyWeight = Math.max(0, Number(config.entropyWeight ?? 0.3));
    const total = deltaWeight + entropyWeight;
    this.deltaWeight = total > 0 ? deltaWeight / total : 0.7;
    this.entropyWeight = total > 0 ? entropyWeight / total : 0.3;
    const min = clamp01(Number(config.minimumDeepFraction01 ?? 0.05));
    const max = clamp01(Number(config.maximumDeepFraction01 ?? 0.95));
    this.minimumFraction = Math.min(min, max);
    this.maximumFraction = Math.max(min, max);
    this.forceFirstDeep = config.forceFirstDeep ?? true;
  }

  /**
   * Bounded difficulty in [0,1] from quantities the caller already has: the magnitude of
   * the prediction delta (relative to its clip) and the routing entropy (relative to the
   * maximum entropy of `rank` experts).
   */
  difficulty(input: { deltaMagnitude: number; updateClip: number; routeEntropy: number; rank: number }): number {
    const clip = Math.max(1e-6, Number(input.updateClip) || 1);
    const deltaScale = clamp01(Math.abs(Number(input.deltaMagnitude) || 0) / clip);
    const rank = Math.max(2, Math.floor(Number(input.rank) || 2));
    const entropyScale = clamp01((Number(input.routeEntropy) || 0) / Math.log(rank));
    return clamp01(this.deltaWeight * deltaScale + this.entropyWeight * entropyScale);
  }

  select(difficulties: number[], options: { forceDeep?: boolean } = {}): DeepWorkSelection {
    const values = difficulties.map(value => clamp01(Number(value)));
    const batch = values.length;
    if (batch === 0) return { mask: [], deepCount: 0, deepFraction01: 0, reason: 'empty' };
    if (options.forceDeep && this.forceFirstDeep) {
      return { mask: values.map(() => true), deepCount: batch, deepFraction01: 1, reason: 'forced' };
    }
    let mask = values.map(value => value >= this.threshold);
    let count = mask.filter(Boolean).length;
    const maxCount = this.maximumFraction > 0 ? Math.max(1, Math.floor(batch * this.maximumFraction)) : 0;
    const minCount = Math.min(Math.ceil(batch * this.minimumFraction), maxCount);
    let reason: DeepWorkSelection['reason'] = 'threshold';
    if (count < minCount) {
      mask = this.topK(values, minCount);
      count = minCount;
      reason = 'raised-to-minimum';
    } else if (count > maxCount) {
      mask = this.topK(values, maxCount);
      count = maxCount;
      reason = 'capped-at-maximum';
    }
    return { mask, deepCount: count, deepFraction01: count / batch, reason };
  }

  /** Deterministic top-k: higher difficulty first, lower index wins ties. */
  private topK(values: number[], k: number): boolean[] {
    const order = values.map((value, index) => ({ value, index })).sort((a, b) => (b.value - a.value) || (a.index - b.index));
    const mask = values.map(() => false);
    for (const row of order.slice(0, Math.max(0, k))) mask[row.index] = true;
    return mask;
  }

  diagnostics(): { threshold01: number; deltaWeight: number; entropyWeight: number; minimumDeepFraction01: number; maximumDeepFraction01: number } {
    return {
      threshold01: this.threshold,
      deltaWeight: this.deltaWeight,
      entropyWeight: this.entropyWeight,
      minimumDeepFraction01: this.minimumFraction,
      maximumDeepFraction01: this.maximumFraction,
    };
  }
}
