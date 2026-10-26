import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveRuntimeServerEntry } from './super-runtime-paths.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeEntry = resolveRuntimeServerEntry(root);

test('root launchers resolve the runtime server from its owning workspace', () => {
  assert.equal(runtimeEntry, path.resolve(root, 'runtime/neuro-kurisu/src/server/server.mjs'));
  assert.equal(existsSync(runtimeEntry), true, `runtime server entry must exist at ${runtimeEntry}`);

  for (const launcher of ['super-start.mjs', 'super-dev.mjs']) {
    const source = readFileSync(new URL(`./${launcher}`, import.meta.url), 'utf8');
    assert.match(source, /resolveRuntimeServerEntry\(ROOT\)/, `${launcher} must use the shared runtime path resolver`);
    assert.match(source, /\['--experimental-strip-types', runtimeServerEntry\]/,
      `${launcher} must execute the resolved absolute entrypoint`);
    assert.doesNotMatch(source, /['"]src\/server\/server\.mjs['"]/,
      `${launcher} must not resolve the runtime entrypoint relative to repository root`);
  }
});

test('root start/dev scripts are wired to the tested launchers', () => {
  const pkg = JSON.parse(readFileSync(path.resolve(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.start, 'node tools/super-start.mjs');
  assert.equal(pkg.scripts.dev, 'node tools/super-dev.mjs');
});
