import assert from 'node:assert/strict';
import { LocalEmbeddingProvider } from '../src/organism/developmental/LocalEmbeddingProvider.ts';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { memoContentHash } from '../src/organism/developmental/MemoInspiredMemoryPrimitives.ts';

const provider = new LocalEmbeddingProvider({
  kind: 'ollama', model: 'test-embed', baseUrl: 'http://127.0.0.1:11434', batchSize: 8,
  fetchImpl: async (url, init) => {
    assert.equal(String(url), 'http://127.0.0.1:11434/api/embed');
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'test-embed');
    return new Response(JSON.stringify({ embeddings: body.input.map(text => text.includes('second') ? [0, 3, 4] : [3, 4, 0]) }), { status: 200, headers: { 'content-type': 'application/json' } });
  },
});
const first = await provider.embedBatch(['first document', 'second document']);
assert.equal(first.length, 2);
assert.ok(Math.abs(Math.sqrt(first[0].reduce((sum, value) => sum + value * value, 0)) - 1) < 1e-8, 'vectors must be normalized');
const cacheBefore = provider.diagnostics().cacheHits;
await provider.embedBatch(['first document']);
assert.ok(provider.diagnostics().cacheHits > cacheBefore, 'identical text should use the bounded embedding cache');
assert.equal(provider.diagnostics().requests, 1, 'cache hit must not issue a new HTTP request');

const openAI = new LocalEmbeddingProvider({
  kind: 'openai-compatible', baseUrl: 'http://127.0.0.1:8080/v1', model: 'fixture',
  fetchImpl: async (url, init) => {
    assert.equal(String(url), 'http://127.0.0.1:8080/v1/embeddings');
    const body = JSON.parse(init.body);
    return new Response(JSON.stringify({ data: body.input.map((_, index) => ({ index: body.input.length - index - 1, embedding: [index + 1, 1] })) }), { status: 200, headers: { 'content-type': 'application/json' } });
  },
});
const ordered = await openAI.embedBatch(['a', 'b']);
assert.equal(ordered.length, 2, 'OpenAI-compatible output must preserve input ordering');
assert.ok(ordered[0][0] > ordered[1][0], 'rows must be sorted by provider index before return');
assert.throws(() => new LocalEmbeddingProvider({ kind: 'ollama', baseUrl: 'https://example.com' }), /Remote embedding endpoint blocked/);

class SemanticFixtureProvider {
  providerId = 'fixture:concept-v1';
  modelId = 'concept-v1';
  async embedBatch(texts) {
    return texts.map(raw => {
      const text = String(raw).toLocaleLowerCase();
      if (/authenticate|sign.in|login|credential recovery|account access/.test(text)) return [1, 0, 0];
      if (/network|socket|database|routing/.test(text)) return [0, 1, 0];
      return [0, 0, 1];
    });
  }
  diagnostics() { return { configured: true, provider: 'ollama', model: this.modelId, endpoint: 'http://127.0.0.1:11434/api/embed', cacheEntries: 0, cacheHits: 0, cacheMisses: 0, requests: 1, failures: 0, lastError: null, lastLatencyMs: 3 }; }
}
const now = Date.now();
const memory = new MemoryOS2({ embeddingProvider: new SemanticFixtureProvider() });
const add = (id, content, createdAt = now) => memory.encode({
  id, content, kind: 'semantic', source: 'semantic-embedding-workpass33', tags: [], context: {},
  salience: .55, emotionalWeight: .1, identityRelevance: .1, goalRelevance: .1,
  socialRelevance: .1, predictionError: .1, confidence: .9, epistemicStatus: 'fact', entities: [],
  semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [], validFromAt: createdAt - 1000,
  observedAt: createdAt - 500, createdAt,
});
add('credential-recovery', 'Login credential recovery restores account access when authentication is lost.');
add('network-decoy', 'Network socket routing and database endpoint configuration for server maintenance.');
add('general-decoy', 'The avatar palette uses a blue background and compact interface controls.');
const before = memory.snapshot();
let lexicalPreviewCalls = 0;
const originalPreviewRetrieve = memory.previewRetrieve.bind(memory);
memory.previewRetrieve = (...args) => {
  lexicalPreviewCalls++;
  return originalPreviewRetrieve(...args);
};
const result = await memory.previewRetrieveWithEmbeddings('I cannot authenticate to my user profile', 3, 0, 0, { temporalMode: 'current', asOfAt: now });
assert.equal(lexicalPreviewCalls, 1, 'semantic retrieval should reuse one isolated lexical preview for candidates and fallback');
assert.equal(result.semantic.enabled, true);
assert.equal(result.items[0]?.id, 'credential-recovery', 'semantic search should retrieve a conceptually related row despite low lexical overlap');
assert.ok(result.semantic.indexedItems >= 3);
const maintenance = memory.semanticEmbeddingMaintenanceDiagnostics();
assert.equal(maintenance.corpusItems, 3, 'maintenance diagnostics should count only eligible current memories');
assert.equal(maintenance.indexedItems, 3, 'diagnostics should count each current provider-bound embedding');
assert.equal(maintenance.remaining, 0);
assert.equal(maintenance.waitingForRetry, 0);
assert.equal(maintenance.nextRetryAt, null);
assert.deepEqual(memory.snapshot(), before, 'semantic inspector retrieval must not mutate canonical memory state');

// Expired hashes/provider changes must not inflate semantic cache coverage or persist
// as unusable rows when the bounded backfill budget only refreshes one item.
memory.semanticEmbeddingIndex.set('network-decoy', { contentHash: 'stale-hash', providerId: 'fixture:concept-v1', vector: [0, 1, 0], lastUsedAt: now });
memory.semanticEmbeddingIndex.set('general-decoy', { contentHash: 'stale-hash', providerId: 'fixture:concept-v1', vector: [0, 0, 1], lastUsedAt: now });
await memory.previewRetrieveWithEmbeddings('I cannot authenticate to my user profile', 3, 0, 0, { temporalMode: 'current', asOfAt: now }, { maxIndexItems: 1 });
const currentRowsForCache = new Map(memory.snapshot().items.map(item => [item.id, item]));
const staleCacheIds = [...memory.semanticEmbeddingIndex].filter(([id, row]) => {
  const item = currentRowsForCache.get(id);
  return !item || row.contentHash !== memoContentHash(item.content) || row.providerId !== 'fixture:concept-v1';
}).map(([id]) => id);
assert.deepEqual(staleCacheIds, [], 'semantic cache maintenance must prune stale content-hash entries even when only one row can be reindexed');

class FailingProvider extends SemanticFixtureProvider {
  providerId = 'fixture:offline';
  modelId = 'offline';
  async embedBatch() { throw new Error('local-model-offline'); }
}
const offline = new MemoryOS2({ embeddingProvider: new FailingProvider() });
offline.restore(before);
const fallback = await offline.previewRetrieveWithEmbeddings('credential recovery account access', 3, 0, 0, { temporalMode: 'current', asOfAt: now });
assert.equal(fallback.semantic.enabled, false);
assert.match(fallback.semantic.fallbackReason, /local-model-offline/);
assert.ok(Array.isArray(fallback.items), 'provider failures should return deterministic hybrid fallback results');

const wideRows = [
  ...before.items.map(row => structuredClone(row)),
  ...Array.from({ length: 10 }, (_, index) => {
    const row = structuredClone(before.items[0]);
    const createdAt = now - (index + 10) * 1_000;
    return {
      ...row,
      id: 'wide-fallback-' + index,
      content: 'Fallback fixture record ' + index + ' stores generic retained context for response recovery.',
      contentHash: undefined,
      createdAt,
      lastAccessAt: createdAt,
      observedAt: createdAt,
      validFromAt: createdAt,
      validUntilAt: null,
      supersedesId: null,
      supersededById: null,
      revisionGroupId: 'wide-fallback-' + index,
      revisionSequence: 1,
      dormant: false,
      epistemicStatus: 'fact',
      semanticVector: [],
    };
  }),
];
const wideFallback = new MemoryOS2({ embeddingProvider: new FailingProvider() });
wideFallback.restore({ ...before, items: wideRows });
const wideFallbackResult = await wideFallback.previewRetrieveWithEmbeddings(
  'credential recovery account access',
  32,
  0,
  0,
  { temporalMode: 'current', asOfAt: now },
  { maxLexicalPool: 8 },
);
assert.equal(wideFallbackResult.semantic.enabled, false);
assert.equal(wideFallbackResult.items.length, wideRows.length, 'an eight-row semantic candidate pool must not truncate a larger fallback response');

const diagnosticNow = Date.now();
const ignoredRows = [
  { id: 'ignored-dormant', dormant: true },
  { id: 'ignored-quarantined', epistemicStatus: 'quarantined' },
  { id: 'ignored-expired', validUntilAt: diagnosticNow - 1 },
  { id: 'ignored-future', validFromAt: diagnosticNow + 60_000 },
].map(({ id, ...overrides }) => ({
  ...structuredClone(before.items[0]),
  id, content: `non-corpus diagnostic row: ${id}`,
  createdAt: diagnosticNow - 10_000, lastAccessAt: diagnosticNow - 10_000,
  validFromAt: diagnosticNow - 5_000, validUntilAt: null,
  dormant: false, epistemicStatus: 'fact', semanticVector: [],
  ...overrides,
}));
const retryMemory = new MemoryOS2({ embeddingProvider: new FailingProvider() });
retryMemory.restore({ ...before, items: [...before.items.map(row => structuredClone(row)), ...ignoredRows] });
const retryResult = await retryMemory.maintainSemanticIndexBatch({ now: diagnosticNow, maxItems: 16 });
assert.equal(retryResult.corpusItems, 3, 'dormant, quarantined, expired, and future memories must be excluded');
assert.equal(retryResult.considered, 3);
assert.equal(retryResult.failed, 3, 'a failed batch should mark each selected row for backoff');
assert.equal(retryResult.waitingForRetry, 3);
assert.equal(retryResult.nextRetryAt, diagnosticNow + 3_000, 'first retry backoff should remain three seconds');
const retryDiagnostics = retryMemory.semanticEmbeddingMaintenanceDiagnostics();
assert.equal(retryDiagnostics.corpusItems, 3);
assert.equal(retryDiagnostics.indexedItems, 0);
assert.equal(retryDiagnostics.remaining, 3);
assert.equal(retryDiagnostics.waitingForRetry, 3);
assert.equal(retryDiagnostics.nextRetryAt, diagnosticNow + 3_000);

let racingMemory;
class MutatingDuringEmbeddingProvider extends SemanticFixtureProvider {
  providerId = 'fixture:mutating';
  modelId = 'mutating';
  async embedBatch(texts) {
    const vectors = await super.embedBatch(texts);
    racingMemory.reviseContent('race-target', 'Changed content during embedding', { reason: 'race-test-revision' });
    return vectors;
  }
}
racingMemory = new MemoryOS2({ embeddingProvider: new MutatingDuringEmbeddingProvider() });
racingMemory.encode({
  ...structuredClone(before.items[0]),
  id: 'race-target',
  content: 'Login credential recovery restores account access when authentication is lost.',
  createdAt: Date.now() - 10_000,
  lastAccessAt: Date.now() - 10_000,
  validFromAt: Date.now() - 5_000,
  validUntilAt: null,
  supersedesId: null,
  supersededById: null,
  revisionGroupId: 'race-target',
  revisionSequence: 1,
  dormant: false,
  epistemicStatus: 'fact',
  semanticVector: [],
}, { forceDistinct: true });
racingMemory.semanticEmbeddingIndex.set('race-target', {
  contentHash: memoContentHash('Login credential recovery restores account access when authentication is lost.'),
  providerId: 'fixture:mutating',
  vector: [1, 0, 0],
  lastUsedAt: Date.now(),
});
const raceResult = await racingMemory.previewRetrieveWithEmbeddings('login credential recovery', 3, 0, 0, { temporalMode: 'current' });
assert.equal(raceResult.semantic.newlyIndexed, 0, 'a vector must not be attached after its source memory is revised during the provider await');
assert.equal(racingMemory.semanticEmbeddingIndex.has('race-target'), false, 'stale source vectors must not enter the semantic index');
assert.ok(!raceResult.items.some(row => row.id === 'race-target'), 'the superseded source row must not be returned after the asynchronous revision');

console.log('MEMORY_SEMANTIC_EMBEDDINGS_WORKPASS33=PASS', JSON.stringify({ providerCache: provider.diagnostics(), semantic: result.semantic, top: result.items[0]?.id, fallback: fallback.semantic.fallbackReason, maintenance: { corpusItems: retryResult.corpusItems, considered: retryResult.considered, waitingForRetry: retryResult.waitingForRetry, nextRetryAt: retryResult.nextRetryAt }, staleWritePrevented: raceResult.semantic.newlyIndexed === 0 && !racingMemory.semanticEmbeddingIndex.has('race-target') }));
