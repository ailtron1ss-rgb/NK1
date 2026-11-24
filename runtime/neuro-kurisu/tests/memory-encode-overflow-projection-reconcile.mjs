import assert from 'node:assert/strict';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';
import { EventLog } from '../src/organism/memory/EventSourcing.ts';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem } from '../src/organism/developmental/UnifiedMemorySystem.ts';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';
import { P62MemoryFabric } from '../src/organism/memory/P62MemoryFabric.ts';
import { SemanticMemoryGraph } from '../src/organism/memory/SemanticMemoryGraph.ts';

const input = (content, extra = {}) => ({
  content,
  kind: 'semantic',
  source: 'memory-encode-overflow-projection-reconcile',
  tags: ['encode-overflow-regression'],
  context: {},
  salience: 0.5,
  emotionalWeight: 0.1,
  identityRelevance: 0.1,
  goalRelevance: 0.1,
  socialRelevance: 0.1,
  predictionError: 0.1,
  confidence: 0.8,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  ...extra,
});

const memoryOS = new MemoryOS2({ embeddingProvider: null });
const multi = new MultiTimescaleMemory();
const p62 = new P62MemoryFabric();
const semantic = new SemanticMemoryGraph();
const fabric = new MemoryFabric(
  memoryOS,
  new EventLog(256),
  multi,
  new MemorySubstrateCoordinator(),
  new UnifiedMemorySystem(),
  p62,
  semantic,
);

const sentinel = 'canonical encode overflow sentinel qzv-882 must vanish from every projection';
const target = fabric.encode(input(sentinel, {
  salience: 0.001,
  confidence: 0.01,
  identityRelevance: 0,
  goalRelevance: 0,
}), { tick: 1 });

fabric.projectCompatibility(256);
const initialFrame = fabric.recall(sentinel, 12);
const graphNode = semantic.snapshot().nodes.find((node) =>
  node.canonicalProjection?.owner === 'memoryOS2' &&
  node.canonicalProjection.itemId === target.id
);
assert.ok(graphNode, 'target must have a semantic graph projection before overflow');
const semanticAlias = 'semantic:' + graphNode.id;
assert.ok(initialFrame.hits.some((hit) => hit.id === target.id || hit.id === semanticAlias),
  'P62 must retain a recall hit before overflow');
assert.ok(multi.snapshot({ clone: false }).some((row) =>
  row.id === target.id || row.canonicalProjection?.itemId === target.id
), 'MultiTimescale must contain the compatibility projection');
assert.ok(fabric.hotIdsSnapshot().includes(target.id), 'target must be present in the hot-ID surface');

for (let index = 0; index < 1599; index += 1) {
  memoryOS.encode(input('direct canonical filler ' + index + ' with a unique payload token', {
    salience: 0.35,
    confidence: 0.55,
    identityRelevance: 0,
    goalRelevance: 0,
  }), { clone: false });
}
assert.equal(memoryOS.size(), 1600);
fabric.encode(input('verified high-value replacement record after capacity pressure', {
  salience: 1,
  confidence: 1,
  identityRelevance: 0.8,
  goalRelevance: 1,
}), { tick: 2 });

assert.equal(memoryOS.snapshot().items.some((row) => row.id === target.id), false);
assert.equal(multi.snapshot({ clone: false }).some((row) =>
  row.id === target.id || row.canonicalProjection?.itemId === target.id
), false, 'encode-triggered eviction must purge MultiTimescale');
const graphAfter = semantic.snapshot();
assert.equal(graphAfter.nodes.some((node) =>
  node.canonicalProjection?.owner === 'memoryOS2' &&
  node.canonicalProjection.itemId === target.id
), false, 'encode-triggered eviction must purge semantic graph nodes');
assert.equal(graphAfter.edges.some((edge) =>
  edge.canonicalProjection?.owner === 'memoryOS2' &&
  (edge.canonicalProjection.fromItemId === target.id || edge.canonicalProjection.toItemId === target.id)
), false, 'encode-triggered eviction must purge semantic graph edges');
const hasStaleP62Hit = (frame) => Boolean(frame?.hits.some((hit) =>
  hit.id === target.id || hit.id === semanticAlias
));
assert.equal(hasStaleP62Hit(p62.snapshot().lastFrame), false, 'P62 lastFrame must not keep a ghost hit');
assert.equal(p62.snapshot().history.some(hasStaleP62Hit), false, 'P62 history must not keep a ghost hit');
assert.equal(fabric.hotIdsSnapshot().includes(target.id), false, 'hot-ID cache must be purged');
console.log('MEMORY_ENCODE_OVERFLOW_PROJECTION_RECONCILE=PASS');
