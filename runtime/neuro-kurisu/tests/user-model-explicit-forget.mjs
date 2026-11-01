import assert from 'node:assert/strict';
import { UserModelEvidenceModel } from '../src/organism/cognition/UserModelEvidenceModel.ts';

const model = new UserModelEvidenceModel();
const recorded = model.recordExplicit({
  key: 'response.style',
  domain: 'interaction-style',
  value: 'detailed',
  tick: 10,
  evidenceRef: 'user-explicit:style:10',
  explicit: true,
  sensitivity: 'low-risk',
});
assert.equal(recorded.accepted, true);
assert.equal(model.confirmedValue('response.style', 'interaction-style'), 'detailed');

const conflict = model.recordExplicit({
  key: 'response.style',
  domain: 'interaction-style',
  value: 'concise',
  tick: 11,
  evidenceRef: 'user-explicit:style:11',
  explicit: true,
  sensitivity: 'low-risk',
});
assert.equal(conflict.status, 'disputed');

model.observeBehavior({
  key: 'response.style',
  domain: 'interaction-style',
  value: 'concise',
  tick: 11,
  observationRef: 'behavior:style:12',
  sensitivity: 'low-risk',
});

const forgotten = model.forgetExplicit({
  key: 'response.style',
  domain: 'interaction-style',
  tick: 13,
  evidenceRef: 'user-explicit:forget-style:13',
  explicit: true,
});
assert.deepEqual(forgotten, {
  accepted: true,
  removed: true,
  key: 'response.style',
  domain: 'interaction-style',
});
assert.equal(model.confirmedValue('response.style', 'interaction-style'), null);
assert.equal(model.snapshot().claims.length, 0);
assert.equal(model.snapshot().candidates.length, 0);
assert.equal(model.snapshot().version, 2);
assert.equal(model.snapshot().forgetTombstones.length, 1);

// Both the original assertion and the forget command survive restart as replay guards.
const restored = new UserModelEvidenceModel();
restored.restore(model.snapshot());
assert.equal(restored.confirmedValue('response.style', 'interaction-style'), null);
assert.equal(restored.recordExplicit({
  key: 'response.style',
  domain: 'interaction-style',
  value: 'detailed',
  tick: 14,
  evidenceRef: 'user-explicit:style:10',
  explicit: true,
  sensitivity: 'low-risk',
}).reason, 'duplicate-evidence');
assert.equal(restored.forgetExplicit({
  key: 'response.style',
  domain: 'interaction-style',
  tick: 15,
  evidenceRef: 'user-explicit:forget-style:13',
  explicit: true,
}).reason, 'duplicate-evidence');

// A fresh explicit statement may intentionally re-establish the preference.
assert.equal(restored.recordExplicit({
  key: 'response.style',
  domain: 'interaction-style',
  value: 'concise',
  tick: 16,
  evidenceRef: 'user-explicit:style:16',
  explicit: true,
  sensitivity: 'low-risk',
}).status, 'confirmed');
assert.equal(restored.confirmedValue('response.style', 'interaction-style'), 'concise');

assert.equal(restored.forgetExplicit({
  key: 'response.style',
  domain: 'interaction-style',
  tick: 17,
  evidenceRef: '',
  explicit: true,
}).reason, 'missing-evidence');
assert.equal(restored.forgetExplicit({
  key: '__proto__',
  domain: 'interaction-style',
  tick: 18,
  evidenceRef: 'invalid:key',
  explicit: false,
}).reason, 'invalid-input');


// The deletion boundary survives replay-ledger rollover and restart.
for (let n = 0; n < 520; n++) {
  model.observeBehavior({
    key: 'noise.preference', domain: 'content-preference', value: 'x',
    tick: 20 + n, observationRef: `noise:${n}`, sensitivity: 'low-risk',
  });
}
const durableRestore = new UserModelEvidenceModel();
durableRestore.restore(model.snapshot());
assert.equal(durableRestore.recordExplicit({
  key: 'response.style', domain: 'interaction-style', value: 'detailed',
  tick: 10, evidenceRef: 'user-explicit:style:10', explicit: true, sensitivity: 'low-risk',
}).reason, 'forgotten-before-event');
assert.equal(durableRestore.observeBehavior({
  key: 'response.style', domain: 'interaction-style', value: 'concise',
  tick: 12, observationRef: 'behavior:stale:12', sensitivity: 'low-risk',
}).reason, 'forgotten-before-event');
assert.equal(durableRestore.recordExplicit({
  key: 'response.style', domain: 'interaction-style', value: 'concise',
  tick: 16, evidenceRef: 'user-explicit:style:16', explicit: true, sensitivity: 'low-risk',
}).status, 'confirmed');

// Restore reconciles persisted claims/candidates against deletion watermarks.
const reconciliationSnapshot = durableRestore.snapshot();
reconciliationSnapshot.claims.push({
  key: 'stale.claim', domain: 'interaction-style', value: 'old', status: 'confirmed',
  source: 'user-explicit', evidenceRef: 'stale:claim', firstSeenTick: 2, lastSeenTick: 9,
  confirmations: 1, contradictions: 0,
});
reconciliationSnapshot.claims.push({
  key: 'fresh.claim', domain: 'interaction-style', value: 'new', status: 'confirmed',
  source: 'user-explicit', evidenceRef: 'fresh:claim', firstSeenTick: 14, lastSeenTick: 14,
  confirmations: 1, contradictions: 0,
});
reconciliationSnapshot.forgetTombstones.push({
  key: 'stale.claim', domain: 'interaction-style', forgottenAtTick: 10, evidenceRef: 'forget:stale',
});
const reconciled = new UserModelEvidenceModel();
reconciled.restore(reconciliationSnapshot);
assert.equal(reconciled.confirmedValue('stale.claim', 'interaction-style'), null);
assert.equal(reconciled.confirmedValue('fresh.claim', 'interaction-style'), 'new');

// Oversized, sparse and malformed deletion ledgers invalidate the whole snapshot.
const oversized = durableRestore.snapshot();
oversized.forgetTombstones = Array.from({ length: 257 }, (_, n) => ({
  key: `forget.key.${n}`, domain: 'interaction-style', forgottenAtTick: n, evidenceRef: `forget:${n}`,
}));
const oversizedRestore = new UserModelEvidenceModel();
oversizedRestore.restore(oversized);
assert.equal(oversizedRestore.snapshot().claims.length, 0);
assert.equal(oversizedRestore.snapshot().forgetTombstones.length, 0);
const sparse = durableRestore.snapshot();
sparse.forgetTombstones = new Array(1);
const sparseRestore = new UserModelEvidenceModel();
sparseRestore.restore(sparse);
assert.equal(sparseRestore.snapshot().forgetTombstones.length, 0);
const malformed = durableRestore.snapshot();
malformed.forgetTombstones = [{ key: 'bad', domain: 'unknown', forgottenAtTick: 1, evidenceRef: 'bad' }];
const malformedRestore = new UserModelEvidenceModel();
malformedRestore.restore(malformed);
assert.equal(malformedRestore.snapshot().claims.length, 0);

// Capacity exhaustion is explicit: no old deletion boundary is silently evicted.
const full = durableRestore.snapshot();
full.forgetTombstones = Array.from({ length: 256 }, (_, n) => ({
  key: `capacity.key.${n}`, domain: 'content-preference', forgottenAtTick: n, evidenceRef: `capacity:${n}`,
}));
const fullRestore = new UserModelEvidenceModel();
fullRestore.restore(full);
assert.equal(fullRestore.forgetExplicit({
  key: 'capacity.new', domain: 'content-preference', tick: 999,
  evidenceRef: 'capacity:new', explicit: true,
}).reason, 'tombstone-capacity-exhausted');

// Legacy v1 snapshots migrate without fabricating deletion history.
const legacy = new UserModelEvidenceModel();
legacy.restore({
  version: 1, claims: [], candidates: [], processedEvidenceRefs: [],
  rejectedSensitiveCount: 0, rejectedMalformedCount: 0,
});
assert.equal(legacy.snapshot().version, 2);
assert.equal(legacy.snapshot().forgetTombstones.length, 0);

console.log('UserModel durable forgetting, strict restore, replay rollover and v1 migration: all assertions passed');
