import assert from 'node:assert/strict';
import { priorityFromTdError, samplePrioritized } from '../src/organism/learning/PrioritizedReplaySampler.ts';

const candidates = [
  { id: 'easy', priority01: 0.01 },
  { id: 'medium', priority01: 0.3 },
  { id: 'hard', priority01: 0.9 },
];
let calls = 0;
const rng = () => ((calls++ * 19) % 97) / 97;
const batch = samplePrioritized(candidates, 6, { alpha: 1, beta: 1, epsilon: 0.001, random: rng });
assert.equal(batch.length, 6);
assert.ok(batch.every((sample) => sample.index >= 0 && sample.index < candidates.length));
assert.ok(batch.every((sample) => Number.isFinite(sample.probability) && sample.probability > 0 && sample.probability <= 1));
assert.ok(batch.every((sample) => Number.isFinite(sample.importanceWeight01) && sample.importanceWeight01 > 0 && sample.importanceWeight01 <= 1));
assert.ok(batch.some((sample) => sample.item.id === 'hard'), 'high-error candidate should be sampleable');
assert.ok(batch.every((sample) => sample.item === candidates[sample.index]), 'sampler returns source references without mutating them');

assert.equal(priorityFromTdError(0), 0.001);
assert.equal(priorityFromTdError(1), 1.001);
assert.throws(() => priorityFromTdError(NaN), /td-error-out-of-range/);
assert.throws(() => samplePrioritized(candidates, -1), /count-invalid/);
assert.throws(() => samplePrioritized([{ priority01: -1 }], 1), /priority-out-of-range/);
assert.throws(() => samplePrioritized(candidates, 1, { random: () => 1 }), /random-out-of-range/);
assert.deepEqual(samplePrioritized(candidates, 0), []);

const uniform = samplePrioritized([{ id: 'a' }, { id: 'b' }], 2, { alpha: 0, beta: 0, random: () => 0.25 });
assert.ok(uniform.every((sample) => Math.abs(sample.probability - 0.5) < 1e-9));
assert.ok(uniform.every((sample) => sample.importanceWeight01 === 1));
console.log('P26_PRIORITIZED_REPLAY_SAMPLER=PASS');
