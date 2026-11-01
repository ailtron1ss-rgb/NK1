import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = await mkdtemp(path.join(tmpdir(), 'neurocore-usermodel-http-'));
const deadlineAt = Date.now() + 120_000;
const token = 'nk1-usermodel-http-test-token';
const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', resolve);
});
const address = probe.address();
assert.ok(address && typeof address === 'object');
const port = address.port;
await new Promise(resolve => probe.close(resolve));

const child = spawn(process.execPath, ['--experimental-strip-types', 'src/server/server.mjs'], {
  cwd: runtimeRoot,
  env: {
    ...process.env,
    HOST: '0.0.0.0',
    PORT: String(port),
    STATE_DIR: stateDir,
    NEURO_API_TOKEN: token,
    NK_MEM0_ENABLED: '0',
    LLM_TIMEOUT_MS: '5000',
    NEURO_REQUEST_TIMEOUT_MS: '20000',
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
    if (childExit) throw new Error(`server exited before readiness: ${JSON.stringify(childExit)} ${output}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.json()).ready === true) return;
    } catch { /* server is still starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`server startup timed out: ${output}`);
}
async function post(payload, authorization = true) {
  const headers = { 'content-type': 'application/json' };
  if (authorization) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`http://127.0.0.1:${port}/api/organism/user-model/preferences`, {
    method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
  });
  return { response, body: await response.json() };
}
try {
  await waitReady();

  const unauthenticated = await post({ action: 'record', value: 'concise', confirmed: true }, false);
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(unauthenticated.body.reason, 'missing-bearer-token');

  const unconfirmed = await post({ action: 'record', value: 'concise', confirmed: false });
  assert.equal(unconfirmed.response.status, 400);
  assert.equal(unconfirmed.body.error, 'explicit-user-confirmation-required');

  const untrustedStyle = await post({ action: 'record', value: 'constructor', confirmed: true });
  assert.equal(untrustedStyle.response.status, 400);
  assert.equal(untrustedStyle.body.error, 'unsupported-response-style');

  const recorded = await post({
    action: 'record', value: 'concise', confirmed: true,
    evidenceRef: 'client-forged-reference', sensitivity: 'low-risk', key: 'arbitrary.prompt',
  });
  assert.equal(recorded.response.status, 200, JSON.stringify(recorded.body));
  assert.equal(recorded.body.preference.status, 'confirmed');
  assert.equal(recorded.body.preference.value, 'concise');
  assert.equal(recorded.body.preference.key, 'response.style');
  assert.equal(Object.hasOwn(recorded.body.preference, 'evidenceRef'), false);

  const conflict = await post({ action: 'record', value: 'detailed', confirmed: true });
  assert.equal(conflict.response.status, 200);
  assert.equal(conflict.body.preference.status, 'disputed');
  assert.equal(conflict.body.preference.value, 'concise');
  assert.equal(conflict.body.requestedValue, 'detailed');

  const corrected = await post({ action: 'correct', value: 'balanced', confirmed: true });
  assert.equal(corrected.response.status, 200);
  assert.equal(corrected.body.preference.status, 'confirmed');
  assert.equal(corrected.body.preference.value, 'balanced');

  console.log('USER_MODEL_HTTP_ROUTE=PASS', JSON.stringify({
    unauthenticated: unauthenticated.response.status,
    unconfirmed: unconfirmed.response.status,
    invalidStyle: untrustedStyle.response.status,
    record: recorded.body.preference.status,
    contradiction: conflict.body.preference.status,
    correction: corrected.body.preference.status,
    clientEvidenceIgnored: true,
  }));
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  if (child.exitCode === null && child.signalCode === null) {
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 2000))]);
  }
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  await rm(stateDir, { recursive: true, force: true });
}
