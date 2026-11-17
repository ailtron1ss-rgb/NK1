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
assert.equal(malformedState.records[0].reviewStatus, 'review-eligible');
assert.deepEqual(malformedState.records[0].alternatives.map(row => row.action), ['explore', 'verify']);
assert.equal(malformedState.records[0].alternatives[0].expectedOutcome01, 1);
assert.equal(malformedState.records[0].alternatives[0].reopenedAt, undefined);
assert.equal(malformedState.records[0].alternatives[1].reopenedAt, 10);
assert.equal(malformedState.records[0].outcomeSource, 'unknown');
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
