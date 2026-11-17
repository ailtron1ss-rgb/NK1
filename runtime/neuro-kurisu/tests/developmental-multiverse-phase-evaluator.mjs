import assert from 'node:assert/strict';
import { createIndependentSkillCandidateEvaluator } from '../src/organism/learning/IndependentSkillCandidateEvaluator.ts';

const services = {
  executor: { async execute() { return { runId: 'phase-run', observedStepIds: ['step-a'] }; } },
  verifier: { async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: ['cap-a'] }; } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
};
const environmentFingerprint = 'a'.repeat(64);
const tasksFor = split => [
  { taskId: split + '-one', trialId: split + '-trial-one', seed: 11, split, input: { prompt: 'scenario one' }, requiredCapabilityIds: ['cap-a'], expectedStepIds: ['step-a'] },
  { taskId: split + '-two', trialId: split + '-trial-two', seed: 12, split, input: { prompt: 'scenario two' }, requiredCapabilityIds: ['cap-a'], expectedStepIds: ['step-a'] },
];

assert.doesNotThrow(() => createIndependentSkillCandidateEvaluator({
  tasks: tasksFor('validation'),
  ...services,
  environmentFingerprint,
  evaluationScope: 'validation-only',
}), 'validation-only evaluation must not be forced to execute or reveal holdout tasks');
assert.doesNotThrow(() => createIndependentSkillCandidateEvaluator({
  tasks: tasksFor('holdout'),
  ...services,
  environmentFingerprint,
  evaluationScope: 'holdout-only',
}), 'holdout-only evaluation must not require validation tasks at execution time');
assert.throws(() => createIndependentSkillCandidateEvaluator({
  tasks: tasksFor('validation'),
  ...services,
  environmentFingerprint,
}), /validation-and-holdout-required/, 'the legacy paired mode must retain its two-split gate');

console.log('DEVELOPMENTAL_MULTIVERSE_PHASE_EVALUATOR=PASS validation-only=PASS holdout-only=PASS paired-default=PASS');
