import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatSupervisorToolchainFailure, inspectSupervisorToolchain } from './supervisor-preflight.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'nk1-supervisor-preflight-'));
  writeFileSync(join(root, '.nvmrc'), '24\n');
  for (const relative of ['app', 'runtime/neuro-kurisu']) mkdirSync(join(root, relative), { recursive: true });
  const manifest = { private: true, engines: { node: '>=24.0.0', npm: '>=10.8.0' } };
  writeFileSync(join(root, 'package.json'), JSON.stringify(manifest));
  writeFileSync(join(root, 'app/package.json'), JSON.stringify(manifest));
  writeFileSync(join(root, 'runtime/neuro-kurisu/package.json'), JSON.stringify(manifest));
  return root;
}

test('matching Node pin and package engine requirements pass the shared supervisor guard', () => {
  const root = fixture();
  try {
    const result = inspectSupervisorToolchain(root, { nodeVersion: 'v24.2.1', npmVersion: '10.9.0' });
    assert.equal(result.ready, true);
    assert.equal(result.nodeReady, true);
    assert.equal(result.npmReady, true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('Node pin mismatch and outdated npm fail closed with distinct diagnostics', () => {
  const root = fixture();
  try {
    const nodeMismatch = inspectSupervisorToolchain(root, { nodeVersion: 'v22.16.0', npmVersion: '10.9.0' });
    assert.equal(nodeMismatch.ready, false);
    assert.equal(nodeMismatch.nodeReady, false);
    assert.equal(nodeMismatch.npmReady, true);
    assert.match(formatSupervisorToolchainFailure(nodeMismatch, 'SUPER_DEV'), /^SUPER_DEV=FAIL reason=toolchain-contract/);

    const npmMismatch = inspectSupervisorToolchain(root, { nodeVersion: 'v24.2.1', npmVersion: '10.7.0' });
    assert.equal(npmMismatch.ready, false);
    assert.equal(npmMismatch.nodeReady, true);
    assert.equal(npmMismatch.npmReady, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('missing manifests or version pin are rejected instead of silently bypassing startup checks', () => {
  const root = fixture();
  try {
    rmSync(join(root, 'runtime/neuro-kurisu/package.json'));
    const missingManifest = inspectSupervisorToolchain(root, { nodeVersion: 'v24.2.1', npmVersion: '10.9.0' });
    assert.equal(missingManifest.ready, false);
    writeFileSync(join(root, 'runtime/neuro-kurisu/package.json'), JSON.stringify({
      engines: { node: '>=24.0.0', npm: '>=10.8.0' },
    }));
    rmSync(join(root, '.nvmrc'));
    const missingPin = inspectSupervisorToolchain(root, { nodeVersion: 'v24.2.1', npmVersion: '10.9.0' });
    assert.equal(missingPin.ready, false);
    assert.equal(missingPin.nodeReady, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
