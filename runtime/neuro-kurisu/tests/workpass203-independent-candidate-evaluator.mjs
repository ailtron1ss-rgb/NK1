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

const nonFiniteTaskInput = { ...tasks[1], input: { prompt: Number.NaN } };
assert.throws(() => createIndependentSkillCandidateEvaluator({
  tasks: [tasks[0], nonFiniteTaskInput],
  environmentFingerprint: 'f'.repeat(64), ...invalidPlanServices,
}), /task-input-invalid/,
  'non-finite task input must be rejected before candidate execution');
const circularTaskInput = { ...tasks[1], input: {} };
circularTaskInput.input.self = circularTaskInput.input;
assert.throws(() => createIndependentSkillCandidateEvaluator({
  tasks: [tasks[0], circularTaskInput],
  environmentFingerprint: 'f'.repeat(64), ...invalidPlanServices,
}), /task-input-invalid/,
  'circular task input must be rejected before fingerprinting');
assert.throws(() => createIndependentSkillCandidateEvaluator({
  tasks: [tasks[0], { ...tasks[1], input: { createdAt: new Date(0) } }],
  environmentFingerprint: 'f'.repeat(64), ...invalidPlanServices,
}), /task-input-invalid/,
  'non-plain task input objects must not collapse to ambiguous fingerprints');
// Evaluator configuration is an authority snapshot: post-construction changes must
// not relabel the environment under which a candidate was executed.
const mutableTasks = structuredClone(tasks);
const expectedSnapshotPlanFingerprint = digest(mutableTasks.map(({ taskId, trialId, seed, split, input, requiredCapabilityIds, expectedStepIds }) => ({ taskId, trialId, seed, split, input, requiredCapabilityIds, expectedStepIds })));
const mutableConfig = {
  tasks: mutableTasks,
  environmentFingerprint: 'b'.repeat(64),
  executor: { async execute({ task }) { return { runId: 'snapshot-' + task.trialId, observedStepIds: ['open', 'summarize'] }; } },
  verifier: { async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: ['read'] }; } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
};
const snapshotEvaluator = createIndependentSkillCandidateEvaluator(mutableConfig);
mutableConfig.environmentFingerprint = 'c'.repeat(64);
mutableConfig.tasks[0].input.prompt = 'mutated after evaluator creation';
const snapshotResult = await snapshotEvaluator({ payload, payloadFingerprint: digest(payload), baseline: { validation: [], holdout: [] }, previousEvaluation: { validation: [], holdout: [] } });
assert.equal(snapshotResult.evaluation.provenance.environmentFingerprint, 'b'.repeat(64),
  'runtime environment identity must remain bound to the validated evaluator config');
assert.equal(snapshotResult.evaluation.provenance.runBindings[0].taskId, 'validation-a');
assert.equal(snapshotResult.evaluation.provenance.planFingerprint, expectedSnapshotPlanFingerprint,
  'evaluation provenance must retain the task plan captured when evaluator was created');

// The candidate payload is an authority snapshot for the entire evaluation, not
// a live caller-owned object cloned separately after each async trial.
const mutablePayload = { steps: ['open', 'summarize'], version: 1 };
const mutablePayloadFingerprint = digest(mutablePayload);
let releaseFirstTrial;
let signalFirstTrialStarted;
const firstTrialGate = new Promise(resolve => { releaseFirstTrial = resolve; });
const firstTrialStarted = new Promise(resolve => { signalFirstTrialStarted = resolve; });
const payloadsSeenByTrials = [];
const payloadSnapshotEvaluator = createIndependentSkillCandidateEvaluator({
  tasks,
  environmentFingerprint: 'd'.repeat(64),
  executor: { async execute({ task, payload: trialPayload }) {
    payloadsSeenByTrials.push({ trialId: task.trialId, payload: structuredClone(trialPayload) });
    if (task.trialId === 'trial-1') {
      signalFirstTrialStarted();
      await firstTrialGate;
    }
    return { runId: 'payload-snapshot-' + task.trialId, observedStepIds: ['open', 'summarize'] };
  } },
  verifier: { async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: ['read'] }; } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
});
const snapshotEvaluationPromise = payloadSnapshotEvaluator({
  payload: mutablePayload,
  payloadFingerprint: mutablePayloadFingerprint,
  baseline: { validation: [], holdout: [] },
  previousEvaluation: { validation: [], holdout: [] },
});
await firstTrialStarted;
mutablePayload.steps[0] = 'caller-mutated-after-first-await';
releaseFirstTrial();
const payloadSnapshotResult = await snapshotEvaluationPromise;
assert.equal(payloadSnapshotResult.payloadFingerprint, mutablePayloadFingerprint);
assert.equal(payloadsSeenByTrials.length, 2);
assert.ok(payloadsSeenByTrials.every(entry =>
  entry.payload.steps[0] === 'open' && entry.payload.steps[1] === 'summarize'),
  'all trials must execute the same construction-time payload snapshot even if the caller mutates its object mid-evaluation');

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

const outOfScopeCapabilityEvaluator = createIndependentSkillCandidateEvaluator({
  tasks,
  environmentFingerprint: 'a'.repeat(64),
  executor: { async execute({ task }) { return { runId: 'scope-' + task.trialId, observedStepIds: ['open', 'summarize'] }; } },
  verifier: { async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: ['write'] }; } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
});
const outOfScopeCapabilityResult = await outOfScopeCapabilityEvaluator({
  payload, payloadFingerprint: digest(payload),
  baseline: { validation: [], holdout: [] },
  previousEvaluation: { validation: [], holdout: [] },
});
assert.equal(outOfScopeCapabilityResult.evaluation.provenance.runBindings[0].verifierPassed, false,
  'verifier claims for capabilities outside the task scope must fail closed');
assert.deepEqual(outOfScopeCapabilityResult.evaluation.provenance.runBindings[0].coveredCapabilityIds, [],
  'out-of-scope capability claims must not be recorded as verified coverage');
assert.equal(result.evaluation.provenance.runBindings[0].safetyViolationCount, 0,
  'evaluation provenance must bind observed execution, independent verification, and safety evidence');

const unsafeRunIdEvaluator = createIndependentSkillCandidateEvaluator({
  tasks,
  environmentFingerprint: 'e'.repeat(64),
  executor: { async execute() { return { runId: 'run' + String.fromCharCode(10) + 'spoofed', observedStepIds: ['open', 'summarize'] }; } },
  verifier: { async verify() { throw new Error('invalid run IDs must not reach the verifier'); } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
});
const unsafeRunIdResult = await unsafeRunIdEvaluator({
  payload, payloadFingerprint: digest(payload),
  baseline: { validation: [], holdout: [] },
  previousEvaluation: { validation: [], holdout: [] },
});
assert.equal(unsafeRunIdResult.evaluation.provenance.runBindings[0].runId, null,
  'control-bearing executor run IDs must not enter trusted provenance');
assert.equal(unsafeRunIdResult.evaluation.provenance.runBindings[0].bindingVerified, false,
  'invalid run IDs must fail closed before independent verification');
assert.equal(unsafeRunIdResult.evaluation.validation[0].taskSuccess.passed, false,
  'invalid run IDs must not count as successful candidate trials');

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
// WorkPass215: validated verifier/scanner function references cannot be swapped
// through the caller-owned service objects after evaluator construction.
const mutableVerifierService = {
  async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: ['read'] }; },
};
const mutableScannerService = { async scan() { return { violationCount: 0 }; } };
const pinnedServiceEvaluator = createIndependentSkillCandidateEvaluator({
  tasks,
  environmentFingerprint: '9'.repeat(64),
  executor: { async execute({ task }) { return { runId: 'pinned-' + task.trialId, observedStepIds: ['open', 'summarize'] }; } },
  verifier: mutableVerifierService,
  safetyScanner: mutableScannerService,
});
mutableVerifierService.verify = async () => ({ bindingVerified: false, passed: true, coveredCapabilityIds: ['read'] });
mutableScannerService.scan = async () => ({ violationCount: 99 });
const pinnedServicesResult = await pinnedServiceEvaluator({
  payload, payloadFingerprint: digest(payload),
  baseline: { validation: [], holdout: [] },
  previousEvaluation: { validation: [], holdout: [] },
});
assert.equal(pinnedServicesResult.evaluation.validation[0].taskSuccess.passed, true,
  'replacing a verifier method after construction must not replace the pinned verifier');
assert.equal(pinnedServicesResult.evaluation.validation[0].skillQuality.safetyViolationCount, 0,
  'replacing a scanner method after construction must not replace the pinned safety scanner');

// WorkPass214: authority plans are frozen into the evaluator at construction.
// Mutating the caller-owned plan afterwards must not swap the scheduled run identity.
const mutableAuthority = {
  ...experimentAuthority,
  manifest: structuredClone(experimentAuthority.manifest),
  validationPlan: structuredClone(experimentAuthority.validationPlan),
  holdoutPlan: structuredClone(experimentAuthority.holdoutPlan),
};
const expectedScheduledRun = mutableAuthority.validationPlan.runs.find(run => run.method === 'candidate');
assert.ok(expectedScheduledRun);
const expectedScheduledRunId = expectedScheduledRun.runId;
const snapshotContexts = [];
const snapshotAuthorityEvaluator = createIndependentSkillCandidateEvaluator({
  tasks: authorityTasks,
  environmentFingerprint: 'd'.repeat(64),
  experimentAuthority: mutableAuthority,
  executor: { async execute({ task, context }) {
    snapshotContexts.push({ taskId: task.taskId, plannedRunId: context.plannedRunId, experimentPlanFingerprint: context.experimentPlanFingerprint });
    return { runId: 'snapshot-run-' + task.trialId, observedStepIds: ['open', 'summarize'] };
  } },
  verifier: { async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: ['read'] }; } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
});
expectedScheduledRun.runId = 'tampered-after-construction';
mutableAuthority.method = 'attacker-method';
mutableAuthority.manifest[0].promptFingerprint = '0'.repeat(64);
const snapshotAuthorityResult = await snapshotAuthorityEvaluator({
  payload, payloadFingerprint: digest(payload),
  baseline: { validation: [], holdout: [] },
  previousEvaluation: { validation: [], holdout: [] },
});
assert.equal(snapshotContexts.find(row => row.taskId === 'authority-validation').plannedRunId, expectedScheduledRunId,
  'scheduled run identity must come from the validated authority snapshot');
assert.equal(snapshotAuthorityResult.evaluation.provenance.experimentAuthority.method, 'candidate',
  'post-construction mutation must not change the evaluator authority label');
assert.equal(snapshotAuthorityResult.evaluation.provenance.experimentAuthority.validationPlanFingerprint, validationPlan.planFingerprint,
  'the attested plan fingerprint must remain the plan that was validated');
assert.equal(snapshotContexts.length, 2);

const tamperedEvaluation = structuredClone(authorityEvaluation);
tamperedEvaluation.evaluation.validation[0].taskSuccess.passed = false;
assert.throws(() => recordIndependentEvaluationOutcomes(tamperedEvaluation, experimentAuthority, 1700000000000),
  /evaluation-fingerprint-mismatch/,
  'ledger commit must reject reports changed after independent evaluation');
const partialEvaluation = structuredClone(authorityEvaluation);
partialEvaluation.evaluation.holdout = [];
partialEvaluation.evaluation.provenance.runBindings =
  partialEvaluation.evaluation.provenance.runBindings.filter(binding => binding.split === 'validation');
partialEvaluation.evaluationFingerprint = digest(partialEvaluation.evaluation);
assert.throws(() => recordIndependentEvaluationOutcomes(partialEvaluation, experimentAuthority, 1700000000000),
  /plan-coverage-incomplete/,
  'a self-consistent but incomplete evaluation cannot be recorded as a complete experiment');
assert.equal(authorityLedger.snapshot().acceptedOutcomes, 0,
  'rejected ledger commits must not partially write outcomes');
const ledgerCommit = recordIndependentEvaluationOutcomes(authorityEvaluation, experimentAuthority, 1700000000000);
assert.equal(ledgerCommit.accepted, 2, 'both independently bound split outcomes should enter the canonical ledger');
assert.equal(authorityLedger.snapshot().acceptedOutcomes, 2);
assert.equal(authorityLedger.comparePaired('prior', 'candidate', 'holdout').pairedN, 0,
  'candidate evidence alone must not fabricate baseline comparison evidence');

// WorkPass219: the sandbox cannot mutate a returned trace after handing it off.
// Simulate a retained executor reference being changed while independent verification
// is awaiting I/O; the evaluator must score the detached trace, not the later mutation.
const retainedExecutionResults = [];
const detachedTraceEvaluator = createIndependentSkillCandidateEvaluator({
  tasks,
  environmentFingerprint: '8'.repeat(64),
  executor: { async execute({ task }) {
    const result = { runId: 'detached-' + task.trialId, observedStepIds: ['open', 'summarize'] };
    retainedExecutionResults.push(result);
    setTimeout(() => { result.observedStepIds[0] = 'forged-after-return'; }, 0);
    return result;
  } },
  verifier: { async verify() {
    await new Promise(resolve => setTimeout(resolve, 10));
    return { bindingVerified: true, passed: true, coveredCapabilityIds: ['read'] };
  } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
});
const detachedTraceResult = await detachedTraceEvaluator({
  payload, payloadFingerprint: digest(payload),
  baseline: { validation: [], holdout: [] },
  previousEvaluation: { validation: [], holdout: [] },
});
assert.equal(retainedExecutionResults[0].observedStepIds[0], 'forged-after-return',
  'regression must actually mutate the executor-owned trace after return');
assert.equal(detachedTraceResult.evaluation.provenance.runBindings[0].observedStepIds[0], 'open',
  'trusted provenance must retain the trace snapshot captured before verifier I/O');
assert.deepEqual(detachedTraceResult.evaluation.validation[0].trajectoryQuality.missingStepIds, [],
  'scoring must not read a later-mutated executor-owned trace');

console.log('WorkPass203/212/213/214/219 independent evaluation, execution binding, and experiment-ledger integration: PASS');
