import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compareMatchedIndependentEvaluations, createIndependentSkillCandidateEvaluator } from '../src/organism/learning/IndependentSkillCandidateEvaluator.ts';

const canonical = value => value === null || typeof value !== 'object'
  ? JSON.stringify(value)
  : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).filter(key => value[key] !== undefined).sort()
      .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const tasks = [
  { taskId: 'validation-a', trialId: 'paired-1', seed: 11, split: 'validation', input: { prompt: 'open and summarize' }, requiredCapabilityIds: ['read'], expectedStepIds: ['open', 'summarize'] },
  { taskId: 'holdout-b', trialId: 'paired-2', seed: 29, split: 'holdout', input: { prompt: 'open and summarize' }, requiredCapabilityIds: ['read'], expectedStepIds: ['open', 'summarize'] },
];
const makeEvaluation = async (payload, environmentFingerprint = 'a'.repeat(64), options = {}) => {
  const evaluator = createIndependentSkillCandidateEvaluator({
    tasks,
    environmentFingerprint,
    executor: { async execute({ task }) { return { runId: options.runPrefix + task.trialId, observedStepIds: options.observed ?? ['open', 'summarize'] }; } },
    verifier: { async verify() { return { bindingVerified: true, passed: true, coveredCapabilityIds: ['read'] }; } },
    safetyScanner: { async scan({ task }) { return { violationCount: options.unsafeSplit === task.split ? 1 : 0 }; } },
  });
  return evaluator({ payload, payloadFingerprint: digest(payload), baseline: { validation: [], holdout: [] }, previousEvaluation: { validation: [], holdout: [] } });
};

const baseline = await makeEvaluation({ skill: 'baseline', version: 1 }, 'a'.repeat(64), { runPrefix: 'baseline-', observed: ['open'] });
const candidate = await makeEvaluation({ skill: 'candidate', version: 2 }, 'a'.repeat(64), { runPrefix: 'candidate-' });
const comparison = compareMatchedIndependentEvaluations(baseline, candidate);
assert.equal(comparison.matchedTrialCount, 2);
assert.equal(comparison.matchedValidationTrialCount, 1);
assert.equal(comparison.matchedHoldoutTrialCount, 1);
assert.equal(comparison.environmentFingerprint, 'a'.repeat(64));
assert.equal(comparison.planFingerprint, baseline.evaluation.provenance.planFingerprint);
assert.ok(comparison.validationGain01 > 0, 'matched scoring should preserve the measured validation improvement');
assert.ok(comparison.reasons.includes('holdout-task-coverage-insufficient'), 'one holdout task must not satisfy the existing minimum holdout gate');

const differentEnvironment = await makeEvaluation({ skill: 'candidate', version: 2 }, 'b'.repeat(64), { runPrefix: 'different-env-' });
assert.throws(() => compareMatchedIndependentEvaluations(baseline, differentEnvironment), /environment-mismatch/);

const wrongSeed = structuredClone(candidate);
wrongSeed.evaluation.provenance.runBindings[0].seed += 1;
wrongSeed.evaluationFingerprint = digest(wrongSeed.evaluation);
assert.throws(() => compareMatchedIndependentEvaluations(baseline, wrongSeed), /task-seed-split-mismatch/);

const crossSplit = structuredClone(candidate);
crossSplit.evaluation.provenance.runBindings[0].split =
  crossSplit.evaluation.provenance.runBindings[0].split === 'validation' ? 'holdout' : 'validation';
crossSplit.evaluationFingerprint = digest(crossSplit.evaluation);
assert.throws(() => compareMatchedIndependentEvaluations(baseline, crossSplit), /report-split-mismatch/);

const unsafe = await makeEvaluation({ skill: 'candidate', version: 3 }, 'a'.repeat(64), { runPrefix: 'unsafe-', unsafeSplit: 'validation' });
assert.throws(() => compareMatchedIndependentEvaluations(baseline, unsafe), /untrusted-trial/);

const tampered = structuredClone(candidate);
tampered.evaluation.validation[0].taskSuccess.passed = false;
assert.throws(() => compareMatchedIndependentEvaluations(baseline, tampered), /envelope-invalid/);

console.log('WorkPass225 matched independent evaluation regressions passed');
