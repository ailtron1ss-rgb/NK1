#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, rename, rm, stat, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(scriptDir, '../..');
const DEFAULT_MANIFEST = 'contracts/inventory/canonical-public-assets-workpass42.json';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

function safePath(root, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath) || relativePath.includes('\\')) {
    throw new Error(`invalid relative asset path: ${String(relativePath)}`);
  }
  const pieces = relativePath.split('/');
  if (pieces.some((piece) => !piece || piece === '.' || piece === '..')) throw new Error(`unsafe asset path: ${relativePath}`);
  const resolved = path.resolve(root, ...pieces);
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`asset path escapes project root: ${relativePath}`);
  return resolved;
}

async function assertNoSymlinkPath(root, target, { allowMissingTail = true } = {}) {
  const rel = path.relative(root, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`path escapes checked root: ${target}`);
  let cursor = root;
  const parts = rel.split(path.sep).filter(Boolean);
  for (let i = 0; i < parts.length; i += 1) {
    cursor = path.join(cursor, parts[i]);
    try {
      const info = await lstat(cursor);
      if (info.isSymbolicLink()) throw new Error(`symlink is not allowed in canonical asset path: ${path.relative(root, cursor)}`);
      if (i < parts.length - 1 && !info.isDirectory()) throw new Error(`asset parent is not a directory: ${path.relative(root, cursor)}`);
    } catch (error) {
      if (error?.code === 'ENOENT' && allowMissingTail) return;
      throw error;
    }
  }
}

/** Hydrate only byte-identical public shadows that are described by the hash-locked manifest. */
export async function hydrateCanonicalPublicAssets(root = DEFAULT_ROOT, manifestRelative = DEFAULT_MANIFEST) {
  const projectRoot = path.resolve(root);
  const manifestPath = safePath(projectRoot, manifestRelative);
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.items) || manifest.items.length === 0) {
    throw new Error('canonical public asset manifest is malformed or empty');
  }

  const hydrated = [];
  const alreadyPresent = [];
  for (const item of manifest.items) {
    const source = safePath(projectRoot, item.canonicalPath);
    const target = safePath(projectRoot, item.targetPath);
    if (!Number.isSafeInteger(item.sizeBytes) || item.sizeBytes < 1 || !/^[a-f0-9]{64}$/.test(item.sha256 ?? '')) {
      throw new Error(`invalid hash/size contract for ${item.targetPath}`);
    }
    await assertNoSymlinkPath(projectRoot, source, { allowMissingTail: false });
    const sourceStat = await stat(source);
    if (!sourceStat.isFile() || sourceStat.size !== item.sizeBytes) throw new Error(`canonical asset size mismatch: ${item.canonicalPath}`);
    const sourceBytes = await readFile(source);
    if (digest(sourceBytes) !== item.sha256) throw new Error(`canonical asset hash mismatch: ${item.canonicalPath}`);

    await assertNoSymlinkPath(projectRoot, path.dirname(target));
    let targetExists = false;
    try {
      const targetStat = await lstat(target);
      targetExists = true;
      if (targetStat.isSymbolicLink() || !targetStat.isFile()) throw new Error(`unsafe existing public asset target: ${item.targetPath}`);
      const targetBytes = await readFile(target);
      if (targetBytes.length !== item.sizeBytes || digest(targetBytes) !== item.sha256) {
        throw new Error(`public asset shadow differs from canonical content; refusing overwrite: ${item.targetPath}`);
      }
      alreadyPresent.push(item.targetPath);
      continue;
    } catch (error) {
      if (error?.code !== 'ENOENT' || targetExists) throw error;
    }

    await mkdir(path.dirname(target), { recursive: true });
    await assertNoSymlinkPath(projectRoot, path.dirname(target), { allowMissingTail: false });
    const temp = `${target}.hydrate-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`;
    try {
      await copyFile(source, temp);
      const staged = await readFile(temp);
      if (staged.length !== item.sizeBytes || digest(staged) !== item.sha256) throw new Error(`staged asset verification failed: ${item.targetPath}`);
      // Recheck target immediately before commit; never silently overwrite user data.
      try {
        await lstat(target);
        throw new Error(`public asset target appeared during hydration: ${item.targetPath}`);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
      await rename(temp, target);
      hydrated.push(item.targetPath);
    } finally {
      await rm(temp, { force: true }).catch(() => {});
    }
  }
  return { ok: true, total: manifest.items.length, hydrated: hydrated.length, alreadyPresent: alreadyPresent.length, hydratedPaths: hydrated };
}

/** Remove only manifest-listed shadows when they still match the canonical hash. */
export async function cleanCanonicalPublicAssets(root = DEFAULT_ROOT, manifestRelative = DEFAULT_MANIFEST) {
  const projectRoot = path.resolve(root);
  const manifestPath = safePath(projectRoot, manifestRelative);
  const manifest = JSON.parse((await readFile(manifestPath)).toString('utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.items) || manifest.items.length === 0) {
    throw new Error('canonical public asset manifest is malformed or empty');
  }
  let removed = 0, absent = 0;
  const removedPaths = [];
  for (const item of manifest.items) {
    if (!Number.isSafeInteger(item.sizeBytes) || item.sizeBytes < 1 || !/^[a-f0-9]{64}$/.test(item.sha256 ?? '')) {
      throw new Error(`invalid hash/size contract for ${item.targetPath}`);
    }
    const source = safePath(projectRoot, item.canonicalPath);
    const target = safePath(projectRoot, item.targetPath);
    await assertNoSymlinkPath(projectRoot, source, { allowMissingTail: false });
    const canonicalBytes = await readFile(source);
    if (canonicalBytes.length !== item.sizeBytes || digest(canonicalBytes) !== item.sha256) {
      throw new Error(`canonical asset hash mismatch while cleaning: ${item.canonicalPath}`);
    }
    await assertNoSymlinkPath(projectRoot, path.dirname(target));
    let st;
    try { st = await lstat(target); }
    catch (error) { if (error?.code === 'ENOENT') { absent++; continue; } throw error; }
    if (st.isSymbolicLink() || !st.isFile()) throw new Error(`unsafe existing public asset target: ${item.targetPath}`);
    const bytes = await readFile(target);
    if (bytes.length !== item.sizeBytes || digest(bytes) !== item.sha256) {
      throw new Error(`public asset shadow differs from canonical content; refusing deletion: ${item.targetPath}`);
    }
    await unlink(target);
    removed++; removedPaths.push(item.targetPath);
  }
  // Remove only now-empty generated directories; preserve app-specific viewer/vendor assets.
  const candidates = [...new Set(manifest.items.map((item) => path.dirname(safePath(projectRoot, item.targetPath))))]
    .sort((a, b) => b.length - a.length);
  for (const dir of candidates) {
    try { await rmdir(dir); } catch (error) { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error?.code)) throw error; }
  }
  return { ok: true, total: manifest.items.length, removed, alreadyAbsent: absent, removedPaths };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const clean = args.includes('--clean');
    const rootArg = args.find((arg) => arg !== '--clean');
    const result = clean
      ? await cleanCanonicalPublicAssets(rootArg ? path.resolve(rootArg) : DEFAULT_ROOT)
      : await hydrateCanonicalPublicAssets(rootArg ? path.resolve(rootArg) : DEFAULT_ROOT);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`[canonical-public-assets] ${error?.stack ?? error}`);
    process.exitCode = 1;
  }
}
