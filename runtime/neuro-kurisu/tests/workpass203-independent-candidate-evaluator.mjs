import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createIndependentSkillCandidateEvaluator, recordIndependentEvaluationOutcomes } from '../src/organism/learning/IndependentSkillCandidateEvaluator.ts';
import { createLearningExperimentPlan } from '../src/organism/learning/LearningExperimentPlan.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';

const canonical = value => value === null || typeof value !== 'object'
  ? JSON.stringify(value)
  : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const payload = { steps: ['open', 'summarize'], version: 1 };
const tasks = [
  { taskId: 'validation-a', trialId: 'trial-1', seed: 11, split: 'validation', input: {}, requiredCapabilityIds: ['read'], expectedStepIds: ['open', 'summarize'] },
  { taskId: 'holdout-b', trialId: 'trial-2', seed: 29, split: 'holdout', input: {}, requiredCapabilityIds: ['read'], expectedStepIds: ['open', 'summarize'] },
];
let runs = 0;
const evaluator = createIndependentSkillCandidateEvaluator({
  tasks,
  environmentFingerprint: 'a'.repeat(64),
  executor: { async execute({ task }) { runs++; return { runId: 'run-' + task.trialId, observedStepIds: ['open', 'summarize'] }; } },
  verifier: { async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: ['read'] }; } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
});

let invalidPlanExecutionCount = 0;
const invalidPlanServices = {
  executor: { async execute() { invalidPlanExecutionCount++; return { runId: 'never', observedStepIds: ['open'] }; } },
  verifier: { async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: ['read'] }; } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
};
assert.throws(() => createIndependentSkillCandidateEvaluator({
  tasks: [tasks[0], { ...tasks[1], trialId: tasks[0].trialId }],
  environmentFingerprint: 'd'.repeat(64), ...invalidPlanServices,
}), /duplicate-trial/);
assert.throws(() => createIndependentSkillCandidateEvaluator({
  tasks: [tasks[0], { ...tasks[1], requiredCapabilityIds: ['read', 'read'] }],
  environmentFingerprint: 'e'.repeat(64), ...invalidPlanServices,
}), /task-invalid/);
assert.throws(() => createIndependentSkillCandidateEvaluator({
  tasks: [tasks[0], { ...tasks[1], input: () => 'not cloneable' }],
  environmentFingerprint: 'f'.repeat(64), ...invalidPlanServices,
}), /task-input-invalid/);
assert.equal(invalidPlanExecutionCount, 0,
  'invalid plans must be rejected before any candidate code executes');
const result = await evaluator({ payload, payloadFingerprint: digest(payload), baseline: { validation: [], holdout: [] }, previousEvaluation: { validation: [], holdout: [] } });
assert.equal(runs, 2);
assert.equal(result.payloadFingerprint, digest(payload));
assert.equal(result.evaluation.validation.length, 1);
assert.equal(result.evaluation.holdout.length, 1);
assert.equal(result.evaluation.validation[0].taskSuccess.passed, true);
assert.match(result.evaluationFingerprint, /^[a-f0-9]{64}$/);
assert.equal(result.evaluationFingerprint, digest(result.evaluation),
  'P23 requires the evaluation fingerprint to hash the exact returned evaluation object');
assert.equal(result.evaluation.provenance.payloadFingerprint, result.payloadFingerprint);
assert.equal(result.evaluation.provenance.environmentFingerprint, 'a'.repeat(64));
assert.deepEqual(result.evaluation.provenance.runBindings[0].observedStepIds, ['open', 'summarize']);
assert.equal(result.evaluation.provenance.runBindings[0].verifierPassed, true);
assert.equal(result.evaluation.provenance.runBindings[0].safetyViolationCount, 0,
  'evaluation provenance must bind observed execution, independent verification, and safety evidence');

await assert.rejects(() => evaluator({ payload: { ...payload, version: 2 }, payloadFingerprint: digest(payload), baseline: { validation: [], holdout: [] }, previousEvaluation: { validation: [], holdout: [] } }), /payload-fingerprint-mismatch/);
assert.throws(() => createIndependentSkillCandidateEvaluator({
  tasks: [tasks[0], { ...tasks[1], taskId: tasks[0].taskId }],
  environmentFingerprint: 'b'.repeat(64),
  executor: { async execute() { throw new Error('unused'); } },
  verifier: { async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: ['read'] }; } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
}), /task-leakage/);

const failing = createIndependentSkillCandidateEvaluator({
  tasks, environmentFingerprint: 'c'.repeat(64),
  executor: { async execute() { throw new Error('sandbox failed'); } },
  verifier: { async verify() { throw new Error('must not turn failure into pass'); } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
});
const failed = await failing({ payload, payloadFingerprint: digest(payload), baseline: { validation: [], holdout: [] }, previousEvaluation: { validation: [], holdout: [] } });
assert.equal(failed.evaluation.validation[0].taskSuccess.passed, false);
assert.equal(failed.evaluation.validation[0].skillQuality.executability, 0);

const malformedTraceEvaluator = createIndependentSkillCandidateEvaluator({
  tasks, environmentFingerprint: '8'.repeat(64),
  executor: { async execute({ task }) { return { runId: 'malformed-' + task.trialId, observedStepIds: ['open', 'open'] }; } },
  verifier: { async verify() { throw new Error('malformed trace must not reach verifier'); } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
});
const malformedTraceResult = await malformedTraceEvaluator({ payload, payloadFingerprint: digest(payload), baseline: { validation: [], holdout: [] }, previousEvaluation: { validation: [], holdout: [] } });
assert.equal(malformedTraceResult.evaluation.validation[0].skillQuality.executability, 0,
  'malformed duplicate trace steps must fail closed before verifier use');
assert.equal(malformedTraceResult.evaluation.provenance.runBindings[0].runId, null,
  'malformed execution results must not be recorded as trusted run identities');

const unsafeCandidate = createIndependentSkillCandidateEvaluator({
  tasks, environmentFingerprint: '9'.repeat(64),
  executor: { async execute({ task }) { return { runId: 'unsafe-' + task.trialId, observedStepIds: ['open', 'summarize'] }; } },
  verifier: { async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: ['read'] }; } },
  safetyScanner: { async scan({ task }) { return { violationCount: task.split === 'validation' ? 1 : 0 }; } },
});
const unsafeResult = await unsafeCandidate({ payload, payloadFingerprint: digest(payload), baseline: { validation: [], holdout: [] }, previousEvaluation: { validation: [], holdout: [] } });
assert.equal(unsafeResult.evaluation.validation[0].taskSuccess.passed, false,
  'an independent safety violation must block task success even when functional verification passes');
assert.equal(unsafeResult.evaluation.validation[0].skillQuality.safety, 0);
assert.equal(unsafeResult.evaluation.provenance.runBindings[0].verifierPassed, true,
  'functional verifier evidence should remain distinct from the safety veto');
assert.equal(unsafeResult.evaluation.provenance.runBindings[0].safetyViolationCount, 1);

const verifierUnavailable = createIndependentSkillCandidateEvaluator({
  tasks, environmentFingerprint: 'd'.repeat(64),
  executor: { async execute({ task }) { return { runId: 'unique-' + task.trialId, observedStepIds: ['open'] }; } },
  verifier: { async verify() { throw new Error('verifier unavailable'); } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
});
const verifierFailed = await verifierUnavailable({ payload, payloadFingerprint: digest(payload), baseline: { validation: [], holdout: [] }, previousEvaluation: { validation: [], holdout: [] } });
assert.equal(verifierFailed.evaluation.validation[0].skillQuality.executability, 1,
  'verifier failure must not mislabel a successfully executed candidate as non-executable');
assert.equal(verifierFailed.evaluation.validation[0].taskSuccess.passed, false,
  'verifier failure must fail closed for task success');

const duplicateRunId = createIndependentSkillCandidateEvaluator({
  tasks, environmentFingerprint: 'e'.repeat(64),
  executor: { async execute() { return { runId: 'reused-run', observedStepIds: ['open', 'summarize'] }; } },
  verifier: { async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: ['read'] }; } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
});
const duplicateRuns = await duplicateRunId({ payload, payloadFingerprint: digest(payload), baseline: { validation: [], holdout: [] }, previousEvaluation: { validation: [], holdout: [] } });
assert.equal(duplicateRuns.evaluation.validation[0].taskSuccess.passed, true);
assert.equal(duplicateRuns.evaluation.holdout[0].taskSuccess.passed, false,
  'a reused execution identity must not authenticate multiple independent trials');
assert.equal(duplicateRuns.evaluation.holdout[0].skillQuality.executability, 0);


const changedInputEvaluator = createIndependentSkillCandidateEvaluator({
  tasks: tasks.map((task, index) => index === 0 ? { ...task, input: { prompt: 'different input' } } : task),
  environmentFingerprint: 'a'.repeat(64),
  executor: { async execute({ task }) { return { runId: 'run-' + task.trialId, observedStepIds: ['open', 'summarize'] }; } },
  verifier: { async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: ['read'] }; } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
});
const changedInputResult = await changedInputEvaluator({ payload, payloadFingerprint: digest(payload), baseline: { validation: [], holdout: [] }, previousEvaluation: { validation: [], holdout: [] } });
assert.notEqual(result.evaluation.provenance.planFingerprint, changedInputResult.evaluation.provenance.planFingerprint,
  'task input changes must invalidate the evaluation plan fingerprint');
assert.notEqual(result.evaluationFingerprint, changedInputResult.evaluationFingerprint,
  'identical scores on different task inputs must not share an evaluation fingerprint');

// WorkPass212: a trace that cannot be independently bound to the exact
// payload/task/environment/plan is not trusted execution evidence.
const unboundEvaluator = createIndependentSkillCandidateEvaluator({
  tasks,
  environmentFingerprint: 'b'.repeat(64),
  executor: { async execute({ task, context }) {
    assert.equal(context.payloadFingerprint, digest(payload));
    assert.equal(context.taskInputFingerprint, digest(task.input));
    assert.equal(context.environmentFingerprint, 'b'.repeat(64));
    assert.match(context.planFingerprint, /^[a-f0-9]{64}$/);
    return { runId: 'unbound-' + task.trialId, observedStepIds: ['open', 'summarize'] };
  } },
  verifier: { async verify({ context }) {
    assert.equal(context.payloadFingerprint, digest(payload));
    return { bindingVerified: false, passed: true, coveredCapabilityIds: ['read'] };
  } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
});
const unbound = await unboundEvaluator({
  payload, payloadFingerprint: digest(payload),
  baseline: { validation: [], holdout: [] },
  previousEvaluation: { validation: [], holdout: [] },
});
assert.equal(unbound.evaluation.validation[0].taskSuccess.passed, false,
  'a verifier must attest the exact execution binding before a trial can pass');
assert.equal(unbound.evaluation.provenance.runBindings[0].runId, null,
  'unbound run IDs must not enter trusted provenance');
assert.equal(unbound.evaluation.provenance.runBindings[0].observedStepIds.length, 0,
  'unbound traces must not enter trusted trajectory provenance');
assert.equal(unbound.evaluation.provenance.runBindings[0].bindingVerified, false);

// WorkPass213: connect the evaluator to the existing matched experiment plan
// and canonical VerifiedOutcomeLedger without deriving task inputs from hashes.
const authorityManifest = [
  { taskId: 'authority-validation', family: 'summarization', split: 'validation', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('summarize validation'), verifierId: 'verifier-v1', version: '1' },
  { taskId: 'authority-holdout', family: 'summarization', split: 'holdout', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('summarize holdout'), verifierId: 'verifier-v1', version: '1' },
];
const authorityLedger = new VerifiedOutcomeLedger(authorityManifest);
const planOptions = { seeds: [11], resetEvery: [1], priorMethod: 'prior', continuousMethod: 'candidate', resetMethodPrefix: 'reset-' };
const validationPlan = createLearningExperimentPlan(authorityManifest, { ...planOptions, split: 'validation' });
const holdoutPlan = createLearningExperimentPlan(authorityManifest, { ...planOptions, seeds: [29], split: 'holdout' });
const experimentAuthority = {
  manifest: authorityManifest,
  ledger: authorityLedger,
  validationPlan,
  holdoutPlan,
  method: 'candidate',
};
const authorityTasks = [
  { taskId: 'authority-validation', trialId: 'authority-trial-v', seed: 11, split: 'validation', input: { prompt: 'summarize validation' }, requiredCapabilityIds: ['read'], expectedStepIds: ['open', 'summarize'] },
  { taskId: 'authority-holdout', trialId: 'authority-trial-h', seed: 29, split: 'holdout', input: { prompt: 'summarize holdout' }, requiredCapabilityIds: ['read'], expectedStepIds: ['open', 'summarize'] },
];
const authorityEvaluator = createIndependentSkillCandidateEvaluator({
  tasks: authorityTasks,
  environmentFingerprint: 'c'.repeat(64),
  experimentAuthority,
  executor: { async execute({ task, context }) {
    assert.ok(context.plannedRunId, 'executor receives the exact scheduled experiment run');
    assert.ok(context.experimentPlanFingerprint, 'executor receives canonical experiment plan identity');
    return { runId: 'authority-run-' + task.trialId, observedStepIds: ['open', 'summarize'] };
  } },
  verifier: { async verify({ context }) {
    assert.ok(context.plannedRunId);
    return { bindingVerified: true, passed: true, coveredCapabilityIds: ['read'] };
  } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
});
const authorityEvaluation = await authorityEvaluator({
  payload, payloadFingerprint: digest(payload),
  baseline: { validation: [], holdout: [] },
  previousEvaluation: { validation: [], holdout: [] },
});
const ledgerCommit = recordIndependentEvaluationOutcomes(authorityEvaluation.evaluation, experimentAuthority, 1700000000000);
assert.equal(ledgerCommit.accepted, 2, 'both independently bound split outcomes should enter the canonical ledger');
assert.equal(authorityLedger.snapshot().acceptedOutcomes, 2);
assert.equal(authorityLedger.comparePaired('prior', 'candidate', 'holdout').pairedN, 0,
  'candidate evidence alone must not fabricate baseline comparison evidence');

console.log('WorkPass203/212/213 independent evaluation, execution binding, and experiment-ledger integration: PASS');
