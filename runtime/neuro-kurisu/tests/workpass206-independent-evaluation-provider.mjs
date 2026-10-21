import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { withIndependentCandidateEvaluation } from '../src/organism/learning/P23IndependentEvaluationProvider.ts';

const canonical = value => value === null || typeof value !== 'object'
  ? JSON.stringify(value)
  : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).filter(key => value[key] !== undefined).sort()
      .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const tasks = [
  { taskId: 'validation-task', trialId: 'validation-1', seed: 17, split: 'validation', input: { prompt: 'v' }, requiredCapabilityIds: ['summarize'], expectedStepIds: ['read', 'summarize'] },
  { taskId: 'holdout-task', trialId: 'holdout-1', seed: 31, split: 'holdout', input: { prompt: 'h' }, requiredCapabilityIds: ['summarize'], expectedStepIds: ['read', 'summarize'] },
];
let configRequests = 0;
let sandboxRuns = 0;
const providerSuppliedEvaluator = async () => { throw new Error('provider evaluator must be replaced'); };
let retainedProviderOutput;
const provider = withIndependentCandidateEvaluation(
  async input => {
    // A provider must not be able to rewrite the repair context used to derive
    // independent evaluation authority.
    input.repairFingerprints[0] = 'provider-mutated-fingerprint';
    input.repairEvidence.push({ failureFingerprint: 'provider-mutated-evidence' });
    retainedProviderOutput = {
      proposal: { proposalId: 'proposal-' + input.skillId, metadata: { source: 'trusted-provider' } },
      sourceCandidateId: 'source-candidate',
      baseline: { validation: [{ taskId: 'baseline-validation', taskSuccess: { passed: true, passRate: 1 } }], holdout: [] },
      candidateEvaluation: { validation: [], holdout: [] },
      generate: async () => ({ payload: { code: 'candidate-v1' } }),
      evaluateRevisedCandidate: providerSuppliedEvaluator,
    };
    const output = retainedProviderOutput;
    setTimeout(() => {
      output.proposal.metadata.source = 'mutated-after-return';
      output.baseline.validation[0].taskId = 'mutated-baseline';
    }, 0);
    return output;
  },
  input => {
    configRequests++;
    assert.equal(input.skillId, 'skill-summarizer');
    assert.deepEqual(input.repairFingerprints, ['repair-fingerprint'],
      'evaluator configuration must receive the pre-provider repair fingerprint snapshot');
    assert.deepEqual(input.repairEvidence, [],
      'provider mutations must not alter the repair evidence used to configure evaluation');
    return {
      tasks,
      environmentFingerprint: 'f'.repeat(64),
      executor: { async execute({ task }) { sandboxRuns++; return { runId: 'run-' + task.trialId, observedStepIds: ['read', 'summarize'] }; } },
      verifier: { async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: ['summarize'] }; } },
      safetyScanner: { async scan() { return { violationCount: 0 }; } },
    };
  },
);
const prepared = await provider({
  skillId: 'skill-summarizer',
  repairFingerprints: ['repair-fingerprint'],
  repairEvidence: [],
});
assert.notEqual(prepared.evaluateRevisedCandidate, providerSuppliedEvaluator,
  'runtime wrapper must replace provider-supplied evaluator');
await new Promise(resolve => setTimeout(resolve, 10));
assert.equal(prepared.proposal.metadata.source, 'trusted-provider',
  'provider-retained proposal references must not rewrite prepared revision inputs');
assert.equal(prepared.baseline.validation[0].taskId, 'baseline-validation',
  'provider-retained baseline references must not rewrite baseline evidence after return');
const payload = { code: 'candidate-v1' };
const evaluated = await prepared.evaluateRevisedCandidate({
  payload, payloadFingerprint: digest(payload),
  baseline: { validation: [], holdout: [] },
  previousEvaluation: { validation: [], holdout: [] },
});
assert.equal(configRequests, 1);
assert.equal(sandboxRuns, 2);
assert.equal(evaluated.evaluation.validation.length, 1);
assert.equal(evaluated.evaluation.holdout.length, 1);
assert.equal(evaluated.evaluationFingerprint, digest(evaluated.evaluation));
console.log('WorkPass206 independent evaluator provider wiring: PASS');
