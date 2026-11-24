import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const verifyState = resolve(ROOT, '.verify-state');
rmSync(verifyState, { recursive: true, force: true });
mkdirSync(verifyState, { recursive: true });

const results = [];
const run = (label, command, args, options = {}) => new Promise((resolvePromise) => {
  const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, ...options.env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { err += d; });
  child.on('close', code => resolvePromise({ label, code, out: String(out), err: String(err) }));
});

function record(label, ok, detail = '', environmentRequired = false) { results.push({ label, ok, detail, environmentRequired }); console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`); }

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
  runtime = spawn('node', ['--experimental-strip-types', 'runtime/neuro-kurisu/src/server/server.mjs'], {
    cwd: ROOT, env: { ...process.env, PORT: '3311', HOST: '127.0.0.1', STATE_DIR: resolve(verifyState, 'organism') }, stdio: ['ignore', 'pipe', 'pipe']
  });
  bridge = spawn('python3', ['research/research_bridge.py'], { cwd: ROOT, env: { ...process.env, RESEARCH_PORT: '8766', ORGANISM_RUNTIME_URL: 'http://127.0.0.1:3311' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise(r => setTimeout(r, 3500));
  const fetchJson = async (url, init) => {
    const res = await fetch(url, init);
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
    const base=`http://127.0.0.1:8766/api/research/probe/${kind}`;
    const blocked=await fetchJson(base,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    record(`research:${kind}:blocked-without-approval`,blocked.res.status===403 && blocked.data?.approvalRequired===true && Boolean(blocked.data?.approvalRequest?.id),`status=${blocked.res.status}`);
    if(blocked.res.status!==403 || !blocked.data?.approvalRequest?.id) return {res:blocked.res,data:blocked.data};
    const decision=await fetchJson('http://127.0.0.1:3311/api/organism/tools/permissions/resolve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestId:blocked.data.approvalRequest.id,approved:true})});
    record(`research:${kind}:explicit-owner-approval`,decision.res.ok && decision.data?.ok===true,`status=${decision.res.status}`);
    if(!decision.res.ok) return {res:decision.res,data:decision.data};
    return await fetchJson(base,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({approvalId:blocked.data.approvalRequest.id})});
  };
  const probe = (label, data, detail) => record(label, data?.ok === true && data?.status === 'pass', detail, !data?.ok && /torch/i.test(data?.error ?? ''));
  const nc = await runApprovedProbe('neurocore');
  probe('research:neurocore-probe-after-approval', nc.data, `delta=${nc.data?.delta ?? '—'}`);
  const nm = await runApprovedProbe('nomega-registry');
  probe('research:nomega-registry-after-approval', nm.data, `modules=${nm.data?.total_modules ?? '—'} cycles=${nm.data?.cycles ?? '—'}`);
  const dc = await runApprovedProbe('deepcode');
  probe('research:deepcode-probe-after-approval', dc.data, `smoke=${dc.data?.result?.smoke ?? '—'} learn_steps=${dc.data?.result?.learn_steps ?? '—'}`);
} catch (error) {
  record('runtime/bridge:http', false, String(error));
} finally {
  runtime?.kill('SIGTERM'); bridge?.kill('SIGTERM');
}

const appDepsPresent = existsSync(resolve(ROOT, 'app/node_modules'));
for (const [label, command, args] of [
  ['ui:typecheck', 'npm', ['--prefix', 'app', 'run', 'typecheck']],
  ['runtime:typecheck', 'npm', ['--prefix', 'runtime/neuro-kurisu', 'run', 'typecheck']],
]) {
  const r = await run(label, command, args);
  record(label, r.code === 0, (r.err || r.out).trim().split('\n').slice(-3).join(' | '), label === 'ui:typecheck' && !appDepsPresent);
}

const environmentBlocked = !appDepsPresent;
const failures = results.filter(r => !r.ok);
const failedLabels = failures.map(r => r.label);
const blockedByEnvironment = failures.length > 0 && failures.every(r => r.environmentRequired);
const summary = { ok: failures.length === 0, environmentBlocked, blockedByEnvironment, failedLabels, results, generatedAt: new Date().toISOString() };
console.log(JSON.stringify(summary, null, 2));
// 0 = fully verified, 1 = real failure(s), 2 = only environment-blocked checks could not run.
process.exitCode = summary.ok ? 0 : (blockedByEnvironment ? 2 : 1);
