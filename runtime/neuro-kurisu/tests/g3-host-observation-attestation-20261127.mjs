import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { SignedObservationAdmissionAuthority, isTrustedObservationAdmission, signedObservationReceiptBytes } from '../src/organism/system/SignedObservationAdmissionAuthority.ts';
import { EmbodimentSubsystemRuntime } from '../src/organism/core/EmbodimentSubsystemRuntime.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
let now = Date.now();
const consumedNonces = new Map();
const revokedTickets = new Set();
const nonceStore = {
  async consume(input) {
    const key = [input.issuerId, input.deviceId, input.sessionId, input.nonce].join('|');
    if (consumedNonces.has(key)) return false;
    consumedNonces.set(key, input.receiptDigest);
    return true;
  },
  async hasConsumed(input) {
    const key = [input.issuerId, input.deviceId, input.sessionId, input.nonce].join('|');
    return consumedNonces.get(key) === input.receiptDigest;
  },
};
const consentAuthority = {
  async isActive(input) {
    return !revokedTickets.has(input.ticketId) &&
      input.deviceId === 'android-test-01' &&
      input.consentRevision === 3 &&
      input.modality === 'vision';
  },
};
const authority = new SignedObservationAdmissionAuthority({
  expectedDeviceId: 'android-test-01',
  resolvePublicKey: async (issuerId, keyId) =>
    issuerId === 'nk1-android-host' && keyId === 'test-ed25519-k1' ? publicKey.export({ type: 'spki', format: 'pem' }).toString() : null,
  consentAuthority,
  nonceStore,
  now: () => now,
  maxCaptureAgeMs: 120_000,
  maxFutureSkewMs: 3_000,
  maxReceiptLifetimeMs: 300_000,
});

function signedReceipt(overrides = {}) {
  const payload = {
    version: 1,
    issuerId: 'nk1-android-host',
    keyId: 'test-ed25519-k1',
    deviceId: 'android-test-01',
    sessionId: 'session-2026-11-27-a',
    nonce: 'nonce-abcdefghijklmnopqrstuvwxyz-01',
    observationId: 'observation-door-open-001',
    modality: 'vision',
    claim: 'door is open',
    confidence01: 0.92,
    capturedAt: now - 1_000,
    issuedAt: now - 500,
    expiresAt: now + 60_000,
    consentTicketId: 'consent-camera-current',
    consentRevision: 3,
    captureDigest: 'a'.repeat(64),
    ...overrides,
  };
  const signature = sign(null, signedObservationReceiptBytes(payload, 'ed25519'), privateKey).toString('base64');
  return { ...payload, signatureAlgorithm: 'ed25519', signature };
}

const receipt = signedReceipt();
const accepted = await authority.admit(receipt);
assert.equal(accepted.accepted, true, 'a valid host-signed, consented, device-bound observation must be admitted: '+JSON.stringify(accepted));
assert.equal(accepted.admission.observationId, 'observation-door-open-001');
assert.equal(accepted.admission.claim, 'door is open');
assert.equal(accepted.admission.confidence01, 0.92);
assert.equal(Object.isFrozen(accepted.admission), true);
assert.equal(isTrustedObservationAdmission(accepted.admission), true);

// Nonce consumption is atomic at the injected host store boundary.
const replay = await authority.admit(receipt);
assert.deepEqual(replay, { accepted: false, reason: 'nonce-replayed' });

// Restart reauthorization is read-only and bound to the exact previously consumed digest.
const reauthorized = await authority.reauthorizePersisted(receipt);
assert.equal(reauthorized.accepted, true);
assert.equal(reauthorized.admission.receiptDigest, accepted.admission.receiptDigest);
revokedTickets.add('consent-camera-current');
const consentRevokedOnRestart = await authority.reauthorizePersisted(receipt);
assert.equal(consentRevokedOnRestart.accepted, false);
assert.equal(consentRevokedOnRestart.reason, 'consent-not-active');
revokedTickets.delete('consent-camera-current');
const changedPayloadOnConsumedNonce = signedReceipt({
  nonce: receipt.nonce,
  claim: 'door is closed',
  observationId: 'observation-door-closed-999',
});
const changedPayloadReauthorization = await authority.reauthorizePersisted(changedPayloadOnConsumedNonce);
assert.equal(changedPayloadReauthorization.accepted, false);
assert.equal(changedPayloadReauthorization.reason, 'nonce-not-previously-consumed');
const neverConsumedReauthorization = await authority.reauthorizePersisted(
  signedReceipt({ nonce: 'nonce-never-consumed-0000000001' }),
);
assert.equal(neverConsumedReauthorization.accepted, false);
assert.equal(neverConsumedReauthorization.reason, 'nonce-not-previously-consumed');

// A private PEM is not accepted as a host verifier key; NK1 receives public keys only.
const privateKeyAuthority = new SignedObservationAdmissionAuthority({
  expectedDeviceId: 'android-test-01',
  resolvePublicKey: async () => privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  consentAuthority,
  nonceStore,
  now: () => now,
});
const privateKeyRejected = await privateKeyAuthority.admit(
  signedReceipt({ nonce: 'nonce-private-key-rejected-0001' }),
);
assert.equal(privateKeyRejected.accepted, false);
assert.equal(privateKeyRejected.reason, 'signature-invalid');

// Payload mutation invalidates the signature, even if a caller supplies verified=true.
const tampered = signedReceipt({ nonce: 'nonce-tampered-0000000000001' });
tampered.claim = 'door is closed';
const tamperedResult = await authority.admit(tampered);
assert.equal(tamperedResult.accepted, false);
assert.equal(tamperedResult.reason, 'signature-invalid');
const wrongAlgorithm = signedReceipt({ nonce: 'nonce-algorithm-substitution-0001' });
wrongAlgorithm.signatureAlgorithm = 'rsa-sha256';
const wrongAlgorithmResult = await authority.admit(wrongAlgorithm);
assert.equal(wrongAlgorithmResult.accepted, false);
assert.equal(wrongAlgorithmResult.reason, 'signature-invalid', 'the signed protocol domain must not permit algorithm substitution');

const callerFlag = await authority.admit({ ...signedReceipt({ nonce: 'nonce-caller-flag-000000001' }), verified: true });
assert.equal(callerFlag.accepted, false);
assert.equal(callerFlag.reason, 'invalid-receipt');

// A valid signature cannot be replayed onto a different device identity.
const wrongDevice = await authority.admit(signedReceipt({
  deviceId: 'different-android-device',
  nonce: 'nonce-device-mismatch-0000000001',
}));
assert.equal(wrongDevice.accepted, false);
assert.equal(wrongDevice.reason, 'device-mismatch');

// Consent must remain active and match the exact device, modality and revision.
revokedTickets.add('consent-revoked');
const revoked = await authority.admit(signedReceipt({
  consentTicketId: 'consent-revoked',
  nonce: 'nonce-revoked-consent-0000000001',
}));
assert.equal(revoked.accepted, false);
assert.equal(revoked.reason, 'consent-not-active');

// Expired/stale and malformed confidence values are rejected before nonce admission.
const stale = await authority.admit(signedReceipt({
  capturedAt: now - 300_000,
  issuedAt: now - 299_000,
  nonce: 'nonce-stale-capture-0000000001',
}));
assert.equal(stale.accepted, false);
assert.equal(stale.reason, 'receipt-time-invalid');
const invalidConfidence = await authority.admit(signedReceipt({
  confidence01: 1.2,
  nonce: 'nonce-invalid-confidence-0000001',
}));
assert.equal(invalidConfidence.accepted, false);
assert.equal(invalidConfidence.reason, 'invalid-receipt');

// Accessors and Proxies must be rejected without invoking caller traps.
let getterInvoked = false;
const accessorReceipt = signedReceipt({ nonce: 'nonce-accessor-0000000001' });
Object.defineProperty(accessorReceipt, 'claim', {
  enumerable: true,
  configurable: true,
  get() { getterInvoked = true; return 'forged'; },
});
const accessorResult = await authority.admit(accessorReceipt);
assert.equal(accessorResult.accepted, false);
assert.equal(getterInvoked, false);
let proxyTrapInvoked = false;
const proxyReceipt = new Proxy(signedReceipt({ nonce: 'nonce-proxy-0000000001' }), {
  get() { proxyTrapInvoked = true; throw new Error('proxy-get'); },
  ownKeys() { proxyTrapInvoked = true; throw new Error('proxy-ownKeys'); },
});
const proxyResult = await authority.admit(proxyReceipt);
assert.equal(proxyResult.accepted, false);
assert.equal(proxyTrapInvoked, false);

// Host authority output enters the canonical embodiment-owned evidence compiler.
// It is observed only while the current process retains the exact verified token.
const owner = new EmbodimentSubsystemRuntime();
assert.equal(typeof owner.recordAdmittedObservation, 'function');
const observed = owner.recordAdmittedObservation(accepted.admission);
assert.equal(observed.kind, 'observed');
assert.equal(observed.claim, 'door is open');
assert.equal(observed.confidence01, 0.92);
owner.perceptualEvidence.compile({ at: now });
assert.equal(owner.perceptualEvidence.snapshot().evidence.find(row => row.id === observed.id)?.kind, 'observed');

// The same admission is idempotent at this owner; caller-built copies are never trusted.
const duplicate = owner.recordAdmittedObservation(accepted.admission);
assert.deepEqual(duplicate, observed);
assert.throws(
  () => owner.recordAdmittedObservation({ ...accepted.admission }),
  /untrusted-observation-admission/,
);

// Persisted observed labels are deliberately downgraded after restart.
const persisted = owner.snapshot();
const recovered = new EmbodimentSubsystemRuntime();
recovered.restoreFromPersisted({ embodiment: persisted });
const recoveredRow = recovered.perceptualEvidence.snapshot().evidence.find(row => row.id === observed.id);
assert.equal(recoveredRow?.kind, 'derived');
assert.equal(recoveredOwner.revokeAdmittedObservation('observation-door-open-001'), true, 'a persisted but currently downgraded host receipt must still be revocable without authority');
const revokedAfterDowngrade = recoveredOwner.perceptualEvidence.snapshot().evidence.find(row => row.id === observed.id);
assert.equal(revokedAfterDowngrade?.kind, 'unresolved');
assert.equal(revokedAfterDowngrade?.revoked, true);
assert.equal(recoveredOwner.revokeAdmittedObservation('observation-door-open-001'), false);
assert.equal(owner.revokeAdmittedObservation('observation-door-open-001'), true);
const revokedRow = owner.perceptualEvidence.snapshot().evidence.find(row => row.id === observed.id);
assert.equal(revokedRow?.kind, 'unresolved');
assert.equal(revokedRow?.confidence01, 0);
assert.equal(owner.revokeAdmittedObservation('observation-door-open-001'), false);


console.log('G3_SIGNED_HOST_OBSERVATION_ADMISSION=PASS signature=device+session+consent+nonce');

const stateStore = new MemoryStateStore();
const core = new OrganismCore(stateStore, {
  enableLanguage: false,
  observationAdmissionAuthority: authority,
});
await core.init();
const coreReceipt = signedReceipt({
  nonce: 'nonce-core-runtime-admission-0001',
  observationId: 'observation-core-runtime-0001',
});
const coreAdmission = await core.admitObservationReceipt(coreReceipt);
assert.equal(coreAdmission.accepted, true, 'OrganismCore must expose the configured trusted host admission path');
assert.equal(coreAdmission.evidence.kind, 'observed');
const coreSnapshot = await stateStore.load();
const persistedAdmission = coreSnapshot?.facets?.embodiment?.perceptualEvidence?.evidence
  ?.find(row => row.id === coreAdmission.evidence.id);
assert.equal(persistedAdmission?.kind, 'observed', 'the canonical persisted embodiment facet must include host admission evidence');
const replayThroughCore = await core.admitObservationReceipt(coreReceipt);
assert.equal(replayThroughCore.accepted, false);
assert.equal(replayThroughCore.reason, 'nonce-replayed');

// A process restart first downgrades stored labels, then restores observed status
// only after rechecking signature, active consent and the durable nonce receipt digest.
const restartedStore = new MemoryStateStore({ initial: coreSnapshot });
const restartedCore = new OrganismCore(restartedStore, {
  enableLanguage: false,
  observationAdmissionAuthority: authority,
});
await restartedCore.init();
const rehydratedRow = restartedCore.organismSystemFabric.embodiment.perceptualEvidence.snapshot().evidence
  .find(row => row.id === coreAdmission.evidence.id);
assert.equal(rehydratedRow?.kind, 'observed', 'restart must reauthorize a persisted signed receipt against the host nonce ledger');

const revokedThroughCore = await restartedCore.revokeAdmittedObservation('observation-core-runtime-0001');
assert.equal(revokedThroughCore.revoked, true);
const revokedSnapshot = await restartedStore.load();
const revokedAdmission = revokedSnapshot?.facets?.embodiment?.perceptualEvidence?.evidence
  ?.find(row => row.id === coreAdmission.evidence.id);
assert.equal(revokedAdmission?.kind, 'unresolved', 'consent revocation must be checkpointed through the canonical Core path');

// Revocation is monotonic across restart: a still-valid old signature must not
// re-promote the explicitly revoked observation.
const postRevokeCore = new OrganismCore(new MemoryStateStore({ initial: revokedSnapshot }), {
  enableLanguage: false,
  observationAdmissionAuthority: authority,
});
await postRevokeCore.init();
const afterRevokeRestart = postRevokeCore.organismSystemFabric.embodiment.perceptualEvidence.snapshot().evidence
  .find(row => row.id === coreAdmission.evidence.id);
assert.equal(afterRevokeRestart?.kind, 'unresolved');
assert.equal(afterRevokeRestart?.revoked, true);
await postRevokeCore.flush();
await restartedCore.flush();
await core.flush();
postRevokeCore.stop?.();
restartedCore.stop?.();
core.stop?.();

console.log('G3_SIGNED_HOST_OBSERVATION_CORE_WIRING=PASS');
