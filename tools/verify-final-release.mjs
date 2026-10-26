#!/usr/bin/env node
import { readdir, stat, access } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
let root = process.cwd();
let allowGeneratedPythonCache = false;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--root') {
    if (!args[i + 1]) {
      console.error('--root requires a directory');
      process.exit(2);
    }
    root = path.resolve(args[++i]);
  } else if (args[i].startsWith('--root=')) {
    root = path.resolve(args[i].slice('--root='.length));
  } else if (args[i] === '--allow-generated-python-cache') {
    allowGeneratedPythonCache = true;
  } else {
    console.error(`Unknown argument: ${args[i]}`);
    process.exit(2);
  }
}

const errors = [];
const warnings = [];
const checks = [];
async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'state', '.super-state'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(file));
    else out.push(file);
  }
  return out;
}
function runCheck(id, commandArgs, cwd = root) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const pass = result.status === 0 && !result.error;
  const detail = pass
    ? (result.stdout || 'exit=0').trim().slice(-1200)
    : String(result.error?.message || result.stderr || result.stdout || `exit=${result.status}`).trim().slice(-2400);
  checks.push({ id, pass, detail });
  if (!pass) errors.push(`${id}:${detail}`);
  return pass;
}

let files = [];
try {
  await access(root);
  files = await walk(root);
} catch (error) {
  console.error(`release-root-unreadable:${String(error?.message ?? error)}`);
  process.exit(2);
}
for (const file of files) {
  const relative = path.relative(root, file);
  const insidePythonCache = /(^|[\\\\/])__pycache__([\\\\/]|$)/.test(relative);
  const isPythonBytecode = relative.endsWith('.pyc');
  if (insidePythonCache || isPythonBytecode) {
    // The CI override accepts only actual bytecode beneath __pycache__. It
    // must not hide source/data files placed there or a stray .pyc elsewhere.
    if (allowGeneratedPythonCache && insidePythonCache && isPythonBytecode) {
      warnings.push(`generated-python-cache-ignored:${relative}`);
    } else {
      errors.push(`generated-python-artifact:${relative}`);
    }
  }
  if (relative.startsWith('backups' + path.sep)) continue;
  try {
    const metadata = await stat(file);
    if (metadata.size === 0) warnings.push(`empty:${relative}`);
  } catch (error) {
    warnings.push(`stat-failed:${relative}:${String(error?.message ?? error)}`);
  }
}
for (const relative of [
  '.env.local',
  'legacy/input-archives/hexis-main-2026-10-08/.env.local',
  'legacy/input-archives/hexis-main-2026-10-08/core/auth/gmail-credentials.json',
]) {
  if (await exists(path.join(root, relative))) errors.push(`secret-file-present:${relative}`);
}

runCheck('ui-wiring', ['scripts/audit-ui-function-wiring.mjs'], path.join(root, 'runtime/neuro-kurisu'));
runCheck('architecture', ['scripts/audit-architecture.mjs'], path.join(root, 'runtime/neuro-kurisu'));
// The final-release command must not go green while the canonical version/lockfile/
// release-status validator is red or missing. This closes a gap between two
// previously independent gates that operators could accidentally run separately.
runCheck('release-metadata', ['tools/verify-release-metadata.mjs', '--root', root], root);

const directCheckFailures = checks.filter(item => !item.pass).length;
const treeFailures = errors.filter(error => !checks.some(item => error.startsWith(`${item.id}:`))).length;
const result = {
  title: 'Neuro-Kurisu SUPER final release verifier',
  root,
  generatedPythonCachePolicy: allowGeneratedPythonCache ? 'allow-transient-caches' : 'strict',
  ok: errors.length === 0,
  summary: {
    checks: checks.length,
    passed: checks.filter(item => item.pass).length,
    failed: directCheckFailures + treeFailures,
    directCheckFailures,
    treeFailures,
  },
  checks,
  files: files.length,
  errors,
  warnings,
  checkedAt: new Date().toISOString(),
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
