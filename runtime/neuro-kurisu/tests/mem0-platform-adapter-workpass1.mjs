import test from 'node:test';
import assert from 'node:assert/strict';
import { Mem0PlatformAdapter } from '../src/organism/integration/mem0/Mem0PlatformAdapter.ts';

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

test('Mem0 is disabled by default and does not make network calls', async () => {
  let calls = 0;
  const adapter = new Mem0PlatformAdapter({
    fetchImpl: async () => { calls++; return jsonResponse({ results: [] }); },
  });
  const result = await adapter.search('preference');
  assert.equal(result.status, 'disabled');
  assert.deepEqual(result.memories, []);
  assert.equal(calls, 0);
  assert.equal(adapter.diagnostics().available, false);
});

test('search scopes to the configured user, redacts sensitive content and labels hits as untrusted', async () => {
  let requestedUrl = '';
  let requestedHeaders;
  let requestedBody;
  const adapter = new Mem0PlatformAdapter({
    enabled: true,
    apiKey: 'do-not-log-this-key',
    userId: 'nk1-user-01',
    fetchImpl: async (input, init) => {
      requestedUrl = String(input);
      requestedHeaders = init?.headers;
      requestedBody = JSON.parse(String(init?.body));
      return jsonResponse({ results: [
        { id: 'mem-good', user_id: 'nk1-user-01', memory: 'Contact alice@example.com; api_key=very-secret-value-123456', score: 0.91, created_at: '2026-10-23T12:00:00Z' },
        { id: 'mem-cross-user', user_id: 'another-user', memory: 'must never appear in results', score: 0.99 },
      ] });
    },
  });

  const result = await adapter.search('contact preference', 50);
  assert.equal(result.status, 'ok');
  assert.equal(new URL(requestedUrl).pathname, '/v3/memories/search/');
  assert.equal(requestedHeaders.authorization, 'Token do-not-log-this-key');
  assert.deepEqual(requestedBody?.filters, { user_id: 'nk1-user-01' });
  assert.equal(requestedBody?.limit, 10);
  assert.equal(result.memories.length, 1);
  assert.equal(result.memories[0]?.id, 'mem-good');
  assert.match(result.memories[0]?.content ?? '', /\[redacted-email\]/);
  assert.match(result.memories[0]?.content ?? '', /api_key=\[redacted\]/i);
  assert.equal(result.memories[0]?.epistemicStatus, 'external-unverified');
  assert.equal(result.memories[0]?.instructionTreatment, 'data-not-instructions');
  assert.equal(result.memories[0]?.requiresVerification, true);
  assert.equal(result.memories[0]?.redacted, true);
  assert.equal(result.diagnostics.scopeRejected, 1);
  assert.equal(JSON.stringify(result).includes('do-not-log-this-key'), false);
});


test('search query is minimized before it leaves NK1', async () => {
  let sentQuery = '';
  const adapter = new Mem0PlatformAdapter({
    enabled: true,
    apiKey: 'test-key',
    userId: 'scope',
    fetchImpl: async (_input, init) => {
      sentQuery = String((JSON.parse(String(init?.body))).query ?? '');
      return jsonResponse({ results: [] });
    },
  });
  const result = await adapter.search('find alice@example.com');
  assert.equal(result.status, 'ok');
  assert.equal(sentQuery, 'find [redacted-email]');
});

test('approved write still fails closed when the write environment gate is absent', async () => {
  let calls = 0;
  const adapter = new Mem0PlatformAdapter({
    enabled: true,
    apiKey: 'test-key',
    userId: 'scope',
    allowWrites: false,
    fetchImpl: async () => { calls++; return jsonResponse({ results: [] }); },
  });
  const result = await adapter.addConversation([{ role: 'user', content: 'save this' }], { approved: true });
  assert.equal(result.status, 'writes-disabled');
  assert.equal(calls, 0);
});

test('missing user scope or an insecure endpoint fails closed before fetch', async () => {
  let calls = 0;
  const adapter = new Mem0PlatformAdapter({
    enabled: true,
    apiKey: 'test-key',
    userId: 'scope',
    baseUrl: 'http://mem0.example.test',
    fetchImpl: async () => { calls++; return jsonResponse({ results: [] }); },
  });
  const result = await adapter.search('query');
  assert.equal(result.status, 'unconfigured');
  assert.equal(calls, 0);
  assert.equal(result.diagnostics.available, false);
});

test('remote writes need both an environment gate and per-operation approval', async () => {
  let calls = 0;
  let payload;
  const adapter = new Mem0PlatformAdapter({
    enabled: true,
    apiKey: 'test-key',
    userId: 'scope',
    allowWrites: true,
    fetchImpl: async (_input, init) => {
      calls++;
      payload = JSON.parse(String(init?.body));
      return jsonResponse({ results: [{ id: 'mem-added' }] });
    },
  });

  const denied = await adapter.addConversation([{ role: 'user', content: 'remember this' }]);
  assert.equal(denied.status, 'consent-required');
  assert.equal(calls, 0);

  const accepted = await adapter.addConversation([
    { role: 'system', content: 'must not be exported' },
    { role: 'user', content: 'Reach me at bob@example.com; api_key=secret-value-123456789' },
    { role: 'assistant', content: 'I will only save this after explicit approval.' },
  ], { approved: true });
  assert.equal(accepted.status, 'ok');
  assert.deepEqual(accepted.memoryIds, ['mem-added']);
  assert.equal(calls, 1);
  const body = payload;
  assert.equal(body.user_id, 'scope');
  assert.deepEqual(body.messages?.map(row => row.role), ['user', 'assistant']);
  assert.match(body.messages?.[0]?.content ?? '', /\[redacted-email\]/);
  assert.match(body.messages?.[0]?.content ?? '', /api_key=\[redacted\]/i);
  assert.equal(JSON.stringify(payload).includes('secret-value-123456789'), false);
  assert.deepEqual(body.metadata, { app_id: 'nk1', source: 'neuro-kurisu' });
});

test('HTTP errors are summarized without exposing provider response bodies', async () => {
  const adapter = new Mem0PlatformAdapter({
    enabled: true,
    apiKey: 'test-key',
    userId: 'scope',
    fetchImpl: async () => new Response('provider-private-error-body', { status: 401 }),
  });
  const result = await adapter.search('query');
  assert.equal(result.status, 'error');
  assert.equal(result.errorCode, 'http-401');
  assert.equal(JSON.stringify(result).includes('provider-private-error-body'), false);
  assert.equal(result.diagnostics.failures, 1);
});

test('oversized Mem0 response is rejected with a bounded error', async () => {
  const adapter = new Mem0PlatformAdapter({
    enabled: true,
    apiKey: 'test-key',
    userId: 'scope',
    maxResponseBytes: 4096,
    fetchImpl: async () => jsonResponse({ results: [{ id: 'x', memory: 'x'.repeat(6000) }] }),
  });
  const result = await adapter.search('query');
  assert.equal(result.status, 'error');
  assert.equal(result.errorCode, 'response-too-large');
  assert.deepEqual(result.memories, []);
});
