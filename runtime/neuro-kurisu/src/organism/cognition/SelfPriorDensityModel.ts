export interface SelfPriorDensityState {
  version: 1;
  dimensions: number;
  sampleCount: number;
  effectiveSamples: number;
  mean: number[];
  variance: number[];
  lastAt: number;
}

export interface SelfPriorObservation {
  /** Pre-update mismatch against the agent's accumulated self-state distribution. */
  mismatch01: number;
  /** Confidence rises only after enough temporally ordered observations. */
  confidence01: number;
  rmsZ: number;
  sampleCount: number;
}

const clamp = (value: number, min = 0, max = 1): number =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
const MIN_VARIANCE = 0.02;
const MAX_VARIANCE = 16;
const MAX_DIMENSIONS = 64;
const MAX_SAMPLES = 1_000_000;
const MAX_EFFECTIVE_SAMPLES = 64;

export function defaultSelfPriorDensityState(dimensions = 16): SelfPriorDensityState {
  const size = Number.isSafeInteger(dimensions) && dimensions > 0 && dimensions <= MAX_DIMENSIONS ? dimensions : 16;
  return {
    version: 1,
    dimensions: size,
    sampleCount: 0,
    effectiveSamples: 0,
    mean: new Array(size).fill(0),
    variance: new Array(size).fill(1),
    lastAt: 0,
  };
}

/**
 * A compact online density model over the organism's own latent state.
 *
 * Prediction is prequential: mismatch is computed against the prior distribution
 * before the current observation is allowed to update it. A surprise-sensitive
 * learning rate slows adaptation to isolated outliers, while repeated stable
 * observations gradually move the prior. Only moments are retained, not raw
 * observations or user content.
 */
export class SelfPriorDensityModel {
  private state: SelfPriorDensityState;

  constructor(dimensions = 16) {
    this.state = defaultSelfPriorDensityState(dimensions);
  }

  snapshot(): SelfPriorDensityState {
    return structuredClone(this.state);
  }

  restore(value: Partial<SelfPriorDensityState> | undefined): void {
    const fallback = defaultSelfPriorDensityState(this.state.dimensions);
    const sampleCount = value?.sampleCount;
    const effectiveSamples = value?.effectiveSamples;
    const lastAt = value?.lastAt;
    if (!value || value.version !== 1 || value.dimensions !== fallback.dimensions
      || !Number.isSafeInteger(sampleCount) || (sampleCount as number) < 0
      || (sampleCount as number) > MAX_SAMPLES
      || !Number.isSafeInteger(effectiveSamples) || (effectiveSamples as number) < 0
      || (effectiveSamples as number) > MAX_EFFECTIVE_SAMPLES
      // These counters are advanced together by observe(); accepting a mismatch
      // would let a forged sampleCount manufacture confidence without evidence.
      || effectiveSamples !== Math.min(sampleCount as number, MAX_EFFECTIVE_SAMPLES)
      || typeof lastAt !== 'number' || !Number.isFinite(lastAt) || lastAt < 0
      || !Array.isArray(value.mean) || !Array.isArray(value.variance)
      || value.mean.length !== fallback.dimensions || value.variance.length !== fallback.dimensions
      || !value.mean.every(Number.isFinite) || !value.variance.every(Number.isFinite)) {
      this.state = fallback;
      return;
    }
    this.state = {
      version: 1,
      dimensions: fallback.dimensions,
      sampleCount: sampleCount as number,
      effectiveSamples: effectiveSamples as number,
      mean: value.mean.map(item => clamp(item, -4, 4)),
      variance: value.variance.map(item => clamp(item, MIN_VARIANCE, MAX_VARIANCE)),
      lastAt: lastAt as number,
    };
  }

  predict(observation: readonly number[]): SelfPriorObservation {
    const vector = this.validateObservation(observation);
    const sampleCount = this.state.sampleCount;
    if (sampleCount < 4) {
      return { mismatch01: 0, confidence01: 0, rmsZ: 0, sampleCount };
    }
    let squaredZ = 0;
    for (let index = 0; index < vector.length; index += 1) {
      const variance = Math.max(MIN_VARIANCE, this.state.variance[index]);
      const z = (vector[index] - this.state.mean[index]) / Math.sqrt(variance);
      squaredZ += z * z;
    }
    const rmsZ = Math.sqrt(squaredZ / vector.length);
    return {
      mismatch01: clamp(rmsZ / (1 + rmsZ)),
      confidence01: clamp((sampleCount - 3) / 24),
      rmsZ,
      sampleCount,
    };
  }

  observe(observation: readonly number[], at = Date.now()): SelfPriorObservation {
    const vector = this.validateObservation(observation);
    if (typeof at !== 'number' || !Number.isFinite(at) || at < 0) {
      throw new RangeError('self-prior-observation-timestamp-must-be-finite-and-non-negative');
    }
    if (at < this.state.lastAt) {
      throw new RangeError('self-prior-observation-timestamp-out-of-order');
    }
    const prediction = this.predict(vector);
    const baseAlpha = Math.min(0.2, 2 / (this.state.effectiveSamples + 2));
    const alpha = baseAlpha * (1 - 0.65 * prediction.mismatch01 * prediction.confidence01);
    for (let index = 0; index < vector.length; index += 1) {
      const delta = vector[index] - this.state.mean[index];
      this.state.mean[index] += alpha * delta;
      const nextVariance = (1 - alpha) * (this.state.variance[index] + alpha * delta * delta);
      this.state.variance[index] = clamp(nextVariance, MIN_VARIANCE, MAX_VARIANCE);
    }
    this.state.sampleCount = Math.min(MAX_SAMPLES, this.state.sampleCount + 1);
    this.state.effectiveSamples = Math.min(MAX_EFFECTIVE_SAMPLES, this.state.effectiveSamples + 1);
    this.state.lastAt = at;
    return prediction;
  }

  private validateObservation(observation: readonly number[]): number[] {
    if (!Array.isArray(observation) || observation.length !== this.state.dimensions) {
      throw new RangeError('self-prior-observation-dimension-mismatch');
    }
    const vector = observation.map(value => {
      if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 4) {
        throw new RangeError('self-prior-observation-must-be-finite-and-bounded');
      }
      return value;
    });
    return vector;
  }
}
