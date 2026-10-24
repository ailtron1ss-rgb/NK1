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
assert.throws(() => learner.train({ ...valid, learningRate01: 1.01 }), /rate-must-be-finite-and-in-0-1/);
assert.throws(() => learner.train({ ...valid, sampleWeight01: Number.NaN }), /sample-weight-must-be-finite/);
assert.throws(() => learner.train({ ...valid, action: 'not-an-action' }), /invalid-action/);
assert.deepEqual(learner.snapshot(), initial, 'rejected samples must not mutate policy weights or learning diagnostics');

const features = learner.features(state, undefined, 'respond');
assert.throws(() => learner.trainFeatures({ features: features.map((v, i) => i === 2 ? Number.NaN : v), action: 'respond', target01: .9, learningRate01: .06 }), /features-must-be-finite/);
assert.deepEqual(learner.snapshot(), initial, 'invalid feature vectors must be rejected atomically');

// A persisted snapshot may be stale, hand-edited, or corrupted. Restore must
// sanitize model parameters and diagnostics rather than reintroducing NaN values.
const corrupted = learner.snapshot();
corrupted.weights.respond[0] = Number.NaN;
corrupted.weights.explore[1] = Number.POSITIVE_INFINITY;
corrupted.bias.verify = Number.NaN;
corrupted.tdAbsMean01 = Number.NaN;
corrupted.trainRewardMean01 = Number.POSITIVE_INFINITY;
corrupted.explorationRate01 = Number.NaN;
corrupted.lastLoss01 = Number.POSITIVE_INFINITY;
corrupted.updates = -1;
corrupted.lastTrainedAt = Number.NaN;
corrupted.frozen = 'false'; // strings must not silently enable a safety freeze
const restored = new ParametricPolicyLearner();
restored.restore(corrupted);
const repaired = restored.snapshot();
assert.ok(Object.values(repaired.weights).flat().every(Number.isFinite), 'restored weights must be finite');
assert.ok(Object.values(repaired.bias).every(Number.isFinite), 'restored biases must be finite');
assert.ok([repaired.tdAbsMean01, repaired.trainRewardMean01, repaired.explorationRate01, repaired.lastLoss01, repaired.lastTrainedAt].every(Number.isFinite), 'restored diagnostics must be finite');
assert.equal(repaired.updates, 0, 'invalid update count must reset safely');
assert.equal(repaired.frozen, false, 'only literal boolean true may restore a frozen learner');
const explicitlyFrozen = new ParametricPolicyLearner();
explicitlyFrozen.restore({ ...initial, frozen: true });
assert.equal(explicitlyFrozen.snapshot().frozen, true, 'literal boolean true must preserve an intentional safety freeze');
assert.equal(repaired.weights.respond[0], 0);
assert.equal(repaired.weights.explore[1], 0);
assert.equal(repaired.bias.verify, 0);

// Batch preflight must reject a malformed later sample before applying the
// valid earlier sample; the batch is atomic with respect to input validation.
const batchLearner = new ParametricPolicyLearner();
const batchBefore = batchLearner.snapshot();
assert.throws(() => batchLearner.trainBatch([
  valid,
  { ...valid, state: { needs: null } },
]), /state-must-have-needs/);
assert.deepEqual(batchLearner.snapshot(), batchBefore, 'invalid batch must not partially train the policy');
assert.throws(() => batchLearner.trainBatch([valid, { ...valid, target01: Number.NaN }]), /target-must-be-finite/);
assert.deepEqual(batchLearner.snapshot(), batchBefore, 'invalid batch feedback must be rejected before mutation');

const result = learner.train(valid);
assert.equal(learner.snapshot().updates, 1, 'valid feedback must still update the learner');
assert.ok(Number.isFinite(result.predictionAfter));
assert.ok(learner.snapshot().weights.respond.every(Number.isFinite));
console.log('P26_LEARNING_INPUT_INTEGRITY=PASS invalidSamples=6 corruptSnapshotFieldsRepaired=9 atomicBatchReject=2 stateMutationOnReject=0 validUpdates=1');
