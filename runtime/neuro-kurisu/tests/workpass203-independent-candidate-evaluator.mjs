import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createIndependentSkillCandidateEvaluator } from '../src/organism/learning/IndependentSkillCandidateEvaluator.ts';

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
  verifier: { async verify() { return { passed: true, coveredCapabilityIds: ['read'] }; } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
});
const result = await evaluator({ payload, payloadFingerprint: digest(payload), baseline: { validation: [], holdout: [] }, previousEvaluation: { validation: [], holdout: [] } });
assert.equal(runs, 2);
assert.equal(result.payloadFingerprint, digest(payload));
assert.equal(result.evaluation.validation.length, 1);
assert.equal(result.evaluation.holdout.length, 1);
assert.equal(result.evaluation.validation[0].taskSuccess.passed, true);
assert.match(result.evaluationFingerprint, /^[a-f0-9]{64}$/);

await assert.rejects(() => evaluator({ payload: { ...payload, version: 2 }, payloadFingerprint: digest(payload), baseline: { validation: [], holdout: [] }, previousEvaluation: { validation: [], holdout: [] } }), /payload-fingerprint-mismatch/);
assert.throws(() => createIndependentSkillCandidateEvaluator({
  tasks: [tasks[0], { ...tasks[1], taskId: tasks[0].taskId }],
  environmentFingerprint: 'b'.repeat(64),
  executor: { async execute() { throw new Error('unused'); } },
  verifier: { async verify() { return { passed: true, coveredCapabilityIds: ['read'] }; } },
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
  verifier: { async verify() { return { passed: true, coveredCapabilityIds: ['read'] }; } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
});
const duplicateRuns = await duplicateRunId({ payload, payloadFingerprint: digest(payload), baseline: { validation: [], holdout: [] }, previousEvaluation: { validation: [], holdout: [] } });
assert.equal(duplicateRuns.evaluation.validation[0].taskSuccess.passed, true);
assert.equal(duplicateRuns.evaluation.holdout[0].taskSuccess.passed, false,
  'a reused execution identity must not authenticate multiple independent trials');
assert.equal(duplicateRuns.evaluation.holdout[0].skillQuality.executability, 0);

console.log('WorkPass203 independent candidate evaluator: PASS');
