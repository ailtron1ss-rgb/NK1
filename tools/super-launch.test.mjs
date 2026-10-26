import assert from 'node:assert/strict';
import { readFile, access, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  PROJECT_ROOT,
  RUNTIME_SERVER_PATH,
  SUPER_STATE_DIRECTORY,
} from './super-paths.mjs';

const readText = file => readFile(file, 'utf8');

test('shared supervisor paths resolve the actual runtime entrypoint from the project root', async () => {
  const expectedRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
  assert.equal(PROJECT_ROOT, expectedRoot);
  assert.equal(
    RUNTIME_SERVER_PATH,
    path.resolve(PROJECT_ROOT, 'runtime/neuro-kurisu/src/server/server.mjs'),
  );
  await access(RUNTIME_SERVER_PATH);
  assert.equal((await stat(RUNTIME_SERVER_PATH)).isFile(), true);
  assert.equal(SUPER_STATE_DIRECTORY, path.resolve(PROJECT_ROOT, '.super-state'));
});

test('both production and development launchers execute the real runtime entrypoint', async () => {
  const start = await readText(path.join(PROJECT_ROOT, 'tools/super-start.mjs'));
  const dev = await readText(path.join(PROJECT_ROOT, 'tools/super-dev.mjs'));
  for (const [label, source] of [['start', start], ['dev', dev]]) {
    assert.match(
      source,
      /launch\('neuro-kurisu',\s*'node',\s*\['--experimental-strip-types',\s*RUNTIME_SERVER_PATH\]/,
      label + ' launcher must pass the canonical absolute server path to Node',
    );
    assert.match(source, /existsSync\(RUNTIME_SERVER_PATH\)/,
      label + ' launcher must fail early with a clear message when runtime entrypoint is missing');
    assert.doesNotMatch(source, /['"]src\/server\/server\.mjs['"]/,
      label + ' launcher must not resolve the runtime server relative to repository root');
  }
});

test('root npm lockfile pins the actual package metadata for clean npm ci', async () => {
  const pkg = JSON.parse(await readText(path.join(PROJECT_ROOT, 'package.json')));
  const lock = JSON.parse(await readText(path.join(PROJECT_ROOT, 'package-lock.json')));
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].name, pkg.name);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.deepEqual(lock.packages[''].engines, pkg.engines);
  assert.deepEqual(lock.packages[''].dependencies ?? {}, pkg.dependencies ?? {});
  assert.deepEqual(lock.packages[''].devDependencies ?? {}, pkg.devDependencies ?? {});
});

console.log('WORKPASS366_SUPER_LAUNCH_CONTRACT=PASS');
