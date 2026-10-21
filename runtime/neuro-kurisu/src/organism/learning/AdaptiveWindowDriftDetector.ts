/**
 * Bounded adaptive-window concept-drift detector for normalized learning signals.
 *
 * Source concept: River's ADWIN/ADWIN2 (BSD-3-Clause), originally by Bifet &
 * Gavaldà. This TypeScript implementation preserves the detector's essential
 * adaptive-window/statistical-cut behavior but deliberately uses an exact
 * bounded window scan rather than River's Rust-backed exponential bucket
 * compression. It is therefore not a byte-for-byte port of ADWIN2.
 *
 * Input is a trusted, comparable scalar in [0, 1] (e.g. held-out error or
 * quality mapped consistently across time). Never feed untrusted self-reports.
 */
export interface AdaptiveWindowOptions {
  delta?: number;
  clock?: number;
  maxWindow?: number;
  minSubwindowLength?: number;
  gracePeriod?: number;
}

export interface AdaptiveWindowSnapshot {
  version: 1;
  options: Required<AdaptiveWindowOptions>;
  values: number[];
  totalSeen: number;
  detections: number;
  lastDriftDetected: boolean;
}

export interface AdaptiveWindowUpdate {
  driftDetected: boolean;
  width: number;
  estimation: number | null;
  variance: number;
  total: number;
  detections: number;
  checked: boolean;
  cutIndex: number | null;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const integerAtLeast = (v: unknown, min: number): v is number =>
  Number.isSafeInteger(v) && Number(v) >= min;

export class AdaptiveWindowDriftDetector {
  private values: number[] = [];
  private totalSeen = 0;
  private detections = 0;
  private lastDrift = false;

  readonly options: Required<AdaptiveWindowOptions>;

  constructor(options: AdaptiveWindowOptions = {}) {
    const delta = options.delta ?? 0.002;
    const clock = options.clock ?? 8;
    const maxWindow = options.maxWindow ?? 2048;
    const minSubwindowLength = options.minSubwindowLength ?? 5;
    const gracePeriod = options.gracePeriod ?? 20;
    if (!finite(delta) || delta <= 0 || delta >= 1) throw new RangeError('adwin-delta-out-of-range');
    if (!integerAtLeast(clock, 1)) throw new RangeError('adwin-clock-invalid');
    if (!integerAtLeast(maxWindow, 2 * minSubwindowLength)) throw new RangeError('adwin-max-window-too-small');
    if (!integerAtLeast(minSubwindowLength, 2)) throw new RangeError('adwin-min-subwindow-invalid');
    if (!integerAtLeast(gracePeriod, 2 * minSubwindowLength)) throw new RangeError('adwin-grace-period-too-small');
    this.options = { delta, clock, maxWindow, minSubwindowLength, gracePeriod };
  }

  get width(): number { return this.values.length; }
  get nDetections(): number { return this.detections; }
  get total(): number { return this.values.reduce((sum, value) => sum + value, 0); }
  get estimation(): number | null { return this.values.length ? this.total / this.values.length : null; }
  get variance(): number {
    if (this.values.length < 2) return 0;
    const mean = this.total / this.values.length;
    return this.values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / this.values.length;
  }
  get driftDetected(): boolean { return this.lastDrift; }

  /**
   * Scan all legal split points using a Hoeffding-style bound. On detected
   * change, discard the stale prefix and re-check the remaining window.
   * Exact scanning is intentionally capped by maxWindow for predictable memory.
   */
  private shrinkIfDrift(): number | null {
    const min = this.options.minSubwindowLength;
    const n = this.values.length;
    if (n < Math.max(this.options.gracePeriod, min * 2)) return null;

    const total = this.values.reduce((sum, value) => sum + value, 0);
    const mean = total / n;
    const variance = this.values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / n;
    const logTerm = Math.log(2 / this.options.delta);
    let cut: number | null = null;

    // Earliest significant cut is chosen; stale history is removed conservatively.
    for (let leftN = min; leftN <= n - min; leftN++) {
      const rightN = n - leftN;
      const leftSum = this.values.slice(0, leftN).reduce((sum, value) => sum + value, 0);
      const leftMean = leftSum / leftN;
      const rightMean = (total - leftSum) / rightN;
      const harmonic = 1 / (1 / leftN + 1 / rightN);
      const epsilon = Math.sqrt(2 * variance * logTerm / harmonic) + (2 / 3) * logTerm / harmonic;
      if (Math.abs(leftMean - rightMean) > epsilon) {
        cut = leftN;
        break;
      }
    }
    return cut;
  }

  update(value: number): AdaptiveWindowUpdate {
    if (!finite(value) || value < 0 || value > 1) throw new RangeError('adwin-value-must-be-finite-0-to-1');
    this.lastDrift = false;
    this.values.push(value);
    this.totalSeen += 1;
    if (this.values.length > this.options.maxWindow) this.values.shift();

    let checked = false;
    let firstCut: number | null = null;
    if (this.totalSeen >= this.options.gracePeriod && this.totalSeen % this.options.clock === 0) {
      checked = true;
      // Repeatedly remove stale prefixes if multiple changes are exposed.
      for (let pass = 0; pass < 8; pass++) {
        const cut = this.shrinkIfDrift();
        if (cut === null) break;
        if (firstCut === null) firstCut = cut;
        this.values.splice(0, cut);
        this.detections += 1;
        this.lastDrift = true;
      }
    }
    return {
      driftDetected: this.lastDrift,
      width: this.width,
      estimation: this.estimation,
      variance: this.variance,
      total: this.total,
      detections: this.detections,
      checked,
      cutIndex: firstCut,
    };
  }

  snapshot(): AdaptiveWindowSnapshot {
    return {
      version: 1,
      options: { ...this.options },
      values: this.values.slice(),
      totalSeen: this.totalSeen,
      detections: this.detections,
      lastDriftDetected: this.lastDrift,
    };
  }

  restore(raw: unknown): void {
    if (!raw || typeof raw !== 'object') throw new TypeError('adwin-snapshot-invalid');
    const snapshot = raw as Partial<AdaptiveWindowSnapshot>;
    if (snapshot.version !== 1 || !snapshot.options || !Array.isArray(snapshot.values) ||
        !integerAtLeast(snapshot.totalSeen, 0) || !integerAtLeast(snapshot.detections, 0) ||
        typeof snapshot.lastDriftDetected !== 'boolean' ||
        snapshot.values.length > this.options.maxWindow ||
        snapshot.values.some((value) => !finite(value) || value < 0 || value > 1) ||
        snapshot.totalSeen < snapshot.values.length ||
        JSON.stringify(snapshot.options) !== JSON.stringify(this.options)) {
      throw new TypeError('adwin-snapshot-invalid');
    }
    this.values = snapshot.values.slice();
    this.totalSeen = snapshot.totalSeen;
    this.detections = snapshot.detections;
    this.lastDrift = snapshot.lastDriftDetected;
  }

  reset(): void {
    this.values = [];
    this.totalSeen = 0;
    this.detections = 0;
    this.lastDrift = false;
  }
}
