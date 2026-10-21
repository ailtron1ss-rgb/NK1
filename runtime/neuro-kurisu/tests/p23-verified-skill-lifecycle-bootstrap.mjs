import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createVerifiedSkillLifecycleBootstrap } from '../src/organism/learning/VerifiedSkillLifecycleBootstrap.ts';

const root = mkdtempSync(join(tmpdir(), 'nk-verified-skill-bootstrap-'));
try {
  const bootstrap = createVerifiedSkillLifecycleBootstrap(
    join(root, 'candidates.json'),
    join(root, 'trusted-runs.json'),
    undefined,
  );
  assert.equal(bootstrap.trustedVerifierCount, 0, 'no configured verifier keys must fail closed');
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
  console.log('verified skill lifecycle bootstrap: default-deny and configuration validation PASS');
} finally {
  rmSync(root, { recursive: true, force: true });
}
