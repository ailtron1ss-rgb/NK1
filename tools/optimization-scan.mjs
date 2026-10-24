#!/usr/bin/env node
/**
 * Read-only structural optimization scan for NK1.
 * Usage: node tools/optimization-scan.mjs [root]
 * This is an inventory heuristic, not a runtime profiler.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(process.argv[2] ?? '.');
const ignored = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage', '.next',
  '.vite', '.turbo', 'vendor', 'target', '.cache',
]);
const sourceExt = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.json',
  '.sql', '.sh', '.yaml', '.yml',
]);
const maxFiles = 100000;
const maxFileBytes = 20 * 1024 * 1024;
const records = [];
const hashes = new Map();
let visited = 0;
let skippedLarge = 0;

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    records.push({ kind: 'warning', path: path.relative(root, dir), message: error.message });
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (!entry.isFile() || !sourceExt.has(path.extname(entry.name).toLowerCase())) continue;
    if (visited >= maxFiles) {
      records.push({ kind: 'warning', message: `File limit reached (${maxFiles}); scan is partial.` });
      return;
    }
    visited++;
    let info;
    try {
      info = await stat(full);
    } catch {
      continue;
    }
    if (info.size > maxFileBytes) {
      skippedLarge++;
      records.push({ kind: 'skipped-large', path: path.relative(root, full), bytes: info.size });
      continue;
    }
    let bytes;
    try {
      bytes = await readFile(full);
    } catch (error) {
      records.push({ kind: 'warning', path: path.relative(root, full), message: error.message });
      continue;
    }
    const digest = createHash('sha256').update(bytes).digest('hex');
    const item = { path: path.relative(root, full), bytes: info.size, sha256: digest };
    records.push({ kind: 'file', ...item });
    const previous = hashes.get(digest) ?? [];
    previous.push(item.path);
    hashes.set(digest, previous);
  }
}

try {
  const rootInfo = await stat(root);
  if (!rootInfo.isDirectory()) throw new Error('root must be a directory');
  await walk(root);
} catch (error) {
  console.error(`optimization-scan: ${error.message}`);
  process.exitCode = 2;
}

const files = records.filter((x) => x.kind === 'file');
const largest = [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 30);
const duplicates = [...hashes.entries()]
  .filter(([, paths]) => paths.length > 1)
  .map(([sha256, paths]) => ({ sha256, count: paths.length, paths: paths.sort() }))
  .sort((a, b) => b.count - a.count);
const result = {
  schemaVersion: 1,
  scanKind: 'read-only-structural-inventory',
  root,
  generatedAt: new Date().toISOString(),
  summary: {
    filesScanned: files.length,
    totalBytes: files.reduce((sum, item) => sum + item.bytes, 0),
    skippedLargeFiles: skippedLarge,
    exactDuplicateGroups: duplicates.length,
    note: 'File size and byte-identical duplicates are clues only; this is not runtime profiling.',
  },
  largestFiles: largest,
  exactDuplicateFiles: duplicates,
  warnings: records.filter((x) => x.kind === 'warning' || x.kind === 'skipped-large'),
};
process.stdout.write(JSON.stringify(result, null, 2) + '\\n');
