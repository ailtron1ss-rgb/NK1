import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationScript = path.join(repoRoot, 'tools/super-migrate.mjs');

test('migration runner rejects invalid timeout before launching migration scripts', () => {
  const result = spawnSync(process.execPath, [migrationScript], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 5_000,
    env: { ...process.env, NK_MIGRATION_TIMEOUT_MS: '999', DATABASE_URL: '' },
  });

  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /MIGRATION=FAIL reason=invalid-timeout allowed=1000\.\.3600000/);
  assert.doesNotMatch(result.stdout + result.stderr, /MIGRATION=START/);
});
