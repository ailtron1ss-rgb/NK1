#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPinnedNodeMajor } from './lib/node-runtime.mjs';
import { assertPortAvailable, assertToolchainVersions, waitForHttpReady, workspaceNeedsNodeModules } from './lib/super-startup.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_DIR = path.join(ROOT, '.super-state', 'organism');
const PORTS = [8080, 8081, 3310, 8765];
const STARTUP_TIMEOUT_MS = Number(process.env.NK_STARTUP_TIMEOUT_MS ?? 60000);
const children = [];
let stopping = false;

function readVersion(command, args) {
  try {
    return execFileSync(command, args, { cwd: ROOT, encoding: 'utf8', timeout: 5000 }).trim();
  } catch (error) {
    throw new Error(`Required command ${command} is unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertPreconditions() {
  const expectedNodeMajor = readPinnedNodeMajor(ROOT);
  const expectedPythonVersion = readFileSync(path.join(ROOT, '.python-version'), 'utf8').trim();
  const versions = assertToolchainVersions({
    nodeVersion: process.version,
    npmVersion: readVersion(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version']),
    pythonVersion: readVersion('python3', ['--version']),
    expectedNodeMajor,
    expectedPythonVersion,
  });
  for (const workspace of ['app', 'runtime/neuro-kurisu']) {
    const packageFile = path.join(ROOT, workspace, 'package.json');
    if (!existsSync(packageFile)) throw new Error(`Required workspace manifest is missing: ${workspace}/package.json`);
    const manifest = JSON.parse(readFileSync(packageFile, 'utf8'));
    const nodeModules = path.join(ROOT, workspace, 'node_modules');
    if (workspaceNeedsNodeModules(manifest) && !existsSync(nodeModules)) {
      throw new Error(`Dependencies are missing at ${workspace}/node_modules. Run npm run quickstart (or npm run install:all), then retry.`);
    }
  }
  if (!existsSync(path.join(ROOT, 'app/.vercel/output/nitro.json'))) {
    throw new Error('Production Nitro output app/.vercel/output/nitro.json is missing. Run npm run quickstart or npm run build before npm run start:prebuilt.');
  }
  for (const relative of [
    'runtime/neuro-kurisu/src/server/server.mjs',
    'research/research_bridge.py',
    'tools/super-gateway.mjs',
  ]) {
    if (!existsSync(path.join(ROOT, relative))) throw new Error(`Required launch component is missing: ${relative}`);
  }
  if (!Number.isSafeInteger(STARTUP_TIMEOUT_MS) || STARTUP_TIMEOUT_MS < 5000 || STARTUP_TIMEOUT_MS > 180000) {
    throw new Error('NK_STARTUP_TIMEOUT_MS must be an integer between 5000 and 180000.');
  }
  console.log(`[super] toolchain Node ${versions.node.major}, npm ${versions.npm.major}.${versions.npm.minor}, Python ${versions.python.major}.${versions.python.minor} — OK`);
}

function signalService(service, signal) {
  if (service.exited || !service.child.pid) return;
  try {
    if (process.platform !== 'win32') process.kill(-service.child.pid, signal);
    else service.child.kill(signal);
  } catch (error) {
    if (error?.code !== 'ESRCH') {
      try { service.child.kill(signal); } catch { /* child is already gone */ }
    }
  }
}

function stopAll(reason, exitCode = 1) {
  if (stopping) {
    for (const service of [...children].reverse()) signalService(service, 'SIGKILL');
    return;
  }
  stopping = true;
  process.exitCode = exitCode;
  console.log(`[super] stopping services (${reason})`);
  for (const service of [...children].reverse()) signalService(service, 'SIGTERM');
  const forceTimer = setTimeout(() => {
    for (const service of [...children].reverse()) signalService(service, 'SIGKILL');
  }, 5000);
  forceTimer.unref();
}

function launch(label, command, args, env = {}, cwd = ROOT) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    windowsHide: true,
    shell: process.platform === 'win32' && /\.cmd$/i.test(command),
  });
  const service = { label, child, exited: false, failure: null, exitCode: null, signal: null };
  children.push(service);
  child.once('error', (error) => {
    service.failure = error;
    service.exited = true;
    console.error(`[super] ${label} spawn error: ${error.message}`);
    stopAll(`spawn:${label}`, 1);
  });
  child.once('exit', (code, signal) => {
    service.exited = true;
    service.exitCode = code;
    service.signal = signal;
    if (!stopping) {
      console.error(`[super] ${label} exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'none'}).`);
      stopAll(`child-exit:${label}`, 1);
    }
  });
  return service;
}

async function waitReady(service, url) {
  await waitForHttpReady({
    url,
    serviceName: service.label,
    timeoutMs: STARTUP_TIMEOUT_MS,
    isAlive: () => !service.exited && !stopping,
  });
  console.log(`[super] ready: ${service.label} (${url})`);
}

async function main() {
  assertPreconditions();
  mkdirSync(STATE_DIR, { recursive: true });
  for (const port of PORTS) await assertPortAvailable(port);

  const runtime = launch(
    'organism-runtime',
    process.execPath,
    ['--experimental-strip-types', 'src/server/server.mjs'],
    { PORT: '3310', HOST: '127.0.0.1', STATE_DIR, NODE_ENV: 'production' },
    path.join(ROOT, 'runtime/neuro-kurisu'),
  );
  await waitReady(runtime, 'http://127.0.0.1:3310/health');

  const research = launch('research-bridge', 'python3', ['research/research_bridge.py'], { RESEARCH_PORT: '8765' });
  await waitReady(research, 'http://127.0.0.1:8765/health');

  const ui = launch('ui-preview', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--prefix', 'app', 'run', 'preview']);
  await waitReady(ui, 'http://127.0.0.1:8081/');

  const gateway = launch('gateway', process.execPath, ['tools/super-gateway.mjs'], {
    SUPER_GATEWAY_PORT: '8080',
    SUPER_UI_PORT: '8081',
    SUPER_RUNTIME_PORT: '3310',
    SUPER_RESEARCH_PORT: '8765',
  });
  await waitReady(gateway, 'http://127.0.0.1:8080/');

  console.log('');
  console.log('[super] NeuroCore prototype is ready.');
  console.log('[super] UI:      http://127.0.0.1:8080/');
  console.log('[super] Runtime: http://127.0.0.1:3310/health');
  console.log('[super] Research:http://127.0.0.1:8765/api/research/status');
  console.log('[super] Press Ctrl+C to stop all services.');
}

process.on('SIGINT', () => stopAll('SIGINT', 130));
process.on('SIGTERM', () => stopAll('SIGTERM', 143));
process.on('SIGHUP', () => stopAll('SIGHUP', 129));

main().catch((error) => {
  console.error(`[super] startup failed: ${error instanceof Error ? error.message : String(error)}`);
  stopAll('startup-failed', 1);
});
