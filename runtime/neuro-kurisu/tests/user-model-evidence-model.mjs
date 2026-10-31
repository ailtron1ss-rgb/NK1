import assert from 'node:assert/strict';
import { UserModelEvidenceModel } from '../src/organism/cognition/UserModelEvidenceModel.ts';

const model = new UserModelEvidenceModel();
const base = { key: 'reply.detail', domain: 'interaction-style', value: 'concise', tick: 1, explicit: true, sensitivity: 'low-risk' };
const accepted = model.recordExplicit({ ...base, evidenceRef: 'turn:1' });
assert.equal(accepted.accepted, true);
assert.equal(accepted.status, 'confirmed');

const duplicate = model.recordExplicit({ ...base, evidenceRef: 'turn:1' });
assert.deepEqual(duplicate, { accepted: false, reason: 'duplicate-evidence' });

const inferred = model.observeBehavior({
  key: 'reply.detail', domain: 'interaction-style', value: 'concise',
  tick: 2, observationRef: 'obs:2', sensitivity: 'low-risk',
});
assert.equal(inferred.accepted, true);
assert.equal(model.snapshot().claims[0].status, 'confirmed');

const candidate1 = model.observeBehavior({
  key: 'format.preference', domain: 'content-preference', value: 'bullet-list',
  tick: 3, observationRef: 'obs:3', sensitivity: 'low-risk',
});
const candidate2 = model.observeBehavior({
  key: 'format.preference', domain: 'content-preference', value: 'bullet-list',
  tick: 4, observationRef: 'obs:4', sensitivity: 'low-risk',
});
assert.equal(candidate1.candidate.status, 'unconfirmed-candidate');
assert.equal(candidate2.candidate.observations, 2);
assert.ok(candidate2.candidate.confidence01 <= 0.65);

const sensitive = model.recordExplicit({
  ...base, key: 'health.detail', value: 'private', evidenceRef: 'turn:5', sensitivity: 'sensitive',
});
assert.deepEqual(sensitive, { accepted: false, reason: 'sensitive-or-unclassified' });
assert.equal(model.snapshot().claims.some(x => x.key === 'health.detail'), false);

const contradiction = model.recordExplicit({
  ...base, value: 'detailed', tick: 6, evidenceRef: 'turn:6',
});
assert.equal(contradiction.accepted, true);
assert.equal(contradiction.status, 'disputed');
assert.equal(model.snapshot().claims[0].value, 'concise');

const stillDisputed = model.recordExplicit({
  ...base, tick: 7, evidenceRef: 'turn:7',
});
assert.equal(stillDisputed.status, 'disputed');

const corrected = model.correctExplicit({
  ...base, value: 'detailed', tick: 8, evidenceRef: 'turn:8',
});
assert.equal(corrected.accepted, true);
assert.equal(corrected.status, 'confirmed');
assert.equal(corrected.claim.value, 'detailed');
assert.equal(corrected.claim.contradictions, 0);
assert.equal(model.confirmedValue('reply.detail', 'interaction-style'), 'detailed');
assert.equal(model.decisionContext().disputedClaims.length, 0);
assert.equal(model.decisionContext().confirmedClaims.some(x => x.key === 'reply.detail'), true);
assert.equal(model.decisionContext().hypotheses.every(x => x.status === 'unconfirmed-candidate'), true);

const restored = new UserModelEvidenceModel();
restored.restore(model.snapshot());
assert.deepEqual(restored.snapshot(), model.snapshot());
assert.equal(restored.recordExplicit({ ...base, evidenceRef: 'turn:8' }).reason, 'duplicate-evidence');

const hostile = new UserModelEvidenceModel();
hostile.restore({
  version: 1,
  claims: [{ key: '__proto__', domain: 'interaction-style', value: 'x', firstSeenTick: 1, lastSeenTick: 1, evidenceRef: 'e' }],
  candidates: [{ key: 'bad', domain: 'unknown', value: 'x', firstSeenTick: 1, lastSeenTick: 1 }],
  processedEvidenceRefs: ['e', 'e'],
});
assert.equal(hostile.snapshot().claims.length, 1);
assert.equal(hostile.snapshot().candidates.length, 0);
assert.equal(hostile.snapshot().processedEvidenceRefs.length, 1);

let rootGetterExecuted = false;
const accessorEnvelope = {};
Object.defineProperty(accessorEnvelope, 'claims', {
  enumerable: true,
  get() { rootGetterExecuted = true; return [{ key: 'injected', domain: 'interaction-style', value: 'unsafe', firstSeenTick: 1, lastSeenTick: 1, evidenceRef: 'getter' }]; },
});
const accessorClaim = { key: 'nested', domain: 'interaction-style', firstSeenTick: 1, lastSeenTick: 1, evidenceRef: 'nested-ref' };
Object.defineProperty(accessorClaim, 'value', {
  enumerable: true,
  get() { rootGetterExecuted = true; return 'unsafe'; },
});
accessorEnvelope.candidates = [];
const accessorArray = [];
Object.defineProperty(accessorArray, '0', {
  enumerable: true,
  get() { rootGetterExecuted = true; return accessorClaim; },
});
accessorArray.length = 1;
accessorEnvelope.processedEvidenceRefs = accessorArray;
const accessorSafe = new UserModelEvidenceModel();
accessorSafe.restore(accessorEnvelope);
assert.equal(rootGetterExecuted, false, 'restore must not execute root, row or array-slot getters');
assert.equal(accessorSafe.snapshot().claims.length, 0);
assert.equal(accessorSafe.snapshot().processedEvidenceRefs.length, 0);

console.log('UserModelEvidenceModel: all assertions passed');
