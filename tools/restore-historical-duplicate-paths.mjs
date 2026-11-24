import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function safeRelative(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) {
    throw new Error(`Unsafe manifest path: ${relative}`);
  }
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error(`Path escapes project root: ${relative}`);
  return resolved;
}

async function rejectSymlinkParents(root, target) {
  const rel = path.relative(root, target);
  let cursor = root;
  for (const part of rel.split(path.sep).slice(0, -1)) {
    cursor = path.join(cursor, part);
    try {
      const st = await lstat(cursor);
      if (st.isSymbolicLink()) throw new Error(`Symlink parent refused: ${path.relative(root, cursor)}`);
      if (!st.isDirectory()) throw new Error(`Non-directory parent refused: ${path.relative(root, cursor)}`);
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
  }
}

async function inspectFile(file) {
  try {
    const st = await lstat(file);
    if (st.isSymbolicLink() || !st.isFile()) throw new Error(`Expected a regular non-symlink file: ${file}`);
    const bytes = await readFile(file);
    return { exists: true, bytes, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false };
    throw error;
  }
}

export async function restoreDuplicatePaths({
  root = defaultRoot,
  manifestRelative = 'docs/archive-optimization/historical-duplicate-paths-workpass42.json',
  restore = false,
} = {}) {
  root = path.resolve(root);
  const manifestPath = safeRelative(root, manifestRelative);
  const manifestInfo = await inspectFile(manifestPath);
  if (!manifestInfo.exists) throw new Error(`Manifest missing: ${manifestRelative}`);
  const manifest = JSON.parse(manifestInfo.bytes.toString('utf8'));
  if (!Array.isArray(manifest.entries)) throw new Error('Manifest entries must be an array');
  const results = [];
  let restored = 0, present = 0, missing = 0, conflicts = 0;

  for (const entry of manifest.entries) {
    if (!entry || typeof entry.path !== 'string' || typeof entry.canonicalPath !== 'string' ||
        !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes < 0) {
      throw new Error('Malformed duplicate path manifest entry');
    }
    const target = safeRelative(root, entry.path);
    const canonical = safeRelative(root, entry.canonicalPath);
    await rejectSymlinkParents(root, target);
    await rejectSymlinkParents(root, canonical);
    const canonicalInfo = await inspectFile(canonical);
    if (!canonicalInfo.exists || canonicalInfo.sizeBytes !== entry.sizeBytes || canonicalInfo.sha256 !== entry.sha256) {
      missing++;
      results.push({ path: entry.path, result: 'missing-or-changed-canonical' });
      continue;
    }
    const targetInfo = await inspectFile(target);
    if (targetInfo.exists) {
      if (targetInfo.sizeBytes === entry.sizeBytes && targetInfo.sha256 === entry.sha256) {
        present++;
        results.push({ path: entry.path, result: 'already-exact' });
      } else {
        conflicts++;
        results.push({ path: entry.path, result: 'conflict-not-overwritten' });
      }
      continue;
    }
    if (!restore) {
      results.push({ path: entry.path, result: 'restorable' });
      continue;
    }
    await mkdir(path.dirname(target), { recursive: true });
    await rejectSymlinkParents(root, target);
    const temp = `${target}.restore-${process.pid}-${Math.random().toString(16).slice(2)}`;
    try {
      await writeFile(temp, canonicalInfo.bytes, { flag: 'wx', mode: 0o600 });
      const staged = await inspectFile(temp);
      if (!staged.exists || staged.sizeBytes !== entry.sizeBytes || staged.sha256 !== entry.sha256) {
        throw new Error(`Staged restore failed verification: ${entry.path}`);
      }
      // Do not replace an existing target. rename only succeeds to a missing target in this workflow.
      try { await lstat(target); throw new Error(`Target appeared during restore; refusing overwrite: ${entry.path}`); }
      catch (error) { if (error?.code !== 'ENOENT') throw error; }
      await rename(temp, target);
      restored++;
      results.push({ path: entry.path, result: 'restored' });
    } finally {
      await rm(temp, { force: true });
    }
  }
  return { ok: missing === 0 && conflicts === 0, mode: restore ? 'restore' : 'check', manifestEntries: manifest.entries.length,
    restored, alreadyExact: present, missingOrChangedCanonical: missing, conflicts, results };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = { root: defaultRoot, restore: args.includes('--restore'), manifestRelative: 'docs/archive-optimization/historical-duplicate-paths-workpass42.json' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--restore') continue;
    if (args[i] === '--manifest') { if (!args[i + 1]) throw new Error('--manifest requires a relative path'); options.manifestRelative = args[++i]; continue; }
    if (args[i].startsWith('--manifest=')) { options.manifestRelative = args[i].slice('--manifest='.length); continue; }
    if (args[i] === '--root') { if (!args[i + 1]) throw new Error('--root requires a path'); options.root = path.resolve(args[++i]); continue; }
    if (args[i].startsWith('--root=')) { options.root = path.resolve(args[i].slice('--root='.length)); continue; }
    throw new Error(`Unknown argument: ${args[i]}`);
  }
  const result = await restoreDuplicatePaths(options);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 2;
}
