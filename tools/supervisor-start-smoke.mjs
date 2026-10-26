import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packageInfo = JSON.parse(readFileSync(resolve(ROOT, 'runtime/neuro-kurisu/package.json'), 'utf8'));
const tempRoot = mkdtempSync(join(tmpdir(), 'nk1-supervisor-start-smoke-'));
const stateDir = join(tempRoot, 'state');
const logs = { stdout: '', stderr: '' };
const maxLogChars = 16_000;
const child = spawn(process.execPath, ['tools/super-start.mjs'], {
  cwd: ROOT,
  env: { ...process.env, NK_SUPER_STATE_DIR: stateDir },
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: process.platform !== 'win32',
});
let stopRequested = false;

function appendLog(target, chunk) {
  logs[target] = (logs[target] + chunk.toString()).slice(-maxLogChars);
}
child.stdout.on('data', chunk => appendLog('stdout', chunk));
child.stderr.on('data', chunk => appendLog('stderr', chunk));

const sleep = milliseconds => new Promise(resolveSleep => setTimeout(resolveSleep, milliseconds));
function childHasExited() {
  return child.exitCode !== null || child.signalCode !== null;
}
function waitForChildExit(milliseconds) {
  if (childHasExited()) return Promise.resolve(true);
  return Promise.race([
    new Promise(resolveExit => child.once('exit', () => resolveExit(true))),
    sleep(milliseconds).then(() => false),
  ]);
}
function killProcessGroup(signal) {
  if (process.platform === 'win32' || !Number.isInteger(child.pid)) {
    try { child.kill(signal); } catch { /* already exited */ }
    return;
  }
  try { process.kill(-child.pid, signal); }
  catch (error) {
    if (error?.code !== 'ESRCH') {
      try { child.kill(signal); } catch { /* best effort */ }
    }
  }
}
async function request(url, timeoutMs = 1500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      body: await response.text(),
    };
  } catch (error) {
    return { status: 0, contentType: '', body: String(error?.message ?? error) };
  } finally {
    clearTimeout(timeout);
  }
}
function parseJson(probe) {
  if (probe.status < 200 || probe.status >= 300) return null;
  try { return JSON.parse(probe.body); } catch { return null; }
}
function summarize(probes) {
  return Object.fromEntries(Object.entries(probes).map(([name, probe]) => [
    name, { status: probe.status, contentType: probe.contentType, preview: probe.body.slice(0, 160) },
  ]));
}

async function main() {
  assert.equal(Number.isInteger(child.pid), true, 'supervisor process must spawn');
  const deadline = Date.now() + 90_000;
  let lastProbes = {};
  while (Date.now() < deadline) {
    if (childHasExited()) {
      throw new Error(`supervisor exited before readiness (code=${child.exitCode}, signal=${child.signalCode})`);
    }
    const [ui, runtime, research] = await Promise.all([
      request('http://127.0.0.1:8080/'),
      request('http://127.0.0.1:8080/api/organism/ui-snapshot'),
      request('http://127.0.0.1:8080/api/research/status'),
    ]);
    lastProbes = { ui, runtime, research };
    const runtimeJson = parseJson(runtime);
    const researchJson = parseJson(research);
    const uiReady = ui.status === 200 && /text\/html/i.test(ui.contentType) && /<!doctype html/i.test(ui.body.slice(0, 1000));
    const runtimeReady = runtime.status === 200 && runtimeJson?.version === packageInfo.version && Number.isInteger(runtimeJson?.schemaVersion);
    const researchReady = research.status === 200 && researchJson?.ok === true;
    if (uiReady && runtimeReady && researchReady) {
      console.log(`NK1_SUPERVISOR_START_SMOKE=PASS ui=${ui.status} runtime=${runtimeJson.version} schema=${runtimeJson.schemaVersion} research=ok`);
      return;
    }
    await sleep(350);
  }
  throw new Error(`supervised stack did not become healthy within 90000ms: ${JSON.stringify(summarize(lastProbes))}`);
}

try {
  await main();
} catch (error) {
  process.exitCode = 1;
  console.error('NK1_SUPERVISOR_START_SMOKE=FAIL', error?.stack ?? String(error));
  if (logs.stdout) console.error('[supervisor stdout]\n' + logs.stdout);
  if (logs.stderr) console.error('[supervisor stderr]\n' + logs.stderr);
} finally {
  stopRequested = true;
  if (!childHasExited()) {
    try { child.kill('SIGTERM'); } catch { /* already exiting */ }
    const exited = await waitForChildExit(3500);
    if (!exited) killProcessGroup('SIGKILL');
  }
  // Keep the smoke run contained: no persistent state is written to the checkout.
  killProcessGroup('SIGKILL');
  rmSync(tempRoot, { recursive: true, force: true });
}
