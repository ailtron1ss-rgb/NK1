import assert from 'node:assert/strict';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const originalEnabled = process.env.NK_EMBEDDINGS_RUNTIME_ENABLED;
const originalBudget = process.env.NK_EMBEDDINGS_RUNTIME_BUDGET_MS;
process.env.NK_EMBEDDINGS_RUNTIME_ENABLED = '1';
process.env.NK_EMBEDDINGS_RUNTIME_BUDGET_MS = '100';

function makeFabric({ lexicalRows, semanticRows = [], providerWork }) {
  const seen = { policy: [], unified: [], touched: [], events: [], canonicalReads: [], liveReads: [] };
  const fabric = Object.create(MemoryFabric.prototype);
  fabric.lastCognitiveMemoryQueryAt = 0;
  fabric.cognitionSemanticInFlight = null;
  fabric.semanticMaintenanceInFlight = null;
  fabric.statsData = { retrievals: 0, retrievalHits: 0 };
  const rowsById = new Map([...lexicalRows, ...semanticRows].map(row => [row.id, row]));
  fabric.memoryOS = {
    recordSelectedRetrieval: (query, ids) => {
      seen.canonicalReads.push({ query, ids: [...ids] });
      return ids.map(id => rowsById.get(id)).filter(Boolean);
    },
    embeddingConfigured: () => true,
    previewRetrieveWithEmbeddings: providerWork,
    adaptivePolicyDiagnostics: () => ({ lastPolicy: 'test-policy', lastContextKey: 'test-context' }),
    retrievalDiagnostics: () => ({ candidateCount: 12 }),
  };
  // The fallback is a read-only preview. A live lexical retrieval before the
  // semantic selector picks its result would mutate canonical access counters.
  fabric.previewRetrieve = () => lexicalRows;
  fabric.retrieve = (query) => { seen.liveReads.push({ query }); return lexicalRows; };
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
    semanticRows,
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
  assert.deepEqual(successful.seen.canonicalReads, [{ query: 'remember this', ids: ['semantic-1'] }],
    'only the chosen semantic IDs are committed to canonical memory access history');
  assert.deepEqual(successful.seen.liveReads, [],
    'semantic success must not run a speculative live lexical retrieval');
  assert.deepEqual(successful.seen.touched, ['semantic-1'],
    'provisional lexical candidates must not be promoted to hot memory');
  assert.equal(successful.seen.events.length, 1);
  assert.match(JSON.stringify(successful.seen.events[0]), /semantic-cognitive-retrieval/);

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
  assert.deepEqual(fallback.seen.liveReads, [{ query: 'remember this' }],
    'provider failure must perform exactly one live lexical retrieval after fallback is selected');
  assert.deepEqual(fallback.seen.canonicalReads, [],
    'the selected lexical fallback is already accounted by canonical MemoryOS2.retrieve');
  assert.deepEqual(fallback.seen.touched, ['lexical-1', 'lexical-2']);

  // Verify the canonical MemoryOS2 owns exactly-once retrieval access signals:
  // a preview is side-effect-free, and committing selected IDs increments those
  // signals once for the result that actually enters the cognitive context.
  const canonical = new MemoryOS2({ embeddingProvider: null });
  canonical.encode({
    id: 'canonical-accounting-target',
    content: 'continuity sentinel confirms canonical retrieval accounting',
    kind: 'semantic',
    source: 'accounting-fixture',
    tags: ['accounting'],
    context: { fixture: 'selected-retrieval' },
    salience: .7,
    emotionalWeight: .1,
    identityRelevance: .3,
    goalRelevance: .2,
    socialRelevance: .1,
    predictionError: .1,
    confidence: .8,
    epistemicStatus: 'fact',
    entities: [],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
    contradictionLinks: [],
    validFromAt: Date.now() - 1000,
    observedAt: Date.now() - 500,
    provenanceClass: 'device',
    sourceAuthority01: .9,
  });
  const initial = canonical.snapshot();
  const candidates = canonical.previewRetrieve('continuity sentinel', 4);
  const afterPreview = canonical.snapshot();
  assert.equal(afterPreview.semanticQueries, initial.semanticQueries,
    'isolated preview must not increment the canonical query counter');
  assert.equal(afterPreview.items[0].retrievalCount, initial.items[0].retrievalCount,
    'isolated preview must not advance canonical memory access counts');
  const committed = canonical.recordSelectedRetrieval('continuity sentinel', candidates.map(row => row.id));
  const afterCommit = canonical.snapshot();
  assert.equal(afterCommit.semanticQueries, initial.semanticQueries + 1,
    'selected retrieval commits one canonical query observation');
  assert.ok(committed.some(row => row.id === 'canonical-accounting-target'));
  const committedItem = afterCommit.items.find(row => row.id === 'canonical-accounting-target');
  assert.equal(committedItem.retrievalCount, 1,
    'selected canonical memory receives one access increment, not one per speculative path');
  assert.equal(canonical.retrievalDiagnostics().candidateCount, candidates.length,
    'adaptive compute-cost accounting must not reuse the previous query candidate count');

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
