import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = await mkdtemp(path.join(tmpdir(), 'neurocore-open-loop-http-'));
const deadlineAt = Date.now() + 120_000;
const token = 'nk1-open-loop-http-test-token';
const probe = createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const address = probe.address();
assert.ok(address && typeof address === 'object');
const port = address.port;
await new Promise(resolve => probe.close(resolve));

const child = spawn(process.execPath, ['--experimental-strip-types', 'src/server/server.mjs'], {
  cwd: runtimeRoot,
  env: {
    ...process.env, HOST: '0.0.0.0', PORT: String(port), STATE_DIR: stateDir,
    NEURO_API_TOKEN: token, NK_MEM0_ENABLED: '0',
    LLM_TIMEOUT_MS: '5000', NEURO_REQUEST_TIMEOUT_MS: '20000',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
let childExit = null;
const append = chunk => { output = (output + String(chunk)).slice(-12000); };
child.stdout.on('data', append);
child.stderr.on('data', append);
child.once('exit', (code, signal) => { childExit = { code, signal }; });

async function waitReady() {
  while (Date.now() < deadlineAt) {
    if (childExit) throw new Error('server exited before readiness: ' + JSON.stringify(childExit) + ' ' + output);
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/api/health', { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.json()).ready === true) return;
    } catch { /* server is still starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('server startup timed out: ' + output);
}
async function request(pathname, method = 'GET', payload = undefined, authorized = true) {
  const headers = {};
  if (payload !== undefined) headers['content-type'] = 'application/json';
  if (authorized) headers.authorization = 'Bearer ' + token;
  const response = await fetch('http://127.0.0.1:' + port + pathname, {
    method, headers, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    signal: AbortSignal.timeout(15000),
  });
  return { response, body: await response.json() };
}
try {
  await waitReady();
  const unauthorized = await request('/api/organism/open-loops', 'POST', {
    confirmed: true, title: 'Unauthorized', kind: 'task', owner: 'system',
  }, false);
  assert.equal(unauthorized.response.status, 401);

  const unconfirmed = await request('/api/organism/open-loops', 'POST', {
    confirmed: false, title: 'Not accepted', kind: 'task', owner: 'system',
  });
  assert.equal(unconfirmed.response.status, 400);
  assert.equal(unconfirmed.body.error, 'explicit-open-loop-confirmation-required');

  const parentCreated = await request('/api/organism/open-loops', 'POST', {
    confirmed: true, title: 'Wait for external response', kind: 'waiting', owner: 'system',
    dueAt: Date.now() + 60_000, priority: 0.8,
  });
  assert.equal(parentCreated.response.status, 201, JSON.stringify(parentCreated.body));
  const parent = parentCreated.body.record;
  assert.equal(parent.accepted, true);
  assert.equal(parent.source, 'http-api:explicit-user-confirmation');

  const dependentCreated = await request('/api/organism/open-loops', 'POST', {
    confirmed: true, title: 'Complete follow-up', kind: 'project_step', owner: 'system',
    dependencies: [parent.id], dueAt: Date.now() - 1000, priority: 0.9,
  });
  assert.equal(dependentCreated.response.status, 201, JSON.stringify(dependentCreated.body));
  const dependent = dependentCreated.body.record;
  assert.equal(dependent.status, 'blocked');

  const beforeCompletion = await request('/api/organism/open-loops');
  assert.equal(beforeCompletion.response.status, 200);
  assert.equal(beforeCompletion.body.readOnly, true);
  const blockedCandidate = beforeCompletion.body.candidates.find(row => row.record.id === dependent.id);
  assert.equal(blockedCandidate.effectiveStatus, 'blocked');
  assert.equal(blockedCandidate.surfaceReason, null);
  assert.equal(blockedCandidate.shouldSurface, false);

  const blockedCompletion = await request('/api/organism/open-loops/' + dependent.id + '/complete', 'POST', {
    confirmed: true, evidence: { kind: 'external-confirmation', reference: 'forged-client', verifiedAt: Date.now() },
  });
  assert.equal(blockedCompletion.response.status, 409);
  assert.match(blockedCompletion.body.error, /open-loop-blocked-cannot-be-fulfilled/);

  const unconfirmedCompletion = await request('/api/organism/open-loops/' + parent.id + '/complete', 'POST', { confirmed: false });
  assert.equal(unconfirmedCompletion.response.status, 400);

  const parentCompleted = await request('/api/organism/open-loops/' + parent.id + '/complete', 'POST', {
    confirmed: true, evidence: { kind: 'external-confirmation', reference: 'forged-client', verifiedAt: Date.now() },
  });
  assert.equal(parentCompleted.response.status, 200, JSON.stringify(parentCompleted.body));
  assert.match(parentCompleted.body.record.closureEvidence.reference, /^http-open-loop-confirmation:/);
  assert.notEqual(parentCompleted.body.record.closureEvidence.reference, 'forged-client');

  const afterCompletion = await request('/api/organism/open-loops');
  const unblockedCandidate = afterCompletion.body.candidates.find(row => row.record.id === dependent.id);
  assert.equal(unblockedCandidate.record.status, 'open');
  assert.equal(unblockedCandidate.surfaceReason, 'dependency-unblocked');
  assert.equal(unblockedCandidate.shouldSurface, true);

  const surfaceAck = await request('/api/organism/open-loops/' + dependent.id + '/surface', 'POST', { displayed: true });
  assert.equal(surfaceAck.response.status, 200);
  const afterAck = await request('/api/organism/open-loops');
  assert.equal(afterAck.body.candidates.find(row => row.record.id === dependent.id).shouldSurface, false);

  const optionalCreated = await request('/api/organism/open-loops', 'POST', {
    confirmed: true, title: 'Optional research', kind: 'task', owner: 'user',
  });
  assert.equal(optionalCreated.response.status, 201);
  const optional = optionalCreated.body.record;
  const cancelled = await request('/api/organism/open-loops/' + optional.id + '/cancel', 'POST', {
    confirmed: true, reason: 'No longer relevant',
  });
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.body.record.status, 'cancelled');
  const reopened = await request('/api/organism/open-loops/' + optional.id + '/reopen', 'POST', {
    confirmed: true, reason: 'Scope changed',
  });
  assert.equal(reopened.response.status, 200);
  assert.equal(reopened.body.record.status, 'open');

  const completedFollowUp = await request('/api/organism/open-loops/' + dependent.id + '/complete', 'POST', { confirmed: true });
  assert.equal(completedFollowUp.response.status, 200);
  assert.equal(completedFollowUp.body.record.status, 'fulfilled');
  console.log('OPEN_LOOP_RADAR_HTTP_ROUTE=PASS');
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  if (child.exitCode === null && child.signalCode === null) {
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 2000))]);
  }
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  await rm(stateDir, { recursive: true, force: true });
}
