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

const strictFamilyComparison = compareMatchedIndependentEvaluations(baseline, candidate, {
  minimumValidationFamilies: 1,
  minimumHoldoutFamilies: 1,
});
assert.equal(strictFamilyComparison.validationFamiliesEvaluated, 0);
assert.equal(strictFamilyComparison.holdoutFamiliesEvaluated, 0);
assert.ok(strictFamilyComparison.reasons.includes('validation-family-coverage-insufficient'),
  'strict evaluation must not pass the validation split without canonical family labels');
assert.ok(strictFamilyComparison.reasons.includes('holdout-family-coverage-insufficient'),
  'strict evaluation must not pass the holdout split without canonical family labels');
assert.equal(strictFamilyComparison.eligible, false,
  'strict family policy must be propagated through the matched independent evaluator');

// WorkPass403: task/family coverage must also replicate across common matched seeds.
function makeFamilyTasks(seedCount) {
  const rows = [];
  for (const [split, ids] of [
    ['validation', ['validation-family-task-a', 'validation-family-task-b']],
    ['holdout', ['holdout-family-task-a', 'holdout-family-task-b']],
  ]) {
    for (const taskId of ids) {
      for (let seed = 1; seed <= seedCount; seed++) {
        rows.push({
          taskId,
          trialId: `${taskId}-seed-${seed}`,
          seed: (split === 'validation' ? 100 : 200) + seed,
          split,
          taskFamily: 'canonical-test-family',
          input: { prompt: `execute ${taskId}` },
          requiredCapabilityIds: ['read'],
          expectedStepIds: ['open', 'summarize'],
        });
      }
    }
  }
  return rows;
}
async function makeFamilyEvaluation(
  payload, seedCount, runPrefix, observedStepIds, coveredCapabilitiesByTask = ['read'],
) {
  const familyTasks = makeFamilyTasks(seedCount);
  const evaluator = createIndependentSkillCandidateEvaluator({
    tasks: familyTasks,
    environmentFingerprint: 'd'.repeat(64),
    executor: { async execute({ task }) {
      const observed = typeof observedStepIds === 'function' ? observedStepIds(task) : observedStepIds;
      return { runId: runPrefix + task.trialId, observedStepIds: observed };
    } },
    verifier: { async verify({ task }) {
      const coveredCapabilityIds = typeof coveredCapabilitiesByTask === 'function'
        ? coveredCapabilitiesByTask(task) : coveredCapabilitiesByTask;
      return { bindingVerified: true, passed: true, coveredCapabilityIds };
    } },
    safetyScanner: { async scan() { return { violationCount: 0 }; } },
  });
  return evaluator({
    payload,
    payloadFingerprint: digest(payload),
    baseline: { validation: [], holdout: [] },
    previousEvaluation: { validation: [], holdout: [] },
  });
}
const twoSeedBaseline = await makeFamilyEvaluation({ skill: 'baseline', version: 1 }, 2, 'seed-baseline-', ['open']);
const twoSeedCandidate = await makeFamilyEvaluation({ skill: 'candidate', version: 2 }, 2, 'seed-candidate-', ['open', 'summarize']);
const seedCoverageOptions = {
  minimumValidationFamilySeeds: 3,
  minimumHoldoutFamilySeeds: 3,
};
const familyPolicy = {
  minimumValidationFamilies: 1,
  minimumHoldoutFamilies: 1,
  minimumValidationFamilyTasks: 2,
  minimumHoldoutFamilyTasks: 2,
};
const underReplicated = compareMatchedIndependentEvaluations(
  twoSeedBaseline, twoSeedCandidate, familyPolicy, seedCoverageOptions,
);
assert.ok(underReplicated.validationGain01 > 0.005,
  'two-seed candidate must show an aggregate improvement so the test isolates replication coverage');
assert.equal(underReplicated.validationFamiliesEvaluatedForSeedCoverage, 1);
assert.equal(underReplicated.holdoutFamiliesEvaluatedForSeedCoverage, 1);
assert.equal(underReplicated.validationFamiliesWithSufficientSeeds, 0);
assert.equal(underReplicated.holdoutFamiliesWithSufficientSeeds, 0);
assert.ok(underReplicated.reasons.includes('validation-family-seed-coverage-insufficient'));
assert.ok(underReplicated.reasons.includes('holdout-family-seed-coverage-insufficient'));
assert.equal(underReplicated.eligible, false,
  'two common seeds cannot satisfy a production policy requiring three paired seeds per family');

const threeSeedBaseline = await makeFamilyEvaluation({ skill: 'baseline', version: 1 }, 3, 'seed3-baseline-', ['open']);
const threeSeedCandidate = await makeFamilyEvaluation({ skill: 'candidate', version: 2 }, 3, 'seed3-candidate-', ['open', 'summarize']);
const replicated = compareMatchedIndependentEvaluations(
  threeSeedBaseline, threeSeedCandidate, familyPolicy, seedCoverageOptions,
);
assert.equal(replicated.validationFamiliesWithSufficientSeeds, 1);
assert.equal(replicated.holdoutFamiliesWithSufficientSeeds, 1);
assert.equal(replicated.validationFamilySeedCoverageFailures, 0);
assert.equal(replicated.holdoutFamilySeedCoverageFailures, 0);
assert.equal(replicated.eligible, true, JSON.stringify(replicated));
assert.equal(replicated.validationFamiliesEvaluatedForConfidenceInterval, 1);
assert.equal(replicated.holdoutFamiliesEvaluatedForConfidenceInterval, 1);
assert.equal(replicated.validationFamilyConfidenceBoundFailures, 0);
assert.equal(replicated.holdoutFamilyConfidenceBoundFailures, 0);
assert.ok(typeof replicated.validationFamilyMeanDelta === 'number' && replicated.validationFamilyMeanDelta > 0);
assert.ok(typeof replicated.validationFamilyLowerBoundMinimum === 'number' && replicated.validationFamilyLowerBoundMinimum > 0);
assert.ok(typeof replicated.validationFamilyUpperBoundMaximum === 'number');
assert.ok(typeof replicated.holdoutFamilyMeanDelta === 'number' && replicated.holdoutFamilyMeanDelta > 0);
assert.ok(typeof replicated.holdoutFamilyLowerBoundMinimum === 'number' && replicated.holdoutFamilyLowerBoundMinimum >= -0.10);
assert.ok(typeof replicated.holdoutFamilyUpperBoundMaximum === 'number');

// WorkPass404: positive macro means alone are not enough when one of three
// seed-level outcomes goes strongly backwards. The paired bootstrap lower bound
// must reveal that the gain is not reliable for either split.
const noisyBaseline = await makeFamilyEvaluation(
  { skill: 'baseline', version: 1 }, 3, 'noisy-base-', ['open'], ['read'],
);
const noisyCandidate = await makeFamilyEvaluation(
  { skill: 'candidate', version: 2 }, 3, 'noisy-candidate-',
  task => task.seed % 100 === 3 ? ['unexpected'] : ['open', 'summarize'],
  task => task.seed % 100 === 3 ? [] : ['read'],
);
const noisyComparison = compareMatchedIndependentEvaluations(
  noisyBaseline, noisyCandidate, familyPolicy, seedCoverageOptions,
);
assert.ok(noisyComparison.validationGain01 > 0.005,
  'the positive family mean should make this a confidence test rather than a mean-score test');
assert.equal(noisyComparison.validationTaskRegressions, 0,
  'the regression on one seed is not a severe average regression for a whole task');
assert.ok(noisyComparison.reasons.includes('validation-family-improvement-confidence-insufficient'),
  'validation promotion requires a positive lower bootstrap confidence bound per family');
assert.ok(noisyComparison.reasons.includes('holdout-family-confidence-bound-regression-exceeds-tolerance'),
  'holdout confidence bounds must also prevent a noisy average from hiding a risky seed');
assert.equal(noisyComparison.eligible, false);
assert.ok(typeof noisyComparison.validationFamilyLowerBoundMinimum === 'number');
assert.ok(noisyComparison.validationFamilyLowerBoundMinimum <= 0);
assert.ok(typeof noisyComparison.holdoutFamilyLowerBoundMinimum === 'number');
assert.ok(noisyComparison.holdoutFamilyLowerBoundMinimum < -0.10);


assert.throws(() => compareMatchedIndependentEvaluations(
  twoSeedBaseline, twoSeedCandidate, familyPolicy,
  { minimumValidationFamilySeeds: Number.NaN, minimumHoldoutFamilySeeds: 3 },
), /matched-independent-evaluation-minimum-validation-family-seeds-invalid/);
assert.throws(() => compareMatchedIndependentEvaluations(
  twoSeedBaseline, twoSeedCandidate, familyPolicy,
  { minimumValidationFamilySeeds: 3, minimumHoldoutFamilySeeds: 1.5 },
), /matched-independent-evaluation-minimum-holdout-family-seeds-invalid/);
assert.throws(() => compareMatchedIndependentEvaluations(
  twoSeedBaseline, twoSeedCandidate, familyPolicy,
  { minimumValidationFamilySeeds: 1001, minimumHoldoutFamilySeeds: 3 },
), /matched-independent-evaluation-minimum-validation-family-seeds-invalid/);

let seedOptionGetterCalls = 0;
const accessorSeedOptions = Object.defineProperty({}, 'minimumValidationFamilySeeds', {
  enumerable: true,
  get() { seedOptionGetterCalls += 1; return Number.NaN; },
});
assert.throws(() => compareMatchedIndependentEvaluations(
  twoSeedBaseline, twoSeedCandidate, familyPolicy, accessorSeedOptions,
), /matched-independent-evaluation-seed-coverage-options-invalid/);
assert.equal(seedOptionGetterCalls, 0,
  'seed-coverage validation must reject accessor options without executing untrusted getters');

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

console.log('WorkPass225 matched independent evaluation regressions passed; strict family policy, paired-seed coverage, bootstrap confidence gate, and invalid-option rejection verified');
