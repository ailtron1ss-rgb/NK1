import assert from 'node:assert/strict';
import test from 'node:test';
import { LocalCrossEncoderReranker } from '../src/organism/developmental/LocalCrossEncoderReranker.ts';
import { previewMemoryCrossEncoderShadow } from '../src/organism/developmental/MemoryCrossEncoderShadowPreview.ts';

const response = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'content-type': 'application/json' },
});

test('cross-encoder is disabled unless explicitly opted in', () => {
  assert.equal(LocalCrossEncoderReranker.fromEnvironment({}), undefined);
  assert.equal(LocalCrossEncoderReranker.fromEnvironment({ NK_MEMORY_RERANKER_ENABLED: '0' }), undefined);
  assert.equal(LocalCrossEncoderReranker.fromEnvironment({
    NK_MEMORY_RERANKER_ENABLED: '1',
    NK_MEMORY_RERANKER_BASE_URL: 'https://reranker.example.test',
  }), undefined);
});

test('only loopback llama.cpp endpoints are accepted', () => {
  assert.throws(() => new LocalCrossEncoderReranker({ baseUrl: 'https://example.com' }), /remote-endpoint-forbidden/);
  assert.throws(() => new LocalCrossEncoderReranker({ baseUrl: 'http://user:pass@127.0.0.1:8080' }), /credentials-forbidden/);
  assert.throws(() => new LocalCrossEncoderReranker({ baseUrl: 'http://127.0.0.1:8080?token=secret' }), /query-or-fragment-forbidden/);
});

test('uses llama.cpp /rerank and orders finite scores without changing source indices', async () => {
  let request;
  const adapter = new LocalCrossEncoderReranker({
    baseUrl: 'http://127.0.0.1:8080/v1',
    model: 'bge-reranker-v2-m3',
    apiKey: 'local-secret',
    fetchImpl: async (url, init) => {
      request = { url: String(url), init, body: JSON.parse(String(init.body)) };
      return response({ results: [
        { index: 0, relevance_score: -0.4 },
        { index: 2, relevance_score: 0.9 },
        { index: 1, relevance_score: 0.3 },
      ] });
    },
  });
  const result = await adapter.rerank('which item explains memory retrieval?', ['lexical baseline', 'cross encoder result', 'relevant semantic memory']);
  assert.equal(result.ok, true);
  assert.deepEqual(result.results, [
    { index: 2, relevanceScore: 0.9 },
    { index: 1, relevanceScore: 0.3 },
    { index: 0, relevanceScore: -0.4 },
  ]);
  assert.equal(request.url, 'http://127.0.0.1:8080/v1/rerank');
  assert.equal(request.body.model, 'bge-reranker-v2-m3');
  assert.equal(request.body.top_n, 3);
  assert.deepEqual(request.body.documents, ['lexical baseline', 'cross encoder result', 'relevant semantic memory']);
  assert.equal(request.init.redirect, 'error');
  assert.equal(request.init.headers.authorization, 'Bearer local-secret');
  assert.equal(adapter.diagnostics().requests, 1);
});

test('redacts obvious secrets and direct contact identifiers before local request', async () => {
  let body;
  const adapter = new LocalCrossEncoderReranker({
    fetchImpl: async (_url, init) => {
      body = JSON.parse(String(init.body));
      return response({ results: [{ index: 0, relevance_score: 1 }] });
    },
  });
  const result = await adapter.rerank(
    'find email alex@example.com with Bearer sk-12345678901234567890',
    ['Call +1 (415) 555-1212 or email private@example.com'],
  );
  assert.equal(result.ok, true);
  assert.doesNotMatch(body.query, /alex@example\.com|sk-12345678901234567890/);
  assert.doesNotMatch(body.documents[0], /415.*555.*1212|private@example\.com/);
});

test('rejects malformed, duplicate and out-of-range response indices', async () => {
  for (const results of [
    [{ index: 0, relevance_score: 1 }, { index: 0, relevance_score: .5 }],
    [{ index: 2, relevance_score: 1 }, { index: 1, relevance_score: .5 }],
    [{ index: 0, relevance_score: Number.POSITIVE_INFINITY }, { index: 1, relevance_score: .5 }],
    [{ index: 0, relevance_score: 1 }],
  ]) {
    const adapter = new LocalCrossEncoderReranker({
      fetchImpl: async () => response({ results }),
    });
    const result = await adapter.rerank('query', ['one', 'two']);
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, 'invalid-response');
    assert.deepEqual(result.results, []);
  }
});

test('fails closed on unavailable server and input budget violations', async () => {
  const unavailable = new LocalCrossEncoderReranker({ fetchImpl: async () => response({}, 503) });
  assert.equal((await unavailable.rerank('query', ['one'])).errorCode, 'http-error');
  const bounded = new LocalCrossEncoderReranker({ maxTotalChars: 1024, fetchImpl: async () => response({ results: [] }) });
  assert.equal((await bounded.rerank('query', ['x'.repeat(1024)])).errorCode, 'input-budget-exceeded');
  assert.equal((await bounded.rerank('query', Array.from({ length: 33 }, () => 'doc'))).errorCode, 'invalid-input');
});

test('shadow preview reports comparison only and never alters canonical order', async () => {
  let seenDocuments;
  const core = {
    async memoryInspectorSearchSemantic(query, limit) {
      assert.equal(query, 'remember the local model decision');
      assert.equal(limit, 3);
      return { memories: [
        { id: 'memory-a', content: 'canonical rank one' },
        { id: 'memory-b', content: 'canonical rank two' },
        { id: 'memory-c', content: 'canonical rank three' },
      ], semantic: { source: 'MemoryOS2' } };
    },
  };
  const reranker = {
    diagnostics: () => ({ model: 'test-cross-encoder' }),
    async rerank(_query, docs) {
      seenDocuments = docs;
      return {
        enabled: true, ok: true, errorCode: null, model: 'test-cross-encoder', latencyMs: 2,
        results: [
          { index: 2, relevanceScore: .95 },
          { index: 0, relevanceScore: .2 },
          { index: 1, relevanceScore: .1 },
        ],
      };
    },
  };
  const report = await previewMemoryCrossEncoderShadow(core, reranker, 'remember the local model decision', 3);
  assert.deepEqual(seenDocuments, ['canonical rank one', 'canonical rank two', 'canonical rank three']);
  assert.deepEqual(report.canonicalIds, ['memory-a', 'memory-b', 'memory-c']);
  assert.deepEqual(report.shadowIds, ['memory-c', 'memory-a', 'memory-b']);
  assert.equal(report.comparison.overlapAtK, 2);
  assert.equal(report.comparison.jaccardAtK, 2 / 3);
  assert.equal(report.userFacingEligible, false);
});

test('disabled shadow preview never invokes canonical memory search', async () => {
  const core = { async memoryInspectorSearchSemantic() { throw new Error('must not run'); } };
  const report = await previewMemoryCrossEncoderShadow(core, undefined, 'query', 8);
  assert.equal(report.enabled, false);
  assert.equal(report.errorCode, 'disabled');
  assert.deepEqual(report.canonicalIds, []);
});
