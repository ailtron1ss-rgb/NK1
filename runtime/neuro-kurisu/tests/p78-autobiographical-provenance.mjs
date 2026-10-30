import assert from 'node:assert/strict';
import { P78AutobiographicalSelfContinuity } from '../src/organism/developmental/P78AutobiographicalSelfContinuity.ts';

const p = new P78AutobiographicalSelfContinuity();
const empty = p.snapshot();
assert.equal(empty.samples, 0);
assert.equal(empty.verifiedOutcomeSamples, 0);
assert.equal(empty.selfAuthorship01, 0.5, 'no authorship evidence must remain neutral');

const legacy = p.observe([
  { tick: 1, at: 100, action: 'explore', outcome: 1, text: 'legacy outcome' },
  { tick: 2, at: 200, action: 'reflect', outcome: 0, text: 'legacy outcome' }
]);
assert.equal(legacy.verifiedOutcomeSamples, 0, 'legacy events cannot be silently promoted to verified evidence');
assert.equal(legacy.unverifiedOutcomeSamples, 2);
assert.equal(legacy.chapters, 0, 'unverified outcomes must not create autobiographical turning points');
assert.equal(legacy.selfAuthorship01, 0.5, 'unknown authorship must not inflate self-authorship');

const verifiedEvents = [
  { tick: 3, at: 300, action: 'explore', outcome: 0.1, evidenceStatus: 'verified-independent', evidenceRef: 'external-verification:reb:3:31:outcome', evidenceReceiptId: 'reb:3:31:outcome', verified01:.95, independent01:.9, evidence01:.9, consequence01:.9, identityUpdateScale01:.9, authorship: 'self-initiated', episodeId: 'episode-3' },
  { tick: 4, at: 400, action: 'verify', outcome: 0.9, evidenceStatus: 'verified-independent', evidenceRef: 'external-verification:reb:4:32:outcome', evidenceReceiptId: 'reb:4:32:outcome', verified01:.95, independent01:.9, evidence01:.9, consequence01:.9, identityUpdateScale01:.9, authorship: 'self-selected', episodeId: 'episode-4' },
  { tick: 5, at: 500, action: 'reflect', outcome: 0.5, evidenceStatus: 'verified-independent', evidenceRef: 'external-verification:reb:5:33:outcome', evidenceReceiptId: 'reb:5:33:outcome', verified01:.95, independent01:.9, evidence01:.9, consequence01:.9, identityUpdateScale01:.9, authorship: 'user-directed', episodeId: 'episode-5' }
];
const grounded = p.observe(verifiedEvents);
assert.equal(grounded.verifiedOutcomeSamples, 3);
assert.equal(grounded.authorshipEvidenceSamples, 3);
assert.ok(grounded.selfAuthorship01 > 0.5, 'explicit self-authored episodes may update self-authorship');
assert.ok(grounded.chapters >= 1, 'corroborated, provenance-bound episodes may form a turning point');

const afterDuplicate = p.observe(verifiedEvents);
assert.deepEqual(afterDuplicate, grounded, 'replaying the same observation window must be idempotent');

const legacyModeEvents=[
  {tick:6,at:600,action:'wait',text:'legacy mode episode',mode:'neutral'},
  {tick:7,at:700,action:'reflect',text:'legacy mode episode',mode:'neutral'},
];
const legacyModeFirst=p.observe(legacyModeEvents);
const modeOnlyChange=p.observe(legacyModeEvents.map(e=>({...e,mode:'reflective'})));
assert.equal(modeOnlyChange.samples,legacyModeFirst.samples+legacyModeEvents.length,'mode changes without a receipt remain distinct observations');

const restored = new P78AutobiographicalSelfContinuity();
restored.restore(modeOnlyChange);
assert.deepEqual(restored.snapshot(), modeOnlyChange, 'autobiographical evidence counters must survive restore');
const nonAdjacentReplay = restored.observe([verifiedEvents[0]]);
assert.deepEqual(nonAdjacentReplay, modeOnlyChange, 'an older event replayed after newer events and a restart must remain idempotent');
const changedReceiptReplay=restored.observe([{...verifiedEvents[0],outcome:0.99,verified01:1,evidence01:1}]);
assert.deepEqual(changedReceiptReplay,modeOnlyChange,'reusing one immutable RuntimeEvidenceBus ID with changed payload cannot create a second autobiographical episode');

const corrupted = new P78AutobiographicalSelfContinuity();
corrupted.restore({ ...modeOnlyChange, verifiedOutcomeSamples: -50, selfAuthorship01: 4 });
assert.equal(corrupted.snapshot().verifiedOutcomeSamples, 0);
assert.equal(corrupted.snapshot().selfAuthorship01, 1);
const nonFiniteCounters = new P78AutobiographicalSelfContinuity();
nonFiniteCounters.restore({ ...modeOnlyChange, chapters: Infinity, samples: NaN, verifiedOutcomeSamples: Infinity, unverifiedOutcomeSamples: -Infinity, authorshipEvidenceSamples: NaN, lastObservationKey: 'x'.repeat(9000), recentSummary: 'y'.repeat(9000) });
assert.equal(nonFiniteCounters.snapshot().chapters, 0);
assert.equal(nonFiniteCounters.snapshot().samples, 0);
assert.equal(nonFiniteCounters.snapshot().verifiedOutcomeSamples, 0);
assert.equal(nonFiniteCounters.snapshot().unverifiedOutcomeSamples, 0);
assert.equal(nonFiniteCounters.snapshot().authorshipEvidenceSamples, 0);
assert.equal(nonFiniteCounters.snapshot().lastObservationKey.length, 4096, 'observation key is bounded at the configured maximum');
assert.equal(nonFiniteCounters.snapshot().recentSummary.length, 512);

const normalized = new P78AutobiographicalSelfContinuity();
const normalizedFirst = normalized.observe([
  { tick: 40, at: 4000, action: 'reflect', text: 'alpha\t beta' }
]);
const normalizedReplay = normalized.observe([
  { tick: 40, at: 4000, action: 'reflect', text: 'alpha beta' }
]);
assert.deepEqual(normalizedReplay, normalizedFirst, 'whitespace normalization must make equivalent event keys idempotent');

const malformedEvidence = new P78AutobiographicalSelfContinuity().observe([
  { tick: 41, at: 4100, action: 'verify', outcome: 1, evidenceStatus: 'verified-independent', evidenceRef: 'world-transition:bad receipt' }
]);
assert.equal(malformedEvidence.verifiedOutcomeSamples, 0, 'evidence references containing whitespace are not bound receipts');
assert.equal(malformedEvidence.unverifiedOutcomeSamples, 1);
const lowQualityReceipt=new P78AutobiographicalSelfContinuity().observe([{tick:45,at:4500,action:'verify',outcome:1,evidenceStatus:'verified-independent',evidenceRef:'external-verification:reb:45:55:outcome',evidenceReceiptId:'reb:45:55:outcome',verified01:.95,independent01:.95,evidence01:.95,consequence01:.95,identityUpdateScale01:.2}]);
assert.equal(lowQualityReceipt.verifiedOutcomeSamples,0,'P78 requires the identity-specific confidence floor as well as a matching receipt');
assert.equal(lowQualityReceipt.unverifiedOutcomeSamples,1);
const unknownIssuer = new P78AutobiographicalSelfContinuity().observe([
  { tick: 42, at: 4200, action: 'verify', outcome: 1, evidenceStatus: 'verified-independent', evidenceRef: 'local-cache:receipt-42' }
]);
assert.equal(unknownIssuer.verifiedOutcomeSamples, 0, 'unknown issuer namespaces cannot enter autobiographical verified history');
assert.equal(unknownIssuer.unverifiedOutcomeSamples, 1);
const wrongTickReceipt = new P78AutobiographicalSelfContinuity().observe([
  { tick: 43, at: 4300, action: 'verify', outcome: 1, evidenceStatus: 'verified-independent', evidenceRef: 'external-verification:reb:42:45:outcome', evidenceReceiptId: 'reb:42:45:outcome', verified01:.95, independent01:.9, evidence01:.9, consequence01:.9, identityUpdateScale01:.9 }
]);
assert.equal(wrongTickReceipt.verifiedOutcomeSamples, 0, 'receipt tick must match the autobiographical event tick');
assert.equal(wrongTickReceipt.unverifiedOutcomeSamples, 1);
const mismatchedReceiptId = new P78AutobiographicalSelfContinuity().observe([
  { tick: 44, at: 4400, action: 'verify', outcome: 1, evidenceStatus: 'verified-independent', evidenceRef: 'external-verification:reb:44:46:outcome', evidenceReceiptId: 'reb:44:47:outcome', verified01:.95, independent01:.9, evidence01:.9, consequence01:.9, identityUpdateScale01:.9 }
]);
assert.equal(mismatchedReceiptId.verifiedOutcomeSamples, 0, 'P78 requires event.evidenceReceiptId to equal evidenceRef exactly');
assert.equal(mismatchedReceiptId.unverifiedOutcomeSamples, 1);
console.log('P78_AUTOBIOGRAPHICAL_PROVENANCE=PASS');
