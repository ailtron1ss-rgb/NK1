import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createBackup, restoreBackup } from './lib/state-backup.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'neurokurisu-backup-test-'));
  const stateDir = path.join(root, 'state');
  const backupRoot = path.join(root, 'backups');
  await mkdir(stateDir, { recursive: true });
  await writeFile(path.join(stateDir, 'organism-core.json'), Buffer.from([0, 1, 2, 255]));
  await writeFile(path.join(stateDir, 'organism-world.json'), '{"world":1}');
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, stateDir, backupRoot };
}

test('backup preserves JSON or binary state bytes and restore verifies checksums', async t => {
  const { stateDir, backupRoot } = await fixture(t);
  const originalCore = await readFile(path.join(stateDir, 'organism-core.json'));
  const originalWorld = await readFile(path.join(stateDir, 'organism-world.json'));
  const backup = await createBackup({ stateDir, backupRoot });
  assert.equal(backup.ok, true);
  assert.equal(backup.files.length, 2);
  await writeFile(path.join(stateDir, 'organism-core.json'), 'changed');
  await writeFile(path.join(stateDir, 'organism-world.json'), '{"world":9}');
  const restored = await restoreBackup({ stateDir, backupRoot, backupName: backup.name, confirmed: true });
  assert.equal(restored.ok, true);
  assert.equal(restored.files.length, 2);
  assert.deepEqual(await readFile(path.join(stateDir, 'organism-core.json')), originalCore);
  assert.deepEqual(await readFile(path.join(stateDir, 'organism-world.json')), originalWorld);
  assert.ok(restored.preRestoreBackup, 'pre-restore rollback snapshot must be created');
});

test('restore rejects corrupted backup bytes before touching current state', async t => {
  const { stateDir, backupRoot } = await fixture(t);
  const backup = await createBackup({ stateDir, backupRoot });
  await writeFile(path.join(backup.path, 'organism-core.json'), 'tampered');
  await writeFile(path.join(stateDir, 'organism-core.json'), 'keep-current');
  await assert.rejects(restoreBackup({ stateDir, backupRoot, backupName: backup.name, confirmed: true }), /integrity failure/);
  assert.equal(await readFile(path.join(stateDir, 'organism-core.json'), 'utf8'), 'keep-current');
});

test('restore requires explicit confirmation and refuses a live runtime lock', async t => {
  const { stateDir, backupRoot } = await fixture(t);
  const backup = await createBackup({ stateDir, backupRoot });
  await assert.rejects(restoreBackup({ stateDir, backupRoot, backupName: backup.name }), /destructive/);
  await writeFile(path.join(stateDir, 'organism-runtime.lock'), 'active');
  await assert.rejects(restoreBackup({ stateDir, backupRoot, backupName: backup.name, confirmed: true }), /Runtime lock exists/);
});

test('backup refuses an empty or wrong state directory instead of making an empty success', async t => {
  const { root, backupRoot } = await fixture(t);
  const empty = path.join(root, 'empty');
  await mkdir(empty);
  await assert.rejects(createBackup({ stateDir: empty, backupRoot }), /No supported organism state files/);
});
