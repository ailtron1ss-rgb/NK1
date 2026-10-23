import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';
import { EventLog } from '../src/organism/memory/EventSourcing.ts';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem } from '../src/organism/developmental/UnifiedMemorySystem.ts';
import { P62MemoryFabric } from '../src/organism/memory/P62MemoryFabric.ts';
import { SemanticMemoryGraph } from '../src/organism/memory/SemanticMemoryGraph.ts';

class DeterministicProvider {
  providerId = 'fixture:background-index-v1';
  modelId = 'background-index-v1';
  requests = 0;
  fail = false;
  async embedBatch(texts) {
    this.requests++;
    if (this.fail) throw new Error('local-model-offline');
    return texts.map(text => {
      const s = String(text).toLocaleLowerCase();
      return /kurisu|personality|любопыт|характер/.test(s) ? [1, 0, 0] : /memory|памят|goal|цель/.test(s) ? [0, 1, 0] : [0, 0, 1];
    });
  }
  diagnostics() { return { configured: true, provider: 'ollama', model: this.modelId, endpoint: 'local-fixture', cacheEntries: 0, cacheHits: 0, cacheMisses: 0, requests: this.requests, failures: this.fail ? 1 : 0, lastError: this.fail ? 'local-model-offline' : null, lastLatencyMs: 1 }; }
}
const now = Date.now();
const provider = new DeterministicProvider();
const memory = new MemoryOS2({ embeddingProvider: provider });
const add = (id, content, salience = .5) => memory.encode({
  id, content, kind: 'semantic', source: 'workpass55-background-index', tags: [], context: {}, salience,
  emotionalWeight: .1, identityRelevance: .2, goalRelevance: .2, socialRelevance: .1, predictionError: .1,
  confidence: .9, epistemicStatus: 'fact', entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [],
  contradictionLinks: [], validFromAt: now - 100, createdAt: now - 50,
});
add('memory-kurisu', 'Kurisu personality and curiosity shape which scientific topics she explores.', .9);
add('memory-goals', 'A memory of research goals helps the next planning cycle.', .6);
const canonicalBefore = memory.snapshot();
let maintenanceGetterReads = 0;
const hostileMaintenanceOptions = Object.defineProperty({}, 'now', {
  enumerable: true,
  get() { maintenanceGetterReads++; return now; },
});
await assert.rejects(
  () => memory.maintainSemanticIndexBatch(hostileMaintenanceOptions),
  /memory-index-maintenance-options-invalid/,
  'semantic-index maintenance must reject accessor-backed options before inspecting the provider',
);
assert.equal(maintenanceGetterReads, 0, 'maintenance input validation must never execute caller-owned getters');
assert.deepEqual(memory.snapshot(), canonicalBefore, 'rejected maintenance options must not mutate canonical memory');
assert.equal(provider.requests, 0, 'invalid maintenance options must not dispatch embedding work');
await assert.rejects(
  () => memory.maintainSemanticIndexBatch({ now, unexpected: true }),
  /memory-index-maintenance-options-invalid/,
  'unknown maintenance fields must not be silently accepted',
);
const first = await memory.maintainSemanticIndexBatch({ maxItems: 1, providerTimeoutMs: 1200, now });
assert.equal(first.enabled, true);
assert.equal(first.considered, 1);
assert.equal(first.indexed, 1);
assert.equal(first.remaining, 1);
assert.equal(first.failed, 0);
assert.deepEqual(memory.snapshot(), canonicalBefore, 'derived vectors must not mutate canonical memory facts');
const second = await memory.maintainSemanticIndexBatch({ maxItems: 1, providerTimeoutMs: 1200, now: now + 1 });
assert.equal(second.indexedItems, 2, 'a later maintenance step should incrementally finish the small corpus');
assert.equal(second.remaining, 0);
assert.equal(provider.requests, 2, 'one bounded provider batch is sent per maintenance step');

// Observability must never become a failure dependency: a custom/local provider
// may have a broken diagnostics hook while embedding itself continues to work.
const brokenDiagnosticsProvider = new DeterministicProvider();
brokenDiagnosticsProvider.diagnostics = () => { throw new Error('diagnostics adapter failure'); };
const diagnosticsMemory = new MemoryOS2({ embeddingProvider: brokenDiagnosticsProvider });
diagnosticsMemory.encode({
  id:'diagnostics-memory',content:'A failed optional diagnostics hook must not break canonical memory.',
  kind:'semantic',source:'diagnostics-failure-fixture',tags:[],context:{},salience:.7,
  emotionalWeight:.1,identityRelevance:.2,goalRelevance:.2,socialRelevance:.1,predictionError:.1,
  confidence:.9,epistemicStatus:'fact',entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[],
  contradictionLinks:[],validFromAt:now-100,createdAt:now-50,
});
const diagnosticsRecovery = await diagnosticsMemory.maintainSemanticIndexBatch({maxItems:1,now});
assert.equal(diagnosticsRecovery.indexed,1,'embedding can still succeed when diagnostics fail');
assert.equal(diagnosticsRecovery.lastErrorCode,'provider-diagnostics-error');
assert.equal(diagnosticsMemory.snapshot().items.length,1,'diagnostics failure must not alter canonical memories');
assert.equal(diagnosticsMemory.semanticEmbeddingMaintenanceDiagnostics().lastErrorCode,'provider-diagnostics-error',
  'read-only diagnostics should report the adapter fault without throwing');

const offlineProvider = new DeterministicProvider();
offlineProvider.fail = true;
const offline = new MemoryOS2({ embeddingProvider: offlineProvider });
addToOffline(offline);
const failure = await offline.maintainSemanticIndexBatch({ maxItems: 1, now });
assert.equal(failure.failed, 1);
assert.equal(failure.waitingForRetry, 1);
assert.equal(failure.lastErrorCode, 'provider-error');
const deferred = await offline.maintainSemanticIndexBatch({ maxItems: 1, now: now + 500 });
assert.equal(deferred.considered, 0, 'backoff prevents a hot-loop against a disconnected local model');
assert.equal(deferred.waitingForRetry, 1);

function addToOffline(target) {
  target.encode({ id: 'offline-memory', content: 'A bounded local semantic index can retry later without blocking lexical memory.', kind: 'semantic', source: 'workpass55-background-index', tags: [], context: {}, salience: .8, emotionalWeight: .1, identityRelevance: .2, goalRelevance: .2, socialRelevance: .1, predictionError: .1, confidence: .9, epistemicStatus: 'fact', entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [], validFromAt: now - 100, createdAt: now - 50 });
}

// Exercise the actual MemoryFabric maintenance owner and prove foreground recall falls back
// to lexical results rather than starting a competing provider request while indexing runs.
const priorFlag = process.env.NK_EMBEDDINGS_RUNTIME_ENABLED;
process.env.NK_EMBEDDINGS_RUNTIME_ENABLED = '1';
const slowProvider = new DeterministicProvider();
slowProvider.activeRequests = 0;
slowProvider.maxConcurrentRequests = 0;
let releaseBackgroundBatch;
let markBackgroundBatchStarted;
const backgroundBatchStarted = new Promise(resolve => { markBackgroundBatchStarted = resolve; });
const backgroundBatchGate = new Promise(resolve => { releaseBackgroundBatch = resolve; });
slowProvider.embedBatch = async (texts) => {
  slowProvider.requests++; slowProvider.activeRequests++;
  slowProvider.maxConcurrentRequests = Math.max(slowProvider.maxConcurrentRequests, slowProvider.activeRequests);
  markBackgroundBatchStarted();
  try { await backgroundBatchGate; return texts.map(() => [0, 1, 0]); }
  finally { slowProvider.activeRequests--; }
};
const fabricMemory = new MemoryOS2({ embeddingProvider: slowProvider });
const fabric = new MemoryFabric(fabricMemory, new EventLog(), new MultiTimescaleMemory(), new MemorySubstrateCoordinator(), new UnifiedMemorySystem(), new P62MemoryFabric(), new SemanticMemoryGraph());
fabric.encode({ id: 'fabric-background-memory', content: 'The memory about a scientific goal should be pre-indexed while the organism rests.', kind: 'semantic', source: 'workpass55-background-index', tags: [], context: {}, salience: .7, emotionalWeight: .1, identityRelevance: .2, goalRelevance: .8, socialRelevance: .1, predictionError: .1, confidence: .9, epistemicStatus: 'fact', entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [], validFromAt: Date.now() - 100, createdAt: Date.now() - 50 });
fabric.maintain({ tick: 7001, force: true });
// Hold the provider batch open explicitly. This avoids a wall-clock race on slow/loaded CI
// hosts and proves that foreground callers queue behind an actually active maintenance job.
await backgroundBatchStarted;
assert.equal(fabric.semanticEmbeddingMaintenanceDiagnostics().maintenanceInFlight, true, 'normal memory maintenance schedules the configured background index worker');
const fallbackDuringWarm = await fabric.retrieveForCognition('What scientific goal should I remember?', 4);
assert.ok(Array.isArray(fallbackDuringWarm));
assert.equal(slowProvider.requests, 1, 'foreground retrieval does not issue a competing provider batch while index maintenance is active');
const [inspectorWork, secondInspectorWork] = [
  fabric.previewRetrieveWithEmbeddings('What scientific goal should I remember?', 4),
  fabric.previewRetrieveWithEmbeddings('Which scientific goal is stored?', 4),
];
await Promise.resolve();
assert.equal(slowProvider.requests, 1, 'semantic inspectors wait for the active background batch rather than racing the local provider');
releaseBackgroundBatch();
const inspectorResult = await inspectorWork;
await secondInspectorWork;
assert.ok(inspectorResult.semantic.enabled);
for (let i = 0; i < 30 && fabric.semanticEmbeddingMaintenanceDiagnostics().maintenanceInFlight; i++) await new Promise(resolve => setTimeout(resolve, 10));
const fabricDiag = fabric.semanticEmbeddingMaintenanceDiagnostics();
assert.equal(fabricDiag.maintenanceInFlight, false);
assert.equal(fabricDiag.indexedItems, 1, 'background vector is exposed through safe maintenance diagnostics');
assert.equal(fabricDiag.remaining, 0);
assert.equal(slowProvider.maxConcurrentRequests, 1, 'background work, live cognition and inspector share a serialized embedding-provider lane');
if (priorFlag === undefined) delete process.env.NK_EMBEDDINGS_RUNTIME_ENABLED; else process.env.NK_EMBEDDINGS_RUNTIME_ENABLED = priorFlag;
console.log('MEMORY_BACKGROUND_INDEX_WORKPASS56=PASS', JSON.stringify({ firstIndexed: first.indexed, completeIndexed: second.indexedItems, providerBatches: slowProvider.requests, offlineBackoff: failure.waitingForRetry, fabricIndexed: fabricDiag.indexedItems, maxConcurrentProviderRequests: slowProvider.maxConcurrentRequests, serializedProviderLoad: slowProvider.maxConcurrentRequests === 1 }));
