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
  contextKey: 'goal:maintain-system|energy:1|uncertainty:3|load:1|novelty:2',
  outcomeVerified01: 1,
  outcomeIndependent01: 1,
  outcomeSource: 'world-transition',
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
assert.equal(record.contextKey, context.contextKey);
assert.equal(record.chosenExpectedOutcome01, 0.84);
assert.equal(record.chosenActualOutcome01, 0.52);
assert.equal(record.chosenActualReward01, null);
assert.equal(record.chosenSurprise01, null);
assert.ok(Math.abs(record.outcomeShortfall01 - 0.32) < 1e-9);
assert.equal(record.reviewStatus, 'review-eligible', 'large outcome shortfall should reopen review, not auto-select an alternative');
assert.deepEqual(record.alternatives.map(row => row.action), ['explore', 'verify']);
assert.equal(record.alternatives[0].rejectionReason, alternatives[0].rejectionReason);
assert.deepEqual(record.alternatives[0].constraints, alternatives[0].constraints);
assert.equal(record.alternatives[0].reviewEligible, true);
assert.equal(engine.negativeSpaceReviewQueue().length, 2);
assert.equal(engine.negativeSpaceDiagnostics().reviewEligible, 2);
assert.equal(engine.negativeSpaceDiagnostics().contextIndexedRecords, 1);
assert.equal(engine.negativeSpaceRelatedAlternatives(context.contextKey).length, 2);
assert.equal(engine.negativeSpaceRelatedAlternatives('unseen-context').length, 0);
assert.equal(engine.negativeSpaceRelatedAlternatives(context.contextKey, 1).length, 1);
assert.ok(record.outcomeEvidence.includes('postcondition:verified'));
const originalRegretRecordCount = engine.snapshot().records.length;
const replayed = engine.observe('respond', 0.52, alternatives, context);
assert.equal(engine.snapshot().negativeSpace.records.length, 1, 'replayed decision IDs must not duplicate the ledger row');
assert.equal(engine.snapshot().records.length, originalRegretRecordCount, 'replayed decision IDs must not duplicate regret rows');
assert.equal(replayed?.decisionId, context.decisionId);

assert.equal(engine.markNegativeSpaceAlternativeReopened(context.decisionId, 'explore', 'new evidence supports a retry', 250), true);
assert.equal(engine.markNegativeSpaceAlternativeReopened(context.decisionId, 'explore', 'duplicate retry', 260), false);
snapshot = engine.snapshot();
record = snapshot.negativeSpace.records[0];
assert.equal(record.reviewStatus, 'review-eligible', 'the other alternative remains queued for review');
assert.equal(record.alternatives[0].reviewEligible, false);
assert.equal(record.alternatives[1].reviewEligible, true);
assert.equal(engine.negativeSpaceReviewQueue().length, 1);
assert.equal(record.alternatives[0].reopenReason, 'new evidence supports a retry');

// An outcome shortfall without verified evidence must never enter the review queue.
const unverified = new RegretEngine();
unverified.observe('act', 0.2, [{ action: 'explore', estimated: 0.95 }], {
  decisionId: 'decision-unverified-outcome',
  contextKey: 'same-context-but-unverified',
  chosenExpectedOutcome01: 0.9,
  significance: { cost01: 0.2, risk01: 0.95, futureImportance01: 0.1 },
  outcomeVerified01: 0,
  outcomeIndependent01: 0,
  outcomeSource: 'internal',
});
assert.equal(unverified.snapshot().negativeSpace.records[0].reviewStatus, 'retained');
assert.equal(unverified.negativeSpaceReviewQueue().length, 0);
assert.equal(unverified.markNegativeSpaceAlternativeReopened(
  'decision-unverified-outcome', 'explore', 'unverified evidence must not reopen', 300,
), false);

// Missing verification metadata is also insufficient; legacy callers do not gain review authority.
const unknownEvidence = new RegretEngine();
unknownEvidence.observe('act', 0.1, [{ action: 'verify', estimated: 0.9 }], {
  decisionId: 'decision-unknown-outcome-quality',
  chosenExpectedOutcome01: 0.9,
  significance: { cost01: 0.1, risk01: 0.9, futureImportance01: 0.1 },
});
assert.equal(unknownEvidence.negativeSpaceReviewQueue().length, 0);

// Review uses confidence-adjusted counterfactual advantage, not raw optimism or chosen-action shortfall alone.
const confidenceGate = new RegretEngine();
confidenceGate.observe('wait', 0.45, [
  {
    action: 'weak-high-estimate',
    expectedOutcome01: 0.8,
    confidence01: 0.25,
    reopenWhen: [{ signal: 'outcome.confidenceAdjustedAlternativeAdvantage01', operator: 'gte', value: 0.15 }],
  },
  {
    action: 'strong-high-estimate',
    expectedOutcome01: 0.8,
    confidence01: 0.9,
    reopenWhen: [{ signal: 'outcome.confidenceAdjustedAlternativeAdvantage01', operator: 'gte', value: 0.15 }],
  },
], {
  decisionId: 'decision-confidence-adjusted-review',
  chosenExpectedOutcome01: 0.8,
  significance: { cost01: 0.8, risk01: 0.1, futureImportance01: 0.1 },
  outcomeVerified01: 1,
  outcomeIndependent01: 1,
  outcomeSource: 'world-transition',
});
assert.deepEqual(
  confidenceGate.negativeSpaceReviewQueue().map(row => row.alternative.action),
  ['strong-high-estimate'],
  'a weakly supported alternative must not reopen just because the selected action underperformed',
);

// A late verified report may upgrade the same outcome, but may not rewrite it.
const delayedVerification = new RegretEngine();
delayedVerification.observe('act', 0.2, [{ action: 'explore', estimated: 0.95 }], {
  decisionId: 'decision-delayed-verification',
  chosenExpectedOutcome01: 0.9,
  significance: { cost01: 0.2, risk01: 0.95, futureImportance01: 0.1 },
  outcomeVerified01: 0,
  outcomeIndependent01: 0,
  outcomeSource: 'internal',
  outcomeEvidence: ['initial-unverified-report'],
});
assert.equal(delayedVerification.negativeSpaceReviewQueue().length, 0);
const corroborated = delayedVerification.recordNegativeSpaceOutcome({
  decisionId: 'decision-delayed-verification',
  actualOutcome01: 0.2,
  verified01: 1,
  independent01: 1,
  source: 'external-evidence',
  evidence: ['independent-postcondition-confirmation'],
  at: 400,
});
assert.equal(corroborated?.outcomeVerified01, 1);
assert.equal(corroborated?.outcomeIndependent01, 1);
assert.equal(corroborated?.outcomeSource, 'external-evidence');
assert.ok(corroborated?.outcomeEvidence.includes('initial-unverified-report'));
assert.ok(corroborated?.outcomeEvidence.includes('independent-postcondition-confirmation'));
assert.equal(delayedVerification.negativeSpaceReviewQueue().length, 1);
const conflicting = delayedVerification.recordNegativeSpaceOutcome({
  decisionId: 'decision-delayed-verification',
  actualOutcome01: 0.95,
  verified01: 1,
  independent01: 1,
  source: 'external-evidence',
  evidence: ['conflicting-outcome-must-not-replace-canonical'],
  at: 500,
});
assert.equal(conflicting?.chosenActualOutcome01, 0.2, 'later evidence must not silently rewrite a conflicting canonical outcome');
assert.ok(!conflicting?.outcomeEvidence.includes('conflicting-outcome-must-not-replace-canonical'));

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
assert.equal(engine.negativeSpaceDiagnostics().bounded, true);

const outcomeMetrics = new RegretEngine();
outcomeMetrics.observe('act', 0.7, [{ action: 'defer', estimated: 0.8 }], {
  decisionId: 'decision-outcome-metrics',
  contextKey: 'verified-device-context',
  chosenExpectedOutcome01: 0.78,
  significance: { cost01: 0.1, risk01: 0.9, futureImportance01: 0.1 },
  outcomeReward01: 0.66,
  outcomeSurprise01: 0.24,
  outcomeVerified01: 1,
  outcomeIndependent01: 1,
  outcomeSource: 'external-evidence',
});
const metricRecord = outcomeMetrics.snapshot().negativeSpace.records[0];
assert.equal(metricRecord.chosenActualReward01, 0.66);
assert.equal(metricRecord.chosenSurprise01, 0.24);
assert.equal(metricRecord.outcomeVerified01, 1);
assert.equal(metricRecord.outcomeIndependent01, 1);
assert.equal(metricRecord.outcomeSource, 'external-evidence');
const metricRestore = new RegretEngine();
metricRestore.restore(outcomeMetrics.snapshot());
assert.deepEqual(metricRestore.snapshot().negativeSpace, outcomeMetrics.snapshot().negativeSpace);
assert.equal(metricRestore.negativeSpaceDiagnostics().verifiedOutcomes, 1);
assert.equal(metricRestore.negativeSpaceDiagnostics().independentOutcomes, 1);
assert.equal(metricRestore.negativeSpaceRelatedAlternatives('verified-device-context').length, 1);

// Boundary: the significance threshold is inclusive and never stores empty-option records.
const threshold = new RegretEngine();
threshold.observe('choose', 0.5, [{ action: 'alt', estimated: 0.6 }], {
  decisionId: 'decision-threshold-exact',
  chosenExpectedOutcome01: 0.5,
  significance: { cost01: 0.72, risk01: 0, futureImportance01: 0 },
});
threshold.observe('choose', 0.5, [{ action: 'alt', estimated: 0.6 }], {
  decisionId: 'decision-threshold-below',
  chosenExpectedOutcome01: 0.5,
  significance: { cost01: 0.7199, risk01: 0, futureImportance01: 0 },
});
threshold.observe('choose', 0.5, [], {
  decisionId: 'decision-no-alternatives',
  chosenExpectedOutcome01: 0.5,
  significance: { cost01: 0.9, risk01: 0, futureImportance01: 0 },
});
assert.deepEqual(threshold.snapshot().negativeSpace.records.map(row => row.decisionId), ['decision-threshold-exact']);

// Snapshot consumers cannot mutate the engine's in-memory ledger by editing a returned object.
const detached = outcomeMetrics.snapshot();
detached.negativeSpace.records[0].alternatives[0].action = 'tampered';
assert.equal(outcomeMetrics.snapshot().negativeSpace.records[0].alternatives[0].action, 'defer');

// Invalid and inconsistent persisted records are ignored or normalized rather than trusted.
const malformed = new RegretEngine();
malformed.restore({
  records: [],
  meanRegret: 0,
  lastAt: 0,
  version: 1,
  negativeSpace: {
    version: 999,
    totalRecorded: -50,
    pruned: -4,
    lastAt: 'not-a-time',
    records: [
      null,
      { decisionId: 'empty', chosen: 'wait', alternatives: [] },
      {
        decisionId: 'bad-status',
        chosen: 'respond',
        chosenExpectedOutcome01: 0.7,
        chosenActualOutcome01: 0.4,
        outcomePredictionError01: 0.3,
        outcomeShortfall01: 0.3,
        significance: { cost01: 4, risk01: -2, futureImportance01: 0.2, score01: 8 },
        reviewStatus: 'awaiting-outcome',
        alternatives: [
          { action: 'respond', expectedOutcome01: 1 },
          { action: 'explore', expectedOutcome01: 2, reviewEligible: true, reopenedAt: null, reopenReason: '' },
          { action: 'explore', expectedOutcome01: 0.8, reviewEligible: true },
          { action: 'verify', expectedOutcome01: 0.65, reopenedAt: 10, reopenReason: 'reviewed earlier' },
        ],
      },
    ],
  },
});
const malformedState = malformed.snapshot().negativeSpace;
assert.equal(malformedState.records.length, 1);
assert.equal(malformedState.records[0].reviewStatus, 'reopened');
assert.equal(malformed.negativeSpaceReviewQueue().length, 0, 'unverified restored snapshots must not restore review authority');
assert.deepEqual(malformedState.records[0].alternatives.map(row => row.action), ['explore', 'verify']);
assert.equal(malformedState.records[0].alternatives[0].expectedOutcome01, 1);
assert.equal(malformedState.records[0].alternatives[0].reopenedAt, undefined);
assert.equal(malformedState.records[0].alternatives[1].reopenedAt, 10);
assert.equal(malformedState.records[0].outcomeSource, 'unknown');
assert.equal(malformed.negativeSpaceRelatedAlternatives('malformed-context').length, 0);
assert.equal(malformedState.records[0].significance.cost01, 1);
assert.equal(malformedState.records[0].significance.risk01, 0);
assert.equal(malformedState.pruned, 0);
assert.equal(malformed.negativeSpaceDiagnostics().bounded, true);

console.log(JSON.stringify({
  pass: true,
  retainedAlternatives: record.alternatives.length,
  reviewStatus: record.reviewStatus,
  boundedRecords: engine.snapshot().negativeSpace.records.length,
  legacyRestore: true,
}));
