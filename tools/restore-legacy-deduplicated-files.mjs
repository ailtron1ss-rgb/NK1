import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'docs/archive-optimization/legacy-content-dedup-manifest.json');
const restore = process.argv.includes('--restore');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const digest = async (file) => {
  const { createReadStream } = await import('node:fs');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};
const insideRoot = (rel) => {
  if (typeof rel !== 'string' || path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) throw new Error(`Unsafe manifest path: ${rel}`);
  const full = path.resolve(root, rel);
  if (!full.startsWith(root + path.sep)) throw new Error(`Path escapes project root: ${rel}`);
  return full;
};
let restored = 0, present = 0, preservedByBlob = 0, missingCanonical = 0, conflicts = 0;
for (const entry of manifest.entries) {
  const target = insideRoot(entry.path);
  const source = insideRoot(entry.canonicalPath);
  try {
    await stat(target);
    if (await digest(target) === entry.sha256) { present++; continue; }
    conflicts++;
    console.error(`CONFLICT (not overwritten): ${entry.path}`);
    continue;
  } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  let exactSource = false;
  try { exactSource = await digest(source) === entry.sha256; }
  catch (error) { if (error?.code !== 'ENOENT') throw error; }
  const blobCandidates = [
    path.join(root, 'docs/archive-optimization/source-archive-blobs', entry.sha256),
    path.join(root, 'docs/archive-optimization/historical-snapshot-blobs', entry.sha256),
  ];
  let immutableBlob = null;
  for (const candidate of blobCandidates) {
    try {
      if (await digest(candidate) === entry.sha256) { immutableBlob = candidate; break; }
    } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }
  if (!exactSource && !immutableBlob) {
    missingCanonical++;
    console.error(`NO EXACT SOURCE OR IMMUTABLE BLOB: ${entry.canonicalPath} -> ${entry.path}`);
    continue;
  }
  if (!exactSource && immutableBlob) {
    preservedByBlob++;
    if (restore) {
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(immutableBlob, target);
      restored++;
    }
    continue;
  }
  if (!restore) continue;
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
  restored++;
}
console.log(JSON.stringify({ mode: restore ? 'restore' : 'check', manifestEntries: manifest.entries.length, alreadyPresent: present, preservedByImmutableBlob: preservedByBlob, restored, missingOrChangedCanonical: missingCanonical, conflicts }, null, 2));
if (missingCanonical || conflicts) process.exitCode = 2;
