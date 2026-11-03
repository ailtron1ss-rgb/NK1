import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateManifest } from './neurok-os.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'engineering-os/manifest.v1.json'), 'utf8'));

test('catalog validates with unique integration ids', () => {
  const result = validateManifest(manifest);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.ok(result.integrationCount >= 40);
});

test('catalog is fail-closed and does not claim external connections', () => {
  assert.ok(manifest.integrations.every(item =>
    item.enabled === false &&
    item.runtimeIntegrated === false &&
    item.connectionStatus === 'unverified' &&
    item.credentialRefs.length === 0
  ));
});

test('rejects duplicate ids', () => {
  const candidate = structuredClone(manifest);
  candidate.integrations.push(structuredClone(candidate.integrations[0]));
  const result = validateManifest(candidate);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.includes('duplicate integration id')));
});

test('rejects weakening safety policy', () => {
  const candidate = structuredClone(manifest);
  candidate.policy.noSelfApproval = false;
  const result = validateManifest(candidate);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.includes('noSelfApproval')));
});

test('rejects premature provider enablement', () => {
  const candidate = structuredClone(manifest);
  candidate.integrations[0].enabled = true;
  const result = validateManifest(candidate);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.includes('fail-closed')));
});
