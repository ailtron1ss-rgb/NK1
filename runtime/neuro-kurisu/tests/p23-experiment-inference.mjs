import assert from 'node:assert/strict';
import { evaluateOutcomePromotionPortfolio, holmAdjustPValues } from '../src/organism/learning/ExperimentInference.ts';
import { pairedSignTestPValue } from '../src/organism/learning/VerifiedOutcomeLedger.ts';

const adjusted = holmAdjustPValues([
  { id: 'candidate-c', pValue: 0.04 },
  { id: 'candidate-a', pValue: 0.01 },
  { id: 'candidate-b', pValue: 0.03 },
]);
assert.deepEqual(adjusted.map(row => row.id), ['candidate-c', 'candidate-a', 'candidate-b']);
assert.deepEqual(adjusted.map(row => row.adjustedPValue), [0.06, 0.03, 0.06]);
assert.deepEqual(adjusted.map(row => row.rank), [3, 1, 2]);
assert.throws(() => holmAdjustPValues([]), /non-empty/);
assert.throws(() => holmAdjustPValues([{ id: 'a', pValue: Number.NaN }]), /finite/);
assert.throws(() => holmAdjustPValues([{ id: 'a', pValue: 0.01 }, { id: 'a', pValue: 0.02 }]), /unique/);

const makeSummary = (candidate, pWins, pLosses, gain = 0.12) => {
  const baselinePassRate = 0.5;
  const candidatePassRate = baselinePassRate + gain;
  return {
    baseline: 'baseline-v1',
    candidate,
    pairedN: 30,
    baselinePassRate,
    candidatePassRate,
    absoluteGain: gain,
    discordantCandidateWins: pWins,
    discordantBaselineWins: pLosses,
    statisticalUnit: 'seed',
    signTestPValue: pairedSignTestPValue(pWins, pLosses),
    approximate95CI: [0.03, 0.21],
    bootstrap95CI: [0.02, 0.22],
  };
};
const makeFamilies = candidate => ['memory', 'transfer', 'tool-use'].map(family => ({
  ...makeSummary(candidate, 20, 0, 0.12),
  pairedN: 30,
  family,
}));

const comparisons = [
  { method: 'candidate-a', aggregate: makeSummary('candidate-a', 18, 7, 0.12), families: makeFamilies('candidate-a') },
  { method: 'candidate-b', aggregate: makeSummary('candidate-b', 18, 7, 0.12), families: makeFamilies('candidate-b') },
];
const portfolio = evaluateOutcomePromotionPortfolio(comparisons, {
  minIndependentSeeds: 30,
  minFamilies: 3,
  minAbsoluteGain: 0.02,
  maxFamilyRegression: 0.05,
  requirePositiveConfidenceLowerBound: true,
  familyPairCountMode: 'seed-repeated',
  familyWiseAlpha: 0.05,
});
assert.equal(portfolio.hypotheses, 2);
assert.equal(portfolio.results[0].method, 'candidate-a');
assert.equal(portfolio.results[0].eligible, false,
  'equal p-values are tied hypotheses and both retain the same conservative Holm-adjusted p-value');
assert.equal(portfolio.results[0].adjustedPValue, 2 * comparisons[0].aggregate.signTestPValue);
assert.ok(portfolio.results[0].reasons.includes('holm-adjusted-p-value-not-significant'));
assert.equal(portfolio.results[1].eligible, false, JSON.stringify(portfolio.results[1]));
assert.equal(portfolio.results[1].adjustedPValue, 2 * comparisons[1].aggregate.signTestPValue);
assert.deepEqual(portfolio.eligibleMethods, []);
assert.equal(portfolio.allEligible, false);

const sameWeak = evaluateOutcomePromotionPortfolio([
  { method: 'candidate-x', aggregate: makeSummary('candidate-x', 10, 10, 0.12), families: makeFamilies('candidate-x') },
  { method: 'candidate-y', aggregate: makeSummary('candidate-y', 10, 10, 0.12), families: makeFamilies('candidate-y') },
], {
  minIndependentSeeds: 30, minFamilies: 3, minAbsoluteGain: 0.02, maxFamilyRegression: 0.05,
  requirePositiveConfidenceLowerBound: true, familyPairCountMode: 'seed-repeated', familyWiseAlpha: 0.05,
});
assert.ok(sameWeak.results.every(row => !row.eligible));
assert.ok(sameWeak.results.every(row => row.rawPValue > 0.05));

assert.throws(() => evaluateOutcomePromotionPortfolio([
  comparisons[0], comparisons[0],
]), /unique/);
assert.throws(() => evaluateOutcomePromotionPortfolio([
  comparisons[0],
  { ...comparisons[1], aggregate: { ...comparisons[1].aggregate, baseline: 'other-baseline' } },
]), /share the same baseline/);

console.log('P23_EXPERIMENT_INFERENCE=PASS', JSON.stringify({
  hypotheses: portfolio.hypotheses,
  eligibleMethods: portfolio.eligibleMethods,
  adjustedPValues: portfolio.results.map(row => ({ method: row.method, p: row.adjustedPValue })),
}));
