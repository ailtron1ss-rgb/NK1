import assert from 'node:assert/strict';
import { P65EpistemicLedger, defaultP65 } from '../src/organism/memory/P65EpistemicLedger.ts';

const ledger = new P65EpistemicLedger();
const claimId = ledger.record({
  tick: 1, at: 100, kind: 'belief',
  content: 'Independent evidence is required before confidence rises.',
  confidence01: 0.6, source: 'web',
});
assert.ok(claimId.startsWith('p65:1:belief:'));
const initial = ledger.snapshot().claimsData.find(row => row.id === claimId);
assert.ok(initial);
assert.equal(initial.confidence01, 0.6);

// A second observation from the same source is journaled but cannot masquerade
// as independent corroboration or raise confidence over and over.
const repeated = ledger.reviseBeliefFromEvidence({
  claimId, evidenceId: 'same-publisher-second-page', source: 'WEB',
  stance: 'supports', strength01: 0.99, at: 110,
});
assert.equal(repeated.accepted, true);
assert.equal(repeated.independentSource, false);
assert.equal(repeated.confidence01, 0.6);
assert.equal(ledger.reviseBeliefFromEvidence({
  claimId, evidenceId: 'same-publisher-second-page', source: 'web',
  stance: 'supports', strength01: 0.99, at: 111,
}).reason, 'evidence-already-applied');

// A genuinely new source closes some uncertainty through a log-odds update.
const corroborated = ledger.reviseBeliefFromEvidence({
  claimId, evidenceId: 'sensor-observation-17', source: 'device',
  stance: 'supports', strength01: 0.9, at: 120,
});
assert.equal(corroborated.independentSource, true);
assert.ok(corroborated.confidence01 > 0.6);
const afterCorroboration = corroborated.confidence01;

// Contradictory evidence from another source lowers the belief confidence.
const contradicted = ledger.reviseBeliefFromEvidence({
  claimId, evidenceId: 'user-counterexample-4', source: 'user',
  stance: 'contradicts', strength01: 0.95, at: 130,
});
assert.equal(contradicted.independentSource, true);
assert.ok(contradicted.confidence01 < afterCorroboration);
const beforeSameSourceContradiction = contradicted.confidence01;

// Repeating the same source under a distinct evidence ID is retained for audit,
// but does not receive another independent-source confidence update.
const sameSourceContradiction = ledger.reviseBeliefFromEvidence({
  claimId, evidenceId: 'user-counterexample-5', source: 'user',
  stance: 'contradicts', strength01: 0.99, at: 140,
});
assert.equal(sameSourceContradiction.independentSource, false);
assert.equal(sameSourceContradiction.confidence01, beforeSameSourceContradiction);
const finalClaim = ledger.snapshot().claimsData.find(row => row.id === claimId);
assert.equal(finalClaim.revisionHistory.length, 4);
assert.equal(finalClaim.revisionHistory[0].independentSource, false);
assert.equal(finalClaim.revisionHistory[1].independentSource, true);
assert.ok(finalClaim.revisionHistory.every(row => row.fromConfidence01 >= 0 && row.fromConfidence01 <= 1
  && row.toConfidence01 >= 0 && row.toConfidence01 <= 1));

// V2 snapshots restore through allowlisted fields; unsupported rows are quarantined.
const legacy = ledger.snapshot();
delete legacy.claimsData[0].evidenceSources;
delete legacy.claimsData[0].evidenceKeys;
delete legacy.claimsData[0].revisionHistory;
legacy.claimsData.push({
  ...legacy.claimsData[0], id: 'corrupt-confidence', confidence01: Infinity,
});
const restored = new P65EpistemicLedger();
restored.restore(legacy);
assert.equal(restored.snapshot().claimsData.length, 1);
assert.deepEqual(restored.snapshot().claimsData[0].evidenceSources, ['web']);
assert.deepEqual(restored.snapshot().claimsData[0].revisionHistory, []);
assert.equal(restored.snapshot().claimsData[0].confidence01, finalClaim.confidence01);

// Hostile persisted accessors are rejected without execution.
let getterCalls = 0;
const hostile = {};
Object.defineProperty(hostile, 'claimsData', {
  enumerable: true, get() { getterCalls++; return []; },
});
const rejectedRestore = new P65EpistemicLedger();
rejectedRestore.restore(hostile);
assert.equal(getterCalls, 0);
assert.equal(rejectedRestore.snapshot().claims, defaultP65().claims);
assert.equal(rejectedRestore.snapshot().claimsData.length, 0);

// Invalid live evidence cannot create or mutate a belief.
assert.equal(ledger.reviseBeliefFromEvidence({
  claimId, evidenceId: 'bad-strength', source: 'external-api',
  stance: 'supports', strength01: 1.1, at: 150,
}).reason, 'evidence-input-invalid');
const scoreBeforeInvalidRecord = ledger.snapshot().claims;
assert.equal(ledger.record({
  tick: -1, at: 151, kind: 'belief', content: 'invalid tick',
  confidence01: 0.7, source: 'web',
}), '');
assert.equal(ledger.snapshot().claims, scoreBeforeInvalidRecord);

console.log('P65_INDEPENDENT_EVIDENCE_REVISION=PASS sourceDedup=true logOddsUpdate=true contradictionErodesConfidence=true restoreSanitized=true accessorRejected=true');
