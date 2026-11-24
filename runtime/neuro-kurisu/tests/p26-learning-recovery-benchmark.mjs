import assert from 'node:assert/strict';
import { ParametricPolicyLearner } from '../src/organism/learning/ParametricPolicyLearner.ts';

const zeros = () => new Array(15).fill(0);
const learner = new ParametricPolicyLearner();
const action = 'respond';
const train = (model, features, target01, n = 1) => {
  for (let i = 0; i < n; i++) model.trainFeatures({ features, action, target01, learningRate01: .12 });
};
const predict = (model, features) => model.predictFromFeatures(features, action);

// 1. Online learning: repeated consistent feedback should move the prediction
// toward the target on a deliberately simple, deterministic probe.
const probe = zeros();
const initial = predict(learner, probe);
train(learner, probe, .95, 80);
const learned = predict(learner, probe);
assert.ok(learned > initial + .15, `consistent feedback should move prediction: ${initial} -> ${learned}`);

// 2. Feedback repair / task reversal: the same probe changes its target.
// This tests plasticity, not whether the policy has a good external reward model.
train(learner, probe, .05, 100);
const reversed = predict(learner, probe);
assert.ok(reversed < learned - .15, `reversal should move prediction back: ${learned} -> ${reversed}`);

// 3. Frozen no-learning control: predictions and update counter must remain stable.
const frozen = new ParametricPolicyLearner();
frozen.setFrozen(true);
const frozenBefore = frozen.snapshot();
const frozenPredictionBefore = predict(frozen, probe);
train(frozen, probe, .95, 20);
const frozenAfter = frozen.snapshot();
assert.equal(predict(frozen, probe), frozenPredictionBefore);
assert.equal(frozenAfter.updates, frozenBefore.updates);
assert.deepEqual(frozenAfter.weights, frozenBefore.weights);
assert.deepEqual(frozenAfter.bias, frozenBefore.bias);

// 4. Replay retention probe: learn two orthogonal feature patterns, then train
// only pattern B. Report A's retention rather than silently assuming no forgetting.
const replay = new ParametricPolicyLearner();
const patternA = zeros(); patternA[0] = 1;
const patternB = zeros(); patternB[1] = 1;
train(replay, patternA, .9, 100);
train(replay, patternB, .9, 100);
const aBefore = predict(replay, patternA);
const bBefore = predict(replay, patternB);
train(replay, patternB, .9, 120);
const aAfter = predict(replay, patternA);
const bAfter = predict(replay, patternB);
assert.ok(bAfter >= bBefore - .02, 'continued training should not materially degrade the active replay target');

const metrics = {
  initial: Number(initial.toFixed(4)),
  learned: Number(learned.toFixed(4)),
  reversed: Number(reversed.toFixed(4)),
  learningGain: Number((learned - initial).toFixed(4)),
  reversalDrop: Number((learned - reversed).toFixed(4)),
  replayRetentionDelta: Number((aAfter - aBefore).toFixed(4)),
  replayTargetDelta: Number((bAfter - bBefore).toFixed(4)),
  frozenControl: 'PASS',
};
console.log('P26_LEARNING_RECOVERY_BENCHMARK=' + JSON.stringify(metrics));
