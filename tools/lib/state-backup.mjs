import { mkdir, open, readFile, readdir, rename, rm, stat, unlink, lstat, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';

export const STATE_FILE_PATTERN = /^organism-(?:core|world)\.json(?:\.bak)?$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

export function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

export async function listStateFiles(stateDir) {
  const entries = await readdir(stateDir, { withFileTypes: true });
  const candidates = entries.filter(entry => STATE_FILE_PATTERN.test(entry.name));
  const unsafe = candidates.find(entry => !entry.isFile() || entry.isSymbolicLink());
  if (unsafe) throw new Error(`Supported state entry ${unsafe.name} must be a regular non-symlink file.`);
  const names = candidates.map(entry => entry.name).sort();
  if (!names.length) {
    throw new Error(`No supported organism state files found in ${stateDir}; check STATE_DIR and stop the runtime before restoring.`);
  }
  return names;
}

export async function createBackup({ stateDir, backupRoot, label = 'snapshot' }) {
  stateDir = path.resolve(stateDir);
  backupRoot = path.resolve(backupRoot);
  const names = await listStateFiles(stateDir);
  await mkdir(backupRoot, { recursive: true });
  const folderName = `${label}_${timestampSlug()}_${randomBytes(3).toString('hex')}`;
  const destination = path.join(backupRoot, folderName);
  await mkdir(destination, { recursive: false });
  const files = [];
  try {
    for (const name of names) {
      const sourcePath = path.join(stateDir, name);
      const targetPath = path.join(destination, name);
      const bytes = await readFile(sourcePath);
      await writeFile(targetPath, bytes, { flag: 'wx' });
      files.push({ name, size: bytes.byteLength, sha256: sha256(bytes) });
    }
    const manifest = {
      schema: 1,
      createdAt: new Date().toISOString(),
      sourceStateDir: stateDir,
      files,
      note: 'Raw organism state bytes are preserved; JSON/V8 decoding is intentionally not required.'
    };
    const manifestTemp = path.join(destination, `.manifest-${randomBytes(4).toString('hex')}.tmp`);
    await writeFile(manifestTemp, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    await rename(manifestTemp, path.join(destination, 'manifest.json'));
    return { ok: true, name: folderName, path: destination, files };
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
}

async function verifyBackup({ backupRoot, backupName }) {
  if (typeof backupName !== 'string' || !backupName || backupName === '.' || backupName === '..' || path.basename(backupName) !== backupName || /[\\/]/.test(backupName)) {
    throw new Error('Invalid backup name; pass only the exact folder name inside backups/.');
  }
  const root = path.resolve(backupRoot);
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Backup root must be a real directory, not a symlink.');
  const folder = path.resolve(root, backupName);
  if (path.dirname(folder) !== root) throw new Error('Backup path escapes the backup root.');
  const folderStat = await lstat(folder);
  if (!folderStat.isDirectory() || folderStat.isSymbolicLink()) throw new Error('Backup folder must be a real directory, not a symlink.');
  const manifestPath = path.join(folder, 'manifest.json');
  const manifestStat = await lstat(manifestPath);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 64 * 1024) throw new Error('Backup manifest must be a small regular file.');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest?.schema !== 1 || !Array.isArray(manifest.files) || manifest.files.length < 1 || manifest.files.length > 4) {
    throw new Error('Unsupported or malformed backup manifest.');
  }
  const seen = new Set();
  const verified = [];
  for (const item of manifest.files) {
    if (!item || typeof item.name !== 'string' || !STATE_FILE_PATTERN.test(item.name) || seen.has(item.name) || !SHA256_PATTERN.test(item.sha256)) {
      throw new Error('Backup manifest contains an invalid or duplicate state filename/hash.');
    }
    seen.add(item.name);
    const itemPath = path.join(folder, item.name);
    const itemStat = await lstat(itemPath);
    if (!itemStat.isFile() || itemStat.isSymbolicLink()) throw new Error(`Backup entry ${item.name} must be a regular non-symlink file.`);
    const bytes = await readFile(itemPath);
    if (!Number.isSafeInteger(item.size) || item.size < 0 || bytes.byteLength !== item.size || sha256(bytes) !== item.sha256) {
      throw new Error(`Backup integrity failure for ${item.name}; no restore has been performed.`);
    }
    verified.push({ name: item.name, bytes });
  }
  return { folder, manifest, verified };
}

export async function restoreBackup({ stateDir, backupRoot, backupName, confirmed = false }) {
  if (!confirmed) throw new Error('Restore is destructive. Re-run with --confirm-overwrite after stopping Neuro-Kurisu.');
  stateDir = path.resolve(stateDir);
  backupRoot = path.resolve(backupRoot);
  const { folder, manifest, verified } = await verifyBackup({ backupRoot, backupName });
  await mkdir(stateDir, { recursive: true });

  // Acquire the same lock path used by ProcessLock. Opening with `wx` makes the
  // check-and-reserve atomic: the runtime cannot start between the check and commit.
  const lockPath = path.join(stateDir, 'organism-runtime.lock');
  let lockHandle;
  try {
    lockHandle = await open(lockPath, 'wx');
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`Runtime lock exists at ${lockPath}; stop Neuro-Kurisu and retry. The lock is not removed automatically.`);
    throw error;
  }
  let lockOwned = true;
  let stage;
  const movedOld = new Set();
  const installed = new Set();
  try {
    await lockHandle.writeFile(JSON.stringify({ pid: process.pid, startedAt: Date.now(), host: 'backup-restore-maintenance', mode: 'restore' }, null, 2), 'utf8');
    await lockHandle.sync();
    await lockHandle.close();
    lockHandle = undefined;

    const stateEntries = await readdir(stateDir, { withFileTypes: true });
    const currentCandidates = stateEntries.filter(entry => STATE_FILE_PATTERN.test(entry.name));
    const unsafeCurrent = currentCandidates.find(entry => !entry.isFile() || entry.isSymbolicLink());
    if (unsafeCurrent) throw new Error(`Current supported state entry ${unsafeCurrent.name} must be a regular non-symlink file before restore.`);
    const currentNames = currentCandidates.map(entry => entry.name).sort();
    const preRestore = currentNames.length ? await createBackup({ stateDir, backupRoot, label: 'pre-restore' }) : null;

    stage = path.join(stateDir, `.restore-stage-${process.pid}-${randomBytes(4).toString('hex')}`);
    const stagedNew = path.join(stage, 'new');
    const stagedOld = path.join(stage, 'old');
    await mkdir(stage, { recursive: false });
    await mkdir(stagedNew, { recursive: false });
    await mkdir(stagedOld, { recursive: false });

    // Stage and verify the entire incoming set before moving any live state bytes.
    for (const item of verified) {
      const stagedPath = path.join(stagedNew, item.name);
      const handle = await open(stagedPath, 'wx');
      try { await handle.writeFile(item.bytes); await handle.sync(); } finally { await handle.close(); }
    }
    for (const item of verified) {
      const stagedBytes = await readFile(path.join(stagedNew, item.name));
      if (sha256(stagedBytes) !== sha256(item.bytes)) throw new Error(`Staged restore verification failed for ${item.name}.`);
    }

    try {
      // Move all current supported state files aside. This also removes stale .bak
      // files from the restored view: a restore reproduces the backup's exact file set.
      for (const name of currentNames) {
        await rename(path.join(stateDir, name), path.join(stagedOld, name));
        movedOld.add(name);
      }
      for (const item of verified) {
        await rename(path.join(stagedNew, item.name), path.join(stateDir, item.name));
        installed.add(item.name);
      }
    } catch (commitError) {
      const rollbackErrors = [];
      for (const name of installed) {
        try { await rm(path.join(stateDir, name), { force: true }); } catch (error) { rollbackErrors.push(error); }
      }
      for (const name of movedOld) {
        try { await rename(path.join(stagedOld, name), path.join(stateDir, name)); } catch (error) { rollbackErrors.push(error); }
      }
      if (rollbackErrors.length) {
        throw new AggregateError([commitError, ...rollbackErrors], 'Restore commit failed and rollback was incomplete; preserve the pre-restore backup and inspect state directory.');
      }
      throw new Error(`Restore commit failed; previous state was rolled back: ${String(commitError?.message ?? commitError)}`);
    }

    return {
      ok: true,
      restored: backupName,
      source: folder,
      stateDir,
      files: verified.map(({ name, bytes }) => ({ name, size: bytes.byteLength, sha256: sha256(bytes) })),
      preRestoreBackup: preRestore?.name ?? null,
      createdAt: manifest.createdAt,
      exactStateSet: true,
      runtimeLockHeldDuringCommit: true,
    };
  } finally {
    if (lockHandle) await lockHandle.close().catch(() => {});
    if (stage) await rm(stage, { recursive: true, force: true }).catch(() => {});
    if (lockOwned) await unlink(lockPath).catch(error => { if (error?.code !== 'ENOENT') throw error; });
  }
}
