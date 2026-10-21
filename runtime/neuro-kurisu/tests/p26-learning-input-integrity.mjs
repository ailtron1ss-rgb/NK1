import assert from 'node:assert/strict';
import { ParametricPolicyLearner } from '../src/organism/learning/ParametricPolicyLearner.ts';

const state = {
  version: 29, tick: 1, at: 1,
  needs: { energy: .7, cognitiveLoad: .2, uncertainty: .3, novelty: .4, goalPressure: .2, socialNeed: .2, identityCoherence: .8 },
  predictionError: .1, attentionBudget: .8, lastAction: 'none', lastActionSuccess: null,
  autonomyScore: .5, selfPredictionError: .1, predictedNextAction: 'none',
  lastPredictionConfidence: .5, worldContextVersion: 1,
};
const learner = new ParametricPolicyLearner();
const initial = learner.snapshot();
const valid = { state, action: 'respond', target01: .9, learningRate01: .06 };

assert.throws(() => learner.train({ ...valid, target01: Number.NaN }), /target-must-be-finite/);
assert.throws(() => learner.train({ ...valid, learningRate01: Number.POSITIVE_INFINITY }), /rate-must-be-finite/);
assert.throws(() => learner.train({ ...valid, sampleWeight01: Number.NaN }), /sample-weight-must-be-finite/);
assert.throws(() => learner.train({ ...valid, action: 'not-an-action' }), /invalid-action/);
assert.deepEqual(learner.snapshot(), initial, 'rejected samples must not mutate policy weights or learning diagnostics');

const features = learner.features(state, undefined, 'respond');
assert.throws(() => learner.trainFeatures({ features: features.map((v, i) => i === 2 ? Number.NaN : v), action: 'respond', target01: .9, learningRate01: .06 }), /features-must-be-finite/);
assert.deepEqual(learner.snapshot(), initial, 'invalid feature vectors must be rejected atomically');

const result = learner.train(valid);
assert.equal(learner.snapshot().updates, 1, 'valid feedback must still update the learner');
assert.ok(Number.isFinite(result.predictionAfter));
assert.ok(learner.snapshot().weights.respond.every(Number.isFinite));
console.log('P26_LEARNING_INPUT_INTEGRITY=PASS invalidSamples=5 stateMutationOnReject=0 validUpdates=1');
