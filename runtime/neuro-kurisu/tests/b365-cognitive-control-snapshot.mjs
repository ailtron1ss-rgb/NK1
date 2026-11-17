import assert from 'node:assert/strict';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';

const neural = new B365UnifiedNeuroCausalCore();
const before = neural.cognitiveControlSnapshot();
assert.equal(before.tick, 0);
assert.equal(before.version, 1);

neural.step({
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

const snapshot = neural.cognitiveControlSnapshot();
assert.equal(snapshot.version, 1);
assert.equal(snapshot.tick, 1);
for (const value of [
  snapshot.predictionError01, snapshot.plasticity01, snapshot.neuromodulation01,
  snapshot.sparseActivity01, snapshot.recurrentCoherence01, snapshot.neuralConfidence01,
  snapshot.modelAgreement01, snapshot.counterfactualDivergence01, snapshot.goalField01,
  snapshot.actionEntropy01, snapshot.allostatic.drive01, snapshot.allostatic.arousal01,
  snapshot.allostatic.exploration01, snapshot.allostatic.preservation01,
  snapshot.allostatic.reflection01, snapshot.allostatic.socialApproach01,
  snapshot.selfModel.agency01, snapshot.selfModel.continuity01,
  snapshot.selfModel.growthReadiness01, snapshot.selfModel.identityConflict01,
  snapshot.goalAuthorship.ownership01, snapshot.goalAuthorship.commitment01,
  snapshot.goalAuthorship.revisionPressure01,
]) {
  assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, `invalid neural control signal: ${value}`);
}
assert.equal(snapshot.tick, neural.diagnostics().version === 14 ? 1 : snapshot.tick);
snapshot.allostatic.drive01 = 0;
snapshot.selfModel.agency01 = 0;
const fresh = neural.cognitiveControlSnapshot();
assert.notEqual(fresh.allostatic.drive01, 0, 'snapshot must not expose mutable internal state');
assert.notEqual(fresh.selfModel.agency01, 0, 'snapshot must not expose mutable internal state');

console.log('B365_COGNITIVE_CONTROL_SNAPSHOT_PASS');
