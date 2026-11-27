import assert from 'node:assert/strict';
import { evaluateOutcomePromotion } from '../src/organism/learning/VerifiedOutcomePromotionGate.ts';

const summary = (overrides = {}) => ({
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
});
const family = (name, overrides = {}) => ({
  family: name,
  ...summary({ pairedN: 30, absoluteGain: 0.1, ...overrides }),
});
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
const incompleteFamilies = evaluateOutcomePromotion(summary(), [family('memory'), family('transfer')]);
assert.ok(incompleteFamilies.reasons.includes('family-pair-count-mismatch'));
assert.ok(tooFewFamilies.reasons.includes('insufficient-task-families'));

const noPairs = evaluateOutcomePromotion(summary({ pairedN: 0, approximate95CI: null }), []);
assert.ok(noPairs.reasons.includes('missing-aggregate-evidence'));

assert.throws(() => evaluateOutcomePromotion(summary(), [
  family('memory'), family('memory'), family('tool-use'),
]), /unique/);
assert.throws(() => evaluateOutcomePromotion(summary(), families, { minPairedTasks: 0 }), /configuration/);
assert.throws(() => evaluateOutcomePromotion(summary(), families, { maxFamilyRegression: -1 }), /configuration/);

// Seed-clustered summaries recount the same complete seeds once per family, so
// their family totals must exceed the aggregate sample instead of partitioning it.
const seedAggregate = summary({ pairedN: 5, absoluteGain: 0.2, approximate95CI: [0.1, 0.3] });
const seedFamilies = [
  family('memory', { pairedN: 5, absoluteGain: 0.2 }),
  family('tool-use', { pairedN: 5, absoluteGain: 0.2 }),
];
const seedClustered = evaluateOutcomePromotion(seedAggregate, seedFamilies, {
  minPairedTasks: 3, minFamilies: 1, minAbsoluteGain: 0.02, maxFamilyRegression: 0.1,
  pairedUnit: 'seed-cluster',
});
assert.equal(seedClustered.eligible, true, JSON.stringify(seedClustered.reasons));
const seedClusteredAsTaskCells = evaluateOutcomePromotion(seedAggregate, seedFamilies, {
  minPairedTasks: 3, minFamilies: 1,
});
assert.ok(seedClusteredAsTaskCells.reasons.includes('family-pair-count-mismatch'),
  'task-cell comparisons must still partition the aggregate sample exactly');
const seedStarved = evaluateOutcomePromotion(summary({ pairedN: 12, absoluteGain: 0.2 }), seedFamilies, {
  minPairedTasks: 3, minFamilies: 1, pairedUnit: 'seed-cluster',
});
assert.ok(seedStarved.reasons.includes('family-pair-count-mismatch'),
  'a family total below the seed-clustered aggregate is impossible and must fail closed');
assert.throws(() => evaluateOutcomePromotion(summary(), families, { pairedUnit: 'mixed' }), /configuration/);

// A caller may relax the confidence gate for exploratory diagnostics, but it
// must be an explicit configuration change and is not the default.
const exploratory = evaluateOutcomePromotion(summary({ approximate95CI: null }), families, {
  requirePositiveConfidenceLowerBound: false,
});
assert.equal(exploratory.eligible, true);

console.log('P23_VERIFIED_OUTCOME_PROMOTION_GATE=PASS');
console.log(JSON.stringify({ eligible: good.eligible, aggregateGain: good.aggregateGain, worstFamilyGain: good.worstFamilyGain }));
