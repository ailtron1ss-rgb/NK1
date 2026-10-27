import assert from 'node:assert/strict';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';

const originalEnabled = process.env.NK_EMBEDDINGS_RUNTIME_ENABLED;
const originalBudget = process.env.NK_EMBEDDINGS_RUNTIME_BUDGET_MS;
process.env.NK_EMBEDDINGS_RUNTIME_ENABLED = '1';
process.env.NK_EMBEDDINGS_RUNTIME_BUDGET_MS = '100';

function makeFabric({ lexicalRows, providerWork }) {
  const seen = { policy: [], unified: [], touched: [], events: [] };
  const fabric = Object.create(MemoryFabric.prototype);
  fabric.lastCognitiveMemoryQueryAt = 0;
  fabric.cognitionSemanticInFlight = null;
  fabric.semanticMaintenanceInFlight = null;
  fabric.statsData = { retrievals: 0, retrievalHits: 0 };
  fabric.memoryOS = {
    retrieve: () => lexicalRows,
    embeddingConfigured: () => true,
    previewRetrieveWithEmbeddings: providerWork,
    adaptivePolicyDiagnostics: () => ({ lastPolicy: 'test-policy', lastContextKey: 'test-context' }),
    retrievalDiagnostics: () => ({ candidateCount: 12 }),
  };
  fabric.policyOutcomeLedger = {
    register: item => { seen.policy.push(item); return { id: 'decision-' + seen.policy.length }; },
  };
  fabric.unifiedMemory = { recordRetrieval: (query, hits) => seen.unified.push({ query, hits }) };
  fabric.events = { append: event => seen.events.push(event) };
  fabric.touchHot = id => seen.touched.push(id);
  return { fabric, seen };
}

const lexicalRows = [{ id: 'lexical-1' }, { id: 'lexical-2' }];
const semanticRows = [{ id: 'semantic-1' }];

try {
  const successful = makeFabric({
    lexicalRows,
    providerWork: () => Promise.resolve({
      items: semanticRows,
      semantic: { enabled: true, fallbackReason: null },
    }),
  });
  const chosen = await successful.fabric.retrieveForCognition('remember this', 8, 0, 0, { tick: 9 });
  assert.deepEqual(chosen, semanticRows);
  assert.equal(successful.fabric.statsData.retrievals, 1,
    'semantic success must increment retrieval count exactly once');
  assert.equal(successful.fabric.statsData.retrievalHits, 1,
    'retrieval-hit metrics must describe selected semantic rows, not provisional lexical rows');
  assert.equal(successful.seen.policy.length, 1,
    'one cognitive query must not register both lexical and semantic outcome credit');
  assert.deepEqual(successful.seen.policy[0].memoryIds, ['semantic-1']);
  assert.deepEqual(successful.seen.unified, [{ query: 'remember this', hits: 1 }]);
  assert.deepEqual(successful.seen.touched, ['semantic-1'],
    'provisional lexical candidates must not be promoted to hot memory');
  assert.equal(successful.seen.events.length, 1);
  assert.equal(successful.seen.events[0].payload.evidenceMode, 'semantic-cognitive-retrieval');

  const fallback = makeFabric({
    lexicalRows,
    providerWork: () => Promise.reject(new Error('embedding provider offline')),
  });
  const returnedFallback = await fallback.fabric.retrieveForCognition('remember this');
  assert.deepEqual(returnedFallback, lexicalRows);
  assert.equal(fallback.fabric.statsData.retrievals, 1,
    'provider failure must count the chosen lexical fallback once');
  assert.equal(fallback.fabric.statsData.retrievalHits, lexicalRows.length);
  assert.equal(fallback.seen.policy.length, 1,
    'provider failure must not register a provisional result and a second fallback result');
  assert.deepEqual(fallback.seen.policy[0].memoryIds, ['lexical-1', 'lexical-2']);
  assert.deepEqual(fallback.seen.unified, [{ query: 'remember this', hits: 2 }]);
  assert.deepEqual(fallback.seen.touched, ['lexical-1', 'lexical-2']);

  console.log('MEMORY_SEMANTIC_RETRIEVAL_ACCOUNTING=PASS', JSON.stringify({
    semanticAccountingExactlyOnce: true,
    fallbackAccountingExactlyOnce: true,
    provisionalRowsDoNotAffectHotMemory: true,
  }));
} finally {
  if (originalEnabled === undefined) delete process.env.NK_EMBEDDINGS_RUNTIME_ENABLED;
  else process.env.NK_EMBEDDINGS_RUNTIME_ENABLED = originalEnabled;
  if (originalBudget === undefined) delete process.env.NK_EMBEDDINGS_RUNTIME_BUDGET_MS;
  else process.env.NK_EMBEDDINGS_RUNTIME_BUDGET_MS = originalBudget;
}
