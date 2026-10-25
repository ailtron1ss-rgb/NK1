/**
 * Deterministic nonparametric bootstrap interval for paired-seed mean deltas.
 *
 * This is deliberately a small native utility rather than a new runtime package.
 * The seed must be derived from stable evaluation identity so the same report
 * can be reproduced. Few-seed intervals are descriptive and do not replace
 * larger benchmark suites or preregistered analysis.
 */
import { snapshotPlainData } from './LearningTrustBoundary.ts';

export interface BootstrapMeanInterval {
  sampleCount: number;
  resamples: number;
  confidenceLevel: number;
  mean: number;
  lower: number;
  upper: number;
}

export interface BootstrapMeanIntervalOptions {
  confidenceLevel?: number;
  resamples?: number;
  seed?: number;
}

// A hard draw budget keeps hostile or accidentally huge inputs from multiplying
// into unbounded CPU work when callers request many resamples.
const MAX_BOOTSTRAP_TOTAL_DRAWS = 16_000_000;

function quantile(sorted: number[], probability: number): number {
  const position = (sorted.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return sorted[lowerIndex];
  const weight = position - lowerIndex;
  return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function bootstrapMeanConfidenceInterval(
  rawValues: readonly number[],
  options: BootstrapMeanIntervalOptions = {},
): BootstrapMeanInterval {
  // Validate numeric domain errors through own data descriptors before the generic
  // snapshot boundary, so NaN/Infinity produce stable value-specific failures while
  // getters are rejected without being invoked.
  try {
    if (!Array.isArray(rawValues) || rawValues.length < 2) {
      throw new Error('paired-seed-bootstrap-values-invalid');
    }
    for (let index = 0; index < rawValues.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(rawValues, String(index));
      if (!descriptor) throw new Error('paired-seed-bootstrap-values-invalid');
      if (!Object.hasOwn(descriptor, 'value')) {
        throw new Error('paired-seed-bootstrap-data-boundary-rejected');
      }
      const value: unknown = descriptor.value;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < -1 || value > 1) {
        throw new Error('paired-seed-bootstrap-values-invalid');
      }
    }
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new Error('paired-seed-bootstrap-data-boundary-rejected');
    }
    const optionFields = [
      ['confidenceLevel', 'confidence-level'],
      ['resamples', 'resamples'],
      ['seed', 'seed'],
    ] as const;
    for (const [key, label] of optionFields) {
      const descriptor = Object.getOwnPropertyDescriptor(options, key);
      if (!descriptor) continue;
      if (!Object.hasOwn(descriptor, 'value')) {
        throw new Error('paired-seed-bootstrap-data-boundary-rejected');
      }
      const value: unknown = descriptor.value;
      if (value === undefined) continue;
      if (label === 'confidence-level' &&
          (typeof value !== 'number' || !Number.isFinite(value) || value <= 0.5 || value >= 1)) {
        throw new RangeError('paired-seed-bootstrap-confidence-level-invalid');
      }
      if (label === 'resamples' &&
          (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 100 || value > 50_000)) {
        throw new RangeError('paired-seed-bootstrap-resamples-invalid');
      }
      if (label === 'seed' &&
          (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff)) {
        throw new RangeError('paired-seed-bootstrap-seed-invalid');
      }
    }
  } catch (error) {
    if (error instanceof RangeError ||
        (error instanceof Error && error.message.startsWith('paired-seed-bootstrap-'))) {
      throw error;
    }
    throw new Error('paired-seed-bootstrap-data-boundary-rejected');
  }

  let values: unknown;
  let config: BootstrapMeanIntervalOptions;
  try {
    values = snapshotPlainData(rawValues);
    config = snapshotPlainData(options) as BootstrapMeanIntervalOptions;
  } catch {
    throw new Error('paired-seed-bootstrap-data-boundary-rejected');
  }
  if (!Array.isArray(values) || values.length < 2 ||
      values.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < -1 || value > 1)) {
    throw new Error('paired-seed-bootstrap-values-invalid');
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('paired-seed-bootstrap-data-boundary-rejected');
  }
  const confidenceLevel = config.confidenceLevel ?? 0.95;
  const resamples = config.resamples ?? 2000;
  const seed = config.seed ?? 1;
  if (!Number.isFinite(confidenceLevel) || confidenceLevel <= 0.5 || confidenceLevel >= 1) {
    throw new RangeError('paired-seed-bootstrap-confidence-level-invalid');
  }
  if (!Number.isSafeInteger(resamples) || resamples < 100 || resamples > 50_000) {
    throw new RangeError('paired-seed-bootstrap-resamples-invalid');
  }
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError('paired-seed-bootstrap-seed-invalid');
  }

  const safeValues = values as number[];
  if (safeValues.length > Math.floor(MAX_BOOTSTRAP_TOTAL_DRAWS / resamples)) {
    throw new RangeError('paired-seed-bootstrap-work-budget-exceeded');
  }

  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const average = mean([...safeValues]);
  const random = createRandom(seed);
  const bootstrapMeans = new Array<number>(resamples);
  for (let sampleIndex = 0; sampleIndex < resamples; sampleIndex++) {
    let sum = 0;
    for (let draw = 0; draw < safeValues.length; draw++) {
      sum += safeValues[Math.floor(random() * safeValues.length)];
    }
    bootstrapMeans[sampleIndex] = sum / safeValues.length;
  }
  bootstrapMeans.sort((left, right) => left - right);
  const tail = (1 - confidenceLevel) / 2;
  const rounded = (value: number) => Number(value.toFixed(6));
  return {
    sampleCount: safeValues.length,
    resamples,
    confidenceLevel,
    mean: rounded(average),
    lower: rounded(quantile(bootstrapMeans, tail)),
    upper: rounded(quantile(bootstrapMeans, 1 - tail)),
  };
}
