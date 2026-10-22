import assert from 'node:assert/strict';
import { planSkillRevision } from '../src/organism/learning/SkillRevisionPlan.ts';

const report = (taskId, trialId, safetyViolationCount) => ({
  taskId, trialId,
  taskSuccess: { passed: true, passRate: 1 },
  skillQuality: {
    functionalCoverage: 1, executability: 1, safety: safetyViolationCount ? 0 : 1,
    aggregate: safetyViolationCount ? 0.8 : 1,
    missingCapabilityIds: [], safetyViolationCount,
  },
  trajectoryQuality: {
    keyPointRecall: 1, executionOrder: 1, completeness: 1, aggregate: 1,
    missingStepIds: [], unexpectedStepIds: [],
  },
});

const validation = [report('validation-task-safe', 'validation-trial-safe', 0)];
const holdout = [report('SECRET_HOLDOUT_TASK', 'SECRET_HOLDOUT_TRIAL', 1)];
const plan = planSkillRevision(validation, holdout, {
  eligible: false, reasons: ['candidate-safety-violations-present'], feedback: [], holdoutDelta01: 0,
});
assert.equal(plan.blockedBySafety, true, 'holdout safety failure still blocks revision');
const generatorFacing = JSON.stringify({ targets: plan.targets, optimizerInstruction: plan.optimizerInstruction, rationale: plan.rationale });
assert.ok(!generatorFacing.includes('SECRET_HOLDOUT_TASK'), 'holdout task ID must not reach generator-facing plan');
assert.ok(!generatorFacing.includes('SECRET_HOLDOUT_TRIAL'), 'holdout trial ID must not reach generator-facing plan');
assert.ok(generatorFacing.includes('validation-task-safe'), 'validation evidence remains available for bounded repair');
// A non-safety holdout regression may influence only the aggregate signal;
 // its individual task/trial identity must remain absent from generator-facing content.
const validationWeak = [report('validation-task-weak', 'validation-trial-weak', 0)];
validationWeak[0].taskSuccess = { passed: false, passRate: 0.5 };
const holdoutRegression = [report('SECRET_HOLDOUT_TASK_2', 'SECRET_HOLDOUT_TRIAL_2', 0)];
const generalizationPlan = planSkillRevision(validationWeak, holdoutRegression, {
  eligible: false,
  reasons: ['holdout-regression-exceeds-tolerance'],
  feedback: ['Aggregate holdout evaluation indicates regression; revise generality without inspecting holdout examples, then request a fresh independent evaluation.'],
  holdoutDelta01: -0.1,
});
const generalizationFacing = JSON.stringify({
  targets: generalizationPlan.targets,
  optimizerInstruction: generalizationPlan.optimizerInstruction,
  rationale: generalizationPlan.rationale,
});
assert.ok(!generalizationFacing.includes('SECRET_HOLDOUT_TASK_2'), 'holdout task ID must not reach generalization prompt');
assert.ok(!generalizationFacing.includes('SECRET_HOLDOUT_TRIAL_2'), 'holdout trial ID must not reach generalization prompt');
assert.ok(!generalizationFacing.includes('task-specific failures'), 'generator must not be instructed to inspect holdout cases');
assert.ok(generalizationFacing.includes('Aggregate evaluation indicates a generalization gap'), 'only aggregate generalization signal should reach generator');

console.log('P23_REVISION_PLAN_HOLDOUT_ISOLATION=PASS');
