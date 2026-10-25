import assert from 'node:assert/strict';
import { summarizeInternalDialogueHistory } from '../src/organism/cognition/InternalDialogueHistory.ts';

function receipt(tick, overrides = {}) {
  return {
    schemaVersion: 1,
    tick,
    status: tick % 3 === 0 ? 'reviewed' : tick % 3 === 1 ? 'provisional' : 'needs-evidence',
    rankingConfidence01: 0.2 + tick * 0.01,
    uncertainty01: 0.75 - tick * 0.005,
    evidenceCoverage01: 0.25 + tick * 0.01,
    contradiction01: 0.3,
    leadingClaimId: 'claim-' + tick,
    suggestedAction: 'verify',
    recommendedNextStep: 'seek-evidence',
    unresolvedQuestions: [
      'Conflicting evidence contradicts the candidate',
      'The action outcome has not been verified',
      'Missing evidence from an independent source',
    ],
    candidateScores: [],
    reviewedRoles: ['frame', 'hypothesis', 'critic', 'evidence-audit', 'metacognition', 'synthesis'],
    evidenceIds: [],
    evidenceMode: 'prediction-only',
    advisoryOnly: true,
    ...overrides,
  };
}

const empty = summarizeInternalDialogueHistory([]);
assert.equal(empty.sampleCount, 0);
assert.equal(empty.firstTick, null);
assert.equal(empty.meanEvidenceCoverage01, null);
assert.equal(empty.evidenceCoverageTrend, 'insufficient-data');

const series = Array.from({ length: 40 }, (_, tick) => receipt(tick, {
  unresolvedQuestions: tick === 17
    ? ['Contact is alice@example.com and should never appear in a public summary']
    : ['Conflicting evidence remains unresolved', 'The action outcome remains unverified'],
}));
const summary = summarizeInternalDialogueHistory(series);
assert.equal(summary.sampleCount, 32, 'history must remain bounded');
assert.equal(summary.windowSize, 32);
assert.equal(summary.firstTick, 8);
assert.equal(summary.lastTick, 39);
assert.equal(summary.statusCounts.reviewed + summary.statusCounts.provisional + summary.statusCounts['needs-evidence'], 32);
assert.equal(summary.rankingConfidenceTrend, 'up');
assert.equal(summary.evidenceCoverageTrend, 'up');
assert.ok(summary.evidenceCoverageDelta01 > 0);
assert.ok(summary.uncertaintyCategoryCounts.some(entry => entry.category === 'conflicting-evidence'));
assert.ok(summary.uncertaintyCategoryCounts.some(entry => entry.category === 'action-outcome'));
assert.equal(summary.advisoryOnly, true);
assert.equal(JSON.stringify(summary).includes('alice@example.com'), false, 'summary must never include original question text');

const single = summarizeInternalDialogueHistory([receipt(17)]);
assert.equal(single.sampleCount, 1);
assert.equal(single.rankingConfidenceDelta01, null);
assert.equal(single.rankingConfidenceTrend, 'insufficient-data');

const malformed = summarizeInternalDialogueHistory([
  receipt(1),
  receipt(2, { evidenceCoverage01: 2 }),
  receipt(3, { advisoryOnly: false }),
]);
assert.equal(malformed.sampleCount, 1, 'malformed or non-advisory receipts must not influence the aggregate');

const capped = summarizeInternalDialogueHistory(series, 1000);
assert.equal(capped.sampleCount, 32, 'caller cannot expand the fixed maximum window');
console.log('NK1_INTERNAL_DIALOGUE_HISTORY=PASS bounded=32 privacy=fixed-taxonomy trend=paired-halves');
