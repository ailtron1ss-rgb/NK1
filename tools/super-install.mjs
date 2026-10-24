#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { meetsMinimumVersion } from './runtime-requirements.mjs';
import { runCommand } from './process-supervisor.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredNodeVersion = '22.12.0';
if (!meetsMinimumVersion(process.versions.node, requiredNodeVersion)) {
  console.error(`SUPER_INSTALL=FAIL reason=node-version-required expected=>=${requiredNodeVersion} actual=${process.version}`);
  process.exit(1);
}

const workspaces = [
  { name: 'app', dir: 'app' },
  { name: 'runtime', dir: 'runtime/neuro-kurisu' },
];
for (const workspace of workspaces) {
  const packageDir = path.join(root, workspace.dir);
  const packageFile = path.join(packageDir, 'package.json');
  const lockFile = path.join(packageDir, 'package-lock.json');
  if (!existsSync(packageFile) || !existsSync(lockFile)) {
    console.error(`SUPER_INSTALL=FAIL workspace=${workspace.name} reason=package-or-lockfile-missing package=${existsSync(packageFile)} lockfile=${existsSync(lockFile)}`);
    process.exit(1);
  }
  try {
    const manifest = JSON.parse(readFileSync(packageFile, 'utf8'));
    const lock = JSON.parse(readFileSync(lockFile, 'utf8'));
    const lockRoot = lock.packages?.[''];
    if (!lockRoot || lockRoot.name !== manifest.name || (manifest.version && lockRoot.version !== manifest.version)) {
      console.error(`SUPER_INSTALL=FAIL workspace=${workspace.name} reason=lockfile-root-mismatch manifest=${manifest.name}@${manifest.version ?? 'unspecified'} lock=${lockRoot?.name ?? 'missing'}@${lockRoot?.version ?? 'unspecified'}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`SUPER_INSTALL=FAIL workspace=${workspace.name} reason=invalid-package-or-lockfile message=${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const timeoutMs = Number(process.env.NK_NPM_INSTALL_TIMEOUT_MS ?? 600000);
if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 1800000) {
  console.error('SUPER_INSTALL=FAIL reason=invalid-timeout allowed=1000..1800000');
  process.exit(1);
}
const installEnv = {
  ...process.env,
  // Bound retries so transient DNS/registry outages fail clearly instead of stalling for many minutes.
  npm_config_fetch_retries: process.env.NK_NPM_FETCH_RETRIES ?? '2',
  npm_config_fetch_retry_mintimeout: process.env.NK_NPM_FETCH_RETRY_MIN_TIMEOUT_MS ?? '1000',
  npm_config_fetch_retry_maxtimeout: process.env.NK_NPM_FETCH_RETRY_MAX_TIMEOUT_MS ?? '5000',
  npm_config_fetch_timeout: process.env.NK_NPM_FETCH_TIMEOUT_MS ?? '60000',
};

function runNpmInstall({ cwd, env, timeoutMs }) {
  return runCommand('npm', ['ci', '--no-audit', '--no-fund'], {
    cwd,
    env,
    timeoutMs,
    terminationGraceMs: 750,
    forceGraceMs: 500,
    maxOutputBytes: 24 * 1024,
    streamOutput: true,
  });
}

for (const workspace of workspaces) {
  const cwd = path.join(root, workspace.dir);
  console.log(`SUPER_INSTALL=START workspace=${workspace.name} lockfile=${path.relative(root, path.join(cwd, 'package-lock.json'))}`);
  const result = await runNpmInstall({ cwd, env: installEnv, timeoutMs });
  if (result.error || result.code !== 0 || result.timedOut) {
    if (result.timedOut) {
      console.error(`SUPER_INSTALL=TIMEOUT workspace=${workspace.name} deadlineMs=${timeoutMs}; child termination was enforced by the process supervisor`);
    }
    const status = typeof result.code === 'number' ? result.code : 1;
    const reason = result.timedOut ? `timeout-after-${result.durationMs}ms`
      : result.error ? `spawn-error`
        : result.signal ? `signal-${result.signal}` : `npm-exit-${status}`;
    console.error(`SUPER_INSTALL=FAIL workspace=${workspace.name} reason=${reason} exit=${status}`);
    if (result.error) console.error(`SUPER_INSTALL=DIAGNOSTIC ${result.error}`);
    const tail = (result.err || result.out).trim();
    if (tail) console.error(`SUPER_INSTALL=OUTPUT_TAIL\\n${tail}`);
    console.error('The lockfile was not rewritten. If npm reports EAI_AGAIN/ENOTFOUND, restore registry DNS/network access and rerun npm run install:all.');
    process.exit(result.timedOut ? 1 : (status || 1));
  }
  console.log(`SUPER_INSTALL=PASS workspace=${workspace.name}`);
}
console.log('SUPER_INSTALL=PASS workspaces=2 lockfiles=2');
