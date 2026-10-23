/**
 * Deterministic nonparametric bootstrap interval for paired-seed mean deltas.
 *
 * This is deliberately a small native utility rather than a new runtime package.
 * The seed must be derived from stable evaluation identity so the same report
 * can be reproduced. Few-seed intervals are descriptive and do not replace
 * larger benchmark suites or preregistered analysis.
 */
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
  if (!Array.isArray(rawValues) || rawValues.length < 2 ||
      rawValues.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < -1 || value > 1)) {
    throw new Error('paired-seed-bootstrap-values-invalid');
  }
  const confidenceLevel = options.confidenceLevel ?? 0.95;
  const resamples = options.resamples ?? 2000;
  const seed = options.seed ?? 1;
  if (!Number.isFinite(confidenceLevel) || confidenceLevel <= 0.5 || confidenceLevel >= 1) {
    throw new RangeError('paired-seed-bootstrap-confidence-level-invalid');
  }
  if (!Number.isSafeInteger(resamples) || resamples < 100 || resamples > 50_000) {
    throw new RangeError('paired-seed-bootstrap-resamples-invalid');
  }
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError('paired-seed-bootstrap-seed-invalid');
  }

  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const average = mean([...rawValues]);
  const random = createRandom(seed);
  const bootstrapMeans = new Array<number>(resamples);
  for (let sampleIndex = 0; sampleIndex < resamples; sampleIndex++) {
    let sum = 0;
    for (let draw = 0; draw < rawValues.length; draw++) {
      sum += rawValues[Math.floor(random() * rawValues.length)];
    }
    bootstrapMeans[sampleIndex] = sum / rawValues.length;
  }
  bootstrapMeans.sort((left, right) => left - right);
  const tail = (1 - confidenceLevel) / 2;
  const rounded = (value: number) => Number(value.toFixed(6));
  return {
    sampleCount: rawValues.length,
    resamples,
    confidenceLevel,
    mean: rounded(average),
    lower: rounded(quantile(bootstrapMeans, tail)),
    upper: rounded(quantile(bootstrapMeans, 1 - tail)),
  };
}
