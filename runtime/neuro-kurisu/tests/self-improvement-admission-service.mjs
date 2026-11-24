import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  computeSourceSnapshotSha256,
  SelfImprovementPatchAdmissionService,
} from '../src/organism/analysis/SelfImprovementCandidatePool.ts';

const baseSha = 'a'.repeat(40);
const sourceFiles = [
  { path: 'src/organism/cognition/Evolvable.ts', text: 'export function tune(x: number) { return x; }\n' },
  { path: 'src/organism/analysis/SelfModificationGuard.ts', text: 'export function evaluateModification() {}\n' },
];
const patchKey = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString();
const evaluatorKey = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString();

test('host composition requires a complete unique source snapshot and a matching immutable digest', () => {
  const digest = computeSourceSnapshotSha256(sourceFiles);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.throws(() => computeSourceSnapshotSha256([]), /host-source-snapshot-files-invalid/);
  assert.throws(() => computeSourceSnapshotSha256([sourceFiles[0], { ...sourceFiles[0] }]), /host-source-snapshot-file-invalid/);
});

test('host composition rejects untrusted source SHA, digest and incomplete trust stores', () => {
  const digest = computeSourceSnapshotSha256(sourceFiles);
  const trust = {
    baseSha,
    sourceSnapshotSha256: digest,
    trustedPublicKeys: { patch: patchKey },
    trustedOutcomePublicKeys: { evaluator: evaluatorKey },
  };
  assert.throws(() => new SelfImprovementPatchAdmissionService({
    sourceSnapshot: { baseSha: 'b'.repeat(40), files: sourceFiles },
    hostTrust: trust,
  }), /host-source-snapshot-base-sha-mismatch/);
  assert.throws(() => new SelfImprovementPatchAdmissionService({
    sourceSnapshot: { baseSha, files: sourceFiles },
    hostTrust: { ...trust, sourceSnapshotSha256: 'b'.repeat(64) },
  }), /host-source-snapshot-digest-mismatch/);
  assert.throws(() => new SelfImprovementPatchAdmissionService({
    sourceSnapshot: { baseSha, files: sourceFiles },
    hostTrust: { ...trust, trustedOutcomePublicKeys: {} },
  }), /candidate-pool-patch-receipt-trust-invalid/);
  assert.throws(() => new SelfImprovementPatchAdmissionService({
    sourceSnapshot: { baseSha, files: sourceFiles },
    hostTrust: {
      ...trust,
      trustedOutcomePublicKeys: { evaluatorA: evaluatorKey, evaluatorB: evaluatorKey },
    },
  }), /candidate-pool-patch-receipt-trust-invalid/);
  assert.throws(() => new SelfImprovementPatchAdmissionService({
    sourceSnapshot: { baseSha, files: sourceFiles },
    hostTrust: {
      ...trust,
      trustedOutcomePublicKeys: { evaluatorA: patchKey },
    },
  }), /candidate-pool-patch-receipt-trust-invalid/);
});
