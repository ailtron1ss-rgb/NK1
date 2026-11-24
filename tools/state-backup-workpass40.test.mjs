import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile, symlink, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createBackup, restoreBackup } from './lib/state-backup.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'neurokurisu-restore-wp40-'));
  const stateDir = path.join(root, 'state');
  const backupRoot = path.join(root, 'backups');
  await mkdir(stateDir, { recursive: true });
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, stateDir, backupRoot };
}

test('restore is an exact set replacement and releases the runtime lock', async t => {
  const { stateDir, backupRoot } = await fixture(t);
  const canonicalCore = Buffer.from('{"core":"snapshot-40"}');
  await writeFile(path.join(stateDir, 'organism-core.json'), canonicalCore);
  const backup = await createBackup({ stateDir, backupRoot, label: 'clean-room' });

  // Simulate stale state from a newer run, including a backup file that could
  // otherwise become a recovery source after the canonical files are restored.
  await writeFile(path.join(stateDir, 'organism-core.json'), '{"core":"newer-state"}');
  await writeFile(path.join(stateDir, 'organism-world.json'), '{"world":"stale"}');
  await writeFile(path.join(stateDir, 'organism-world.json.bak'), '{"world":"stale-backup"}');

  const restored = await restoreBackup({ stateDir, backupRoot, backupName: backup.name, confirmed: true });
  assert.equal(restored.ok, true);
  assert.equal(restored.exactStateSet, true);
  assert.equal(restored.runtimeLockHeldDuringCommit, true);
  assert.deepEqual(await readFile(path.join(stateDir, 'organism-core.json')), canonicalCore);
  assert.deepEqual((await readdir(stateDir)).filter(name => /^organism-(?:core|world)\.json(?:\.bak)?$/.test(name)).sort(), ['organism-core.json']);
  await assert.rejects(readFile(path.join(stateDir, 'organism-runtime.lock')), { code: 'ENOENT' });
  assert.ok(restored.preRestoreBackup, 'the displaced live state must have a rollback snapshot');
});

test('restore rejects symlinked backup state before acquiring the runtime lock or touching live files', async t => {
  const { root, stateDir, backupRoot } = await fixture(t);
  const live = Buffer.from('keep-live');
  await writeFile(path.join(stateDir, 'organism-core.json'), live);
  const backup = await createBackup({ stateDir, backupRoot, label: 'symlink-check' });
  const outside = path.join(root, 'outside.bin');
  await writeFile(outside, 'outside-state');
  await unlink(path.join(backup.path, 'organism-core.json'));
  await symlink(outside, path.join(backup.path, 'organism-core.json'));

  await assert.rejects(restoreBackup({ stateDir, backupRoot, backupName: backup.name, confirmed: true }), /regular non-symlink file/);
  assert.deepEqual(await readFile(path.join(stateDir, 'organism-core.json')), live);
  await assert.rejects(readFile(path.join(stateDir, 'organism-runtime.lock')), { code: 'ENOENT' });
});

test('restore refuses traversal names and leaves the exact state bytes unchanged', async t => {
  const { stateDir, backupRoot } = await fixture(t);
  const live = Buffer.from([0, 255, 1, 0, 42]);
  await writeFile(path.join(stateDir, 'organism-core.json'), live);
  await assert.rejects(restoreBackup({ stateDir, backupRoot, backupName: '../state', confirmed: true }), /Invalid backup name/);
  assert.deepEqual(await readFile(path.join(stateDir, 'organism-core.json')), live);
});

test('restore rejects symlinked live-state entries instead of silently leaving or replacing them', async t => {
  const { root, stateDir, backupRoot } = await fixture(t);
  const target = path.join(root, 'outside-live.bin');
  await writeFile(target, 'outside-live-bytes');
  await symlink(target, path.join(stateDir, 'organism-core.json'));
  const seed = path.join(root, 'seed');
  await mkdir(seed);
  await writeFile(path.join(seed, 'organism-world.json'), '{"world":"incoming"}');
  const backup = await createBackup({ stateDir: seed, backupRoot, label: 'live-symlink' });
  await assert.rejects(restoreBackup({ stateDir, backupRoot, backupName: backup.name, confirmed: true }), /Current supported state entry.*regular non-symlink/);
  assert.equal(await readFile(target, 'utf8'), 'outside-live-bytes');
  await assert.rejects(readFile(path.join(stateDir, 'organism-runtime.lock')), { code: 'ENOENT' });
});

test('restore rejects a symlinked backup directory before changing live state', async t => {
  const { root, stateDir, backupRoot } = await fixture(t);
  await mkdir(backupRoot);
  await writeFile(path.join(stateDir, 'organism-core.json'), 'live');
  const actual = path.join(root, 'actual-backup');
  await mkdir(actual);
  await writeFile(path.join(actual, 'manifest.json'), JSON.stringify({ schema: 1, files: [{ name: 'organism-core.json', size: 4, sha256: '0'.repeat(64) }] }));
  await writeFile(path.join(actual, 'organism-core.json'), 'snap');
  await symlink(actual, path.join(backupRoot, 'linked-backup'));
  await assert.rejects(restoreBackup({ stateDir, backupRoot, backupName: 'linked-backup', confirmed: true }), /Backup folder must be a real directory/);
  assert.equal(await readFile(path.join(stateDir, 'organism-core.json'), 'utf8'), 'live');
});
