import assert from 'node:assert/strict';
import { evaluateOutcomePromotion } from '../src/organism/learning/VerifiedOutcomePromotionGate.ts';

const bounded = (value) => Math.max(0, Math.min(1, value));
const summary = (overrides = {}) => {
  const value = {
    baseline: 'fixed-32',
    candidate: 'candidate',
    pairedN: 90,
    baselinePassRate: 0.60,
    candidatePassRate: 0.72,
    absoluteGain: 0.12,
    discordantCandidateWins: 18,
    discordantBaselineWins: 7,
    approximate95CI: [0.03, 0.21],
    ...overrides,
  };
  // Keep fixture rows internally consistent unless a specific consistency
  // failure is the subject of the test.
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
  return value;
};
const family = (name, overrides = {}) => {
  const value = summary({
    family: name,
    pairedN: 30,
    baselinePassRate: 0.60,
    candidatePassRate: 0.70,
    absoluteGain: 0.10,
    discordantCandidateWins: 3,
    discordantBaselineWins: 0,
    approximate95CI: [0.05, 0.15],
    ...overrides,
  });
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
  return value;
};
const families = [family('memory'), family('transfer'), family('tool-use')];

const good = evaluateOutcomePromotion(summary(), families);
assert.equal(good.eligible, true);
assert.deepEqual(good.reasons, []);
assert.equal(good.pairedTasks, 90);
assert.equal(good.familyCount, 3);
assert.equal(good.worstFamilyGain, 0.1);

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
assert.ok(tooFewFamilies.reasons.includes('family-pair-count-mismatch'));
assert.ok(tooFewFamilies.reasons.includes('insufficient-task-families'));

const noPairs = evaluateOutcomePromotion(summary({
  pairedN: 0, baselinePassRate: 0.6, candidatePassRate: 0.6,
  absoluteGain: 0, approximate95CI: null,
}), []);
assert.ok(noPairs.reasons.includes('missing-aggregate-evidence'));

assert.throws(() => evaluateOutcomePromotion(summary(), [
  family('memory'), family('memory'), family('tool-use'),
]), /unique/);
assert.throws(() => evaluateOutcomePromotion(summary(), families, { minPairedTasks: 0 }), /configuration/);
assert.throws(() => evaluateOutcomePromotion(summary(), families, { maxFamilyRegression: -1 }), /configuration/);
assert.throws(() => evaluateOutcomePromotion(summary(), families, { minAbsoluteGain: 1.1 }), /configuration/);

// A caller may relax the confidence gate for exploratory diagnostics, but it
// must be an explicit configuration change and is not the default.
const exploratory = evaluateOutcomePromotion(summary({ approximate95CI: null }), families, {
  requirePositiveConfidenceLowerBound: false,
});
assert.equal(exploratory.eligible, true);

// Runtime data is untrusted even if TypeScript signatures normally protect callers.
const nonFiniteCount = evaluateOutcomePromotion(summary({ pairedN: Number.NaN }), families);
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
assert.equal(optimisticApproxButNegativeBootstrap.eligible, false,
  'when seed-cluster bootstrap exists, the gate must not fall back to the optimistic approximate interval');
assert.ok(optimisticApproxButNegativeBootstrap.reasons.includes('confidence-lower-bound-not-positive'));

const validBootstrap = evaluateOutcomePromotion(summary({
  approximate95CI: [-0.1, 0.3],
  bootstrap95CI: [0.02, 0.20],
}), families);
assert.equal(validBootstrap.eligible, true,
  'the available positive seed-cluster interval takes precedence over an approximate interval');

const malformedFamily = evaluateOutcomePromotion(summary(), [
  family('memory'), { ...family('transfer'), absoluteGain: Number.NaN }, family('tool-use'),
]);
assert.equal(malformedFamily.eligible, false);
assert.ok(malformedFamily.reasons.includes('invalid-family-gain'));

const reversedCI = evaluateOutcomePromotion(summary({ approximate95CI: [0.3, 0.1] }), families);
assert.equal(reversedCI.eligible, false);
assert.ok(reversedCI.reasons.includes('invalid-aggregate-approximate-confidence-interval'));

console.log('P23_VERIFIED_OUTCOME_PROMOTION_GATE=PASS');
console.log(JSON.stringify({ eligible: good.eligible, aggregateGain: good.aggregateGain, worstFamilyGain: good.worstFamilyGain }));
