import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { canonicalOutcomePayload, ingestSignedOutcomeArtifact, outcomePayloadFingerprint } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const manifest = [{
  taskId: 'holdout-1', family: 'memory', split: 'holdout',
  promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('What did the user say?'),
  verifierId: 'verifier-ed25519-v1', version: '3',
}];
const ledger = new VerifiedOutcomeLedger(manifest);
const keys = new Map([['verifier-ed25519-v1', publicPem]]);
const makePayload = (overrides = {}) => ({
  schemaVersion: 1, artifactId: 'artifact-001', runId: 'run-001',
  manifestFingerprint: ledger.manifestFingerprint(), taskId: 'holdout-1',
  taskVersion: '3', method: 'candidate', seed: 42, attempt: 1,
  passed: true, verifierId: 'verifier-ed25519-v1', observedAt: 1792512000000,
  ...overrides,
});
const artifactFor = payload => ({
  payload,
  signature: sign(null, Buffer.from(canonicalOutcomePayload(payload)), privateKey).toString('base64'),
});

const validPayload = makePayload();
const accepted = ingestSignedOutcomeArtifact(ledger, manifest, artifactFor(validPayload), keys);
assert.equal(accepted.accepted, true);
assert.match(accepted.artifactFingerprint, /^[a-f0-9]{64}$/);
assert.equal(ledger.snapshot().acceptedOutcomes, 1);
// Re-ingesting the exact signed artifact is idempotent, including trust-receipt restoration after restart.
const replayed = ingestSignedOutcomeArtifact(ledger, manifest, artifactFor(validPayload), keys);
assert.equal(replayed.accepted, true);
assert.equal(replayed.artifactFingerprint, accepted.artifactFingerprint);
assert.equal(ledger.snapshot().acceptedOutcomes, 1, 'an identical signed replay must not create a duplicate row');

// A different signed payload for the same task/method/seed/attempt must still fail closed.
const conflicting = artifactFor(makePayload({ artifactId: 'artifact-conflict', passed: false }));
assert.equal(ingestSignedOutcomeArtifact(ledger, manifest, conflicting, keys).rejection, 'conflicting-existing-outcome');

const changed = makePayload({ artifactId: 'artifact-002', passed: false });
const forged = artifactFor(changed);
forged.payload.passed = true;
assert.equal(ingestSignedOutcomeArtifact(ledger, manifest, forged, keys).rejection, 'invalid-signature');

const wrongManifest = makePayload({ artifactId: 'artifact-003', manifestFingerprint: '0'.repeat(64) });
assert.equal(ingestSignedOutcomeArtifact(ledger, manifest, artifactFor(wrongManifest), keys).rejection, 'manifest-fingerprint-mismatch');
assert.equal(ingestSignedOutcomeArtifact(ledger, manifest, artifactFor(makePayload()), new Map()).rejection, 'untrusted-verifier-key');
assert.equal(ingestSignedOutcomeArtifact(ledger, manifest, artifactFor(makePayload({ taskVersion: '2', artifactId: 'artifact-004' })), keys).rejection, 'manifest-task-or-verifier-mismatch');
assert.equal(ingestSignedOutcomeArtifact(ledger, manifest, { payload: null, signature: '' }, keys).rejection, 'invalid-artifact-schema');
assert.equal(ingestSignedOutcomeArtifact(ledger, manifest, artifactFor(makePayload({ artifactId: 17 })), keys).rejection, 'invalid-artifact-fields');
assert.equal(outcomePayloadFingerprint(validPayload).length, 64);
console.log('P23_SIGNED_OUTCOME_ARTIFACT=PASS');
