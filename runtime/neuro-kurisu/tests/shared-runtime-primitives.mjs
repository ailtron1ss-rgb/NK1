import assert from 'node:assert/strict';
import { ACTION_COSTS, actionCost } from '../src/organism/core/ActionCostPolicy.ts';
import { cosineSimilarity, cosineSimilarity01, fnv1a32 } from '../src/organism/core/NumericPrimitives.ts';
import { ParametricPolicyLearner } from '../src/organism/learning/ParametricPolicyLearner.ts';

assert.equal(fnv1a32('hello'), 0x4f9f2cab, 'FNV-1a stays deterministic');
assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
assert.equal(cosineSimilarity([1, 0], [-1, 0]), -1);
assert.equal(cosineSimilarity([], [1, 2]), 0);
assert.equal(cosineSimilarity([0, 0], [0, 0]), 0);
assert.equal(cosineSimilarity([0, 0], [1, 0], 1e-9), 0, 'epsilon norm floor preserves legacy raw-cosine semantics');
assert.equal(cosineSimilarity01([0, 0], [1, 0], 1e-9), 0.5, 'epsilon norm floor preserves neutral mapped cosine semantics');
assert.equal(cosineSimilarity01([1, 0], [1, 0]), 1);
assert.equal(cosineSimilarity01([0, 0], [1, 1]), 0.5, 'zero vector is neutral in the [0,1] similarity domain');
assert.ok(Number.isFinite(cosineSimilarity([Number.NaN, 1], [1, 1])));
assert.ok(Math.abs(cosineSimilarity([Number.NaN, 1], [1, 1]) - Math.SQRT1_2) < 1e-12, 'invalid dimensions are zeroed consistently with runtime finite(value, 0) semantics');

const expected = { respond:.18, explore:.42, verify:.36, rest:.05, reflect:.22, wait:.02, defer:.08 };
assert.deepEqual({ ...ACTION_COSTS }, expected);
for (const [action, value] of Object.entries(expected)) assert.equal(actionCost(action), value);

const learner = new ParametricPolicyLearner();
const features = learner.features({
  tick: 1, at: 1,
  needs: { energy:.5, cognitiveLoad:.5, uncertainty:.5, novelty:.5, goalPressure:.5, socialNeed:.5, identityCoherence:.5 },
  predictionError:.5, attentionBudget:.5,
}, undefined, 'explore');
assert.equal(features.at(-1), actionCost('explore'), 'learned policy and live scoring use the same action cost');
console.log('SHARED_RUNTIME_PRIMITIVES=PASS fnv1a cosine semantics canonical action-cost table');
