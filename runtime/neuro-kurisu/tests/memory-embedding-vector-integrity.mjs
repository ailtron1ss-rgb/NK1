import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const now = Date.now();
const invalidMagnitude = Number.MAX_VALUE;
const diagnostics = () => ({
  configured: true,
  provider: 'ollama',
  model: 'test-invalid-vector',
  endpoint: 'http://127.0.0.1:11434',
  cacheEntries: 0,
  cacheHits: 0,
  cacheMisses: 0,
  requests: 1,
  failures: 0,
  lastError: null,
  lastLatencyMs: 1,
  redactedInputs: 0,
});
const item = id => ({
  id,
  content: 'remember the validated project memory retrieval invariant',
  kind: 'semantic',
  source: 'test-fixture',
  tags: ['memory', 'validation'],
  context: { area: 'test' },
  salience: .9,
  emotionalWeight: .1,
  identityRelevance: .2,
  goalRelevance: .3,
  socialRelevance: .1,
  predictionError: .1,
  confidence: .9,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: now - 1000,
  observedAt: now - 500,
  provenanceClass: 'external',
  sourceAuthority01: .9,
});

function makeProvider(mode) {
  return {
    providerId: `test-${mode}`,
    modelId: 'invalid-vector-fixture',
    diagnostics,
    async embedBatch(texts) {
      if (mode === 'invalid-query') {
        return texts.map((_, index) => index === 0 ? [invalidMagnitude, invalidMagnitude] : [1, 0]);
      }
      // Retrieval batches contain [query, ...candidate memories], while the
      // maintenance batch contains candidate memories only. Keep the query valid
      // for semantic retrieval but deliberately corrupt every memory vector.
      return texts.map((_, index) => texts.length > 1 && index === 0
        ? [1, 0]
        : [invalidMagnitude, invalidMagnitude]);
    },
  };
}

const candidateMemory = new MemoryOS2({ embeddingProvider: makeProvider('invalid-candidate') });
candidateMemory.encode(item('memory-invalid-candidate'));
const preview = await candidateMemory.previewRetrieveWithEmbeddings(
  'what is the validated project memory retrieval invariant?',
  5,
  0,
  0,
  { asOfAt: now },
  { maxIndexItems: 4, maxLexicalPool: 8, providerTimeoutMs: 500 },
);
assert.equal(preview.semantic.enabled, false,
  'a corpus with no valid semantic candidates must report fallback rather than an empty semantic success');
assert.equal(preview.semantic.fallbackReason, 'no-valid-semantic-candidates');
assert.ok(preview.items.some(row => row.id === 'memory-invalid-candidate'),
  'malformed candidate embeddings must not hide a retrievable lexical memory');
assert.equal(candidateMemory.semanticEmbeddingMaintenanceDiagnostics().indexedItems, 0,
  'malformed vectors must not enter the semantic index');

const maintenance = await candidateMemory.maintainSemanticIndexBatch({ maxItems: 1, providerTimeoutMs: 500, now });
assert.equal(maintenance.indexed, 0);
assert.equal(maintenance.failed, 1,
  'maintenance must reject finite-but-overflowing vectors instead of normalizing them to zero vectors');
assert.equal(maintenance.indexedItems, 0);

const queryMemory = new MemoryOS2({ embeddingProvider: makeProvider('invalid-query') });
queryMemory.encode(item('memory-query-fallback'));
const badQuery = await queryMemory.previewRetrieveWithEmbeddings(
  'what is the validated project memory retrieval invariant?',
  5,
  0,
  0,
  { asOfAt: now },
  { maxIndexItems: 4, maxLexicalPool: 8, providerTimeoutMs: 500 },
);
assert.equal(badQuery.semantic.enabled, false);
assert.equal(badQuery.semantic.fallbackReason, 'invalid-query-embedding-vector');
assert.ok(badQuery.items.some(row => row.id === 'memory-query-fallback'),
  'an invalid query vector must fall back to canonical lexical retrieval');

console.log('MEMORY_EMBEDDING_VECTOR_INTEGRITY=PASS', JSON.stringify({
  invalidQueryRejected: true,
  invalidCandidateSkipped: true,
  overflowNormalizationBlocked: true,
  lexicalFallbackPreserved: true,
}));
