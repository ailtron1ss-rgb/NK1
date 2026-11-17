import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createLearningExperimentPlan } from '../src/organism/learning/LearningExperimentPlan.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
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

// The configured phase is part of the validated evaluator identity. Mutating
// the caller-owned config after factory construction must not relabel evidence.
const manifest = [
  { taskId: 'scope-v-one', family: 'dm19-scope-family', split: 'validation', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('validation prompt one'), verifierId: 'dm19-scope-verifier', version: 'v1' },
  { taskId: 'scope-v-two', family: 'dm19-scope-family', split: 'validation', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('validation prompt two'), verifierId: 'dm19-scope-verifier', version: 'v1' },
  { taskId: 'scope-h-one', family: 'dm19-scope-family', split: 'holdout', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('holdout prompt one'), verifierId: 'dm19-scope-verifier', version: 'v1' },
  { taskId: 'scope-h-two', family: 'dm19-scope-family', split: 'holdout', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('holdout prompt two'), verifierId: 'dm19-scope-verifier', version: 'v1' },
];
const ledger = new VerifiedOutcomeLedger(manifest);
const planOptions = {
  seeds: [11, 12],
  resetEvery: [2],
  priorMethod: 'dm19:baseline',
  continuousMethod: 'dm19:candidate:1',
  resetMethodPrefix: 'dm19:candidate:',
};
const validationPlan = createLearningExperimentPlan(manifest, { ...planOptions, split: 'validation' });
const holdoutPlan = createLearningExperimentPlan(manifest, { ...planOptions, split: 'holdout' });
const mutableConfig = {
  tasks: [
    { taskId: 'scope-v-one', trialId: 'scope-v-trial-one', seed: 11, split: 'validation', input: { prompt: 'validation prompt one' }, requiredCapabilityIds: ['cap-a'], expectedStepIds: ['step-a'] },
    { taskId: 'scope-v-two', trialId: 'scope-v-trial-two', seed: 12, split: 'validation', input: { prompt: 'validation prompt two' }, requiredCapabilityIds: ['cap-a'], expectedStepIds: ['step-a'] },
  ],
  executor: { async execute({ context }) { return { runId: context.plannedRunId, observedStepIds: ['step-a'] }; } },
  verifier: { async verify({ execution, context }) { return { bindingVerified: execution.runId === context.plannedRunId, passed: true, coveredCapabilityIds: ['cap-a'] }; } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
  environmentFingerprint,
  evaluationScope: 'validation-only',
  experimentAuthority: {
    manifest, ledger, validationPlan, holdoutPlan,
    method: 'dm19:candidate:1',
    attempt: 1,
  },
};
const scopedEvaluator = createIndependentSkillCandidateEvaluator(mutableConfig);
mutableConfig.evaluationScope = 'paired';
const payload = { profile: 'scope-bound' };
const payloadFingerprint = createHash('sha256').update('{"profile":"scope-bound"}').digest('hex');
const scopedResult = await scopedEvaluator({ payload, payloadFingerprint });
assert.equal(scopedResult.evaluation.validation.length, 2);
assert.equal(scopedResult.evaluation.holdout.length, 0);
assert.equal(scopedResult.evaluation.provenance.experimentAuthority.evaluationScope, 'validation-only',
  'evaluator provenance must retain the phase validated at construction, not a later caller mutation');


console.log('DEVELOPMENTAL_MULTIVERSE_PHASE_EVALUATOR=PASS validation-only=PASS holdout-only=PASS paired-default=PASS');
