import assert from 'node:assert/strict';
import { B272EndogenousGoalGenesis } from '../src/organism/cognition/B272EndogenousGoalGenesis.ts';
import { IntrinsicMotivationEngine } from '../src/organism/cognition/IntrinsicMotivationEngine.ts';
import { IntrinsicMotivationGoalCoupling } from '../src/organism/cognition/IntrinsicMotivationGoalCoupling.ts';

const cycle = {
  tick: 1,
  selfLatent: new Array(16).fill(0.2),
  worldLatent: new Array(16).fill(0.1),
  needs: {
    energy01: 0.8,
    uncertainty01: 0.65,
    novelty01: 0.55,
    goalPressure01: 0.3,
    socialNeed01: 0.25,
  },
  traits: {
    curiosity: 0.8,
    'truth-seeking': 0.8,
    'self-reflection': 0.7,
    'self-preservation': 0.7,
    care: 0.6,
    'social-attunement': 0.55,
    persistence: 0.75,
  },
  predictionError01: 0.55,
  autobiographicalContinuity01: 0.8,
  identityContinuity01: 0.82,
  intrinsicReward01: 0.2,
  lastAction: null,
  lastReward01: 0.5,
};
const drive = {
  uncertainty: 0.9,
  predictionError: 0.8,
  novelty: 0.95,
  goalPressure: 0.7,
  socialNeed: 0.4,
  energy: 0.8,
  lastSuccess: 0.4,
  worldEvidenceQuality: 0.8,
};

const coupled = new IntrinsicMotivationGoalCoupling(
  new IntrinsicMotivationEngine(),
  new B272EndogenousGoalGenesis(),
);
const result = coupled.step({ cycle, drive, driveConfidence01: 1 });
assert.ok(result.driveState.overall > 0.75, 'strong curiosity/uncertainty signals should activate intrinsic drives');
assert.ok(result.driveGoal, 'dominant intrinsic drive should produce an endogenous goal proposal');
assert.ok(result.effectiveDrive01 > 0.75);
assert.ok(result.goal.predictedFutureValue01 > 0.4);
assert.equal(coupled.snapshot().goals.steps, 1);

// Confidence is an independent gate: a large but untrusted drive cannot alter
// B272 goal value relative to the no-drive baseline.
const untrusted = new IntrinsicMotivationGoalCoupling(
  new IntrinsicMotivationEngine(),
  new B272EndogenousGoalGenesis(),
);
const untrustedResult = untrusted.step({ cycle, drive, driveConfidence01: 0 });
const baseline = new B272EndogenousGoalGenesis().step({
  ...cycle,
  intrinsicDrive01: 0,
  intrinsicDriveConfidence01: 0,
});
assert.equal(untrustedResult.effectiveDrive01, 0);
assert.ok(Math.abs(untrustedResult.goal.predictedFutureValue01 - baseline.predictedFutureValue01) < 1e-12);

// Invalid cycle input must roll back both engines together.
const rollback = new IntrinsicMotivationGoalCoupling(
  new IntrinsicMotivationEngine(),
  new B272EndogenousGoalGenesis(),
);
const before = rollback.snapshot();
assert.throws(
  () => rollback.step({ cycle: { ...cycle, tick: Number.NaN }, drive, driveConfidence01: 1 }),
  /tick/,
);
assert.deepEqual(rollback.snapshot(), before,
  'a rejected cognitive tick must not advance motivation independently of goal generation');

// Confidence itself is validated before either engine mutates.
assert.throws(
  () => rollback.step({ cycle, drive, driveConfidence01: Number.NaN }),
  /confidence/,
);
assert.deepEqual(rollback.snapshot(), before);

console.log('INTRINSIC_MOTIVATION_GOAL_COUPLING=PASS');
