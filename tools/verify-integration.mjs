import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendOutputTail,
  findAvailablePort,
  runCommand,
  terminateChild,
  waitForHttp,
} from './integration-supervisor.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const verifyState = await mkdtemp(join(tmpdir(), 'nk1-integration-state-'));
const runtimePort = await findAvailablePort();
const bridgePort = await findAvailablePort({ exclude: [runtimePort] });
const runtimeUrl = `http://127.0.0.1:${runtimePort}`;
const bridgeUrl = `http://127.0.0.1:${bridgePort}`;

const results = [];
const children = [];

function record(label, ok, detail = '') {
  results.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
}

function launch(label, command, args, env) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    windowsHide: true,
  });
  const item = { label, child, out: '', err: '', spawnError: null };
  child.stdout?.on('data', chunk => { item.out = appendOutputTail(item.out, chunk); });
  child.stderr?.on('data', chunk => { item.err = appendOutputTail(item.err, chunk); });
  child.once('error', error => { item.spawnError = error; });
  children.push(item);
  return item;
}

function childDiagnostics(item) {
  if (!item) return '';
  const output = [item.out, item.err].filter(Boolean).join('\n').slice(-4_000);
  return `child=${item.label} spawnError=${item.spawnError?.message ?? 'none'} output=${output || '(no output)'}`;
}

async function fetchJson(url, init = {}, timeoutMs = 8_000) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 240_000) {
    throw new RangeError('fetchJson timeoutMs must be a safe integer in 1..240000');
  }
  const response = await fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  });
  const body = await response.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`Expected JSON from ${url}; HTTP ${response.status}; body=${body.slice(0, 300)}`);
  }
  return { res: response, data };
}

try {
  for (const relativePath of [
    'runtime/neuro-kurisu/src/server/server.mjs',
    'app/src/neuro-kurisu/api.ts',
    'app/src/legacy/avatar/LegacySpriteDeck.tsx',
    'runtime/neuro-kurisu/public/live2d/Kurisu/Kurisu.model3.json',
    'app/public/live2d/vendor/pixi.min.js',
    'research/research_bridge.py',
    'contracts/integration-manifest.json',
  ]) {
    record(`exists:${relativePath}`, existsSync(resolve(ROOT, relativePath)));
  }

  const runtime = launch('neuro-kurisu', 'node', [
    '--experimental-strip-types', 'runtime/neuro-kurisu/src/server/server.mjs',
  ], {
    PORT: String(runtimePort),
    HOST: '127.0.0.1',
    STATE_DIR: resolve(verifyState, 'organism'),
  });

  const bridge = launch('research-bridge', 'python3', ['research/research_bridge.py'], {
    RESEARCH_HOST: '127.0.0.1',
    RESEARCH_PORT: String(bridgePort),
    ORGANISM_RUNTIME_URL: runtimeUrl,
  });

  await waitForHttp(`${runtimeUrl}/api/organism/ui-snapshot`, {
    timeoutMs: 30_000,
    child: runtime.child,
    label: 'NeuroCore runtime',
    diagnostic: () => childDiagnostics(runtime),
  });
  const ui = await fetchJson(`${runtimeUrl}/api/organism/ui-snapshot`);
  const runtimePackage = JSON.parse(await readFile(resolve(ROOT, 'runtime/neuro-kurisu/package.json'), 'utf8'));
  record('runtime:ui-snapshot', ui.res.ok && ui.data?.version === runtimePackage.version,
    `version=${ui.data?.version} expected=${runtimePackage.version} schema=${ui.data?.schemaVersion}`);

  const chat = await fetchJson(`${runtimeUrl}/api/organism/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'integration smoke', deliberate: true, speak: false }),
  });
  record('runtime:chat', chat.res.ok && Boolean(chat.data?.language?.text),
    `backend=${chat.data?.language?.backend ?? 'unknown'}`);

  await waitForHttp(`${bridgeUrl}/api/research/status`, {
    timeoutMs: 30_000,
    child: bridge.child,
    label: 'Research bridge',
    diagnostic: () => childDiagnostics(bridge),
  });
  const bridgeStatus = await fetchJson(`${bridgeUrl}/api/research/status`);
  record('research:status', bridgeStatus.res.ok && bridgeStatus.data?.ok === true,
    `neurocore=${bridgeStatus.data?.neurocore?.version ?? '—'} nomega=${bridgeStatus.data?.nomega?.version ?? '—'}`);

  const runApprovedProbe = async (kind, executionTimeoutMs = 8_000) => {
    const base = `${bridgeUrl}/api/research/probe/${kind}`;
    const blocked = await fetchJson(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    record(`research:${kind}:blocked-without-approval`,
      blocked.res.status === 403 && blocked.data?.approvalRequired === true && Boolean(blocked.data?.approvalRequest?.id),
      `status=${blocked.res.status} error=${blocked.data?.error ?? '—'} approvalId=${blocked.data?.approvalRequest?.id ? 'present' : 'missing'}`);
    if (blocked.res.status !== 403 || !blocked.data?.approvalRequest?.id) return { res: blocked.res, data: blocked.data };

    const decision = await fetchJson(`${runtimeUrl}/api/organism/tools/permissions/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestId: blocked.data.approvalRequest.id, approved: true }),
    });
    record(`research:${kind}:explicit-owner-approval`, decision.res.ok && decision.data?.ok === true,
      `status=${decision.res.status} error=${decision.data?.error ?? '—'}`);
    if (!decision.res.ok) return { res: decision.res, data: decision.data };
    return await fetchJson(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ approvalId: blocked.data.approvalRequest.id }),
    }, executionTimeoutMs);
  };

  const nc = await runApprovedProbe('neurocore', 60_000);
  record('research:neurocore-probe-after-approval',
    nc.res.ok && Boolean(nc.data?.ok) && nc.data?.status === 'pass',
    `delta=${nc.data?.delta ?? '—'} error=${nc.data?.error ?? '—'}`);

  const nm = await runApprovedProbe('nomega-registry', 60_000);
  record('research:nomega-registry-after-approval',
    nm.res.ok && Boolean(nm.data?.ok) && nm.data?.status === 'pass',
    `modules=${nm.data?.total_modules ?? '—'} cycles=${nm.data?.cycles ?? '—'} error=${nm.data?.error ?? '—'}`);

  // DeepCode's CPU smoke can legitimately approach its 180-second subprocess limit.
  const dc = await runApprovedProbe('deepcode', 200_000);
  record('research:deepcode-probe-after-approval',
    dc.res.ok && Boolean(dc.data?.ok) && dc.data?.status === 'pass',
    `smoke=${dc.data?.result?.smoke ?? '—'} learn_steps=${dc.data?.result?.learn_steps ?? '—'} error=${dc.data?.error ?? '—'}`);
} catch (error) {
  record('runtime/bridge:http', false, error instanceof Error ? error.message : String(error));
} finally {
  await Promise.all(children.map(item => terminateChild(item.child)));
  await rm(verifyState, { recursive: true, force: true });
}

for (const [label, command, args] of [
  ['ui:typecheck', 'npm', ['--prefix', 'app', 'run', 'typecheck']],
  ['runtime:typecheck', 'npm', ['--prefix', 'runtime/neuro-kurisu', 'run', 'typecheck']],
]) {
  const result = await runCommand(label, command, args, { cwd: ROOT, timeoutMs: 20 * 60 * 1000 });
  const tail = (result.err || result.out).trim().split('\n').slice(-3).join(' | ');
  const detail = result.timedOut
    ? `timeout after 20m; ${tail}`
    : result.error
      ? `spawn error: ${result.error.message}; ${tail}`
      : `${result.signal ? `signal=${result.signal}` : `exit=${result.code}`}; ${tail}`;
  record(label, result.code === 0 && !result.error && !result.timedOut, detail);
}

const environmentBlocked = !existsSync(resolve(ROOT, 'app/node_modules'));
const summary = { ok: results.every(result => result.ok), environmentBlocked, results, generatedAt: new Date().toISOString() };
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.ok ? 0 : 1;
