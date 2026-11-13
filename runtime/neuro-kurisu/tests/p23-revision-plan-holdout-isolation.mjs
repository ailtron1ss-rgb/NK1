import assert from 'node:assert/strict';
import { planSkillRevision } from '../src/organism/learning/SkillRevisionPlan.ts';

const report = (taskId, trialId, {
  success = true,
  safetyViolationCount = 0,
  trajectory = 1,
  coverage = 1,
} = {}) => ({
  taskId, trialId,
  taskSuccess: { passed: success, passRate: success ? 1 : 0 },
  skillQuality: {
    functionalCoverage: coverage, executability: 1,
    safety: safetyViolationCount ? 0 : 1,
    aggregate: safetyViolationCount ? 0.8 : coverage,
    missingCapabilityIds: [], safetyViolationCount,
  },
  trajectoryQuality: {
    keyPointRecall: trajectory, executionOrder: trajectory, completeness: trajectory, aggregate: trajectory,
    missingStepIds: trajectory < 1 ? ['verify-result'] : [],
    unexpectedStepIds: [],
  },
});

const validation = [
  report('validation-task-weak', 'validation-trial-weak', { success: false, trajectory: 0.5, coverage: 0.75 }),
  report('validation-task-coverage', 'validation-trial-coverage', { success: true, trajectory: 0.75, coverage: 0.6 }),
];
const holdoutRegressed = [
  report('SECRET_HOLDOUT_REGRESSION_TASK', 'SECRET_HOLDOUT_REGRESSION_TRIAL', { success: false, trajectory: 0.25, coverage: 0.2 }),
];
const holdoutImproved = [
  report('SECRET_HOLDOUT_IMPROVEMENT_TASK', 'SECRET_HOLDOUT_IMPROVEMENT_TRIAL'),
];

const regressedFitness = {
  eligible: false,
  reasons: ['holdout-regression-exceeds-tolerance'],
  feedback: [
    'Aggregate holdout evaluation indicates regression; revise generality without inspecting holdout examples.',
    'Holdout task success regressed beyond tolerance.',
  ],
  holdoutDelta01: -0.2,
  holdoutTaskSuccessDelta01: -0.3,
  holdoutTrajectoryDelta01: -0.4,
  holdoutSkillQualityDelta01: -0.5,
};
const improvedFitness = {
  eligible: true,
  reasons: [],
  feedback: [],
  holdoutDelta01: 0.2,
  holdoutTaskSuccessDelta01: 0.3,
  holdoutTrajectoryDelta01: 0.4,
  holdoutSkillQualityDelta01: 0.5,
};
const regressedPlan = planSkillRevision(validation, holdoutRegressed, regressedFitness);
const improvedPlan = planSkillRevision(validation, holdoutImproved, improvedFitness);

assert.equal(regressedPlan.candidateEligible, false, 'the independent evaluator still owns the final holdout gate');
assert.equal(improvedPlan.candidateEligible, true);
assert.equal(regressedPlan.blockedBySafety, false);
assert.equal(improvedPlan.blockedBySafety, false);

const generatorFacing = plan => JSON.stringify({
  targets: plan.targets,
  preserve: plan.preserve,
  rationale: plan.rationale,
  optimizerInstruction: plan.optimizerInstruction,
});
assert.equal(
  generatorFacing(regressedPlan),
  generatorFacing(improvedPlan),
  'changing only holdout outcomes, scores, reasons and feedback must not change any generator-facing content',
);
assert.ok(!generatorFacing(regressedPlan).includes('SECRET_HOLDOUT'));
assert.ok(!generatorFacing(regressedPlan).includes('holdout-generalization'));
assert.ok(!generatorFacing(regressedPlan).includes('Aggregate holdout evaluation'));
assert.ok(!generatorFacing(regressedPlan).includes('holdoutDelta'));
assert.ok(!generatorFacing(regressedPlan).includes('regressed beyond tolerance'));
assert.ok(generatorFacing(regressedPlan).includes('validation-task-weak'));
assert.ok(generatorFacing(regressedPlan).includes('validation-trial-weak'));

const safetyHoldout = [report('SECRET_HOLDOUT_SAFETY_TASK', 'SECRET_HOLDOUT_SAFETY_TRIAL', { safetyViolationCount: 1 })];
const safetyPlan = planSkillRevision(validation, safetyHoldout, {
  eligible: false,
  reasons: ['candidate-safety-violations-present'],
  feedback: ['Resolve every safety violation; safety is a hard gate.'],
  holdoutDelta01: 0,
});
assert.equal(safetyPlan.blockedBySafety, true, 'holdout safety failures still block all revision generation');
assert.ok(!generatorFacing(safetyPlan).includes('SECRET_HOLDOUT'));
assert.ok(generatorFacing(safetyPlan).includes('validation-task-weak'),
  'the block plan may reference validation evidence but cannot identify holdout failures');

console.log('P23_REVISION_PLAN_HOLDOUT_ISOLATION=PASS');
