#!/usr/bin/env node
import { readdir, readFile, stat, access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { runCommand } from './process-supervisor.mjs';

const root = process.cwd();
const errors = [];
const warnings = [];
const IGNORED_DIRS = new Set(['node_modules', '.git', 'state', '.super-state']);

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(filePath));
    else if (entry.isFile()) out.push(filePath);
  }
  return out;
}

const files = await walk(root);
const secretPaths = [
  '.env.local',
  'legacy/input-archives/hexis-main-2026-10-08/.env.local',
  'legacy/input-archives/hexis-main-2026-10-08/core/auth/gmail-credentials.json',
];
for (const rel of secretPaths) {
  if (await exists(path.join(root, rel))) errors.push(`secret-file-present:${rel}`);
}

// File metadata is independent. Use bounded batches instead of a serial stat()
// per file or an unbounded Promise.all over the whole (potentially large) tree.
const metadataConcurrency = 64;
for (let offset = 0; offset < files.length; offset += metadataConcurrency) {
  const batch = files.slice(offset, offset + metadataConcurrency);
  const metadata = await Promise.all(batch.map(async (filePath) => {
    const rel = path.relative(root, filePath);
    if (/(^|[\\/])__pycache__([\\/]|$)/.test(rel) || rel.endsWith('.pyc')) {
      return { rel, generatedPythonArtifact: true, empty: false };
    }
    if (rel.startsWith(`backups${path.sep}`)) return { rel, generatedPythonArtifact: false, empty: false };
    try {
      const fileStat = await stat(filePath);
      return { rel, generatedPythonArtifact: false, empty: fileStat.size === 0 };
    } catch (error) {
      return { rel, metadataError: error instanceof Error ? error.message : String(error) };
    }
  }));

  for (const item of metadata) {
    if (item.generatedPythonArtifact) errors.push(`generated-python-artifact:${item.rel}`);
    if (item.empty) warnings.push(`empty:${item.rel}`);
    if (item.metadataError) warnings.push(`stat-failed:${item.rel}:${item.metadataError}`);
  }
}

const runtimeCwd = path.join(root, 'runtime/neuro-kurisu');
const audits = [
  {
    name: 'ui-wiring',
    args: ['scripts/audit-ui-function-wiring.mjs'],
  },
  {
    name: 'architecture',
    args: ['scripts/audit-architecture.mjs'],
  },
];

// These read-only audits share no mutable output. Run in parallel, with
// independent deadlines and bounded diagnostic tails, to reduce release-check
// wall-clock time without launching an unbounded number of subprocesses.
const auditResults = await Promise.all(audits.map(async (audit) => ({
  ...audit,
  result: await runCommand(process.execPath, audit.args, {
    cwd: runtimeCwd,
    timeoutMs: 120_000,
    terminationGraceMs: 500,
    forceGraceMs: 500,
    maxOutputBytes: 24 * 1024,
  }),
})));

for (const audit of auditResults) {
  const { result } = audit;
  if (!result.error && !result.timedOut && result.code === 0) continue;

  const reason = result.timedOut
    ? `timeout after ${result.durationMs}ms`
    : result.error
      ? `spawn error: ${result.error}`
      : `exit=${result.code ?? 'unknown'} signal=${result.signal ?? 'none'}`;
  const tail = (result.err || result.out).trim();
  const truncation = result.outTruncated || result.errTruncated ? ' [output tail truncated]' : '';
  errors.push(`${audit.name}:${reason}${tail ? ` — ${tail}` : ''}${truncation}`);
}

console.log(JSON.stringify({
  ok: errors.length === 0,
  files: files.length,
  metadataConcurrency,
  audits: auditResults.map(({ name, result }) => ({
    name,
    ok: !result.error && !result.timedOut && result.code === 0,
    durationMs: result.durationMs,
    timedOut: result.timedOut,
    exitCode: result.code,
  })),
  errors,
  warnings,
  checkedAt: new Date().toISOString(),
}, null, 2));
if (errors.length) process.exit(1);
