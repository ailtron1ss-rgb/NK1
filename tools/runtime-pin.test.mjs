import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIN_NPM_VERSION, matchesNodePin, parseNodePin, versionAtLeast } from './runtime-pin.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('supports the repository major pin without freezing patch releases', () => {
  assert.deepEqual(parseNodePin('24\n'), { kind: 'major', major: 24 });
  assert.equal(matchesNodePin('24', 'v24.0.0'), true);
  assert.equal(matchesNodePin('24', 'v24.11.1'), true);
  assert.equal(matchesNodePin('24', 'v22.16.0'), false);
  assert.equal(matchesNodePin('24', 'v24.0.0-rc.1'), false);
});

test('supports an exact .nvmrc version when explicitly configured', () => {
  assert.deepEqual(parseNodePin('24.8.0'), { kind: 'exact', major: 24, minor: 8, patch: 0 });
  assert.equal(matchesNodePin('24.8.0', 'v24.8.0'), true);
  assert.equal(matchesNodePin('24.8.0', 'v24.8.1'), false);
});

test('rejects absent, ambiguous and malformed Node pins', () => {
  for (const value of ['', 'latest', '24.0', '0', '-1', '24.x', '1.2.3-beta']) {
    assert.equal(parseNodePin(value), null, String(value));
  }
  assert.equal(matchesNodePin('latest', 'v24.0.0'), false);
});

test('enforces the declared npm minimum without rejecting newer majors', () => {
  assert.equal(MIN_NPM_VERSION, '10.8.0');
  assert.equal(versionAtLeast('10.8.0', MIN_NPM_VERSION), true);
  assert.equal(versionAtLeast('10.8.1', MIN_NPM_VERSION), true);
  assert.equal(versionAtLeast('10.7.9', MIN_NPM_VERSION), false);
  assert.equal(versionAtLeast('v11.0.0', MIN_NPM_VERSION), true);
  assert.equal(versionAtLeast('10.8.0-rc.1', MIN_NPM_VERSION), false);
  assert.equal(versionAtLeast('latest', MIN_NPM_VERSION), false);
});

test('the checked-in pin and installer/doctor gates use the shared policy', async () => {
  const pin = await readFile(path.join(root, '.nvmrc'), 'utf8');
  assert.equal(parseNodePin(pin)?.major, 24, '.nvmrc should continue to pin Node 24');
  const installer = await readFile(path.join(root, 'tools/super-install.mjs'), 'utf8');
  const doctor = await readFile(path.join(root, 'tools/super-doctor.mjs'), 'utf8');
  assert.match(installer, /from ['"]\.\/runtime-pin\.mjs['"]/);
  assert.match(installer, /matchesNodePin/);
  assert.match(installer, /versionAtLeast/);
  assert.match(doctor, /from ['"]\.\/runtime-pin\.mjs['"]/);
  assert.match(doctor, /matchesNodePin/);
  assert.match(doctor, /versionAtLeast/);
  assert.doesNotMatch(installer, /nodeMajor\s*!==\s*22/);
  assert.doesNotMatch(doctor, /\^v22\\\./);
});
