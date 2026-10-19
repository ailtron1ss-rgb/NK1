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

function record(label, ok, detail = '') { results.push({ label, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`); }

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
  const nc = await runApprovedProbe('neurocore');
  record('research:neurocore-probe-after-approval', nc.res.ok && Boolean(nc.data?.ok) && nc.data?.status === 'pass', `delta=${nc.data?.delta ?? '—'}`);
  const nm = await runApprovedProbe('nomega-registry');
  record('research:nomega-registry-after-approval', nm.res.ok && Boolean(nm.data?.ok) && nm.data?.status === 'pass', `modules=${nm.data?.total_modules ?? '—'} cycles=${nm.data?.cycles ?? '—'}`);
  const dc = await runApprovedProbe('deepcode');
  record('research:deepcode-probe-after-approval', dc.res.ok && Boolean(dc.data?.ok) && dc.data?.status === 'pass', `smoke=${dc.data?.result?.smoke ?? '—'} learn_steps=${dc.data?.result?.learn_steps ?? '—'}`);
} catch (error) {
  record('runtime/bridge:http', false, String(error));
} finally {
  runtime?.kill('SIGTERM'); bridge?.kill('SIGTERM');
}

for (const [label, command, args] of [
  ['ui:typecheck', 'npm', ['--prefix', 'app', 'run', 'typecheck']],
  ['runtime:typecheck', 'npm', ['--prefix', 'runtime/neuro-kurisu', 'run', 'typecheck']],
]) {
  const r = await run(label, command, args);
  record(label, r.code === 0, (r.err || r.out).trim().split('\n').slice(-3).join(' | '));
}

const environmentBlocked = !existsSync(resolve(ROOT, 'app/node_modules'));
const summary = { ok: results.every(r => r.ok), environmentBlocked, results, generatedAt: new Date().toISOString() };
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.ok ? 0 : 1;
