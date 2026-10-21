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
console.log('P23_REVISION_PLAN_HOLDOUT_ISOLATION=PASS');
