import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { buildVerifiedSessionDataset } from '../src/organism/learning/VerifiedSessionDataset.ts';
import { ingestSignedOutcomeArtifact, signOutcomePayloadForFixture } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';

const fp = value => VerifiedOutcomeLedger.fingerprintPrompt(value);
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const trustedKeys = new Map([['verifier-a', publicKey.export({ type: 'spki', format: 'pem' }).toString()]]);
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const ledger = new VerifiedOutcomeLedger([
  { taskId: 'train-1', family: 'tool-use', split: 'train', promptFingerprint: fp('train prompt'), verifierId: 'verifier-a', version: 'v1' },
  { taskId: 'validation-1', family: 'tool-use', split: 'validation', promptFingerprint: fp('validation prompt'), verifierId: 'verifier-a', version: 'v1' },
  { taskId: 'holdout-secret-id', family: 'tool-use', split: 'holdout', promptFingerprint: fp('holdout prompt'), verifierId: 'verifier-a', version: 'v1' },
]);
const now = Date.now();
let artifactCounter = 0;
const record = (taskId, method, passed, evidenceRef, seed = 1) => {
  const payload = {
    schemaVersion: 1, artifactId: `artifact-${++artifactCounter}`, runId: `run-${method}-${seed}`,
    manifestFingerprint: ledger.manifestFingerprint(), taskId, taskVersion: 'v1', method, seed,
    attempt: 1, passed, verifierId: 'verifier-a', observedAt: now,
  };
  const artifact = signOutcomePayloadForFixture(payload, privateKeyPem);
  return ingestSignedOutcomeArtifact(ledger, [
    { taskId: 'train-1', family: 'tool-use', split: 'train', promptFingerprint: fp('train prompt'), verifierId: 'verifier-a', version: 'v1' },
    { taskId: 'validation-1', family: 'tool-use', split: 'validation', promptFingerprint: fp('validation prompt'), verifierId: 'verifier-a', version: 'v1' },
    { taskId: 'holdout-secret-id', family: 'tool-use', split: 'holdout', promptFingerprint: fp('holdout prompt'), verifierId: 'verifier-a', version: 'v1' },
  ], artifact, trustedKeys);
};
assert.equal(record('train-1', 'baseline', true, '/private/path?token=secret').accepted, true);
assert.equal(record('validation-1', 'candidate', false, 'https://example.invalid/evidence?api_key=secret').accepted, true);
for (let seed = 1; seed <= 5; seed++) {
  assert.equal(record('holdout-secret-id', 'baseline', true, `private-holdout-ref-${seed}`, seed).accepted, true);
}
assert.equal(record('holdout-secret-id', 'candidate', false, 'private-holdout-ref-2').accepted, true);
const rejected = ledger.record({
  taskId: 'train-1', taskVersion: 'v1', method: 'self-report', seed: 2, attempt: 1, passed: true,
  authority: 'self-report', verifierId: 'model', evidenceRef: 'model-said-so', observedAt: now,
});
assert.equal(rejected.accepted, false);

const dataset = buildVerifiedSessionDataset(ledger);
assert.equal(dataset.training.length, 1);
assert.equal(dataset.validation.length, 1);
assert.equal(dataset.training[0].split, 'train');
assert.equal(dataset.validation[0].split, 'validation');
assert.ok(!JSON.stringify(dataset).includes('token=secret'));
assert.ok(!JSON.stringify(dataset).includes('api_key=secret'));
assert.ok(!JSON.stringify(dataset).includes('holdout-secret-id'));
assert.ok(!JSON.stringify(dataset).includes('private-holdout-ref'));
// A single-case candidate aggregate would reveal its exact holdout label; suppress it.
assert.equal(dataset.holdoutAggregates.length, 1);
assert.equal(dataset.holdoutAggregates[0].method, 'baseline');
assert.equal(dataset.holdoutAggregates[0].outcomeCount, 5);
assert.equal(dataset.holdoutAggregates[0].passRate, 1);
assert.ok(!JSON.stringify(dataset.holdoutAggregates).includes('candidate'));
assert.equal(dataset.rejectedSelfReports, 1);
assert.match(dataset.datasetFingerprint, /^[a-f0-9]{64}$/);
assert.equal(buildVerifiedSessionDataset(ledger).datasetFingerprint, dataset.datasetFingerprint,
  'dataset fingerprint must be stable across exports of unchanged ledger content');
const evaluationSnapshot = ledger.snapshot();
assert.equal(record('train-1', 'baseline', false, 'new-verified-evidence', 2).accepted, true);
assert.notEqual(buildVerifiedSessionDataset(ledger).datasetFingerprint, dataset.datasetFingerprint,
  'new verified outcomes must change dataset fingerprint');
assert.equal(buildVerifiedSessionDataset(ledger, evaluationSnapshot).datasetFingerprint, dataset.datasetFingerprint,
  'a proposal using a captured ledger snapshot must not silently mix in later outcomes');
const untrustedLedger = new VerifiedOutcomeLedger([
  { taskId: 'untrusted-train', family: 'tool-use', split: 'train', promptFingerprint: fp('untrusted prompt'), verifierId: 'verifier-a', version: 'v1' },
]);
assert.equal(untrustedLedger.record({
  taskId: 'untrusted-train', taskVersion: 'v1', method: 'candidate', seed: 1, attempt: 1, passed: true,
  authority: 'independent-verifier', verifierId: 'verifier-a', evidenceRef: `signed-artifact:forged:sha256:${'a'.repeat(64)}`, observedAt: now,
}).accepted, true);
assert.equal(buildVerifiedSessionDataset(untrustedLedger).training.length, 0,
  'claimed independent-verifier authority without an authenticated artifact must not enter training data');
console.log('P23_VERIFIED_SESSION_DATASET=PASS');
