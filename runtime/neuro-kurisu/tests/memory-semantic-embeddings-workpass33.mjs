import assert from 'node:assert/strict';
import { LocalEmbeddingProvider } from '../src/organism/developmental/LocalEmbeddingProvider.ts';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

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
const result = await memory.previewRetrieveWithEmbeddings('I cannot authenticate to my user profile', 3, 0, 0, { temporalMode: 'current', asOfAt: now });
assert.equal(result.semantic.enabled, true);
assert.equal(result.items[0]?.id, 'credential-recovery', 'semantic search should retrieve a conceptually related row despite low lexical overlap');
assert.ok(result.semantic.indexedItems >= 3);
assert.deepEqual(memory.snapshot(), before, 'semantic inspector retrieval must not mutate canonical memory state');

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

class InvalidMemoryVectorProvider extends SemanticFixtureProvider {
  providerId = 'fixture:invalid-memory-vector';
  modelId = 'invalid-memory-vector';
  async embedBatch(texts) {
    return texts.map((raw, index) => {
      if (index === 0) return [1, 0, 0];
      if (/credential recovery/i.test(String(raw))) return [Number.NaN, 0, 0];
      return [0, 1, 0];
    });
  }
}
const invalidMemory = new MemoryOS2({ embeddingProvider: new InvalidMemoryVectorProvider() });
invalidMemory.restore(before);
const invalidMemoryFallback = await invalidMemory.previewRetrieveWithEmbeddings(
  'credential recovery account access', 3, 0, 0, { temporalMode: 'current', asOfAt: now },
);
assert.equal(invalidMemoryFallback.semantic.enabled, false,
  'a malformed corpus vector must fail closed into deterministic lexical retrieval');
assert.match(invalidMemoryFallback.semantic.fallbackReason, /invalid-memory-embedding-vector/);
assert.ok(invalidMemoryFallback.items.some(item => item.id === 'credential-recovery'),
  'malformed semantic vectors must not hide a lexical match from the fallback');
assert.equal(invalidMemoryFallback.semantic.indexedItems, 0,
  'the failed batch must not partially publish vectors into the derived semantic index');
assert.deepEqual(invalidMemory.snapshot(), before,
  'invalid provider vectors and fallback retrieval must not mutate canonical memory state');

class ZeroQueryVectorProvider extends SemanticFixtureProvider {
  providerId = 'fixture:zero-query-vector';
  modelId = 'zero-query-vector';
  async embedBatch(texts) {
    return texts.map((_, index) => index === 0 ? [0, 0, 0] : [1, 0, 0]);
  }
}
const zeroQueryMemory = new MemoryOS2({ embeddingProvider: new ZeroQueryVectorProvider() });
zeroQueryMemory.restore(before);
const zeroQueryFallback = await zeroQueryMemory.previewRetrieveWithEmbeddings(
  'credential recovery account access', 3, 0, 0, { temporalMode: 'current', asOfAt: now },
);
assert.equal(zeroQueryFallback.semantic.enabled, false, 'zero-norm query embeddings must be rejected');
assert.match(zeroQueryFallback.semantic.fallbackReason, /invalid-query-embedding-vector/);
assert.ok(zeroQueryFallback.items.some(item => item.id === 'credential-recovery'),
  'a zero query vector must retain the deterministic lexical fallback');

const racedSnapshot = structuredClone(before);
const revisedCredential = racedSnapshot.items.find(item => item.id === 'credential-recovery');
assert.ok(revisedCredential, 'race fixture must contain the original credential memory');
const revisedContent = 'Corrected credential recovery and account access troubleshooting facts.';
revisedCredential.content = revisedContent;
revisedCredential.contentHash = '';
revisedCredential.semanticVector = [];
let racedMemory;
let postRestoreSnapshot;
class RestoreDuringEmbeddingProvider extends SemanticFixtureProvider {
  providerId = 'fixture:restore-during-embedding';
  modelId = 'restore-during-embedding';
  async embedBatch(texts) {
    const vectors = texts.map(() => [1, 0, 0]);
    racedMemory.restore(structuredClone(racedSnapshot));
    postRestoreSnapshot = racedMemory.snapshot();
    return vectors;
  }
}
racedMemory = new MemoryOS2({ embeddingProvider: new RestoreDuringEmbeddingProvider() });
racedMemory.restore(before);
const raceResult = await racedMemory.previewRetrieveWithEmbeddings(
  'credential recovery account access', 3, 0, 0, { temporalMode: 'current', asOfAt: now },
);
assert.equal(raceResult.semantic.enabled, false,
  'an embedding request racing with snapshot restore must discard its stale semantic result');
assert.match(raceResult.semantic.fallbackReason, /memory-corpus-changed-during-embedding/);
assert.equal(raceResult.items.find(item => item.id === 'credential-recovery')?.content, revisedContent,
  'the fallback must retrieve from the newly restored canonical corpus, not the stale pre-await copy');
assert.deepEqual(racedMemory.snapshot(), postRestoreSnapshot,
  'stale in-flight embedding completion must not mutate restored canonical memory');



console.log('MEMORY_SEMANTIC_EMBEDDINGS_WORKPASS33=PASS', JSON.stringify({ providerCache: provider.diagnostics(), semantic: result.semantic, top: result.items[0]?.id, fallback: fallback.semantic.fallbackReason, invalidMemoryFallback: invalidMemoryFallback.semantic.fallbackReason, zeroQueryFallback: zeroQueryFallback.semantic.fallbackReason, raceFallback: raceResult.semantic.fallbackReason }));
