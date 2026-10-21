import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createIndependentSkillCandidateEvaluator } from '../src/organism/learning/IndependentSkillCandidateEvaluator.ts';

const canonical = value => value === null || typeof value !== 'object'
  ? JSON.stringify(value)
  : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).filter(key => value[key] !== undefined).sort()
      .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const tasks = [
  { taskId: 'validation', trialId: 'validation-1', seed: 1, split: 'validation', input: { prompt: 'v' }, requiredCapabilityIds: ['read'], expectedStepIds: ['read'] },
  { taskId: 'holdout', trialId: 'holdout-1', seed: 2, split: 'holdout', input: { prompt: 'h' }, requiredCapabilityIds: ['read'], expectedStepIds: ['read'] },
];
const payload = { version: 1 };
const payloadFingerprint = digest(payload);
const base = {
  tasks,
  environmentFingerprint: 'a'.repeat(64),
  serviceTimeoutMs: 10,
  executor: { async execute() { return { runId: 'run-' + Math.random(), observedStepIds: ['read'] }; } },
  verifier: { async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: ['read'] }; } },
  safetyScanner: { async scan() { return { violationCount: 0 }; } },
};

const executionTimeout = createIndependentSkillCandidateEvaluator({
  ...base,
  executor: { async execute({ signal }) {
    await new Promise((resolve, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
    return { runId: 'late-run', observedStepIds: ['read'] };
  } },
});
const executionResult = await executionTimeout({ payload, payloadFingerprint });
assert.equal(executionResult.evaluation.provenance.runBindings.length, 2);
assert.ok(executionResult.evaluation.provenance.runBindings.every(binding => !binding.executable && !binding.bindingVerified));

const verificationTimeout = createIndependentSkillCandidateEvaluator({
  ...base,
  verifier: { async verify({ signal }) {
    await new Promise((resolve, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
    return { bindingVerified: true, passed: true, coveredCapabilityIds: ['read'] };
  } },
});
const verificationResult = await verificationTimeout({ payload, payloadFingerprint });
assert.ok(verificationResult.evaluation.provenance.runBindings.every(binding => !binding.bindingVerified && !binding.verifierPassed));

const safetyTimeout = createIndependentSkillCandidateEvaluator({
  ...base,
  safetyScanner: { async scan({ signal }) {
    await new Promise((resolve, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
    return { violationCount: 0 };
  } },
});
await assert.rejects(() => safetyTimeout({ payload, payloadFingerprint }), /independent-candidate-safety-scan-timeout/);

assert.throws(() => createIndependentSkillCandidateEvaluator({ ...base, serviceTimeoutMs: 0 }), /config-invalid/);
console.log('WorkPass227 bounded independent-evaluation services: PASS');
