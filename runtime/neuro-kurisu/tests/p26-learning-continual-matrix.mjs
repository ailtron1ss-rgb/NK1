import assert from 'node:assert/strict';
import { ParametricPolicyLearner } from '../src/organism/learning/ParametricPolicyLearner.ts';

const FEATURE_COUNT = 15;
const ACTION = 'respond';
const rounds = 60;
const makePattern = (index) => {
  const features = new Array(FEATURE_COUNT).fill(0);
  features[index] = 1;
  // Keep probes orthogonal while varying feature magnitude across families.
  features[(index + 7) % FEATURE_COUNT] = index % 2 ? .35 : .65;
  return features;
};
const patterns = [
  { id: 'energy-like', features: makePattern(0), target: .88 },
  { id: 'uncertainty-like', features: makePattern(2), target: .18 },
  { id: 'novelty-like', features: makePattern(3), target: .72 },
];
const orders = [
  ['energy-like', 'uncertainty-like', 'novelty-like'],
  ['novelty-like', 'uncertainty-like', 'energy-like'],
  ['uncertainty-like', 'energy-like', 'novelty-like'],
];
const train = (model, item, target = item.target, count = rounds) => {
  for (let i = 0; i < count; i++) {
    model.trainFeatures({ features: item.features, action: ACTION, target01: target, learningRate01: .12 });
  }
};
const predict = (model, item) => model.predictFromFeatures(item.features, ACTION);
const results = [];

for (const order of orders) {
  const model = new ParametricPolicyLearner();
  const before = Object.fromEntries(patterns.map(item => [item.id, predict(model, item)]));
  for (const id of order) train(model, patterns.find(item => item.id === id));
  const after = Object.fromEntries(patterns.map(item => [item.id, predict(model, item)]));
  const errors = Object.fromEntries(patterns.map(item => [item.id, Math.abs(after[item.id] - item.target)]));
  const snapshot = model.snapshot();
  assert.equal(snapshot.updates, rounds * patterns.length, 'each curriculum must apply the expected number of updates');
  assert.ok(Object.values(after).every(value => Number.isFinite(value) && value >= 0 && value <= 1));
  assert.ok(Object.values(snapshot.weights).flat().every(Number.isFinite), 'weights must remain finite across task orders');
  assert.ok(Object.values(snapshot.bias).every(Number.isFinite), 'bias must remain finite across task orders');
  results.push({ order: order.join('>'), before, after, absoluteTargetError: errors, meanAbsoluteTargetError: Number((Object.values(errors).reduce((a, b) => a + b, 0) / patterns.length).toFixed(4)) });
}

// Repair after intentionally wrong feedback. We report the error at every
// phase boundary and require the corrected target to move in the right direction.
const repair = new ParametricPolicyLearner();
const repairProbe = { id: 'repair-probe', features: new Array(FEATURE_COUNT).fill(0), target: .12 };
train(repair, repairProbe, .9, 80);
const afterWrongFeedback = predict(repair, repairProbe);
train(repair, repairProbe, repairProbe.target, 120);
const afterRepair = predict(repair, repairProbe);
assert.ok(afterRepair < afterWrongFeedback - .15, `correct feedback should repair the prediction: ${afterWrongFeedback} -> ${afterRepair}`);

const orderErrors = results.map(row => row.meanAbsoluteTargetError);
const metrics = {
  taskCount: patterns.length,
  taskOrders: results.length,
  updatesPerOrder: rounds * patterns.length,
  meanAbsoluteTargetErrorByOrder: orderErrors,
  orderSensitivitySpread: Number((Math.max(...orderErrors) - Math.min(...orderErrors)).toFixed(4)),
  repair: {
    target: repairProbe.target,
    afterWrongFeedback: Number(afterWrongFeedback.toFixed(4)),
    afterRepair: Number(afterRepair.toFixed(4)),
    repairGain: Number((afterWrongFeedback - afterRepair).toFixed(4)),
  },
  finiteBoundedParameters: 'PASS',
  claims: 'synthetic deterministic probes; not a production quality score',
};
console.log('P26_LEARNING_CONTINUAL_MATRIX=' + JSON.stringify(metrics));
