import assert from 'node:assert/strict';
import { SelfPriorDensityModel } from '../src/organism/cognition/SelfPriorDensityModel.ts';
import { IntrinsicMotivationEngine } from '../src/organism/cognition/IntrinsicMotivationEngine.ts';
import { IntrinsicMotivationGoalCoupling } from '../src/organism/cognition/IntrinsicMotivationGoalCoupling.ts';
import { B272EndogenousGoalGenesis } from '../src/organism/cognition/B272EndogenousGoalGenesis.ts';

const prior = new SelfPriorDensityModel(16);
for (let tick = 0; tick < 32; tick += 1) {
  const familiar = prior.observe(new Array(16).fill(0), tick + 1);
  assert.equal(familiar.mismatch01, 0);
}
const firstNovel = prior.observe(new Array(16).fill(1), 33);
assert.ok(firstNovel.confidence01 > 0.95, 'self-prior confidence should mature after ordered exposure');
assert.ok(firstNovel.mismatch01 > 0.7, 'a novel self-state should create a strong pre-update mismatch');
let adapted = firstNovel;
for (let tick = 0; tick < 40; tick += 1) adapted = prior.observe(new Array(16).fill(1), 34 + tick);
assert.ok(adapted.mismatch01 < firstNovel.mismatch01,
  'repeated stable exposure should gradually adapt the self-prior');
assert.equal(prior.snapshot().sampleCount, 73);

const restored = new SelfPriorDensityModel(16);
restored.restore(prior.snapshot());
assert.deepEqual(restored.snapshot(), prior.snapshot());
assert.throws(() => prior.observe([0, 1]), /dimension-mismatch/);
assert.throws(() => prior.observe(new Array(16).fill(Number.NaN)), /finite-and-bounded/);
const malformed = new SelfPriorDensityModel(16);
malformed.restore({ version: 1, dimensions: 16, sampleCount: 1, effectiveSamples: 1, mean: [Number.NaN], variance: [1], lastAt: 1 });
assert.equal(malformed.snapshot().sampleCount, 0, 'invalid persisted prior should reset to a neutral state');

// Restored confidence must be supported by the paired counters that observe()
// advances together. A forged sampleCount must not make an empty prior trusted.
const forgedCount = new SelfPriorDensityModel(16);
forgedCount.restore({
  version: 1,
  dimensions: 16,
  sampleCount: 24,
  effectiveSamples: 0,
  mean: new Array(16).fill(1),
  variance: new Array(16).fill(0.02),
  lastAt: 24,
});
assert.equal(forgedCount.snapshot().sampleCount, 0,
  'inconsistent persisted counters must reset instead of manufacturing confidence');
assert.equal(forgedCount.predict(new Array(16).fill(1)).confidence01, 0);

// The effective-sample counter is an integer, capped at 64, and must equal the
// deterministic projection of sampleCount; a valid saturated snapshot remains restorable.
const fractionalCount = new SelfPriorDensityModel(16);
fractionalCount.restore({
  version: 1,
  dimensions: 16,
  sampleCount: 24,
  effectiveSamples: 23.5,
  mean: new Array(16).fill(0),
  variance: new Array(16).fill(1),
  lastAt: 24,
});
assert.equal(fractionalCount.snapshot().sampleCount, 0,
  'fractional effective sample counts must not be accepted');
const saturated = new SelfPriorDensityModel(16);
saturated.restore({
  version: 1,
  dimensions: 16,
  sampleCount: 128,
  effectiveSamples: 64,
  mean: new Array(16).fill(0),
  variance: new Array(16).fill(1),
  lastAt: 128,
});
assert.equal(saturated.snapshot().sampleCount, 128);
assert.equal(saturated.snapshot().effectiveSamples, 64);
assert.equal(saturated.predict(new Array(16).fill(0)).confidence01, 1);

const invalidTimestamp = new SelfPriorDensityModel(16);
invalidTimestamp.restore({
  version: 1,
  dimensions: 16,
  sampleCount: 0,
  effectiveSamples: 0,
  mean: new Array(16).fill(0),
  variance: new Array(16).fill(1),
  lastAt: Number.NaN,
});
assert.equal(invalidTimestamp.snapshot().sampleCount, 0,
  'non-finite restore timestamps must reset the persisted prior');

const cycle = {
  tick: 1,
  selfLatent: new Array(16).fill(0.2),
  worldLatent: new Array(16).fill(0.1),
  needs: { energy01: 0.8, uncertainty01: 0.65, novelty01: 0.55, goalPressure01: 0.3, socialNeed01: 0.25 },
  traits: { curiosity: 0.8, 'truth-seeking': 0.8, 'self-reflection': 0.7, 'self-preservation': 0.7, care: 0.6, 'social-attunement': 0.55, persistence: 0.75 },
  predictionError01: 0.55,
  autobiographicalContinuity01: 0.8,
  identityContinuity01: 0.82,
  intrinsicReward01: 0.2,
  lastAction: null,
  lastReward01: 0.5,
};
const drive = {
  uncertainty: 0.9, predictionError: 0.8, novelty: 0.95, goalPressure: 0.7,
  socialNeed: 0.4, energy: 0.8, lastSuccess: 0.4, worldEvidenceQuality: 0.8,
};
const coupling = new IntrinsicMotivationGoalCoupling(
  new IntrinsicMotivationEngine(),
  new B272EndogenousGoalGenesis(),
  new SelfPriorDensityModel(16),
);
for (let tick = 0; tick < 32; tick += 1) {
  coupling.step({ cycle: { ...cycle, tick }, drive, driveConfidence01: 1, selfObservation: new Array(16).fill(0), at: tick + 1 });
}
const baselineHomeostatic = new IntrinsicMotivationEngine().update(drive).homeostatic;
const mismatchResult = coupling.step({
  cycle: { ...cycle, tick: 32 },
  drive,
  driveConfidence01: 1,
  selfObservation: new Array(16).fill(1),
  at: 33,
});
assert.ok(mismatchResult.selfPrior.mismatch01 > 0.7);
assert.ok(mismatchResult.driveState.homeostatic > baselineHomeostatic,
  'self-prior mismatch should add a bounded familiarity-restoration drive');
assert.ok(mismatchResult.goal.predictedFutureValue01 > 0);

// Rejected B272 ticks roll the learned self-prior back with the other two owners.
const beforeRollback = coupling.snapshot();
assert.throws(() => coupling.step({
  cycle: { ...cycle, tick: Number.NaN },
  drive,
  driveConfidence01: 1,
  selfObservation: new Array(16).fill(0.5),
  at: 34,
}), /tick/);
assert.deepEqual(coupling.snapshot(), beforeRollback);
assert.throws(() => coupling.step({
  cycle,
  drive,
  driveConfidence01: 1,
  selfObservation: [0, 1],
  at: 35,
}), /dimension-mismatch/);
assert.deepEqual(coupling.snapshot(), beforeRollback);

console.log('SELF_PRIOR_HOMEOSTATIC_DRIVE=PASS');
