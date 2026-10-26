import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verifier = path.join(projectRoot, 'tools/verify-final-release.mjs');

async function fixture(t, { metadataExitCode = 0, includeMetadata = true } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nk-final-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'runtime/neuro-kurisu/scripts'), { recursive: true });
  await mkdir(path.join(root, 'tools'), { recursive: true });
  await writeFile(
    path.join(root, 'runtime/neuro-kurisu/scripts/audit-ui-function-wiring.mjs'),
    "console.log('ui wiring ok');\n",
  );
  await writeFile(
    path.join(root, 'runtime/neuro-kurisu/scripts/audit-architecture.mjs'),
    "console.log('architecture ok');\n",
  );
  if (includeMetadata) {
    await writeFile(
      path.join(root, 'tools/verify-release-metadata.mjs'),
      `console.log('metadata fixture exit=${metadataExitCode}'); process.exitCode = ${metadataExitCode};\n`,
    );
  }
  return root;
}

function run(root, extraArgs = []) {
  return spawnSync(process.execPath, [verifier, '--root', root, ...extraArgs], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 15000,
  });
}

test('final release verifier includes the release metadata gate', async t => {
  const root = await fixture(t, { metadataExitCode: 0 });
  const result = run(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.deepEqual(report.checks.map(check => [check.id, check.pass]), [
    ['ui-wiring', true],
    ['architecture', true],
    ['release-metadata', true],
  ]);
  assert.equal(report.summary.failed, 0);
});

test('final release verifier fails closed when release metadata is invalid', async t => {
  const root = await fixture(t, { metadataExitCode: 1 });
  const result = run(root);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.checks.find(check => check.id === 'release-metadata')?.pass, false);
  assert.ok(report.errors.some(error => error.startsWith('release-metadata:metadata fixture exit=1')));
});

test('final release verifier fails closed when the metadata validator is missing', async t => {
  const root = await fixture(t, { includeMetadata: false });
  const result = run(root);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.checks.find(check => check.id === 'release-metadata')?.pass, false);
});

test('final release verifier rejects unknown CLI arguments', async () => {
  const result = spawnSync(process.execPath, [verifier, '--typo'], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown argument: --typo/);
});
