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
    tasks: options.tasks ?? tasks,
    environmentFingerprint,
    executor: { async execute({ task }) { return { runId: (options.runPrefix ?? 'run-') + task.trialId, observedStepIds: options.observedForTask ? options.observedForTask(task) : (options.observed ?? ['open', 'summarize']) }; } },
    verifier: { async verify({ task }) {
      const failed = task.seed === options.failedSeed && task.split === (options.failedSplit ?? task.split) &&
        (!options.failedTaskIds || options.failedTaskIds.includes(task.taskId));
      return { bindingVerified: true, passed: !failed, coveredCapabilityIds: ['read'] };
    } },
    safetyScanner: { async scan({ task }) { return { violationCount: options.unsafeSplit === task.split ? 1 : 0 }; } },
  });
  return evaluator({ payload, payloadFingerprint: digest(payload), baseline: { validation: [], holdout: [] }, previousEvaluation: { validation: [], holdout: [] } });
};

const baseline = await makeEvaluation({ skill: 'baseline', version: 1 }, 'a'.repeat(64), { runPrefix: 'baseline-', observed: ['open'] });
const candidate = await makeEvaluation({ skill: 'candidate', version: 2 }, 'a'.repeat(64), { runPrefix: 'candidate-' });
const withSyntheticExperimentAuthority = (evaluation, method) => {
  const copy = structuredClone(evaluation);
  copy.evaluation.provenance.experimentAuthority = {
    manifestFingerprint: 'c'.repeat(64),
    validationPlanFingerprint: 'd'.repeat(64),
    holdoutPlanFingerprint: 'e'.repeat(64),
    method,
    attempt: 1,
  };
  for (const binding of copy.evaluation.provenance.runBindings) {
    binding.plannedRunId = `scheduled-${method}-${binding.trialId}`;
  }
  copy.evaluationFingerprint = digest(copy.evaluation);
  return copy;
};
const baselineWithAuthority = withSyntheticExperimentAuthority(baseline, 'baseline');
const candidateWithAuthority = withSyntheticExperimentAuthority(candidate, 'candidate');

assert.throws(
  () => compareMatchedIndependentEvaluations(baseline, candidate, { requireSeedGrowthGate: true }),
  /experiment-authority-required/,
  'strict growth analysis must reject envelopes without canonical experiment provenance',
);
const comparison = compareMatchedIndependentEvaluations(baseline, candidate);
assert.equal(comparison.matchedTrialCount, 2);
assert.equal(comparison.matchedValidationTrialCount, 1);
assert.equal(comparison.matchedHoldoutTrialCount, 1);
assert.equal(comparison.environmentFingerprint, 'a'.repeat(64));
assert.equal(comparison.planFingerprint, baseline.evaluation.provenance.planFingerprint);
assert.ok(comparison.validationGain01 > 0, 'matched scoring should preserve the measured validation improvement');
assert.ok(comparison.reasons.includes('holdout-task-coverage-insufficient'), 'one holdout task must not satisfy the existing minimum holdout gate');

const insufficientSeedComparison = compareMatchedIndependentEvaluations(baselineWithAuthority, candidateWithAuthority, {
  requireSeedGrowthGate: true,
});
assert.ok(insufficientSeedComparison.reasons.includes('independent-evaluation-validation-paired-seed-count-insufficient'));
assert.ok(insufficientSeedComparison.reasons.includes('independent-evaluation-holdout-paired-seed-count-insufficient'));
assert.ok(insufficientSeedComparison.reasons.includes('independent-evaluation-validation-confidence-lower-bound-insufficient'));
assert.equal(insufficientSeedComparison.eligible, false, 'a single seed cannot support promotion');

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


const growthSeeds = [11, 17, 23, 29, 31];
const growthTasks = [];
for (const seed of growthSeeds) {
  growthTasks.push(
    { taskId: 'validation-a', trialId: `validation-a-seed-${seed}`, seed, split: 'validation', input: { prompt: 'open and summarize validation' }, requiredCapabilityIds: ['read'], expectedStepIds: ['open', 'summarize'] },
    { taskId: 'validation-b', trialId: `validation-b-seed-${seed}`, seed, split: 'validation', input: { prompt: 'read and summarize validation' }, requiredCapabilityIds: ['read'], expectedStepIds: ['open', 'summarize'] },
    { taskId: 'holdout-a', trialId: `holdout-a-seed-${seed}`, seed, split: 'holdout', input: { prompt: 'open and summarize holdout' }, requiredCapabilityIds: ['read'], expectedStepIds: ['open', 'summarize'] },
    { taskId: 'holdout-b', trialId: `holdout-b-seed-${seed}`, seed, split: 'holdout', input: { prompt: 'read and summarize holdout' }, requiredCapabilityIds: ['read'], expectedStepIds: ['open', 'summarize'] },
  );
}
const growthBaseline = await makeEvaluation(
  { skill: 'growth-baseline', version: 1 },
  'a'.repeat(64),
  { tasks: growthTasks, runPrefix: 'growth-baseline-', observed: ['open'] },
);
const growthCandidate = await makeEvaluation(
  { skill: 'growth-candidate', version: 2 },
  'a'.repeat(64),
  {
    tasks: growthTasks,
    runPrefix: 'growth-candidate-',
    // Keep every validation seed positive while exercising a non-zero sample variance.
    observedForTask: task => task.seed === 31 && task.taskId === 'validation-a'
      ? ['open', 'summarize', 'extra-observed-step']
      : ['open', 'summarize'],
  },
);
const growthWithAuthorityBaseline = withSyntheticExperimentAuthority(growthBaseline, 'baseline');
const growthWithAuthorityCandidate = withSyntheticExperimentAuthority(growthCandidate, 'candidate');
const growth = compareMatchedIndependentEvaluations(growthWithAuthorityBaseline, growthWithAuthorityCandidate, {
  requireSeedGrowthGate: true,
});
assert.equal(growth.seedGrowthGateApplied, true);
assert.equal(growth.seedAnalysis.validation.pairedSeedCount, 5);
assert.equal(growth.seedAnalysis.holdout.pairedSeedCount, 5);
assert.equal(growth.matchedValidationTrialCount, 10);
assert.equal(growth.matchedHoldoutTrialCount, 10);
assert.equal(growth.seedAnalysis.validation.positiveSeedRate01, 1);
assert.ok(growth.seedAnalysis.validation.confidenceLower95Delta01 > 0);
assert.equal(growth.seedAnalysis.validation.completeSeedCoverage, true);
assert.equal(growth.seedAnalysis.holdout.completeSeedCoverage, true);
assert.equal(growth.eligible, true, 'consistent improvements across all seeds should pass the seed gate');

// Four held-out seeds improve; one independently verified task failure remains valid
// negative evidence and must not be silently discarded as "untrusted" merely because
// its verifier-bound outcome is false. The macro-average is positive, yet the strict
// per-seed regression limit blocks promotion.
const oneSeedRegression = await makeEvaluation(
  { skill: 'growth-candidate-with-regression', version: 3 },
  'a'.repeat(64),
  {
    tasks: growthTasks,
    runPrefix: 'growth-regression-',
    failedSeed: 31,
    failedSplit: 'holdout',
    failedTaskIds: ['holdout-a', 'holdout-b'],
  },
);
const regressionGate = compareMatchedIndependentEvaluations(
  growthWithAuthorityBaseline,
  withSyntheticExperimentAuthority(oneSeedRegression, 'candidate'),
  { requireSeedGrowthGate: true },
);
assert.ok(regressionGate.holdoutDelta01 > -0.02, 'aggregate holdout score should not expose this isolated regression by itself');
assert.ok(
  regressionGate.reasons.includes('independent-evaluation-holdout-seed-regression-exceeds-tolerance'),
  'a hidden regression on one seed must block promotion even when aggregate holdout is acceptable',
);
assert.equal(regressionGate.seedAnalysis.holdout.pairedSeedCount, 5);

console.log('WorkPass225 matched independent evaluation regressions passed');
