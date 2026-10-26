import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseNodeMajor, resolveNodeRuntimeContract } from './node-runtime-contract.mjs';

async function withNvmrc(contents, run) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-node-runtime-'));
  try {
    if (contents !== undefined) await writeFile(path.join(root, '.nvmrc'), contents, 'utf8');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('.nvmrc major pin accepts compatible Node 24 patch releases', async () => {
  await withNvmrc('24\n', root => {
    assert.deepEqual(resolveNodeRuntimeContract(root, 'v24.21.0'), {
      pinPath: path.join(root, '.nvmrc'),
      expectedMajor: 24,
      actualMajor: 24,
      compatible: true,
    });
    assert.equal(resolveNodeRuntimeContract(root, '24.0.0').compatible, true);
  });
});

test('installer rejects a runtime whose major differs from .nvmrc', async () => {
  await withNvmrc('24\n', root => {
    const contract = resolveNodeRuntimeContract(root, 'v22.12.0');
    assert.equal(contract.expectedMajor, 24);
    assert.equal(contract.actualMajor, 22);
    assert.equal(contract.compatible, false);
  });
});

test('parser accepts v-prefixed major/full versions and rejects labels or malformed versions', () => {
  assert.equal(parseNodeMajor('24'), 24);
  assert.equal(parseNodeMajor('v24.3.1'), 24);
  assert.equal(parseNodeMajor('24.3'), 24);
  assert.throws(() => parseNodeMajor('latest'), /numeric major or semver/);
  assert.throws(() => parseNodeMajor('24.x'), /numeric major or semver/);
  assert.throws(() => parseNodeMajor('0.0.0'), /positive safe integer/);
});

test('malformed or missing .nvmrc fails closed with a clear error', async () => {
  await withNvmrc('', root => {
    assert.throws(() => resolveNodeRuntimeContract(root, 'v24.21.0'), /.nvmrc must not be empty/);
  });
  await withNvmrc(undefined, root => {
    assert.throws(() => resolveNodeRuntimeContract(root, 'v24.21.0'), /ENOENT/);
  });
});

console.log('Super installer Node runtime contract: PASS');
