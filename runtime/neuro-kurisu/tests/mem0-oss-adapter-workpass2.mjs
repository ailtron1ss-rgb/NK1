import test from 'node:test';
import assert from 'node:assert/strict';
import { Mem0PlatformAdapter } from '../src/organism/integration/mem0/Mem0PlatformAdapter.ts';

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('self-hosted Mem0 OSS uses native REST paths, X-API-Key, and preserves scoped write/delete gates', async () => {
  const memoryId = '123e4567-e89b-42d3-a456-426614174000';
  const calls = [];
  const adapter = new Mem0PlatformAdapter({
    enabled: true,
    mode: 'oss',
    apiKey: 'm0sk-test-key-never-log',
    userId: 'nk1-oss-test-user',
    baseUrl: 'http://localhost:8888',
    allowWrites: true,
    fetchImpl: async (input, init = {}) => {
      const url = new URL(input);
      const headers = init.headers ?? {};
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ url, method: init.method ?? 'GET', headers, body, redirect: init.redirect });
      if (url.pathname === '/search' && init.method === 'POST') {
        return jsonResponse({ results: [{ id: memoryId, user_id: 'nk1-oss-test-user', memory: 'Local-first recall note', score: 0.82 }] });
      }
      if (url.pathname === '/memories' && init.method === 'POST') {
        return jsonResponse({ results: [{ id: memoryId, user_id: 'nk1-oss-test-user' }] });
      }
      if (url.pathname === `/memories/${memoryId}` && init.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      return jsonResponse({ error: 'unexpected route' }, 500);
    },
  });

  assert.equal(adapter.diagnostics().provider, 'mem0-oss');
  assert.equal(adapter.diagnostics().available, true);

  const search = await adapter.search('local-first memory', 2);
  assert.equal(search.status, 'ok');
  assert.equal(search.memories.length, 1);
  assert.equal(search.memories[0].source, 'mem0-oss');
  assert.equal(search.memories[0].epistemicStatus, 'external-unverified');
  assert.equal(search.memories[0].instructionTreatment, 'data-not-instructions');
  assert.equal(calls[0].url.pathname, '/search');
  assert.equal(calls[0].headers['X-API-Key'], 'm0sk-test-key-never-log');
  assert.deepEqual(calls[0].body, { query: 'local-first memory', user_id: 'nk1-oss-test-user' });
  assert.equal(Object.hasOwn(calls[0].body, 'filters'), false, 'self-hosted REST uses its own top-level user_id request shape');
  assert.equal(Object.hasOwn(calls[0].body, 'limit'), false, 'NK1 enforces the result cap locally for this REST endpoint');
  assert.equal(calls[0].redirect, 'error');

  const added = await adapter.addConversation([{ role: 'user', content: 'I prefer a self-hosted memory service.' }], { approved: true });
  assert.equal(added.status, 'ok');
  assert.deepEqual(added.memoryIds, [memoryId]);
  assert.equal(calls[1].url.pathname, '/memories');
  assert.equal(calls[1].method, 'POST');
  assert.equal(calls[1].headers['X-API-Key'], 'm0sk-test-key-never-log');
  assert.equal(calls[1].body.user_id, 'nk1-oss-test-user');
  assert.equal(calls[1].body.messages[0].content, 'I prefer a self-hosted memory service.');

  const deleted = await adapter.deleteMemory(memoryId, { approved: true });
  assert.equal(deleted.status, 'ok');
  assert.equal(deleted.deleted, true);
  assert.equal(calls[2].url.pathname, `/memories/${memoryId}`);
  assert.equal(calls[2].method, 'DELETE');
  assert.equal(calls[2].headers['X-API-Key'], 'm0sk-test-key-never-log');
  assert.ok(calls.every(call => !call.url.pathname.startsWith('/v1/') && !call.url.pathname.startsWith('/v3/')));
});

test('self-hosted OSS plain HTTP to a non-loopback host is blocked without a separate opt-in', async () => {
  let networkCalls = 0;
  const adapter = new Mem0PlatformAdapter({
    enabled: true,
    mode: 'oss',
    apiKey: 'test-key',
    userId: 'nk1-oss-test-user',
    baseUrl: 'http://192.0.2.10:8888',
    fetchImpl: async () => { networkCalls++; return jsonResponse({ results: [] }); },
  });
  const result = await adapter.search('safe local query');
  assert.equal(result.status, 'unconfigured');
  assert.equal(adapter.diagnostics().available, false);
  assert.equal(networkCalls, 0);
});

console.log('Mem0 OSS adapter workpass 2: PASS');
