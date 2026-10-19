import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port = 21957;
const statePath = '/tmp/nk157-server-state.json';
const child = spawn(
  process.execPath,
  ['--experimental-strip-types', 'src/server/server.mjs'],
  {
    env: { ...process.env, PORT: String(port), NEURO_STATE_PATH: statePath },
    stdio: ['ignore', 'pipe', 'pipe']
  }
);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function get(path) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  assert.equal(response.ok, true);
  return response.json();
}
async function post(path, payload) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  assert.equal(response.ok, true);
  return response.json();
}
async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/organism/operational-life`);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error('server-start-timeout');
}

try {
  await waitForServer();
  const base = await get('/api/organism/operational-life');
  assert.ok(base.operationalLife);

  const causal = await post('/api/organism/operational-life/causal-intervention', {
    target: 'server-test', control01: .4, treatment01: .62,
    confidence01: .8, independent01: .8, repetitions: 3
  });
  assert.equal(causal.ok, true);

  const dev = await post('/api/organism/operational-life/self-development', {
    hypothesis: 'holdout improves', intervention: 'bounded sandbox proposal',
    baseline01: .5, treatment01: .7, holdout01: .61, safety01: .95
  });
  assert.equal(dev.ok, true);

  for (let seed = 1; seed <= 3; seed++) {
    const replication = await post('/api/organism/operational-life/replication', {
      track: 'replication', seed, control01: .5, treatment01: .66,
      holdout01: .61, evaluator: 'server-smoke'
    });
    assert.equal(replication.ok, true);
  }

  const after = await get('/api/organism/operational-life');
  const counts = after.diagnostics?.counts;
  assert.ok(counts.causalInterventions >= 1);
  assert.ok(counts.selfDevelopmentTrials >= 1);
  assert.ok(counts.replications >= 3);
  assert.equal(after.audit.pass, true);

  console.log(`BIG_PASS_157_SERVER=PASS real-http=true postRoutes=true replications=${counts.replications}`);
} finally {
  child.kill('SIGTERM');
  await sleep(150);
}
