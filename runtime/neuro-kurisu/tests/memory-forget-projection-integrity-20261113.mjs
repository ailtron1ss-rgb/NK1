import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';
import { EventLog } from '../src/organism/memory/EventSourcing.ts';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';
import { UnifiedMemorySystem } from '../src/organism/developmental/UnifiedMemorySystem.ts';
import { P62MemoryFabric } from '../src/organism/memory/P62MemoryFabric.ts';
import { SemanticMemoryGraph } from '../src/organism/memory/SemanticMemoryGraph.ts';

const now = Date.now();
const memoryOS = new MemoryOS2({ embeddingProvider: null });
const multiTimescale = new MultiTimescaleMemory();
const substrate = new MemorySubstrateCoordinator();
const semanticGraph = new SemanticMemoryGraph();
const p62 = new P62MemoryFabric();
const fabric = new MemoryFabric(
  memoryOS,
  new EventLog(),
  multiTimescale,
  substrate,
  new UnifiedMemorySystem(),
  p62,
  semanticGraph,
);

memoryOS.encode({
  id: 'canonical-forget-target',
  content: 'quasar archive navigation memory that must disappear after explicit forgetting',
  kind: 'semantic',
  source: 'memory-forget-projection-integrity',
  tags: ['test'],
  context: {},
  salience: 0.95,
  emotionalWeight: 0.1,
  identityRelevance: 0.2,
  goalRelevance: 0.2,
  socialRelevance: 0,
  predictionError: 0.1,
  confidence: 0.95,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: now - 1_000,
  observedAt: now - 500,
});

assert.equal(fabric.projectCompatibility(32), 1);
const projected = multiTimescale.snapshot().find(row => row.id === 'canonical-forget-target');
assert.ok(projected, 'canonical memory must be represented in the compatibility read model');
assert.deepEqual(projected.canonicalProjection, {
  owner: 'memoryOS2',
  itemId: 'canonical-forget-target',
  schemaVersion: 1,
}, 'projection provenance must identify the sole canonical owner');
assert.ok(
  multiTimescale.retrieve('quasar archive', 8).some(row => row.id === 'canonical-forget-target'),
  'the projected record should be discoverable before forgetting',
);

// Canonical projections must never be interpreted as importable legacy source rows.
const beforeForgetFrame = fabric.recall('quasar archive', 8);
assert.ok(beforeForgetFrame.hits.some(hit => hit.id === 'canonical-forget-target'));
assert.ok(p62.snapshot().history.some(frame => frame.hits.some(hit => hit.id === 'canonical-forget-target')),
  'P62 must have a cached recall frame before the forgetting operation');
assert.deepEqual(
  substrate.compatibilityInputs(multiTimescale.snapshot()).map(row => row.context?.originalId),
  [],
  'canonical projections must not be re-ingested as lower-trust compatibility beliefs',
);

// Exercise the real MemoryFabric lifecycle boundary, not a test-only deletion helper.
assert.equal(
  fabric.applyLifecycleCommand({
    action: 'forget',
    id: 'canonical-forget-target',
    reason: 'explicit-user-forget',
  }),
  true,
  'explicit forget must remove the canonical MemoryOS2 record',
);
assert.equal(
  memoryOS.snapshot().items.some(row => row.id === 'canonical-forget-target'),
  false,
  'forgotten canonical record must be absent from MemoryOS2',
);
assert.equal(
  multiTimescale.snapshot().some(row => row.id === 'canonical-forget-target'),
  false,
  'forget must remove every matching derived compatibility projection',
);
assert.deepEqual(
  multiTimescale.retrieve('quasar archive', 8).map(row => row.id),
  [],
  'forgotten content must not be recalled through the secondary projection',
);
const p62AfterForget = p62.snapshot();
assert.equal(p62AfterForget.lastFrame, null, 'P62 must clear a last frame containing forgotten memory');
assert.equal(p62AfterForget.history.some(frame => frame.hits.some(hit => hit.id === 'canonical-forget-target')), false,
  'P62 history must not retain a hit for explicitly forgotten memory');
assert.equal(JSON.stringify(p62AfterForget).includes('quasar archive navigation memory'), false,
  'P62 persisted state must not retain forgotten memory content');
assert.equal(
  fabric.recall('quasar archive', 8).hits.some(hit => hit.id === 'canonical-forget-target'),
  false,
  'the unified recall packet must not resurrect the explicitly forgotten record',
);

console.log('MEMORY_FORGET_PROJECTION_INTEGRITY=PASS');

// Distinct source namespaces may describe the same concept without collapsing
// into one node; repeated writes within one namespace remain idempotent.
{
  const graph = new SemanticMemoryGraph();
  const local = graph.upsertNode('episodic recall', 'concept', 0.7, 'nk1:self');
  const imported = graph.upsertNode('episodic recall', 'concept', 0.7, 'hexis:export-42');
  assert.notEqual(local.id, imported.id, 'different source namespaces must not merge');
  assert.equal(
    graph.upsertNode('episodic recall', 'concept', 0.9, 'nk1:self').id,
    local.id,
    'same label and source namespace must reconsolidate the same node',
  );
  const restored = new SemanticMemoryGraph();
  restored.restore(graph.snapshot());
  const rows = restored.snapshot().nodes;
  assert.equal(rows.find(row => row.id === local.id)?.sourceKey, 'nk1:self');
  assert.equal(rows.find(row => row.id === imported.id)?.sourceKey, 'hexis:export-42');
}

console.log('SEMANTIC_MEMORY_SOURCE_NAMESPACE=PASS');
