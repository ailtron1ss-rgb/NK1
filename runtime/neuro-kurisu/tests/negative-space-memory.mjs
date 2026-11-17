import assert from 'node:assert/strict';
import { RegretEngine } from '../src/organism/developmental/RegretEngine.ts';

const engine = new RegretEngine();
const context = {
  decisionId: 'decision-negative-space-001',
  decisionAt: 100,
  outcomeAt: 200,
  chosenExpectedOutcome01: 0.84,
  significance: { cost01: 0.82, risk01: 0.15, futureImportance01: 0.2 },
  outcomeEvidence: ['grounded-outcome:device', 'postcondition:verified'],
};
const alternatives = [
  {
    action: 'explore',
    estimated: 0.92,
    confidence01: 0.81,
    rejectionReason: 'ranked below respond under current resource budget',
    constraints: ['energy-before01:0.31', 'selection-margin01:0.08'],
    expectedConsequences: ['energy-after01:0.18', 'novelty-after01:0.78'],
    reopenWhen: [
      { signal: 'outcome.shortfall01', operator: 'gte', value: 0.2 },
      { signal: 'outcome.alternativeAdvantage01', operator: 'gte', value: 0.15 },
    ],
  },
  {
    action: 'verify',
    estimated: 0.76,
    confidence01: 0.68,
    rejectionReason: 'lower expected utility',
    constraints: ['selection-margin01:0.12'],
    expectedConsequences: ['uncertainty-after01:0.22'],
  },
];

const regret = engine.observe('respond', 0.52, alternatives, context);
const legacyApi = new RegretEngine();
const legacyRegret = legacyApi.observe('respond', 0.4, [{ action: 'explore', estimated: 0.8 }]);
assert.equal(legacyRegret?.counterfactualOutcome, 0.8, 'the original estimated-field RegretEngine contract must remain compatible');
assert.ok(regret, 'the pre-existing regret path must remain operational');

let snapshot = engine.snapshot();
assert.equal(snapshot.negativeSpace?.version, 1, 'RegretEngine snapshot must persist the Negative Space Memory schema');
assert.equal(snapshot.negativeSpace.records.length, 1, 'a high-cost decision must retain its rejected alternatives');

let record = snapshot.negativeSpace.records[0];
assert.equal(record.decisionId, context.decisionId);
assert.equal(record.chosen, 'respond');
assert.equal(record.chosenExpectedOutcome01, 0.84);
assert.equal(record.chosenActualOutcome01, 0.52);
assert.ok(Math.abs(record.outcomeShortfall01 - 0.32) < 1e-9);
assert.equal(record.reviewStatus, 'review-eligible', 'large outcome shortfall should reopen review, not auto-select an alternative');
assert.deepEqual(record.alternatives.map(row => row.action), ['explore', 'verify']);
assert.equal(record.alternatives[0].rejectionReason, alternatives[0].rejectionReason);
assert.deepEqual(record.alternatives[0].constraints, alternatives[0].constraints);
assert.equal(record.alternatives[0].reviewEligible, true);
assert.equal(engine.negativeSpaceReviewQueue().length, 2);
assert.equal(engine.negativeSpaceDiagnostics().reviewEligible, 2);
assert.ok(record.outcomeEvidence.includes('postcondition:verified'));
engine.observe('respond', 0.52, alternatives, context);
assert.equal(engine.snapshot().negativeSpace.records.length, 1, 'replayed decision IDs must not duplicate the ledger row');

assert.equal(engine.markNegativeSpaceAlternativeReopened(context.decisionId, 'explore', 'new evidence supports a retry', 250), true);
assert.equal(engine.markNegativeSpaceAlternativeReopened(context.decisionId, 'explore', 'duplicate retry', 260), false);
snapshot = engine.snapshot();
record = snapshot.negativeSpace.records[0];
assert.equal(record.reviewStatus, 'review-eligible', 'the other alternative remains queued for review');
assert.equal(record.alternatives[0].reviewEligible, false);
assert.equal(record.alternatives[1].reviewEligible, true);
assert.equal(engine.negativeSpaceReviewQueue().length, 1);
assert.equal(record.alternatives[0].reopenReason, 'new evidence supports a retry');

// Small decisions must not create a permanent counterfactual-memory trail.
engine.observe('wait', 0.6, [{ action: 'rest', estimated: 0.7 }], {
  decisionId: 'decision-negative-space-small',
  significance: { cost01: 0.1, risk01: 0.1, futureImportance01: 0.1 },
});
assert.equal(engine.snapshot().negativeSpace.records.length, 1);

// Restarts retain the ledger. Pre-feature saves without this optional field remain valid.
const restored = new RegretEngine();
restored.restore(snapshot);
assert.deepEqual(restored.snapshot().negativeSpace, snapshot.negativeSpace);
const legacy = new RegretEngine();
legacy.restore({ records: [], meanRegret: 0, lastAt: 0, version: 1 });
assert.equal(legacy.snapshot().negativeSpace.records.length, 0);

// A decision retains only the four strongest distinct alternatives.
const capped = new RegretEngine();
capped.observe('choose', 0.3, Array.from({ length: 8 }, (_, index) => ({
  action: `option-${index}`,
  expectedOutcome01: 0.9 - index * 0.05,
})), {
  decisionId: 'decision-negative-space-option-cap',
  significance: { cost01: 0.9, risk01: 0.1, futureImportance01: 0.1 },
});
assert.equal(capped.snapshot().negativeSpace.records[0].alternatives.length, 4);

// The ledger is bounded even under a sustained stream of consequential decisions.
for (let i = 0; i < 140; i++) {
  engine.observe('respond', 0.4, [{ action: 'verify', estimated: 0.8 }], {
    decisionId: `decision-bounded-${i}`,
    significance: { cost01: 0.8, risk01: 0.1, futureImportance01: 0.1 },
  });
}
assert.ok(engine.snapshot().negativeSpace.records.length <= 128, 'negative-space history must stay bounded');
assert.ok(engine.snapshot().negativeSpace.pruned > 0, 'pruning should be accounted for');

console.log(JSON.stringify({
  pass: true,
  retainedAlternatives: record.alternatives.length,
  reviewStatus: record.reviewStatus,
  boundedRecords: engine.snapshot().negativeSpace.records.length,
  legacyRestore: true,
}));
