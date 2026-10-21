/**
 * Proportional prioritized replay adapted from OpenAI Baselines' MIT-licensed
 * PrioritizedReplayBuffer (Schaul et al. mechanism).
 *
 * This small adapter deliberately accepts a caller-owned candidate list: it
 * does not create a second memory owner or alter the canonical replay buffer.
 * Priorities should come from observed, trusted prediction error (not an
 * unverified reward or user assertion). Importance weights reduce sampling bias.
 */
export interface PrioritizedCandidate {
  priority01?: number;
}

export interface PrioritizedSample<T> {
  index: number;
  item: T;
  probability: number;
  importanceWeight01: number;
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function unit(value: number, name: string): number {
  if (!finite(value) || value < 0 || value > 1) throw new RangeError(`prioritized-${name}-out-of-range`);
  return value;
}

function checkedRandom(random: () => number): number {
  const value = random();
  if (!finite(value) || value < 0 || value >= 1) throw new RangeError('prioritized-random-out-of-range');
  return value;
}

/** Convert absolute prediction error into a strictly positive PER priority. */
export function priorityFromTdError(tdError01: number, epsilon = 0.001): number {
  if (!finite(tdError01) || tdError01 < 0 || tdError01 > 1) throw new RangeError('prioritized-td-error-out-of-range');
  if (!finite(epsilon) || epsilon <= 0 || epsilon > 1) throw new RangeError('prioritized-epsilon-out-of-range');
  return tdError01 + epsilon;
}

/**
 * Proportional prioritized sampling with stratified mass intervals and
 * normalized importance-sampling weights, inspired by OpenAI Baselines.
 * No external dependencies; RNG is injectable for reproducible experiments.
 */
export function samplePrioritized<T extends PrioritizedCandidate>(
  candidates: readonly T[],
  count: number,
  options: { alpha?: number; beta?: number; epsilon?: number; random?: () => number } = {},
): PrioritizedSample<T>[] {
  if (!Array.isArray(candidates)) throw new TypeError('prioritized-candidates-must-be-array');
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('prioritized-count-invalid');
  const alpha = unit(options.alpha ?? 0.6, 'alpha');
  const beta = unit(options.beta ?? 0.4, 'beta');
  const epsilon = options.epsilon ?? 0.001;
  if (!finite(epsilon) || epsilon <= 0 || epsilon > 1) throw new RangeError('prioritized-epsilon-out-of-range');
  const random = options.random ?? Math.random;
  if (typeof random !== 'function') throw new TypeError('prioritized-random-must-be-function');
  if (count === 0 || candidates.length === 0) return [];

  const raw = candidates.map((item) => {
    if (!item || typeof item !== 'object') throw new TypeError('prioritized-candidate-must-be-object');
    const priority = item.priority01 ?? 1;
    if (!finite(priority) || priority < 0 || priority > 1) throw new RangeError('prioritized-priority-out-of-range');
    return Math.pow(priority + epsilon, alpha);
  });
  const total = raw.reduce((sum, value) => sum + value, 0);
  if (!finite(total) || total <= 0) throw new RangeError('prioritized-total-mass-invalid');
  const probabilities = raw.map((value) => value / total);
  const minProbability = Math.min(...probabilities);
  const maxUnnormalizedWeight = Math.pow(candidates.length * minProbability, -beta);
  const cumulative: number[] = [];
  raw.reduce((sum, value, index) => (cumulative[index] = sum + value, sum + value), 0);

  const result: PrioritizedSample<T>[] = [];
  for (let slot = 0; slot < count; slot++) {
    const mass = (slot + checkedRandom(random)) * total / count;
    let low = 0;
    let high = cumulative.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (mass < cumulative[mid]) high = mid;
      else low = mid + 1;
    }
    const probability = probabilities[low];
    const weight = Math.pow(candidates.length * probability, -beta) / maxUnnormalizedWeight;
    result.push({ index: low, item: candidates[low], probability, importanceWeight01: Math.max(0, Math.min(1, weight)) });
  }
  return result;
}
