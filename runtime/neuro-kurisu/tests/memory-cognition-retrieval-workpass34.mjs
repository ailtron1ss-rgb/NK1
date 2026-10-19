import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';
import { EventLog } from '../src/organism/memory/EventSourcing.ts';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem } from '../src/organism/developmental/UnifiedMemorySystem.ts';
import { P62MemoryFabric } from '../src/organism/memory/P62MemoryFabric.ts';
import { SemanticMemoryGraph } from '../src/organism/memory/SemanticMemoryGraph.ts';

const now = Date.now();
const makeInput = (id, content) => ({
  id, content, kind: 'semantic', source: 'workpass34-cognition-retrieval', tags: [], context: {},
  salience: .6, emotionalWeight: .1, identityRelevance: .2, goalRelevance: .2,
  socialRelevance: .1, predictionError: .1, confidence: .9, epistemicStatus: 'fact', entities: [],
  semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [], validFromAt: now - 1000, observedAt: now,
});
class ConceptProvider {
  constructor({ delayMs = 0, fail = false } = {}) { this.delayMs = delayMs; this.fail = fail; this.calls = 0; this.active = 0; this.maxActive = 0; this.providerId = 'fixture:workpass34'; this.modelId = 'fixture-concept-v2'; }
  async embedBatch(texts) {
    this.calls++; this.active++; this.maxActive = Math.max(this.maxActive, this.active);
    try {
      if (this.delayMs) await new Promise(resolve => setTimeout(resolve, this.delayMs));
      if (this.fail) throw new Error('fixture-provider-offline');
      return texts.map(raw => {
        const text = String(raw).toLowerCase();
        if (/authenticate|sign.in|login|credential recovery|account access/.test(text)) return [1, 0, 0];
        if (/network|socket|database|routing/.test(text)) return [0, 1, 0];
        return [0, 0, 1];
      });
    } finally { this.active--; }
  }
  diagnostics() { return { configured: true, provider: 'ollama', model: this.modelId, endpoint: 'http://127.0.0.1:11434/api/embed', cacheEntries: 0, cacheHits: 0, cacheMisses: 0, requests: this.calls, failures: this.fail ? this.calls : 0, lastError: this.fail ? 'fixture-provider-offline' : null, lastLatencyMs: this.delayMs }; }
}
const makeFabric = provider => {
  const memory = new MemoryOS2({ embeddingProvider: provider });
  memory.encode(makeInput('credential-recovery', 'Login credential recovery restores account access when authentication is lost.'));
  memory.encode(makeInput('network-decoy', 'Network socket routing and database endpoint configuration for server maintenance.'));
  memory.encode(makeInput('general-decoy', 'The avatar palette uses a blue background and compact interface controls.'));
  const fabric = new MemoryFabric(memory, new EventLog(), new MultiTimescaleMemory(), new MemorySubstrateCoordinator(), new UnifiedMemorySystem(), new P62MemoryFabric(), new SemanticMemoryGraph());
  return { memory, fabric };
};

const oldEnv = { enabled: process.env.NK_EMBEDDINGS_RUNTIME_ENABLED, budget: process.env.NK_EMBEDDINGS_RUNTIME_BUDGET_MS, timeout: process.env.NK_EMBEDDINGS_TIMEOUT_MS };
process.env.NK_EMBEDDINGS_RUNTIME_ENABLED = '1';
process.env.NK_EMBEDDINGS_RUNTIME_BUDGET_MS = '350';
process.env.NK_EMBEDDINGS_TIMEOUT_MS = '1000';
try {
  const provider = new ConceptProvider();
  const { fabric } = makeFabric(provider);
  const semantic = await fabric.retrieveForCognition('I cannot authenticate to my user profile', 4, .2, .2, { tick: 1 });
  assert.equal(semantic[0]?.id, 'credential-recovery', 'bounded semantic retrieval must affect the live cognition-facing API, not only the inspector');
  assert.ok(provider.calls >= 1, 'runtime feature flag should activate provider work');

  process.env.NK_EMBEDDINGS_RUNTIME_BUDGET_MS = '60';
  const slowProvider = new ConceptProvider({ delayMs: 280 });
  const slow = makeFabric(slowProvider);
  const started = Date.now();
  const fallback = await slow.fabric.retrieveForCognition('I cannot authenticate to my user profile', 4, .2, .2, { tick: 2 });
  const elapsedMs = Date.now() - started;
  assert.ok(elapsedMs < 200, `live cognition must respect the foreground time budget (elapsed ${elapsedMs}ms)`);
  assert.ok(fallback.length > 0, 'timeouts must preserve deterministic lexical retrieval');
  const requestsWhileBusy = slowProvider.calls;
  await slow.fabric.retrieveForCognition('I cannot authenticate to my user profile', 4, .2, .2, { tick: 3 });
  assert.equal(slowProvider.calls, requestsWhileBusy, 'a slow semantic job must not spawn overlapping provider work');
  assert.equal(slowProvider.maxActive, 1, 'at most one semantic embedding job may run per MemoryFabric');
  await new Promise(resolve => setTimeout(resolve, 320));

  const failingProvider = new ConceptProvider({ fail: true });
  const failing = makeFabric(failingProvider);
  const failedFallback = await failing.fabric.retrieveForCognition('credential recovery account access', 4, .2, .2, { tick: 4 });
  assert.ok(failedFallback.length > 0, 'provider errors must fall back instead of breaking the cognitive cycle');
  assert.equal(failingProvider.maxActive, 1);

  console.log('MEMORY_COGNITION_RETRIEVAL_WORKPASS34=PASS', JSON.stringify({ semanticTop: semantic[0]?.id, providerCalls: provider.calls, slowForegroundMs: elapsedMs, boundedParallelism: slowProvider.maxActive, failureFallback: failedFallback.length }));
} finally {
  if (oldEnv.enabled === undefined) delete process.env.NK_EMBEDDINGS_RUNTIME_ENABLED; else process.env.NK_EMBEDDINGS_RUNTIME_ENABLED = oldEnv.enabled;
  if (oldEnv.budget === undefined) delete process.env.NK_EMBEDDINGS_RUNTIME_BUDGET_MS; else process.env.NK_EMBEDDINGS_RUNTIME_BUDGET_MS = oldEnv.budget;
  if (oldEnv.timeout === undefined) delete process.env.NK_EMBEDDINGS_TIMEOUT_MS; else process.env.NK_EMBEDDINGS_TIMEOUT_MS = oldEnv.timeout;
}
