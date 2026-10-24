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
// The same event cannot be replayed as independent evidence by relabelling its source.
const relabelledReplay = ledger.reviseBeliefFromEvidence({
  claimId, evidenceId: 'same-publisher-second-page', source: 'independent-lab',
  independenceKey: 'independent-lab:1', stance: 'supports', strength01: 0.99, at: 112,
});
assert.equal(relabelledReplay.accepted, false);
assert.equal(relabelledReplay.reason, 'evidence-already-applied');
assert.equal(relabelledReplay.confidence01, 0.6);

// A genuinely new source closes some uncertainty through a log-odds update.
const corroborated = ledger.reviseBeliefFromEvidence({
  claimId, evidenceId: 'sensor-observation-17', source: 'device', independenceKey: 'device:sensor-17',
  stance: 'supports', strength01: 0.9, at: 120,
});
assert.equal(corroborated.independentSource, true);
assert.ok(corroborated.confidence01 > 0.6);
const afterCorroboration = corroborated.confidence01;

// Contradictory evidence from another source lowers the belief confidence.
const contradicted = ledger.reviseBeliefFromEvidence({
  claimId, evidenceId: 'user-counterexample-4', source: 'user', independenceKey: 'user:counterexample-set-a',
  stance: 'contradicts', strength01: 0.95, at: 130,
});
assert.equal(contradicted.independentSource, true);
assert.ok(contradicted.confidence01 < afterCorroboration);
const beforeSameSourceContradiction = contradicted.confidence01;

// Repeating the same source under a distinct evidence ID is retained for audit,
// but does not receive another independent-source confidence update.
const sameSourceContradiction = ledger.reviseBeliefFromEvidence({
  claimId, evidenceId: 'user-counterexample-5', source: 'user-mirror', independenceKey: 'user:counterexample-set-a',
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
assert.deepEqual(finalClaim.evidenceLineageKeys, ['web', 'device:sensor-17', 'user:counterexample-set-a']);
assert.equal(finalClaim.revisionHistory[1].independenceKey, 'device:sensor-17');

// Distinct URLs/source labels from the same story must not count as independent evidence.
const lineageMemory = new P65EpistemicLedger();
const lineageClaim = lineageMemory.record({tick:2,at:200,kind:'belief',content:'A syndicated story is one evidence lineage.',confidence01:.5,source:'web'});
const lineageFirst = lineageMemory.reviseBeliefFromEvidence({claimId:lineageClaim,evidenceId:'story-a',source:'publisher-a',independenceKey:'story-family-42',stance:'supports',strength01:.95,at:210});
assert.equal(lineageFirst.independentSource,true);
const confidenceAfterFirstLineage = lineageFirst.confidence01;
const mirrored = lineageMemory.reviseBeliefFromEvidence({claimId:lineageClaim,evidenceId:'mirror-copy-99',source:'mirror-b',independenceKey:' STORY-FAMILY-42 ',stance:'supports',strength01:.99,at:220});
assert.equal(mirrored.accepted,true);
assert.equal(mirrored.independentSource,false);
assert.equal(mirrored.confidence01,confidenceAfterFirstLineage,'a mirror must not add a second confidence vote');
assert.equal(lineageMemory.snapshot().claimsData.find(row=>row.id===lineageClaim).evidenceLineageKeys.length,2);
assert.equal(lineageMemory.reviseBeliefFromEvidence({claimId:lineageClaim,evidenceId:'story-a',source:'different-host',independenceKey:'story-family-42',stance:'contradicts',strength01:.99,at:230}).reason,'evidence-already-applied','same lineage/evidence pair cannot vote again by changing source or stance');
const roundTripLineage = new P65EpistemicLedger();
roundTripLineage.restore(lineageMemory.snapshot());
assert.deepEqual(roundTripLineage.snapshot().claimsData.find(row=>row.id===lineageClaim).evidenceLineageKeys,['web','story-family-42']);
assert.equal(roundTripLineage.snapshot().claimsData.find(row=>row.id===lineageClaim).revisionHistory[1].independenceKey,'story-family-42');

// Compound IDs are compared as a structured tuple, not an ambiguous colon-concatenated string.
const collisionLedger = new P65EpistemicLedger();
const collisionClaim = collisionLedger.record({tick:3,at:300,kind:'belief',content:'Evidence identifiers are compared without delimiter collisions.',confidence01:.5,source:'web'});
const collisionFirst = collisionLedger.reviseBeliefFromEvidence({claimId:collisionClaim,evidenceId:'c',source:'publisher-a',independenceKey:'a:b',stance:'supports',strength01:.9,at:310});
assert.equal(collisionFirst.independentSource,true);
const collisionSecond = collisionLedger.reviseBeliefFromEvidence({claimId:collisionClaim,evidenceId:'b:c',source:'publisher-b',independenceKey:'a',stance:'supports',strength01:.9,at:320});
assert.equal(collisionSecond.reason,'independent-evidence-applied', 'the structured pair [a,b:c] must not collide with [a:b,c]');
assert.equal(collisionSecond.independentSource,true, 'a distinct evidence lineage must remain independently countable');
assert.ok(collisionSecond.confidence01 > collisionFirst.confidence01, 'the formerly-colliding independent evidence must update confidence once');
const collisionFinal = collisionLedger.snapshot().claimsData.find(row=>row.id===collisionClaim);
assert.equal(collisionFinal.evidenceKeys.length,2);
assert.ok(collisionFinal.evidenceLineageKeys.includes('a:b'));
assert.ok(collisionFinal.evidenceLineageKeys.includes('a'));
// V2 snapshots restore through allowlisted fields; unsupported rows are quarantined.
const legacy = ledger.snapshot();
delete legacy.claimsData[0].evidenceSources;
delete legacy.claimsData[0].evidenceKeys;
delete legacy.claimsData[0].evidenceLineageKeys;
delete legacy.claimsData[0].revisionHistory;
legacy.claimsData.push(
  { ...legacy.claimsData[0], id: 'corrupt-confidence', confidence01: Infinity },
  { ...legacy.claimsData[0], id: 'corrupt-parent-whitespace', parentIds: ['  '] },
  { ...legacy.claimsData[0], id: 'corrupt-parent-duplicate', parentIds: ['parent:a', 'parent:a'] },
);
const restored = new P65EpistemicLedger();
restored.restore(legacy);
assert.equal(restored.snapshot().claimsData.length, 1);
assert.deepEqual(restored.snapshot().claimsData[0].evidenceSources, ['web']);
assert.deepEqual(restored.snapshot().claimsData[0].evidenceLineageKeys, ['web']);
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
assert.equal(ledger.record({
  tick: 2, at: 152, kind: 'prediction', content: 'invalid predicted score',
  confidence01: 0.7, predicted01: 2, source: 'web',
}), '', 'out-of-range prediction values must be rejected rather than clamped into evidence');
assert.equal(ledger.record({
  tick: 2, at: 153, kind: 'belief', content: 'invalid parent lineage',
  confidence01: 0.7, source: 'web', parentIds: ['valid-parent', ''],
}), '', 'malformed parent references must be rejected rather than silently removed');

for (const parentIds of [['  '], ['parent\\u0000id'], ['parent:a', 'parent:a']]) {
  assert.equal(ledger.record({
    tick: 2, at: 154, kind: 'belief', content: 'invalid canonical parent lineage',
    confidence01: 0.7, source: 'web', parentIds,
  }), '', 'whitespace, control characters and duplicate parent IDs must be rejected');
}


console.log('P65_INDEPENDENT_EVIDENCE_REVISION=PASS sourceDedup=true lineageDedup=true logOddsUpdate=true contradictionErodesConfidence=true restoreSanitized=true accessorRejected=true');
