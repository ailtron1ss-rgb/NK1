import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { serializeVerifiedOutcomeLedger, restoreVerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedgerStore.ts';
import {
  hasAuthenticatedOutcomeEvidence, ingestSignedOutcomeArtifact, outcomePayloadFingerprint,
  signOutcomePayloadForFixture,
} from '../src/organism/learning/VerifiedOutcomeArtifact.ts';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const task = {
  taskId: 'verified-task', family: 'memory', split: 'holdout',
  promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('unique verified task prompt'),
  verifierId: 'trusted-verifier', version: 'v1',
};
const manifest = [task];
const ledger = new VerifiedOutcomeLedger(manifest);
function payload(passed=true) {
  return {
    schemaVersion: 1, artifactId: 'artifact-'+String(passed), runId: 'run-1',
    manifestFingerprint: ledger.manifestFingerprint(), taskId: task.taskId, taskVersion: task.version,
    method: 'candidate', seed: 1, attempt: 1, passed, verifierId: task.verifierId, observedAt: Date.now(),
  };
}
const validPayload = payload(true);
const validArtifact = signOutcomePayloadForFixture(validPayload, privatePem);
const accepted = ingestSignedOutcomeArtifact(ledger, manifest, validArtifact, new Map([[task.verifierId, publicPem]]));
assert.equal(accepted.accepted, true);
const evidenceRef = `signed-artifact:${validPayload.artifactId}:sha256:${outcomePayloadFingerprint(validPayload)}`;
assert.equal(hasAuthenticatedOutcomeEvidence(ledger, evidenceRef), true);

// A valid signature and task id are not enough if the caller supplies a different
// manifest from the one bound to the ledger (e.g. a split/family/prompt substitution).
const substitutedManifest = [{ ...task, split: 'train' }];
const manifestSubstitution = ingestSignedOutcomeArtifact(
  ledger, substitutedManifest, signOutcomePayloadForFixture({ ...payload(false), artifactId: 'manifest-substitution' }, privatePem),
  new Map([[task.verifierId, publicPem]]),
);
assert.equal(manifestSubstitution.accepted, false);
assert.equal(manifestSubstitution.rejection, 'supplied-manifest-mismatch');

const malformedManifest = [task, { ...task }];
const malformedManifestResult = ingestSignedOutcomeArtifact(
  ledger, malformedManifest, validArtifact, new Map([[task.verifierId, publicPem]]),
);
assert.equal(malformedManifestResult.accepted, false);
assert.equal(malformedManifestResult.rejection, 'invalid-supplied-manifest',
  'duplicate task IDs in the supplied manifest must fail closed');

const alteredPayload = { ...payload(false), artifactId: 'altered-artifact' };
const alteredArtifact = { ...signOutcomePayloadForFixture(alteredPayload, privatePem), payload: { ...alteredPayload, passed: true } };
const altered = ingestSignedOutcomeArtifact(ledger, manifest, alteredArtifact, new Map([[task.verifierId, publicPem]]));
assert.equal(altered.accepted, false);
assert.equal(altered.rejection, 'invalid-signature');

const untrusted = ingestSignedOutcomeArtifact(
  ledger, manifest,
  signOutcomePayloadForFixture({ ...payload(false), artifactId: 'untrusted-artifact' }, privatePem),
  new Map(),
);
assert.equal(untrusted.accepted, false);
assert.equal(untrusted.rejection, 'untrusted-verifier-key');

const restored = restoreVerifiedOutcomeLedger(serializeVerifiedOutcomeLedger(ledger));
assert.equal(hasAuthenticatedOutcomeEvidence(restored, evidenceRef), false,
  'restored ledger rows do not inherit in-process cryptographic provenance');
const reauthenticated = ingestSignedOutcomeArtifact(restored, manifest, validArtifact, new Map([[task.verifierId, publicPem]]));
assert.equal(reauthenticated.accepted, true,
  'the exact signed artifact must restore its trust receipt after restart without duplicating the ledger row');
assert.equal(hasAuthenticatedOutcomeEvidence(restored, evidenceRef), true);
assert.equal(restored.snapshot().outcomes.length, ledger.snapshot().outcomes.length,
  'reattestation must not create a duplicate accepted outcome');
const conflictingPayload = { ...validPayload, passed: false };
const conflictingArtifact = signOutcomePayloadForFixture(conflictingPayload, privatePem);
const conflicting = ingestSignedOutcomeArtifact(restored, manifest, conflictingArtifact, new Map([[task.verifierId, publicPem]]));
assert.equal(conflicting.accepted, false,
  'a different signed outcome for the same task/method/seed/attempt must not replace the restored record');
assert.equal(conflicting.rejection, 'conflicting-existing-outcome');
console.log('P23_VERIFIED_OUTCOME_ARTIFACT_AUTHENTICATION=PASS');
