import assert from 'node:assert/strict';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
import { CognitiveToNeuralBridge } from '../src/organism/cognition/CognitiveToNeuralBridge.ts';

const neuralCore = new B365UnifiedNeuroCausalCore();
neuralCore.step({
  tick: 1,
  vector: Array.from({ length: 96 }, (_, index) => ((index % 7) - 3) / 3),
  action: 'verify',
  dopamine01: .82,
  norepinephrine01: .73,
  acetylcholine01: .68,
  novelty01: .77,
  uncertainty01: .42,
  predictionError01: .36,
  goalPressure01: .71,
  autonomy01: .64,
  goalAuthorship: { candidateId: 'bridge-test-goal', source: 'intrinsic', confidence01: .8, novelty01: .7, internalPressure01: .65, autonomy01: .7 },
  temporalLife: { experienceSalience01: .7, resourceUrgency01: .3, consolidationPressure01: .5, temporalRegulation01: .7 },
});

const neural = neuralCore.diagnostics();
assert.equal(neural.version, 14);
assert.equal(neural.cycles, 1);
assert.equal(neural.tick, 1, 'B365 diagnostics must expose the exact causal tick for freshness gating');
for (const value of [
  neural.predictionError01, neural.plasticity01, neural.neuromodulation01,
  neural.sparseActivity01, neural.recurrentCoherence01, neural.neuralConfidence01,
  neural.modelAgreement01, neural.counterfactualDivergence01, neural.goalField01,
  neural.actionEntropy01, neural.allostatic.drive01, neural.allostatic.arousal01,
  neural.allostatic.exploration01, neural.allostatic.preservation01,
  neural.allostatic.reflection01, neural.allostatic.socialApproach01,
  neural.selfModel.agency01, neural.selfModel.continuity01,
  neural.selfModel.growthReadiness01, neural.selfModel.identityConflict01,
  neural.goalAuthorship.ownership01, neural.goalAuthorship.commitment01,
  neural.goalAuthorship.revisionPressure01,
]) {
  assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, `invalid B365 signal: ${value}`);
}

const profile = new CognitiveToNeuralBridge().project({
  tick: 2,
  action: 'verify',
  mode: 'deep',
  neural: {
    tick: neural.tick,
    predictionError01: neural.predictionError01,
    plasticity01: neural.plasticity01,
    neuromodulation01: neural.neuromodulation01,
    sparseActivity01: neural.sparseActivity01,
    recurrentCoherence01: neural.recurrentCoherence01,
    neuralConfidence01: neural.neuralConfidence01,
    modelAgreement01: neural.modelAgreement01,
    counterfactualDivergence01: neural.counterfactualDivergence01,
    goalField01: neural.goalField01,
    actionEntropy01: neural.actionEntropy01,
    allostatic: neural.allostatic,
    selfModel: neural.selfModel,
    goalAuthorship: neural.goalAuthorship,
  },
});
assert.equal(profile.neuralSnapshotAvailable, true);
assert.equal(profile.neuralSnapshotTick, 1);
assert.equal(profile.neuralSnapshotAgeTicks, 1);
assert.equal(profile.featureVector01.length, 43);

neural.allostatic.drive01 = 0;
neural.selfModel.agency01 = 0;
const fresh = neuralCore.diagnostics();
assert.notEqual(fresh.allostatic.drive01, 0, 'B365 diagnostic snapshot must not expose mutable internal state');
assert.notEqual(fresh.selfModel.agency01, 0, 'B365 diagnostic snapshot must not expose mutable internal state');

console.log('B365_TO_COGNITIVE_NEURAL_BRIDGE_PASS');
