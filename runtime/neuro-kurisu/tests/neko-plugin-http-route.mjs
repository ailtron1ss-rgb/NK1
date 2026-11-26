import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createFileBackedPluginMessageIngress,
} from '../src/organism/integration/neko/PluginMessageIngressHost.ts';
import { parseNekoPluginCredentials } from '../src/server/neko-plugin-transport-auth.mjs';
import {
  handleNekoPluginPushHttpRequest,
  NEKO_PLUGIN_PUSH_HTTP_LIMITS,
} from '../src/server/neko-plugin-http-route.mjs';

const directory = await mkdtemp(path.join(os.tmpdir(), 'nk-neko-http-route-'));
const receiptFilePath = path.join(directory, 'neko-http-receipts.json');
const token = 'NK1-http-route-test-secret-'.padEnd(48, 'R');
const credentials = parseNekoPluginCredentials(JSON.stringify({ notes: token }));
let cognitionCalls = 0;

const makeIngress = () => createFileBackedPluginMessageIngress({
  receiptFilePath,
  allowedPlugins: ['notes'],
  authorize: async context => context.aiBehavior === 'read' && context.visibility.length === 0,
  runtime: {
    step: async (text, options) => {
      cognitionCalls += 1;
      assert.equal(options.externalGoalPolicy, 'evidence-only');
      assert.equal(options.spontaneous, false);
      assert.equal(options.suppressResponse, true);
      return { accepted: true, textBytes: Buffer.byteLength(text) };
    },
  },
});

const envelope = (messageId, text = 'Observe this bounded external note as evidence.') => ({
  identity: { pluginId: 'notes', messageId },
  payload: {
    type: 'MESSAGE_PUSH',
    schema: 'push_message.v2',
    plugin_id: 'notes',
    message_id: messageId,
    time: 1_799_000_000,
    visibility: [],
    ai_behavior: 'read',
    parts: [{ type: 'text', text }],
    target_lanlan: null,
  },
});

let ingress;
let ready = true;
let activeCredentials = credentials;
const server = createServer((req, res) => {
  void handleNekoPluginPushHttpRequest(req, {
    credentials: activeCredentials,
    ingress,
    ready,
    maxBodyBytes: 1024,
  }).then(result => {
    res.writeHead(result.status, {
      'content-type': 'application/json; charset=utf-8',
      ...result.headers,
    });
    res.end(JSON.stringify(result.body));
  }).catch(() => {
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'test-http-handler-failed' }));
  });
});

const listen = async () => {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return `http://127.0.0.1:${address.port}`;
};

const request = (base, pathName, body, headers = {}, method = 'POST') =>
  fetch(base + pathName, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-neko-plugin-id': 'notes',
      'x-neko-plugin-token': token,
      ...headers,
    },
    ...(body === undefined ? {} : { body }),
  });

const expectJson = async (response, status) => {
  assert.equal(response.status, status);
  return response.json();
};

try {
  assert.deepEqual(NEKO_PLUGIN_PUSH_HTTP_LIMITS, {
    defaultMaxBodyBytes: 65_536,
    maxConfigurableBodyBytes: 1_048_576,
  });

  ingress = await makeIngress();
  const base = await listen();
  const firstEnvelope = envelope('http-message-0001');
  const first = await request(base, '/api/neko/messages/push', JSON.stringify(firstEnvelope));
  const firstBody = await expectJson(first, 200);
  assert.equal(firstBody.accepted, true);
  assert.equal(firstBody.cognitiveProcessed, true);
  assert.equal(firstBody.replayed, false);
  assert.equal(cognitionCalls, 1,
    'a real HTTP POST must reach the runtime through the host-owned durable ingress');

  const duplicate = await request(base, '/api/neko/messages/push', JSON.stringify(firstEnvelope));
  const duplicateBody = await expectJson(duplicate, 200);
  assert.equal(duplicateBody.replayed, true);
  assert.equal(cognitionCalls, 1,
    'same-identity HTTP retries must replay the durable result without repeating cognition');

  // Replace the ingress with a newly restored instance, as on a process restart.
  ingress = await makeIngress();
  const afterRestart = await request(base, '/api/neko/messages/push', JSON.stringify(firstEnvelope));
  const restartBody = await expectJson(afterRestart, 200);
  assert.equal(restartBody.replayed, true);
  assert.equal(cognitionCalls, 1,
    'a restarted HTTP host must recover the receipt before admitting another cognitive side effect');

  const conflict = await request(base, '/api/neko/messages/push',
    JSON.stringify(envelope('http-message-0001', 'Different content under the same identity.')));
  const conflictBody = await expectJson(conflict, 409);
  assert.equal(conflictBody.errorCode, 'message-id-conflict');
  assert.equal(cognitionCalls, 1);

  const deniedToken = await request(base, '/api/neko/messages/push', JSON.stringify(envelope('http-denied-1')),
    { 'x-neko-plugin-token': 'wrong-secret'.padEnd(token.length, 'x') });
  assert.equal((await expectJson(deniedToken, 401)).error, 'neko-plugin-auth-denied');

  const mismatchedIdentity = envelope('http-identity-1');
  mismatchedIdentity.payload.plugin_id = 'calendar';
  const identityDenied = await request(base, '/api/neko/messages/push', JSON.stringify(mismatchedIdentity));
  assert.equal((await expectJson(identityDenied, 401)).error, 'neko-plugin-auth-denied');

  const respond = envelope('http-respond-1');
  respond.payload.ai_behavior = 'respond';
  assert.equal((await expectJson(
    await request(base, '/api/neko/messages/push', JSON.stringify(respond)), 409,
  )).error, 'neko-plugin-presentation-transport-not-configured');

  const visible = envelope('http-visible-1');
  visible.payload.visibility = ['chat'];
  assert.equal((await expectJson(
    await request(base, '/api/neko/messages/push', JSON.stringify(visible)), 409,
  )).error, 'neko-plugin-presentation-transport-not-configured');
  assert.equal(cognitionCalls, 1,
    'unauthorized, conflicting and presentation-capability requests must not reach cognition');

  const invalidJson = await request(base, '/api/neko/messages/push', '{"identity":');
  assert.equal((await expectJson(invalidJson, 400)).error, 'invalid-json');

  const invalidUtf8 = await request(base, '/api/neko/messages/push', Buffer.from([0xff, 0xfe, 0xfd]));
  assert.equal((await expectJson(invalidUtf8, 400)).error, 'request-body-not-utf8');

  const wrongMediaType = await request(base, '/api/neko/messages/push', JSON.stringify(envelope('http-media-1')),
    { 'content-type': 'text/plain' });
  assert.equal((await expectJson(wrongMediaType, 415)).error, 'application-json-required');

  const tooLarge = await request(base, '/api/neko/messages/push',
    JSON.stringify(envelope('http-large-1', 'x'.repeat(2_000))));
  assert.equal((await expectJson(tooLarge, 413)).error, 'request-too-large');

  const notReady = await request(base, '/api/neko/messages/push', JSON.stringify(envelope('http-not-ready-1')));
  ready = false;
  const unavailable = await expectJson(notReady, 200);
  assert.equal(unavailable.accepted, true);
  // The request above was deliberately sent before the readiness flip.
  const blockedWhileNotReady = await request(base, '/api/neko/messages/push',
    JSON.stringify(envelope('http-not-ready-2')));
  assert.equal((await expectJson(blockedWhileNotReady, 503)).error, 'organism-runtime-not-ready');
  ready = true;

  const wrongMethod = await request(base, '/api/neko/messages/push', undefined, {}, 'GET');
  const wrongMethodBody = await expectJson(wrongMethod, 405);
  assert.equal(wrongMethodBody.error, 'method-not-allowed');
  assert.equal(wrongMethod.headers.get('allow'), 'POST');

  const wrongPath = await request(base, '/api/neko/messages/unknown', '{}');
  assert.equal((await expectJson(wrongPath, 404)).error, 'neko-plugin-route-not-found');

  activeCredentials = new Map();
  const disabled = await request(base, '/api/neko/messages/push', JSON.stringify(envelope('http-disabled-1')));
  assert.equal((await expectJson(disabled, 503)).error, 'neko-plugin-transport-not-configured');
  activeCredentials = credentials;

  const originalIngress = ingress;
  ingress = { handle: async () => { throw new Error('private-internal-detail'); } };
  const ingressFailure = await request(base, '/api/neko/messages/push', JSON.stringify(envelope('http-ingress-failure-1')));
  assert.equal((await expectJson(ingressFailure, 503)).error, 'neko-plugin-ingress-unavailable');
  ingress = originalIngress;

  assert.throws(() => handleNekoPluginPushHttpRequest(
    { method: 'POST', url: '/api/neko/messages/push', headers: {} },
    { credentials, ingress, maxBodyBytes: 512 },
  ), /neko-plugin-http-body-limit-invalid/);

  console.log('NEKO_PLUGIN_REAL_HTTP_ROUTE=PASS cases=19');
} finally {
  await new Promise(resolve => server.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
}
