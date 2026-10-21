import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { ingestSignedOutcomeArtifact, signOutcomePayloadForFixture } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import { selectVerifiedReplayExperiences } from '../src/organism/learning/VerifiedReplayAdmission.ts';

const fp = text => VerifiedOutcomeLedger.fingerprintPrompt(text);
const manifest = [
  { taskId: 'train-pass', family: 'memory', split: 'train', promptFingerprint: fp('train pass'), verifierId: 'v1', version: 'v1' },
  { taskId: 'train-fail', family: 'tool-use', split: 'train', promptFingerprint: fp('train fail'), verifierId: 'v1', version: 'v1' },
  { taskId: 'train-forged', family: 'tool-use', split: 'train', promptFingerprint: fp('train forged'), verifierId: 'v1', version: 'v1' },
  { taskId: 'holdout-only', family: 'transfer', split: 'holdout', promptFingerprint: fp('holdout'), verifierId: 'v1', version: 'v1' },
];
const ledger = new VerifiedOutcomeLedger(manifest);
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const trustedKeys = new Map([['v1', publicKey.export({ type: 'spki', format: 'pem' }).toString()]]);
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
let artifactCounter = 0;
const record = (taskId, method, seed, passed, attempt = 1, authority = 'independent-verifier') => {
  const payload = {
    schemaVersion: 1, artifactId: `artifact-${++artifactCounter}`, runId: `run-${taskId}-${method}-${seed}`,
    manifestFingerprint: ledger.manifestFingerprint(), taskId, taskVersion: 'v1', method, seed,
    attempt, passed, verifierId: 'v1', observedAt: 1000 + seed + attempt,
  };
  if (authority === 'self-report') {
    return ledger.record({ taskId, taskVersion: 'v1', method, seed, attempt, passed, authority,
      verifierId: 'v1', evidenceRef: `self-report:${artifactCounter}`, observedAt: payload.observedAt });
  }
  const artifact = signOutcomePayloadForFixture(payload, privateKeyPem);
  const result = ingestSignedOutcomeArtifact(ledger, manifest, artifact, trustedKeys);
  return { ...result, evidenceRef: `signed-artifact:${payload.artifactId}:sha256:${result.artifactFingerprint}` };
};

const pass = record('train-pass', 'policy-a', 1, true);
const failure = record('train-fail', 'policy-a', 1, false);
const holdout = record('holdout-only', 'policy-a', 1, true);
assert.equal(pass.accepted, true);
assert.equal(failure.accepted, true);
assert.equal(holdout.accepted, true);
assert.equal(record('train-pass', 'self-reported', 2, true, 1, 'self-report').accepted, false);

// Deliberately bypass the signed-artifact ingestion boundary: the ledger allows
// an authority claim, but replay must not mistake that claim for a verified receipt.
assert.equal(ledger.record({
  taskId: 'train-forged', taskVersion: 'v1', method: 'policy-a', seed: 7, attempt: 1, passed: true,
  authority: 'independent-verifier', verifierId: 'v1', evidenceRef: 'signed-artifact:forged:sha256:' + 'a'.repeat(64), observedAt: 1007,
}).accepted, true);

const experiences = [
  { id: 'good-pass', taskId: 'train-pass', taskVersion: 'v1', method: 'policy-a', seed: 1, attempt: 1, evidenceRef: pass.evidenceRef, tick: 1, contextKey: 'memory', action: 'recall', surprise: 0.4 },
  { id: 'good-failure', taskId: 'train-fail', taskVersion: 'v1', method: 'policy-a', seed: 1, attempt: 1, evidenceRef: failure.evidenceRef, tick: 2, contextKey: 'tools', action: 'repair', surprise: 0.9 },
  { id: 'wrong-evidence', taskId: 'train-pass', taskVersion: 'v1', method: 'policy-a', seed: 1, attempt: 1, evidenceRef: 'signed-artifact:forged', tick: 3, contextKey: 'memory', action: 'recall', surprise: 1 },
  { id: 'unknown-task', taskId: 'not-in-manifest', taskVersion: 'v1', method: 'policy-a', seed: 1, attempt: 1, evidenceRef: 'artifact://unknown', tick: 4, contextKey: 'other', action: 'do', surprise: 1 },
  { id: 'wrong-version', taskId: 'train-pass', taskVersion: 'v0', method: 'policy-a', seed: 1, attempt: 1, evidenceRef: pass.evidenceRef, tick: 5, contextKey: 'memory', action: 'recall', surprise: 1 },
  { id: 'holdout', taskId: 'holdout-only', taskVersion: 'v1', method: 'policy-a', seed: 1, attempt: 1, evidenceRef: holdout.evidenceRef, tick: 6, contextKey: 'transfer', action: 'generalize', surprise: 1 },
  { id: 'no-outcome', taskId: 'train-pass', taskVersion: 'v1', method: 'policy-a', seed: 99, attempt: 1, evidenceRef: 'artifact://missing', tick: 7, contextKey: 'memory', action: 'recall', surprise: 1 },
  { id: 'forged-authority', taskId: 'train-forged', taskVersion: 'v1', method: 'policy-a', seed: 7, attempt: 1, evidenceRef: 'signed-artifact:forged:sha256:' + 'a'.repeat(64), tick: 8, contextKey: 'tools', action: 'repair', surprise: 1 },
  { id: 'good-failure', taskId: 'train-fail', taskVersion: 'v1', method: 'policy-a', seed: 1, attempt: 1, evidenceRef: failure.evidenceRef, tick: 9, contextKey: 'tools', action: 'repair', surprise: 1 },
];

const result = selectVerifiedReplayExperiences(ledger, experiences, { maxBatchSize: 8, recentQuota: 1 });
assert.equal(result.split, 'train');
assert.equal(result.eligibleOutcomeCount, 2, 'only authenticated train outcomes count as eligible');
assert.equal(result.admittedCount, 2, 'only exact task/version/method/seed/attempt/evidence matches are admitted');
assert.equal(result.selectedCount, 2);
assert.deepEqual(result.admitted.map(item => item.experience.id), ['good-pass', 'good-failure']);
assert.equal(result.admitted.find(item => item.experience.id === 'good-pass').outcome.passed, true);
assert.equal(result.admitted.find(item => item.experience.id === 'good-failure').outcome.passed, false,
  'independently verified failures remain useful for repair learning');
assert.equal(result.rejected.some(item => item.code === 'evidence-reference-mismatch'), true);
assert.equal(result.rejected.some(item => item.code === 'wrong-split'), true);
assert.equal(result.rejected.some(item => item.code === 'task-version-mismatch'), true);
assert.equal(result.rejected.some(item => item.code === 'outcome-not-found'), true);
assert.equal(result.rejected.some(item => item.code === 'duplicate-experience-id'), true);
assert.equal(result.rejected.some(item => item.code === 'unauthenticated-outcome'), true);
assert.equal(result.selected.every(item => item.manifestFingerprint === ledger.manifestFingerprint()), true);
assert.ok(result.selected.some(item => item.experience.id === 'good-failure'), 'verified failures remain available to the salience-aware replay selector');

const explicitlyRequestedHoldout = selectVerifiedReplayExperiences(ledger, [experiences[5]], { split: 'holdout' });
assert.equal(explicitlyRequestedHoldout.admittedCount, 1, 'holdout requires explicit split selection and authentic evidence');
console.log('P23_VERIFIED_REPLAY_ADMISSION=PASS');
console.log(JSON.stringify({ admitted: result.admittedCount, rejected: result.rejected.length, selected: result.selectedCount, manifestFingerprint: result.manifestFingerprint }));
