import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaCheckScript = path.join(repoRoot, 'tools/super-schema-check.mjs');

test('schema checker rejects invalid timeout before launching verification commands', () => {
  const result = spawnSync(process.execPath, [schemaCheckScript], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 5_000,
    env: { ...process.env, NK_SCHEMA_CHECK_TIMEOUT_MS: '999' },
  });

  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /SCHEMA_CHECK=FAIL reason=invalid-timeout allowed=1000\.\.600000/);
  assert.doesNotMatch(result.stdout + result.stderr, /SCHEMA_CHECK=START/);
});
