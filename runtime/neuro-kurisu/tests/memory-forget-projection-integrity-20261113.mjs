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

// A stale compatibility or P62-only copy must still be removed when the canonical
// row has already disappeared (for example, after a partial or older restore).
{
  const orphanId = 'already-absent-canonical-row';
  multiTimescale.add({
    ...projected,
    id: 'orphaned-projection-alias',
    summary: 'orphaned supernova evidence that must also be forgotten',
    canonicalProjection: { owner: 'memoryOS2', itemId: orphanId, schemaVersion: 1 },
  });
  p62.recall({
    query: 'orphaned supernova evidence',
    memoryOS: [],
    multiTimescale: [{
      id: orphanId,
      content: 'orphaned supernova evidence that must also be forgotten',
      kind: 'episode',
      confidence01: 0.9,
      salience01: 0.9,
      source: 'compatibility-projection',
    }],
    semanticNodes: [],
    beliefs: [],
  });
  assert.equal(memoryOS.snapshot().items.some(row => row.id === orphanId), false);
  assert.equal(
    fabric.applyLifecycleCommand({ action: 'forget', id: orphanId, reason: 'stale-cache-reconciliation' }),
    true,
    'forget should report success when it purges a derived-only orphan',
  );
  assert.equal(multiTimescale.snapshot().some(row => row.id === 'orphaned-projection-alias'), false);
  assert.equal(p62.snapshot().history.some(frame => frame.hits.some(hit => hit.id === orphanId)), false);
  assert.equal(
    fabric.applyLifecycleCommand({ action: 'forget', id: orphanId, reason: 'stale-cache-reconciliation' }),
    false,
    'a repeated forget with no canonical or derived copy should be a no-op',
  );
}

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


// A protected canonical identity is not forgotten merely because a stale derived
// projection or recall frame exists. The graph/cache purge must never report a
// successful forget while the canonical owner still retains the protected row.
{
  const protectedMemoryOS = new MemoryOS2({ embeddingProvider: null });
  const protectedProjection = new MultiTimescaleMemory();
  const protectedSubstrate = new MemorySubstrateCoordinator();
  const protectedP62 = new P62MemoryFabric();
  const protectedGraph = new SemanticMemoryGraph();
  const protectedFabric = new MemoryFabric(
    protectedMemoryOS,
    new EventLog(),
    protectedProjection,
    protectedSubstrate,
    new UnifiedMemorySystem(),
    protectedP62,
    protectedGraph,
  );

  const protectedId = 'protected-identity-anchor';
  protectedFabric.encode({
    id: protectedId,
    content: 'private identity anchor and stable autobiographical profile',
    kind: 'identity',
    source: 'explicit-forget-protection-regression',
    tags: ['identity'],
    context: {},
    salience: 0.98,
    emotionalWeight: 0.2,
    identityRelevance: 0.99,
    goalRelevance: 0.1,
    socialRelevance: 0.1,
    predictionError: 0.05,
    confidence: 0.99,
    epistemicStatus: 'fact',
    entities: ['identity'],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
    contradictionLinks: [],
  });
  protectedFabric.projectCompatibility(32);
  const protectedFrame = protectedFabric.recall('private identity anchor', 8);
  assert.ok(protectedFrame.hits.some(hit => hit.id === protectedId),
    'the protected item should be present in the recall cache before the forget request');
  assert.ok(protectedProjection.snapshot().some(row => row.id === protectedId),
    'the protected item should have a derived compatibility projection before the forget request');

  assert.equal(
    protectedFabric.forgetById(protectedId, 'explicit-user-forget'),
    false,
    'a refusal from canonical MemoryOS2 must not be reported as a successful forget',
  );
  assert.ok(
    protectedMemoryOS.snapshot().items.some(row => row.id === protectedId),
    'the protected canonical identity record must remain present',
  );
  assert.ok(
    protectedProjection.snapshot().some(row => row.id === protectedId),
    'derived projection must not be deleted while the canonical owner retains the record',
  );
  assert.ok(
    protectedP62.snapshot().history.some(frame => frame.hits.some(hit => hit.id === protectedId)),
    'recall frames must remain consistent with a protected canonical record',
  );
}

console.log('PROTECTED_MEMORY_FORGET_BOUNDARY=PASS');


// Canonical MemoryOS2 links must be projected into the SemanticMemoryGraph read
// model through MemoryFabric, then removed/rebuilt from the same canonical owner.
{
  const input = (id, content, salience) => ({
    id,
    content,
    kind: 'semantic',
    source: 'semantic-graph-projection-regression',
    tags: ['semantic-graph'],
    context: {},
    salience,
    emotionalWeight: 0.1,
    identityRelevance: 0.2,
    goalRelevance: 0.1,
    socialRelevance: 0.05,
    predictionError: 0.05,
    confidence: 0.95,
    epistemicStatus: 'fact',
    entities: ['NeuroCore', 'MemoryOS2'],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
    contradictionLinks: [],
  });
  const memoryOS = new MemoryOS2({ embeddingProvider: null });
  const graph = new SemanticMemoryGraph();
  const fabric = new MemoryFabric(
    memoryOS,
    new EventLog(),
    new MultiTimescaleMemory(),
    new MemorySubstrateCoordinator(),
    new UnifiedMemorySystem(),
    new P62MemoryFabric(),
    graph,
  );
  const first = fabric.encode(input(
    'semantic-graph-canonical-a',
    'NeuroCore stores episodic memory and stable context',
    0.8,
  ));
  const second = fabric.encode(input(
    'semantic-graph-canonical-b',
    'NeuroCore retrieves episodic memory and stable context',
    0.9,
  ));

  assert.ok(second.semanticLinks.includes(first.id),
    'the canonical MemoryOS2 owner should record the shared-entity semantic link');
  let state = graph.snapshot();
  const firstNode = state.nodes.find(node =>
    node.canonicalProjection?.owner === 'memoryOS2' && node.canonicalProjection.itemId === first.id);
  const secondNode = state.nodes.find(node =>
    node.canonicalProjection?.owner === 'memoryOS2' && node.canonicalProjection.itemId === second.id);
  assert.ok(firstNode && secondNode,
    'MemoryFabric writes must materialize canonical MemoryOS2 rows into the semantic graph read projection');
  assert.ok(state.edges.some(edge =>
    edge.from === secondNode.id && edge.to === firstNode.id && edge.relation === 'associated'
    && edge.canonicalProjection?.owner === 'memoryOS2'),
  'MemoryOS2 semanticLinks must become provenance-marked graph edges');

  assert.equal(fabric.forgetById(first.id, 'semantic-graph-forget'), true);
  state = graph.snapshot();
  assert.equal(state.nodes.some(node => node.canonicalProjection?.itemId === first.id), false,
    'forget must remove the canonical memory node from the graph');
  assert.equal(state.edges.some(edge =>
    edge.canonicalProjection?.fromItemId === second.id && edge.canonicalProjection?.toItemId === first.id), false,
  'forget must remove projected graph edges that reference the deleted canonical row');

  const restoredMemoryOS = new MemoryOS2({ embeddingProvider: null });
  restoredMemoryOS.restore(memoryOS.snapshot());
  const restoredGraph = new SemanticMemoryGraph();
  const restoredFabric = new MemoryFabric(
    restoredMemoryOS,
    new EventLog(),
    new MultiTimescaleMemory(),
    new MemorySubstrateCoordinator(),
    new UnifiedMemorySystem(),
    new P62MemoryFabric(),
    restoredGraph,
  );
  assert.equal(typeof restoredFabric.reconcileSemanticGraph, 'function',
    'MemoryFabric must expose canonical graph reconciliation for runtime restore');
  restoredFabric.reconcileSemanticGraph();
  const restoredState = restoredGraph.snapshot();
  assert.ok(restoredState.nodes.some(node => node.canonicalProjection?.itemId === second.id),
    'graph read model must rebuild from canonical MemoryOS2 after restart');
  assert.equal(restoredState.nodes.some(node => node.canonicalProjection?.itemId === first.id), false,
    'rebuild must not resurrect a forgotten canonical memory');
}

console.log('CANONICAL_MEMORY_TO_SEMANTIC_GRAPH_PROJECTION=PASS');
