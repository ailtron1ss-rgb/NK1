import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const receipt = (overrides = {}) => ({
  tick: 13,
  executionId: 'exec:workpass349:snapshot',
  toolId: 'filesystem.read',
  decisionId: 'decision:13',
  ok: true,
  verified: true,
  outcomeClass: 'verified',
  confidence01: 0.88,
  verificationBasis: 'independent-postcondition',
  externalObservation: true,
  observationId: 'observation:13',
  expectedPostcondition: 'manifest digest matches',
  observedPostcondition: 'manifest digest matches',
  observationIntegrated: true,
  at: 1700000001000,
  ...overrides,
});

const sourceFabric = new CognitiveEventFabric(128);
const first = sourceFabric.appendToolReceiptTrace(receipt());
const saved = sourceFabric.snapshot();
assert.equal(first.replayed, false);
assert.equal(saved.receiptProjectionIndex.length, 1);

const validRestoredFabric = new CognitiveEventFabric(128);
validRestoredFabric.restore(saved);
assert.equal(validRestoredFabric.snapshot().receiptProjectionIndex.length, 1, 'valid reconstructed projection fingerprint should restore');
const validRestoredTotal = validRestoredFabric.snapshot().total;
assert.equal(validRestoredFabric.appendToolReceiptTrace(receipt()).replayed, true);
assert.equal(validRestoredFabric.snapshot().total, validRestoredTotal);

// A syntactically valid but false projection hash must not be restored as a replay guard.
const badIndexSnapshot = {
  ...saved,
  receiptProjectionIndex: saved.receiptProjectionIndex.map(entry => ({
    ...entry,
    projectionHash: 'f'.repeat(64),
  })),
};
const badIndexFabric = new CognitiveEventFabric(128);
badIndexFabric.restore(badIndexSnapshot);
assert.equal(badIndexFabric.snapshot().receiptProjectionIndex.length, 0, 'tampered projection index must be rejected');
const exactAfterBadIndex = badIndexFabric.appendToolReceiptTrace(receipt());
assert.equal(exactAfterBadIndex.replayed, true, 'valid retained event evidence can reconstruct the index');
assert.equal(badIndexFabric.snapshot().total, saved.total);
assert.equal(badIndexFabric.snapshot().receiptProjectionIndex.length, 1);

// Event-level evidence changed while the index fingerprint remained valid: reject the index
// and reject an attempted replay that no longer matches the stored evidence.
const evidenceTamperedSnapshot = {
  ...saved,
  recent: saved.recent.map(event => event.id === first.evidenceEventId
    ? { ...event, payload: { ...event.payload, expectedPostconditionHash: 'a'.repeat(64) } }
    : event),
};
const evidenceTamperedFabric = new CognitiveEventFabric(128);
evidenceTamperedFabric.restore(evidenceTamperedSnapshot);
assert.equal(evidenceTamperedFabric.snapshot().receiptProjectionIndex.length, 0);
const evidenceTamperedTotal = evidenceTamperedFabric.snapshot().total;
assert.throws(
  () => evidenceTamperedFabric.appendToolReceiptTrace(receipt()),
  /tool-receipt-execution-id-conflict/,
  'index fingerprint must not override changed evidence',
);
assert.equal(evidenceTamperedFabric.snapshot().total, evidenceTamperedTotal);

// A half-present pair of event-level hashes is malformed; legacy compatibility applies only
// when both event hashes are absent and the saved full-input fingerprint is valid.
const partialHashSnapshot = {
  ...saved,
  recent: saved.recent.map(event => {
    if (event.id !== first.evidenceEventId) return event;
    const payload = { ...event.payload };
    delete payload.observedPostconditionHash;
    return { ...event, payload };
  }),
};
const partialHashFabric = new CognitiveEventFabric(128);
partialHashFabric.restore(partialHashSnapshot);
assert.equal(partialHashFabric.snapshot().receiptProjectionIndex.length, 0);
const partialTotal=partialHashFabric.snapshot().total;
assert.throws(()=>partialHashFabric.appendToolReceiptTrace(receipt()),/tool-receipt-execution-id-conflict/);
assert.equal(partialHashFabric.snapshot().total,partialTotal);

// Legacy snapshots with both event-level hashes absent retain the documented compatibility route.
const legacySnapshot = {
  ...saved,
  recent: saved.recent.map(event => {
    if (event.id !== first.evidenceEventId) return event;
    const payload = { ...event.payload };
    delete payload.expectedPostconditionHash;
    delete payload.observedPostconditionHash;
    return { ...event, payload };
  }),
};
const legacyFabric = new CognitiveEventFabric(128);
legacyFabric.restore(legacySnapshot);
const legacyTotal=legacyFabric.snapshot().total;
assert.equal(legacyFabric.snapshot().receiptProjectionIndex.length, 1, 'legacy projection index stays recoverable');
assert.equal(legacyFabric.appendToolReceiptTrace(receipt()).replayed,true);
assert.equal(legacyFabric.snapshot().total,legacyTotal);


const emptyClaimReceipt=receipt({
  executionId:'exec:workpass349:null-hashes',
  expectedPostcondition:'',
  observedPostcondition:'',
});
const emptyClaimFabric=new CognitiveEventFabric(128);
const emptyClaimEntry=emptyClaimFabric.appendToolReceiptTrace(emptyClaimReceipt);
const emptyClaimSnapshot=emptyClaimFabric.snapshot();
const emptyEvidence=emptyClaimSnapshot.recent.find(event=>event.id===emptyClaimEntry.evidenceEventId);
assert.equal(emptyEvidence.payload.expectedPostconditionHash,null);
assert.equal(emptyEvidence.payload.observedPostconditionHash,null);
const emptyClaimRestored=new CognitiveEventFabric(128);
emptyClaimRestored.restore(emptyClaimSnapshot);
assert.equal(emptyClaimRestored.snapshot().receiptProjectionIndex.length,1,'modern null hash fields must be fingerprint-validated');
const emptyClaimTotal=emptyClaimRestored.snapshot().total;
assert.equal(emptyClaimRestored.appendToolReceiptTrace(emptyClaimReceipt).replayed,true);
assert.equal(emptyClaimRestored.snapshot().total,emptyClaimTotal);

// A null-hash receipt with a modified projection fingerprint must not install its saved index.
const emptyHashTampered=new CognitiveEventFabric(128);
emptyHashTampered.restore({
  ...emptyClaimSnapshot,
  receiptProjectionIndex:emptyClaimSnapshot.receiptProjectionIndex.map(entry=>({...entry,projectionHash:'e'.repeat(64)})),
});
assert.equal(emptyHashTampered.snapshot().receiptProjectionIndex.length,0);
assert.equal(emptyHashTampered.appendToolReceiptTrace(emptyClaimReceipt).replayed,true);
assert.equal(emptyHashTampered.snapshot().receiptProjectionIndex.length,1);

console.log('WorkPass349 receipt snapshot fingerprint: PASS');
