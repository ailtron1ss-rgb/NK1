import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { restoreDuplicatePaths } from './restore-historical-duplicate-paths.mjs';

const hash = (b) => createHash('sha256').update(b).digest('hex');
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nk-duplicate-restore-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const canonical = Buffer.from('source bytes exact\n');
  await mkdir(path.join(root, 'docs/archive-optimization'), { recursive: true });
  await mkdir(path.join(root, 'canonical'), { recursive: true });
  await writeFile(path.join(root, 'canonical/source.txt'), canonical);
  await writeFile(path.join(root, 'docs/archive-optimization/manifest.json'), JSON.stringify({ schemaVersion: 1, entries: [{ path:'restored/deep/file.txt', canonicalPath:'canonical/source.txt', sha256:hash(canonical), sizeBytes:canonical.length }] }));
  return { root, canonical };
}

test('restores byte-identical duplicate path and is idempotent', async (t) => {
  const { root, canonical } = await fixture(t);
  const first = await restoreDuplicatePaths({ root, manifestRelative:'docs/archive-optimization/manifest.json', restore:true });
  assert.equal(first.ok, true); assert.equal(first.restored, 1);
  assert.deepEqual(await readFile(path.join(root, 'restored/deep/file.txt')), canonical);
  const second = await restoreDuplicatePaths({ root, manifestRelative:'docs/archive-optimization/manifest.json', restore:true });
  assert.equal(second.ok, true); assert.equal(second.alreadyExact, 1); assert.equal(second.restored, 0);
});

test('never overwrites conflicting target', async (t) => {
  const { root } = await fixture(t);
  const target = path.join(root, 'restored/deep/file.txt');
  await mkdir(path.dirname(target), { recursive:true }); await writeFile(target, 'keep me');
  const result = await restoreDuplicatePaths({ root, manifestRelative:'docs/archive-optimization/manifest.json', restore:true });
  assert.equal(result.ok, false); assert.equal(result.conflicts, 1); assert.equal(await readFile(target,'utf8'),'keep me');
});

test('refuses changed canonical source', async (t) => {
  const { root } = await fixture(t); await writeFile(path.join(root, 'canonical/source.txt'), 'changed');
  const result = await restoreDuplicatePaths({ root, manifestRelative:'docs/archive-optimization/manifest.json', restore:true });
  assert.equal(result.ok, false); assert.equal(result.missingOrChangedCanonical, 1);
});

test('refuses symlink target parent', async (t) => {
  const { root } = await fixture(t);
  const outside = await mkdtemp(path.join(os.tmpdir(), 'nk-outside-'));
  t.after(() => rm(outside, { recursive:true, force:true }));
  await symlink(outside, path.join(root,'restored'));
  await assert.rejects(() => restoreDuplicatePaths({ root, manifestRelative:'docs/archive-optimization/manifest.json', restore:true }), /Symlink parent refused/);
});
