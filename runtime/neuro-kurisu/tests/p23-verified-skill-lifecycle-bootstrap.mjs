import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createVerifiedSkillLifecycleBootstrap } from '../src/organism/learning/VerifiedSkillLifecycleBootstrap.ts';

const root = mkdtempSync(join(tmpdir(), 'nk-verified-skill-bootstrap-'));
try {
  const bootstrap = createVerifiedSkillLifecycleBootstrap(
    join(root, 'candidates.json'),
    join(root, 'trusted-runs.json'),
    '',
  );
  assert.equal(bootstrap.trustedVerifierCount, 0, 'no configured verifier keys must fail closed');
  assert.equal(bootstrap.trustedApprovalCount, 0, 'no configured approval keys must keep promotion default-deny');
  assert.deepEqual(bootstrap.store.snapshot(), {
    schemaVersion: 1,
    revision: 0,
    active: [],
    candidates: [],
  });
  assert.deepEqual(bootstrap.registry.snapshot(), { schemaVersion: 1, revision: 0, runs: [] });
  assert.throws(() => createVerifiedSkillLifecycleBootstrap(
    join(root, 'bad-candidates.json'),
    join(root, 'bad-runs.json'),
    '{not-json',
  ), /valid JSON/);
  assert.throws(() => createVerifiedSkillLifecycleBootstrap(
    join(root, 'bad2-candidates.json'),
    join(root, 'bad2-runs.json'),
    JSON.stringify({ verifier: 'not-a-PEM-key' }),
  ), /PEM public keys/);

  const ed25519 = generateKeyPairSync('ed25519');
  const validEd25519Pem = ed25519.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const configured = createVerifiedSkillLifecycleBootstrap(
    join(root, 'configured-candidates.json'),
    join(root, 'configured-runs.json'),
    JSON.stringify({ trustedVerifier: validEd25519Pem }),
  );
  assert.equal(configured.trustedVerifierCount, 1, 'valid Ed25519 verifier key should be accepted');

  const approvalKeyPair = generateKeyPairSync('ed25519');
  const validApprovalPem = approvalKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const configuredApproval = createVerifiedSkillLifecycleBootstrap(
    join(root, 'approval-candidates.json'),
    join(root, 'approval-runs.json'),
    JSON.stringify({ trustedVerifier: validEd25519Pem }),
    JSON.stringify({ 'promotion-operator-1': validApprovalPem }),
  );
  assert.equal(configuredApproval.trustedApprovalCount, 1, 'a valid detached-signature approval authority key should be accepted');
  assert.throws(() => createVerifiedSkillLifecycleBootstrap(
    join(root, 'approval-bad-candidates.json'),
    join(root, 'approval-bad-runs.json'),
    '',
    '{bad-json',
  ), /NEURO_SKILL_PROMOTION_APPROVAL_KEYS_JSON must be valid JSON/);

  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const incompatiblePem = rsa.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  assert.throws(() => createVerifiedSkillLifecycleBootstrap(
    join(root, 'bad3-candidates.json'),
    join(root, 'bad3-runs.json'),
    JSON.stringify({ incompatibleVerifier: incompatiblePem }),
  ), /valid Ed25519 public keys/);

  assert.throws(() => createVerifiedSkillLifecycleBootstrap(
    join(root, 'approval-bad2-candidates.json'),
    join(root, 'approval-bad2-runs.json'),
    '',
    JSON.stringify({ 'rsa-approver': incompatiblePem }),
  ), /promotion approval keys must be valid Ed25519 public keys/);
  console.log('verified skill lifecycle bootstrap: default-deny verifier/approval keys and Ed25519 enforcement PASS');
} finally {
  rmSync(root, { recursive: true, force: true });
}
