import assert from 'node:assert/strict';
import { planSkillRevision } from '../src/organism/learning/SkillRevisionPlan.ts';

const report = (taskId, trialId, safetyViolationCount = 0, passed = true) => ({
  taskId,
  trialId,
  taskSuccess: { passed, passRate: passed ? 1 : 0 },
  skillQuality: {
    functionalCoverage: 1,
    executability: 1,
    safety: safetyViolationCount ? 0 : 1,
    aggregate: safetyViolationCount ? 0.8 : 1,
    missingCapabilityIds: [],
    safetyViolationCount,
  },
  trajectoryQuality: {
    keyPointRecall: 1,
    executionOrder: 1,
    completeness: 1,
    aggregate: 1,
    missingStepIds: [],
    unexpectedStepIds: [],
  },
});

const validationSafe = [report('validation-task-safe', 'validation-trial-safe')];
const holdoutSafetyFailure = [report('SECRET_HOLDOUT_TASK', 'SECRET_HOLDOUT_TRIAL', 1)];
const safetyFitness = {
  eligible: false,
  reasons: ['candidate-safety-violations-present', 'SECRET_HOLDOUT_REASON'],
  feedback: ['SECRET_HOLDOUT_FEEDBACK: safety failure on SECRET_HOLDOUT_TASK'],
  holdoutDelta01: -0.9,
  holdoutTaskSuccessDelta01: -0.8,
  holdoutTrajectoryDelta01: -0.7,
  holdoutSkillQualityDelta01: -0.6,
};
const safetyPlan = planSkillRevision(validationSafe, holdoutSafetyFailure, safetyFitness);
assert.equal(safetyPlan.blockedBySafety, true, 'holdout safety failure must still block revision');
assert.deepEqual(safetyPlan.targets, [], 'a blocked plan must not manufacture validation repair targets');
assert.equal(safetyPlan.optimizerInstruction, '', 'a blocked plan must not produce generator instructions');
const safetyPlanJson = JSON.stringify(safetyPlan);
for (const secret of [
  'SECRET_HOLDOUT_TASK',
  'SECRET_HOLDOUT_TRIAL',
  'SECRET_HOLDOUT_REASON',
  'SECRET_HOLDOUT_FEEDBACK',
]) {
  assert.ok(!safetyPlanJson.includes(secret), `blocked plan must not expose ${secret}`);
}
assert.ok(!Object.hasOwn(safetyPlan, 'candidateEligible'), 'the plan must not export a holdout-derived eligibility bit');

// A validation failure may guide repair, but even aggregate holdout direction,
// gate reasons and evaluator feedback must remain outside the revision plan.
const validationWeak = [report('validation-task-weak', 'validation-trial-weak', 0, false)];
const holdoutRegression = [report('SECRET_HOLDOUT_TASK_2', 'SECRET_HOLDOUT_TRIAL_2', 0, false)];
const regressionFitness = {
  eligible: false,
  reasons: [
    'holdout-regression-exceeds-tolerance',
    'holdout-task-success-regression-exceeds-tolerance',
    'SECRET_HOLDOUT_REASON_2',
  ],
  feedback: [
    'Aggregate holdout evaluation indicates regression.',
    'SECRET_HOLDOUT_FEEDBACK_2: SECRET_HOLDOUT_TASK_2 / SECRET_HOLDOUT_TRIAL_2',
  ],
  holdoutDelta01: -0.1,
  holdoutTaskSuccessDelta01: -0.2,
  holdoutTrajectoryDelta01: -0.3,
  holdoutSkillQualityDelta01: -0.4,
  holdoutFamilyRegressions: 2,
};
const generalizationPlan = planSkillRevision(validationWeak, holdoutRegression, regressionFitness);
const generalizationJson = JSON.stringify(generalizationPlan);
assert.deepEqual(
  generalizationPlan.targets.map(target => ({
    dimension: target.dimension,
    affectedTaskIds: target.affectedTaskIds,
    evidenceIds: target.evidenceIds,
  })),
  [{
    dimension: 'task-success',
    affectedTaskIds: ['validation-task-weak'],
    evidenceIds: ['validation-trial-weak'],
  }],
  'revision targets must be derived exclusively from validation reports',
);
for (const secret of [
  'SECRET_HOLDOUT_TASK_2',
  'SECRET_HOLDOUT_TRIAL_2',
  'SECRET_HOLDOUT_REASON_2',
  'SECRET_HOLDOUT_FEEDBACK_2',
  'holdout-regression-exceeds-tolerance',
  'Aggregate holdout evaluation indicates regression',
  'generalization gap',
  'holdout-generalization',
]) {
  assert.ok(!generalizationJson.includes(secret), `revision plan must not expose ${secret}`);
}
assert.ok(generalizationPlan.optimizerInstruction.includes('validation-task-weak'));
assert.ok(!Object.hasOwn(generalizationPlan, 'candidateEligible'), 'the plan must not export a holdout-derived eligibility bit');

// If validation is healthy and only holdout regresses, there is no repair target.
// P23 must refuse to generate a candidate instead of tuning against the holdout.
const validationHealthy = [report('validation-task-healthy', 'validation-trial-healthy')];
const holdoutOnlyFailure = [report('SECRET_HOLDOUT_ONLY_TASK', 'SECRET_HOLDOUT_ONLY_TRIAL', 0, false)];
const holdoutOnlyPlan = planSkillRevision(validationHealthy, holdoutOnlyFailure, regressionFitness);
assert.deepEqual(holdoutOnlyPlan.targets, [], 'holdout-only regression must not create a generator target');
assert.equal(holdoutOnlyPlan.overallFitness01, 1, 'the plan score must describe validation evidence only');
assert.ok(!JSON.stringify(holdoutOnlyPlan).includes('SECRET_HOLDOUT_ONLY'));

// A hostile gate report proves the planner never reads holdout-derived accessors.
const hostileFitness = Object.defineProperties({}, {
  eligible: { enumerable: true, get() { throw new Error('holdout-eligible-read'); } },
  reasons: { enumerable: true, get() { throw new Error('holdout-reasons-read'); } },
  feedback: { enumerable: true, get() { throw new Error('holdout-feedback-read'); } },
  holdoutDelta01: { enumerable: true, get() { throw new Error('holdout-delta-read'); } },
});
assert.doesNotThrow(
  () => planSkillRevision(validationWeak, holdoutRegression, hostileFitness),
  'the planner must not read gate-report fields that may encode holdout results',
);

console.log('P23_REVISION_PLAN_HOLDOUT_ISOLATION=PASS');
