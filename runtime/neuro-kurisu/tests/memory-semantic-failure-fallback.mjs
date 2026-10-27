import assert from 'node:assert/strict';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';

const originalEnv = {
  enabled: process.env.NK_EMBEDDINGS_RUNTIME_ENABLED,
  budget: process.env.NK_EMBEDDINGS_RUNTIME_BUDGET_MS,
};
process.env.NK_EMBEDDINGS_RUNTIME_ENABLED = '1';
process.env.NK_EMBEDDINGS_RUNTIME_BUDGET_MS = '50';

const fallback = [{ id: 'lexical-fallback', content: 'locally available memory' }];
const semanticResult = {
  items: [{ id: 'semantic-candidate', content: 'semantic result' }],
  semantic: { enabled: true, fallbackReason: null },
};

function makeFabric(providerWork) {
  const fabric = Object.create(MemoryFabric.prototype);
  fabric.lastCognitiveMemoryQueryAt = 0;
  fabric.cognitionSemanticInFlight = null;
  fabric.semanticMaintenanceInFlight = null;
  fabric.memoryOS = {
    embeddingConfigured: () => true,
    previewRetrieveWithEmbeddings: providerWork,
  };
  fabric.retrieve = () => fallback;
  // This regression isolates fallback/control flow; outcome accounting has its own behavioral test.
  fabric.recordRetrievalOutcome = () => {};
  return fabric;
}

try {
  // Rejected provider promises must not reject the organism's foreground cognition.
  const rejected = makeFabric(() => Promise.reject(new Error('provider unavailable')));
  assert.deepEqual(await rejected.retrieveForCognition('what happened?'), fallback);
  assert.equal(rejected.cognitionSemanticInFlight, null,
    'a failed provider attempt must clear its in-flight marker');

  // A synchronous throw from an adapter must use the same fallback path.
  const synchronousThrow = makeFabric(() => { throw new Error('adapter misconfigured'); });
  assert.deepEqual(await synchronousThrow.retrieveForCognition('what happened?'), fallback);
  assert.equal(synchronousThrow.cognitionSemanticInFlight, null,
    'a synchronous adapter throw must clear its in-flight marker');

  // A slow provider must not hold up the cycle beyond the configured foreground budget.
  let resolveProvider;
  const pending = new Promise(resolve => { resolveProvider = resolve; });
  const slow = makeFabric(() => pending);
  const started = Date.now();
  assert.deepEqual(await slow.retrieveForCognition('what happened?'), fallback);
  assert.ok(Date.now() - started < 1500, 'foreground recall must honor the bounded fallback budget');
  assert.ok(slow.cognitionSemanticInFlight,
    'the bounded background operation remains tracked until its provider work settles');
  const trackedInFlight = slow.cognitionSemanticInFlight;
  resolveProvider(semanticResult);
  await trackedInFlight;
  assert.equal(slow.cognitionSemanticInFlight, null,
    'settled late provider work must clear its in-flight marker');

  console.log('MEMORY_SEMANTIC_FAILURE_FALLBACK=PASS', JSON.stringify({
    rejectedProvider: true,
    synchronousAdapterThrow: true,
    boundedSlowProvider: true,
    lexicalFallbackPreserved: true,
  }));
} finally {
  if (originalEnv.enabled === undefined) delete process.env.NK_EMBEDDINGS_RUNTIME_ENABLED;
  else process.env.NK_EMBEDDINGS_RUNTIME_ENABLED = originalEnv.enabled;
  if (originalEnv.budget === undefined) delete process.env.NK_EMBEDDINGS_RUNTIME_BUDGET_MS;
  else process.env.NK_EMBEDDINGS_RUNTIME_BUDGET_MS = originalEnv.budget;
}
