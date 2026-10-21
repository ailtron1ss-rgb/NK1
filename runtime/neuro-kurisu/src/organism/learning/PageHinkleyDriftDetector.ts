/**
 * Constant-memory Page-Hinkley streaming change detector.
 *
 * Adapted from River's public PageHinkley implementation (BSD-3-Clause):
 * https://github.com/online-ml/river/blob/main/river/drift/page_hinkley.py
 * Algorithm reference: E. S. Page, "Continuous Inspection Schemes", Biometrika,
 * 1954. This is an independent TypeScript adaptation, not copied Python code.
 *
 * For Neuro Kurisu, normalized [0,1] quality/error signals make the threshold
 * scale meaningful only relative to the chosen signal. Tune against held-out
 * streams; defaults are pragmatic for normalized signals, not universal.
 */
export type PageHinkleyMode = 'up' | 'down' | 'both';

export interface PageHinkleyOptions {
  minInstances?: number;
  delta?: number;
  threshold?: number;
  alpha?: number;
  mode?: PageHinkleyMode;
}

export interface PageHinkleySnapshot {
  version: 1;
  options: Required<PageHinkleyOptions>;
  count: number;
  mean: number;
  sumIncrease: number;
  sumDecrease: number;
  minIncrease: number;
  maxDecrease: number;
  driftDetected: boolean;
  detections: number;
}

export interface PageHinkleyUpdate {
  driftDetected: boolean;
  count: number;
  mean: number | null;
  increaseStatistic: number;
  decreaseStatistic: number;
  detections: number;
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const positiveInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 1;

export class PageHinkleyDriftDetector {
  readonly options: Required<PageHinkleyOptions>;
  private count = 0;
  private mean = 0;
  private sumIncrease = 0;
  private sumDecrease = 0;
  private minIncrease = Number.POSITIVE_INFINITY;
  private maxDecrease = Number.NEGATIVE_INFINITY;
  private detected = false;
  private detections = 0;

  constructor(options: PageHinkleyOptions = {}) {
    const minInstances = options.minInstances ?? 30;
    const delta = options.delta ?? 0.005;
    const threshold = options.threshold ?? 0.15;
    const alpha = options.alpha ?? 0.999;
    const mode = options.mode ?? 'both';
    if (!positiveInteger(minInstances)) throw new RangeError('page-hinkley-min-instances-invalid');
    if (!finite(delta) || delta < 0) throw new RangeError('page-hinkley-delta-invalid');
    if (!finite(threshold) || threshold <= 0) throw new RangeError('page-hinkley-threshold-invalid');
    if (!finite(alpha) || alpha <= 0 || alpha > 1) throw new RangeError('page-hinkley-alpha-invalid');
    if (mode !== 'up' && mode !== 'down' && mode !== 'both') throw new RangeError('page-hinkley-mode-invalid');
    this.options = { minInstances, delta, threshold, alpha, mode };
  }

  get driftDetected(): boolean { return this.detected; }
  get nDetections(): number { return this.detections; }
  get estimation(): number | null { return this.count ? this.mean : null; }

  update(value: number): PageHinkleyUpdate {
    if (!finite(value)) throw new RangeError('page-hinkley-value-must-be-finite');
    // River resets an alarmed detector before accepting the next observation.
    if (this.detected) this.reset();
    this.count += 1;
    this.mean += (value - this.mean) / this.count;
    const deviation = value - this.mean;
    this.sumIncrease = this.options.alpha * this.sumIncrease + deviation - this.options.delta;
    this.sumDecrease = this.options.alpha * this.sumDecrease + deviation + this.options.delta;
    this.minIncrease = Math.min(this.minIncrease, this.sumIncrease);
    this.maxDecrease = Math.max(this.maxDecrease, this.sumDecrease);
    const increaseStatistic = this.sumIncrease - this.minIncrease;
    const decreaseStatistic = this.maxDecrease - this.sumDecrease;
    if (this.count >= this.options.minInstances) {
      this.detected = this.options.mode === 'up'
        ? increaseStatistic > this.options.threshold
        : this.options.mode === 'down'
          ? decreaseStatistic > this.options.threshold
          : increaseStatistic > this.options.threshold || decreaseStatistic > this.options.threshold;
      if (this.detected) this.detections += 1;
    }
    return {
      driftDetected: this.detected,
      count: this.count,
      mean: this.mean,
      increaseStatistic,
      decreaseStatistic,
      detections: this.detections,
    };
  }

  snapshot(): PageHinkleySnapshot {
    return {
      version: 1,
      options: { ...this.options },
      count: this.count,
      mean: this.mean,
      sumIncrease: this.sumIncrease,
      sumDecrease: this.sumDecrease,
      minIncrease: this.minIncrease,
      maxDecrease: this.maxDecrease,
      driftDetected: this.detected,
      detections: this.detections,
    };
  }

  restore(raw: unknown): void {
    if (!raw || typeof raw !== 'object') throw new TypeError('page-hinkley-snapshot-invalid');
    const s = raw as Partial<PageHinkleySnapshot>;
    const numeric = [s.mean, s.sumIncrease, s.sumDecrease, s.minIncrease, s.maxDecrease];
    if (s.version !== 1 || !s.options || !positiveInteger(s.count) ||
        !positiveInteger(s.detections) && s.detections !== 0 ||
        typeof s.driftDetected !== 'boolean' || numeric.some((n) => !finite(n) && n !== Number.POSITIVE_INFINITY && n !== Number.NEGATIVE_INFINITY) ||
        JSON.stringify(s.options) !== JSON.stringify(this.options) ||
        (s.minIncrease !== Number.POSITIVE_INFINITY && !finite(s.minIncrease)) ||
        (s.maxDecrease !== Number.NEGATIVE_INFINITY && !finite(s.maxDecrease))) {
      // count=0 is a valid fresh snapshot; handled separately below.
      if (!(s.version === 1 && s.options && s.count === 0 && s.detections === 0 &&
        s.mean === 0 && s.sumIncrease === 0 && s.sumDecrease === 0 &&
        s.minIncrease === Number.POSITIVE_INFINITY && s.maxDecrease === Number.NEGATIVE_INFINITY &&
        s.driftDetected === false && JSON.stringify(s.options) === JSON.stringify(this.options))) {
        throw new TypeError('page-hinkley-snapshot-invalid');
      }
    }
    if (!Number.isSafeInteger(s.count) || Number(s.count) < 0 ||
        !Number.isSafeInteger(s.detections) || Number(s.detections) < 0 ||
        !finite(s.mean) || !finite(s.sumIncrease) || !finite(s.sumDecrease)) {
      throw new TypeError('page-hinkley-snapshot-invalid');
    }
    this.count = s.count;
    this.mean = s.mean;
    this.sumIncrease = s.sumIncrease;
    this.sumDecrease = s.sumDecrease;
    this.minIncrease = s.minIncrease as number;
    this.maxDecrease = s.maxDecrease as number;
    this.detected = s.driftDetected;
    this.detections = s.detections;
  }

  reset(): void {
    this.count = 0;
    this.mean = 0;
    this.sumIncrease = 0;
    this.sumDecrease = 0;
    this.minIncrease = Number.POSITIVE_INFINITY;
    this.maxDecrease = Number.NEGATIVE_INFINITY;
    this.detected = false;
    this.detections = 0;
  }
}
