import { spawnManaged, terminateChildren, runCommand, waitForHttp } from './process-supervisor.mjs';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
// Each verification gets an isolated state directory. Concurrent runs must not
// remove or overwrite each other's temporary organism state.
const verifyStateRoot = resolve(ROOT, '.verify-state');
mkdirSync(verifyStateRoot, { recursive: true });
const verifyState = mkdtempSync(resolve(verifyStateRoot, 'run-'));

const results = [];
const record = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};

for (const path of [
  'runtime/neuro-kurisu/src/server/server.mjs',
  'app/src/neuro-kurisu/api.ts',
  'app/src/legacy/avatar/LegacySpriteDeck.tsx',
  'runtime/neuro-kurisu/public/live2d/Kurisu/Kurisu.model3.json',
  'app/public/live2d/vendor/pixi.min.js',
  'research/research_bridge.py',
  'contracts/integration-manifest.json',
]) record(`exists:${path}`, existsSync(resolve(ROOT, path)));

let runtime;
let bridge;
try {
  runtime = spawnManaged('node', ['--experimental-strip-types', 'runtime/neuro-kurisu/src/server/server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: '3311', HOST: '127.0.0.1', STATE_DIR: resolve(verifyState, 'organism') },
    stdio: 'inherit',
  });
  bridge = spawnManaged('python3', ['research/research_bridge.py'], {
    cwd: ROOT,
    env: { ...process.env, RESEARCH_PORT: '8766', ORGANISM_RUNTIME_URL: 'http://127.0.0.1:3311' },
    stdio: 'inherit',
  });
  runtime.on('error', (error) => record('runtime:spawn', false, error.message));
  bridge.on('error', (error) => record('research:spawn', false, error.message));

  // Wait for actual readiness instead of guessing with a fixed 3.5-second
  // sleep. Each probe has a request timeout and the overall startup has a cap.
  const [runtimeReady, bridgeReady] = await Promise.all([
    waitForHttp('http://127.0.0.1:3311/api/organism/ui-snapshot', { timeoutMs: 20_000, intervalMs: 100, requestTimeoutMs: 1_500 }),
    waitForHttp('http://127.0.0.1:8766/api/research/status', { timeoutMs: 20_000, intervalMs: 100, requestTimeoutMs: 1_500 }),
  ]);
  record('runtime:ready', runtimeReady.ok, runtimeReady.ok ? `status=${runtimeReady.status} elapsed=${runtimeReady.elapsedMs}ms` : runtimeReady.error);
  record('research:ready', bridgeReady.ok, bridgeReady.ok ? `status=${bridgeReady.status} elapsed=${bridgeReady.elapsedMs}ms` : bridgeReady.error);
  if (!runtimeReady.ok || !bridgeReady.ok) {
    throw new Error(`readiness deadline: runtime=${runtimeReady.error ?? 'ready'}; research=${bridgeReady.error ?? 'ready'}`);
  }

  const fetchJson = async (url, init = {}) => {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(5_000) });
    const data = await res.json();
    return { res, data };
  };

  const ui = await fetchJson('http://127.0.0.1:3311/api/organism/ui-snapshot');
  const runtimePackage = JSON.parse(await (await import('node:fs/promises')).readFile(resolve(ROOT, 'runtime/neuro-kurisu/package.json'), 'utf8'));
  record('runtime:ui-snapshot', ui.res.ok && ui.data?.version === runtimePackage.version, `version=${ui.data?.version} expected=${runtimePackage.version} schema=${ui.data?.schemaVersion}`);
  const chat = await fetchJson('http://127.0.0.1:3311/api/organism/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'integration smoke', deliberate: true, speak: false }) });
  record('runtime:chat', chat.res.ok && Boolean(chat.data?.language?.text), `backend=${chat.data?.language?.backend ?? 'unknown'}`);
  const bridgeStatus = await fetchJson('http://127.0.0.1:8766/api/research/status');
  record('research:status', bridgeStatus.res.ok && bridgeStatus.data?.ok === true, `neurocore=${bridgeStatus.data?.neurocore?.version ?? '—'} nomega=${bridgeStatus.data?.nomega?.version ?? '—'}`);
  const runApprovedProbe = async (kind) => {
    const base = `http://127.0.0.1:8766/api/research/probe/${kind}`;
    const blocked = await fetchJson(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    record(`research:${kind}:blocked-without-approval`, blocked.res.status === 403 && blocked.data?.approvalRequired === true && Boolean(blocked.data?.approvalRequest?.id), `status=${blocked.res.status}`);
    if (blocked.res.status !== 403 || !blocked.data?.approvalRequest?.id) return { res: blocked.res, data: blocked.data };
    const decision = await fetchJson('http://127.0.0.1:3311/api/organism/tools/permissions/resolve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requestId: blocked.data.approvalRequest.id, approved: true }) });
    record(`research:${kind}:explicit-owner-approval`, decision.res.ok && decision.data?.ok === true, `status=${decision.res.status}`);
    if (!decision.res.ok) return { res: decision.res, data: decision.data };
    return await fetchJson(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ approvalId: blocked.data.approvalRequest.id }) });
  };
  const nc = await runApprovedProbe('neurocore');
  record('research:neurocore-probe-after-approval', nc.res.ok && Boolean(nc.data?.ok) && nc.data?.status === 'pass', `delta=${nc.data?.delta ?? '—'}`);
  const nm = await runApprovedProbe('nomega-registry');
  record('research:nomega-registry-after-approval', nm.res.ok && Boolean(nm.data?.ok) && nm.data?.status === 'pass', `modules=${nm.data?.total_modules ?? '—'} cycles=${nm.data?.cycles ?? '—'}`);
  const dc = await runApprovedProbe('deepcode');
  record('research:deepcode-probe-after-approval', dc.res.ok && Boolean(dc.data?.ok) && dc.data?.status === 'pass', `smoke=${dc.data?.result?.smoke ?? '—'} learn_steps=${dc.data?.result?.learn_steps ?? '—'}`);
} catch (error) {
  record('runtime/bridge:http', false, String(error));
} finally {
  await terminateChildren([runtime, bridge], { graceMs: 800, forceGraceMs: 500 });
}

for (const [label, command, args] of [
  ['ui:typecheck', 'npm', ['--prefix', 'app', 'run', 'typecheck']],
  ['runtime:typecheck', 'npm', ['--prefix', 'runtime/neuro-kurisu', 'run', 'typecheck']],
]) {
  const r = await runCommand(command, args, { cwd: ROOT, timeoutMs: 180_000, terminationGraceMs: 800, forceGraceMs: 500, maxOutputBytes: 24 * 1024 });
  const tail = (r.err || r.out).trim().split('\n').slice(-3).join(' | ');
  const detail = r.error
    ? `spawn error: ${r.error}`
    : r.timedOut
      ? `timed out after ${r.durationMs}ms${tail ? ` — ${tail}` : ''}`
      : tail || `exit=${r.code}`;
  record(label, r.code === 0 && !r.timedOut && !r.error, detail);
}

const environmentBlocked = !existsSync(resolve(ROOT, 'app/node_modules'));
rmSync(verifyState, { recursive: true, force: true });
const summary = { ok: results.every(r => r.ok), environmentBlocked, results, generatedAt: new Date().toISOString() };
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.ok ? 0 : 1;
