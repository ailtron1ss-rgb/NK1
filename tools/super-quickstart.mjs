#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPinnedNodeMajor } from './lib/node-runtime.mjs';
import { assertToolchainVersions, workspaceNeedsNodeModules } from './lib/super-startup.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let activeChild = null;
let interrupted = false;

function readVersion(command, args) {
  try {
    return execFileSync(command, args, { cwd: ROOT, encoding: 'utf8', timeout: 5000 }).trim();
  } catch (error) {
    throw new Error(`Required command ${command} is unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function terminate(child, signal) {
  if (!child?.pid) return;
  try {
    if (process.platform !== 'win32') process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch {
    try { child.kill(signal); } catch { /* already gone */ }
  }
}

function run(label, command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: process.env,
      stdio: 'inherit',
      detached: process.platform !== 'win32',
      windowsHide: true,
      shell: process.platform === 'win32' && /\.cmd$/i.test(command),
    });
    activeChild = child;
    child.once('error', (error) => {
      if (activeChild === child) activeChild = null;
      reject(new Error(`${label} could not start: ${error.message}`));
    });
    child.once('exit', (code, signal) => {
      if (activeChild === child) activeChild = null;
      if (code === 0 && !signal) resolve();
      else reject(new Error(`${label} failed (exit=${code ?? 'null'}, signal=${signal ?? 'none'}).`));
    });
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    interrupted = true;
    process.exitCode = signal === 'SIGINT' ? 130 : 143;
    terminate(activeChild, signal);
  });
}

async function main() {
  const expectedNodeMajor = readPinnedNodeMajor(ROOT);
  const expectedPythonVersion = readFileSync(path.join(ROOT, '.python-version'), 'utf8').trim();
  const versions = assertToolchainVersions({
    nodeVersion: process.version,
    npmVersion: readVersion(npm, ['--version']),
    pythonVersion: readVersion('python3', ['--version']),
    expectedNodeMajor,
    expectedPythonVersion,
  });
  console.log(`[quickstart] Node ${versions.node.major}, npm ${versions.npm.major}.${versions.npm.minor}, Python ${versions.python.major}.${versions.python.minor}: OK`);

  const workspaces = ['app', 'runtime/neuro-kurisu'];
  const missing = workspaces.filter((workspace) => {
    const manifestPath = path.join(ROOT, workspace, 'package.json');
    if (!existsSync(manifestPath)) throw new Error(`Workspace package manifest is missing: ${workspace}/package.json`);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    return workspaceNeedsNodeModules(manifest) && !existsSync(path.join(ROOT, workspace, 'node_modules'));
  });
  if (missing.length > 0) {
    console.log(`[quickstart] installing dependencies for: ${missing.join(', ')}`);
    await run('npm run install:all', npm, ['run', 'install:all']);
  } else {
    console.log('[quickstart] dependency trees already present; preserving them');
  }

  console.log('[quickstart] building the production UI/runtime bundle');
  await run('npm run build', npm, ['run', 'build']);

  console.log('[quickstart] running repository doctor');
  await run('npm run doctor', process.execPath, ['tools/super-doctor.mjs']);

  console.log('[quickstart] starting the prototype');
  await run('super-start', process.execPath, ['tools/super-start.mjs']);
}

main().catch((error) => {
  if (!interrupted) {
    console.error(`[quickstart] failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
});
