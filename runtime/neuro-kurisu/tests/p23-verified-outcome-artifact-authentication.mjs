import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
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

const restored = VerifiedOutcomeLedger.restoreSnapshot(ledger.snapshot());
assert.equal(hasAuthenticatedOutcomeEvidence(restored, evidenceRef), false,
  'restored ledger rows do not inherit in-process cryptographic provenance');
assert.equal(ingestSignedOutcomeArtifact(restored, manifest, validArtifact, new Map([[task.verifierId, publicPem]])).accepted, false,
  're-ingesting an already accepted attempt remains blocked by duplicate-attempt protection');
console.log('P23_VERIFIED_OUTCOME_ARTIFACT_AUTHENTICATION=PASS');
