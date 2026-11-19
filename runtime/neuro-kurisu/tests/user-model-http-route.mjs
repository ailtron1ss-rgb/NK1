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
async function dyadicRequest(method, payload, authorization = true, idempotencyKey) {
  const headers = {};
  if (payload !== undefined) headers['content-type'] = 'application/json';
  if (authorization) headers.authorization = `Bearer ${token}`;
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  const response = await fetch(`http://127.0.0.1:${port}/api/organism/dyadic-collaboration`, {
    method, headers,
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  return { response, body: await response.json() };
}

try {
  await waitReady();

  const unauthenticated = await post({ action: 'record', value: 'concise', confirmed: true }, false);
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(unauthenticated.body.reason, 'missing-bearer-token');

  const invalidBody = await post(null);
  assert.equal(invalidBody.response.status, 400);
  assert.equal(invalidBody.body.error, 'request-body-must-be-object');

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

  const forgotten = await post({ action: 'forget', confirmed: true });
  assert.equal(forgotten.response.status, 200);
  assert.equal(forgotten.body.action, 'forget');
  assert.equal(forgotten.body.forgotten, true);
  assert.equal(forgotten.body.preference.present, false);

  const reestablished = await post({ action: 'record', value: 'concise', confirmed: true });
  assert.equal(reestablished.response.status, 200);
  assert.equal(reestablished.body.preference.status, 'confirmed');

  const dyadicUnauthenticated = await dyadicRequest('GET', undefined, false);
  assert.equal(dyadicUnauthenticated.response.status, 401);
  assert.equal(dyadicUnauthenticated.body.reason, 'missing-bearer-token');

  const dyadicInvalidBody = await dyadicRequest('POST', null);
  assert.equal(dyadicInvalidBody.response.status, 400);
  assert.equal(dyadicInvalidBody.body.error, 'request-body-must-be-object');

  const dyadicUnconfirmed = await dyadicRequest('POST', {
    action: 'record', kind: 'task', title: 'Do not save without confirmation', confirmed: false,
  });
  assert.equal(dyadicUnconfirmed.response.status, 400);
  assert.equal(dyadicUnconfirmed.body.error, 'explicit-user-confirmation-required');

  const dyadicBefore = await dyadicRequest('GET');
  assert.equal(dyadicBefore.response.status, 200, JSON.stringify(dyadicBefore.body));

  const dyadicRecordPayload = {
    action: 'record', kind: 'task', title: 'Coordinate the shared release plan',
    detail: 'Collect the agreed validation and release evidence.',
    confirmed: true,
    // Host must derive actor, provenance, sensitivity and tick itself.
    actor: 'system', sourceRef: 'client-forged-source', evidenceRef: 'client-forged-evidence',
    sensitivity: 'sensitive', tick: -10,
  };
  const dyadicIdempotencyKey = 'dyadic-http-record-retry-1';
  const dyadicRecorded = await dyadicRequest('POST', dyadicRecordPayload, true, dyadicIdempotencyKey);
  assert.equal(dyadicRecorded.response.status, 201, JSON.stringify(dyadicRecorded.body));
  assert.equal(dyadicRecorded.body.item.author, 'human');
  assert.equal(dyadicRecorded.body.item.status, 'accepted');
  assert.equal(dyadicRecorded.body.item.kind, 'task');
  assert.equal(dyadicRecorded.body.item.progress, 'not-started');
  assert.equal(Object.hasOwn(dyadicRecorded.body.item, 'sourceRef'), false);
  assert.equal(Object.hasOwn(dyadicRecorded.body.item, 'lastEvidenceRef'), false);
  assert.equal(Object.hasOwn(dyadicRecorded.body.item, 'evidenceRef'), false);
  const dyadicItemId = dyadicRecorded.body.item.id;
  const dyadicReplay = await dyadicRequest('POST', dyadicRecordPayload, true, dyadicIdempotencyKey);
  assert.equal(dyadicReplay.response.status, 200, JSON.stringify(dyadicReplay.body));
  assert.equal(dyadicReplay.body.replayed, true);
  assert.equal(dyadicReplay.body.item.id, dyadicItemId);

  const dyadicIdempotencyConflict = await dyadicRequest('POST', {
    ...dyadicRecordPayload, title: 'Conflicting payload under the same key',
  }, true, dyadicIdempotencyKey);
  assert.equal(dyadicIdempotencyConflict.response.status, 409);
  assert.equal(dyadicIdempotencyConflict.body.error, 'idempotency-key-conflict');

  const concurrentPayload = {
    action: 'record', kind: 'goal', title: 'One concurrent shared goal only',
    confirmed: true,
  };
  const concurrentKey = 'dyadic-http-concurrent-retry-1';
  const concurrentResults = await Promise.all([
    dyadicRequest('POST', concurrentPayload, true, concurrentKey),
    dyadicRequest('POST', concurrentPayload, true, concurrentKey),
  ]);
  assert.deepEqual(concurrentResults.map(result => result.response.status).sort(), [200, 201]);
  assert.equal(concurrentResults.filter(result => result.body.replayed === true).length, 1);
  assert.equal(concurrentResults[0].body.item.id, concurrentResults[1].body.item.id);

  const conflictingKey = 'dyadic-http-concurrent-conflict-1';
  const conflictingResults = await Promise.all([
    dyadicRequest('POST', {
      action: 'record', kind: 'goal', title: 'First concurrent payload wins', confirmed: true,
    }, true, conflictingKey),
    dyadicRequest('POST', {
      action: 'record', kind: 'goal', title: 'Second concurrent payload conflicts', confirmed: true,
    }, true, conflictingKey),
  ]);
  assert.deepEqual(conflictingResults.map(result => result.response.status).sort(), [201, 409]);
  assert.equal(conflictingResults.filter(result => result.body.error === 'idempotency-key-conflict').length, 1);

  const dyadicCorrected = await dyadicRequest('POST', {
    action: 'correct', itemId: dyadicItemId,
    title: 'Coordinate the agreed shared release plan',
    confirmed: true, actor: 'system', evidenceRef: 'forged-correction-ref',
  });
  assert.equal(dyadicCorrected.response.status, 200, JSON.stringify(dyadicCorrected.body));
  assert.equal(dyadicCorrected.body.item.title, 'Coordinate the agreed shared release plan');
  assert.equal(dyadicCorrected.body.item.updatedBy, 'human');

  const dyadicCompleted = await dyadicRequest('POST', {
    action: 'progress', itemId: dyadicItemId, progress: 'completed', confirmed: true,
  });
  assert.equal(dyadicCompleted.response.status, 200, JSON.stringify(dyadicCompleted.body));
  assert.equal(dyadicCompleted.body.item.progress, 'completed');

  const dyadicSensitive = await dyadicRequest('POST', {
    action: 'record', kind: 'decision', title: 'API token = sk-ABCDEFGHIJKLMNOPQRSTUVWX',
    confirmed: true,
  });
  assert.equal(dyadicSensitive.response.status, 400);
  assert.equal(dyadicSensitive.body.error, 'sensitive-content');

  const dyadicAfter = await dyadicRequest('GET');
  assert.equal(dyadicAfter.response.status, 200);
  assert.equal(dyadicAfter.body.items.some(item =>
    item.id === dyadicItemId &&
    item.title === 'Coordinate the agreed shared release plan' &&
    item.progress === 'completed'), true);
  assert.equal(Object.hasOwn(dyadicAfter.body.items.find(item => item.id === dyadicItemId), 'sourceRef'), false);
  console.log('DYADIC_HTTP_ROUTE=PASS', JSON.stringify({
    unauthenticated: dyadicUnauthenticated.response.status,
    confirmationRequired: dyadicUnconfirmed.response.status,
    record: dyadicRecorded.response.status,
    replay: dyadicReplay.response.status,
    replayed: dyadicReplay.body.replayed,
    conflictingKey: dyadicIdempotencyConflict.response.status,
    correction: dyadicCorrected.response.status,
    completion: dyadicCompleted.response.status,
    sensitiveRejected: dyadicSensitive.response.status,
    redactedReadback: true,
  }));

  console.log('USER_MODEL_HTTP_ROUTE=PASS', JSON.stringify({
    unauthenticated: unauthenticated.response.status,
    unconfirmed: unconfirmed.response.status,
    invalidStyle: untrustedStyle.response.status,
    record: recorded.body.preference.status,
    contradiction: conflict.body.preference.status,
    correction: corrected.body.preference.status,
    forget: forgotten.body.forgotten,
    reestablish: reestablished.body.preference.status,
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
