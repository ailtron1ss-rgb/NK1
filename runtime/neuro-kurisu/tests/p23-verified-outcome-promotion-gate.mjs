import assert from 'node:assert/strict';
import { pairedSignTestPValue } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { evaluateOutcomePromotion, normalizePromotionGateConfig } from '../src/organism/learning/VerifiedOutcomePromotionGate.ts';

const bounded = value => Math.max(0, Math.min(1, value));
const summary = (overrides = {}) => {
  const value = {
    baseline: 'fixed-32',
    candidate: 'candidate',
    pairedN: 30,
    baselinePassRate: 0.60,
    candidatePassRate: 0.72,
    absoluteGain: 0.12,
    discordantCandidateWins: 18,
    discordantBaselineWins: 7,
    statisticalUnit: 'seed',
    approximate95CI: [0.03, 0.21],
    ...overrides,
  };
  if (Object.hasOwn(overrides, 'absoluteGain') && !Object.hasOwn(overrides, 'candidatePassRate')) {
    value.candidatePassRate = bounded(value.baselinePassRate + value.absoluteGain);
  }
  if (Object.hasOwn(overrides, 'pairedN')) {
    if (!Object.hasOwn(overrides, 'discordantCandidateWins')) {
      value.discordantCandidateWins = Math.min(value.pairedN, Math.max(0, Math.round(Math.max(0, value.absoluteGain) * value.pairedN)));
    }
    if (!Object.hasOwn(overrides, 'discordantBaselineWins')) {
      value.discordantBaselineWins = Math.min(value.pairedN - value.discordantCandidateWins, Math.max(0, Math.round(Math.max(0, -value.absoluteGain) * value.pairedN)));
    }
  }
  if (!Object.hasOwn(overrides, 'signTestPValue')) {
    value.signTestPValue = pairedSignTestPValue(value.discordantCandidateWins, value.discordantBaselineWins);
  }
  return value;
};
const family = (name, overrides = {}) => ({
  ...summary({
    pairedN: 30,
    baselinePassRate: 0.60,
    candidatePassRate: 0.70,
    absoluteGain: 0.10,
    discordantCandidateWins: 3,
    discordantBaselineWins: 0,
    approximate95CI: [0.05, 0.15],
    ...overrides,
  }),
  family: name,
});
const families = [family('memory'), family('transfer'), family('tool-use')];

const good = evaluateOutcomePromotion(summary(), families);
assert.equal(good.eligible, true, JSON.stringify(good));
assert.deepEqual(good.reasons, []);
assert.equal(good.pairedTasks, 30);
assert.equal(good.familyCount, 3);
assert.equal(good.worstFamilyGain, 0.1);
assert.equal(good.statisticalEvidence.unit, 'seed');
assert.equal(good.statisticalEvidence.significant, true);

const lowN = evaluateOutcomePromotion(summary({ pairedN: 12 }), families);
assert.equal(lowN.eligible, false);
assert.ok(lowN.reasons.includes('insufficient-paired-tasks'));

const weakGain = evaluateOutcomePromotion(summary({ absoluteGain: 0.01 }), families);
assert.ok(weakGain.reasons.includes('aggregate-gain-below-threshold'));

const uncertain = evaluateOutcomePromotion(summary({ approximate95CI: [-0.02, 0.15] }), families);
assert.ok(uncertain.reasons.includes('confidence-lower-bound-not-positive'));
const noCI = evaluateOutcomePromotion(summary({ approximate95CI: null }), families);
assert.ok(noCI.reasons.includes('confidence-lower-bound-not-positive'));

const regressed = evaluateOutcomePromotion(summary(), [
  family('memory'), family('transfer', { absoluteGain: -0.08 }), family('tool-use'),
]);
assert.equal(regressed.eligible, false);
assert.ok(regressed.reasons.includes('family-regression:transfer'));

const missingFamilyEvidence = evaluateOutcomePromotion(summary(), [
  family('memory'), family('transfer', { pairedN: 0 }), family('tool-use'),
]);
assert.ok(missingFamilyEvidence.reasons.includes('missing-family-pairs:transfer'));

const tooFewFamilies = evaluateOutcomePromotion(summary(), [family('memory'), family('transfer')]);
assert.ok(tooFewFamilies.reasons.includes('insufficient-task-families'));

const noPairs = evaluateOutcomePromotion(summary({
  pairedN: 0, baselinePassRate: 0.6, candidatePassRate: 0.6,
  absoluteGain: 0, approximate95CI: null,
  discordantCandidateWins: 0, discordantBaselineWins: 0,
}), []);
assert.ok(noPairs.reasons.includes('missing-aggregate-evidence'));

assert.throws(() => evaluateOutcomePromotion(summary(), [
  family('memory'), family('memory'), family('tool-use'),
]), /unique/);
assert.throws(() => evaluateOutcomePromotion(summary(), families, { minPairedTasks: 0 }), /configuration/);
assert.throws(() => evaluateOutcomePromotion(summary(), families, { maxFamilyRegression: -1 }), /configuration/);
assert.throws(() => evaluateOutcomePromotion(summary(), families, { minAbsoluteGain: 1.1 }), /configuration/);
assert.throws(() => evaluateOutcomePromotion(summary(), families, { familyWiseAlpha: 1 }), /configuration/);

const exploratory = evaluateOutcomePromotion(summary({ approximate95CI: null }), families, {
  requirePositiveConfidenceLowerBound: false,
});
assert.equal(exploratory.eligible, true);

const nonSeedUnit = evaluateOutcomePromotion(summary({ statisticalUnit: 'paired-cell' }), families);
assert.equal(nonSeedUnit.eligible, false);
assert.ok(nonSeedUnit.reasons.includes('non-seed-statistical-unit:aggregate'));

const invalidP = evaluateOutcomePromotion(summary({ signTestPValue: Number.NaN }), families);
assert.equal(invalidP.eligible, false);
assert.ok(invalidP.reasons.includes('invalid-aggregate-sign-test-p-value'));

const inconsistentP = evaluateOutcomePromotion(summary({ signTestPValue: 0.00001 }), families);
assert.equal(inconsistentP.eligible, false);
assert.ok(inconsistentP.reasons.includes('inconsistent-aggregate-sign-test-p-value'));

const nonFiniteCount = evaluateOutcomePromotion(summary({
  pairedN: Number.NaN,
  discordantCandidateWins: 18,
  discordantBaselineWins: 7,
}), families);
assert.equal(nonFiniteCount.eligible, false);
assert.ok(nonFiniteCount.reasons.includes('invalid-aggregate-paired-count'));

const invalidGain = evaluateOutcomePromotion(summary({ absoluteGain: 1.5, candidatePassRate: 1 }), families);
assert.equal(invalidGain.eligible, false);
assert.ok(invalidGain.reasons.includes('invalid-aggregate-gain'));

const inconsistentGain = evaluateOutcomePromotion(summary({ absoluteGain: 0.04, candidatePassRate: 0.72 }), families);
assert.equal(inconsistentGain.eligible, false);
assert.ok(inconsistentGain.reasons.includes('inconsistent-aggregate-gain'));

const overcountedWins = evaluateOutcomePromotion(summary({
  discordantCandidateWins: 70, discordantBaselineWins: 40,
}), families);
assert.equal(overcountedWins.eligible, false);
assert.ok(overcountedWins.reasons.includes('invalid-aggregate-discordant-counts'));

const malformedCI = evaluateOutcomePromotion(summary({ approximate95CI: [0.1, Number.POSITIVE_INFINITY] }), families);
assert.equal(malformedCI.eligible, false);
assert.ok(malformedCI.reasons.includes('invalid-aggregate-approximate-confidence-interval'));

const optimisticApproxButNegativeBootstrap = evaluateOutcomePromotion(summary({
  approximate95CI: [0.03, 0.21],
  bootstrap95CI: [-0.01, 0.18],
}), families);
assert.equal(optimisticApproxButNegativeBootstrap.eligible, false);
assert.ok(optimisticApproxButNegativeBootstrap.reasons.includes('confidence-lower-bound-not-positive'));

const validBootstrap = evaluateOutcomePromotion(summary({
  approximate95CI: [-0.1, 0.3],
  bootstrap95CI: [0.02, 0.20],
}), families);
assert.equal(validBootstrap.eligible, true);

const malformedFamily = evaluateOutcomePromotion(summary(), [
  family('memory'), { ...family('transfer'), absoluteGain: Number.NaN }, family('tool-use'),
]);
assert.equal(malformedFamily.eligible, false);
assert.ok(malformedFamily.reasons.includes('invalid-family-gain'));

const reversedCI = evaluateOutcomePromotion(summary({ approximate95CI: [0.3, 0.1] }), families);
assert.equal(reversedCI.eligible, false);
assert.ok(reversedCI.reasons.includes('invalid-aggregate-approximate-confidence-interval'));

assert.ok(Math.abs(pairedSignTestPValue(8, 0) - 2 / (2 ** 8)) < 1e-15);
assert.ok(Math.abs(pairedSignTestPValue(0, 8) - 2 / (2 ** 8)) < 1e-15);
assert.equal(pairedSignTestPValue(6, 6), 1);
assert.equal(pairedSignTestPValue(0, 0), 1);
assert.throws(() => pairedSignTestPValue(-1, 2), /non-negative/);
assert.throws(() => pairedSignTestPValue(500_001, 500_000), /exact computation limit/);

const normalizedPolicy = normalizePromotionGateConfig({ minIndependentSeeds: 42 });
assert.equal(normalizedPolicy.minIndependentSeeds, 42);
assert.equal(normalizedPolicy.minPairedTasks, undefined);
const legacyPolicy = normalizePromotionGateConfig({ minPairedTasks: 19 });
assert.equal(legacyPolicy.minIndependentSeeds, 19, 'legacy option is accepted as a compatibility alias');
assert.throws(() => normalizePromotionGateConfig({
  minIndependentSeeds: 20, minPairedTasks: 19,
}), /conflicting/);

const uncomputableLargeSample = evaluateOutcomePromotion(summary({
  pairedN: 1_000_001,
  discordantCandidateWins: 500_001,
  discordantBaselineWins: 500_000,
}), families);
assert.equal(uncomputableLargeSample.eligible, false);
assert.ok(uncomputableLargeSample.reasons.includes('uncomputable-aggregate-sign-test-evidence'));

console.log('P23_VERIFIED_OUTCOME_PROMOTION_GATE=PASS');
console.log(JSON.stringify({
  eligible: good.eligible,
  aggregateGain: good.aggregateGain,
  exactSignTestP: good.statisticalEvidence.rawPValue,
  worstFamilyGain: good.worstFamilyGain,
}));
