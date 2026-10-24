#!/usr/bin/env node
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { meetsMinimumVersion } from './runtime-requirements.mjs';
import { runCommand } from './process-supervisor.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = [];
const ok = (name, pass, detail = '') => out.push({ name, pass, detail });

const versionCommands = [
  { name: 'node', command: process.execPath, args: ['--version'] },
  { name: 'npm', command: 'npm', args: ['--version'] },
  { name: 'python3', command: 'python3', args: ['--version'] },
];

// These independent, cheap probes run concurrently and are individually
// bounded so a broken package-manager shim cannot stall the entire doctor.
const versionResults = await Promise.all(versionCommands.map(async (item) => ({
  ...item,
  result: await runCommand(item.command, item.args, {
    cwd: root,
    timeoutMs: 5_000,
    terminationGraceMs: 250,
    forceGraceMs: 250,
    maxOutputBytes: 2_048,
  }),
})));

function versionOf({ result }) {
  if (result.error || result.timedOut || result.code !== 0) return null;
  return result.out.trim() || result.err.trim() || null;
}

const versions = Object.fromEntries(versionResults.map((item) => [item.name, versionOf(item)]));
const requiredNodeVersion = '22.12.0';
const requiredNpmVersion = '10.8.0';

ok('node', meetsMinimumVersion(versions.node, requiredNodeVersion),
  `${versions.node ?? 'missing'} (required >=${requiredNodeVersion})`);
ok('npm', meetsMinimumVersion(versions.npm, requiredNpmVersion),
  `${versions.npm ?? 'missing'} (required >=${requiredNpmVersion})`);

for (const item of versionResults) {
  if (!item.result.error && !item.result.timedOut && item.result.code === 0) continue;
  const reason = item.result.timedOut
    ? `timed out after ${item.result.durationMs}ms`
    : item.result.error
      ? `spawn error: ${item.result.error}`
      : `exit=${item.result.code ?? 'unknown'} signal=${item.result.signal ?? 'none'}`;
  ok(`${item.name}-probe`, false, reason);
}

ok('runtime-package', existsSync(path.join(root, 'runtime/neuro-kurisu/package.json')));
ok('app-lock', existsSync(path.join(root, 'app/package-lock.json')));
ok('no-shipped-node_modules',
  !existsSync(path.join(root, 'app/node_modules')) && !existsSync(path.join(root, 'runtime/neuro-kurisu/node_modules')));
ok('no-shipped-state',
  !existsSync(path.join(root, 'runtime/neuro-kurisu/state')) && !existsSync(path.join(root, '.super-state')));

const secretFiles = ['.env.local', 'core/auth/gmail-credentials.json'];
for (const rel of secretFiles) {
  ok(`no-provenance-secret:${rel}`,
    !existsSync(path.join(root, 'legacy/input-archives/hexis-main-2026-10-08', rel)));
}

const result = { ok: out.every((item) => item.pass), checks: out, checkedAt: new Date().toISOString() };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
