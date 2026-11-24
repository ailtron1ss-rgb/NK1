import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cleanCanonicalPublicAssets, hydrateCanonicalPublicAssets } from './sync-canonical-public-assets.mjs';

const hash = (x) => createHash('sha256').update(x).digest('hex');
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'canonical-assets-'));
  const source = 'runtime/neuro-kurisu/public/live2d/model.bin';
  const target = 'app/public/live2d/model.bin';
  const bytes = Buffer.from('canonical-live2d-model-data');
  await mkdir(path.dirname(path.join(root, source)), { recursive: true });
  await writeFile(path.join(root, source), bytes);
  const manifest = path.join(root, 'contracts/inventory/canonical-public-assets-workpass42.json');
  await mkdir(path.dirname(manifest), { recursive: true });
  await writeFile(manifest, JSON.stringify({ schemaVersion: 1, items: [{ canonicalPath: source, targetPath: target, sizeBytes: bytes.length, sha256: hash(bytes) }] }));
  return { root, source, target, bytes, manifest };
}

test('hydrates a missing shadow byte-for-byte from the canonical source', async () => {
  const f = await fixture();
  try {
    const result = await hydrateCanonicalPublicAssets(f.root);
    assert.equal(result.ok, true);
    assert.equal(result.hydrated, 1);
    assert.deepEqual(await readFile(path.join(f.root, f.target)), f.bytes);
    assert.equal((await hydrateCanonicalPublicAssets(f.root)).alreadyPresent, 1);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('does not overwrite a conflicting existing target', async () => {
  const f = await fixture();
  try {
    await mkdir(path.dirname(path.join(f.root, f.target)), { recursive: true });
    await writeFile(path.join(f.root, f.target), 'user-specific override');
    await assert.rejects(hydrateCanonicalPublicAssets(f.root), /refusing overwrite/);
    assert.equal((await readFile(path.join(f.root, f.target))).toString(), 'user-specific override');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('fails closed if canonical content drifts from its hash lock', async () => {
  const f = await fixture();
  try {
    await writeFile(path.join(f.root, f.source), 'mutated upstream file');
    await assert.rejects(hydrateCanonicalPublicAssets(f.root), /canonical asset (size|hash) mismatch/);
    await assert.rejects(readFile(path.join(f.root, f.target)), { code: 'ENOENT' });
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('rejects a symlink target directory', async () => {
  const f = await fixture();
  const outside = await mkdtemp(path.join(os.tmpdir(), 'canonical-assets-outside-'));
  try {
    await mkdir(path.join(f.root, 'app'), { recursive: true });
    await symlink(outside, path.join(f.root, 'app/public'));
    await assert.rejects(hydrateCanonicalPublicAssets(f.root), /symlink is not allowed/);
  } finally {
    await rm(f.root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});


test('cleans only exact generated shadows while preserving app-specific files', async () => {
  const f = await fixture();
  try {
    await mkdir(path.join(f.root, 'app/public/live2d/vendor'), { recursive: true });
    await writeFile(path.join(f.root, 'app/public/live2d/viewer.html'), 'app-owned viewer');
    await writeFile(path.join(f.root, 'app/public/live2d/vendor/runtime.js'), 'app-owned vendor');
    await hydrateCanonicalPublicAssets(f.root);
    const result = await cleanCanonicalPublicAssets(f.root);
    assert.equal(result.removed, 1);
    await assert.rejects(readFile(path.join(f.root, f.target)), { code: 'ENOENT' });
    assert.equal((await readFile(path.join(f.root, 'app/public/live2d/viewer.html'), 'utf8')), 'app-owned viewer');
    assert.equal((await readFile(path.join(f.root, 'app/public/live2d/vendor/runtime.js'), 'utf8')), 'app-owned vendor');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('refuses to clean a shadow that has changed since hydration', async () => {
  const f = await fixture();
  try {
    await hydrateCanonicalPublicAssets(f.root);
    await writeFile(path.join(f.root, f.target), 'local override');
    await assert.rejects(cleanCanonicalPublicAssets(f.root), /refusing deletion/);
    assert.equal((await readFile(path.join(f.root, f.target), 'utf8')), 'local override');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
