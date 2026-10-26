import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verifier = path.join(projectRoot, 'tools/verify-final-release.mjs');

async function fixture(t, { metadataExitCode = 0, includeMetadata = true, includePythonCache = false, includeStrayBytecode = false, includeNonBytecodeInCache = false, trackPythonCache = false } = {}) {
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
  if (includePythonCache || includeNonBytecodeInCache) {
    await mkdir(path.join(root, 'research/__pycache__'), { recursive: true });
  }
  if (includePythonCache) {
    await writeFile(path.join(root, 'research/__pycache__/fixture.cpython-312.pyc'), Buffer.from([0, 1, 2, 3]));
  }
  if (includeStrayBytecode) {
    await mkdir(path.join(root, 'research'), { recursive: true });
    await writeFile(path.join(root, 'research/stray.cpython-312.pyc'), Buffer.from([0, 1, 2, 3]));
  }
  if (includeNonBytecodeInCache) {
    await writeFile(path.join(root, 'research/__pycache__/source.py'), 'must-not-be-ignored');
  }
  if (trackPythonCache) {
    const init = spawnSync('git', ['init', '--quiet'], { cwd: root, encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    const add = spawnSync('git', ['add', 'research/__pycache__/fixture.cpython-312.pyc'], { cwd: root, encoding: 'utf8' });
    assert.equal(add.status, 0, add.stderr);
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


test('final release verifier rejects generated Python cache by default', async t => {
  const root = await fixture(t, { includePythonCache: true });
  const result = run(root);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.generatedPythonCachePolicy, 'strict');
  assert.ok(report.summary.treeFailures >= 1, 'tree hygiene failures must appear in the summary');
  assert.ok(report.summary.failed >= 1, 'a failed final verifier must not report zero failures');
  assert.ok(report.errors.some(error => error.includes('generated-python-artifact:research/__pycache__/fixture.cpython-312.pyc')));
});

test('CI can ignore only transient Python caches after research smoke', async t => {
  const root = await fixture(t, { includePythonCache: true });
  const result = run(root, ['--allow-generated-python-cache']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.generatedPythonCachePolicy, 'allow-transient-caches');
  assert.equal(report.summary.treeFailures, 0);
  assert.equal(report.summary.failed, 0);
  assert.ok(report.warnings.some(warning => warning.includes('generated-python-cache-ignored:research/__pycache__/fixture.cpython-312.pyc')));
  assert.equal(report.checks.find(check => check.id === 'release-metadata')?.pass, true);
});


test('CI cache override still rejects stray bytecode and non-bytecode files in cache directories', async t => {
  const root = await fixture(t, {
    includePythonCache: true,
    includeStrayBytecode: true,
    includeNonBytecodeInCache: true,
  });
  const result = run(root, ['--allow-generated-python-cache']);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.generatedPythonCachePolicy, 'allow-transient-caches');
  assert.ok(report.warnings.some(warning => warning.includes('generated-python-cache-ignored:research/__pycache__/fixture.cpython-312.pyc')));
  assert.ok(report.errors.some(error => error.includes('generated-python-artifact:research/stray.cpython-312.pyc')));
  assert.ok(report.errors.some(error => error.includes('generated-python-artifact:research/__pycache__/source.py')));
  assert.ok(report.summary.treeFailures >= 2);
});


test('CI cache override never ignores tracked bytecode', async t => {
  const root = await fixture(t, { includePythonCache: true, trackPythonCache: true });
  const result = run(root, ['--allow-generated-python-cache']);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.generatedPythonCachePolicy, 'allow-transient-caches');
  assert.ok(report.errors.some(error => error.includes('tracked-python-artifact:research/__pycache__/fixture.cpython-312.pyc')));
  assert.equal(report.summary.treeFailures, 1);
});
