import assert from 'node:assert/strict';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { EventLog } from '../src/organism/memory/EventSourcing.ts';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem } from '../src/organism/developmental/UnifiedMemorySystem.ts';
import { P62MemoryFabric } from '../src/organism/memory/P62MemoryFabric.ts';
import { SemanticMemoryGraph } from '../src/organism/memory/SemanticMemoryGraph.ts';

const memoryOS = new MemoryOS2();
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

const makeInput = (content, extra = {}) => ({
  content,
  kind: 'semantic',
  source: 'memory-maintenance-projection-reconcile',
  tags: ['eviction-reconcile'],
  context: {},
  salience: 0.9,
  emotionalWeight: 0.1,
  identityRelevance: 0.1,
  goalRelevance: 0.1,
  socialRelevance: 0.1,
  predictionError: 0.1,
  confidence: 0.9,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  ...extra,
});

// Seed one deliberately weak canonical row and materialize every read-side view.
const sentinel = 'eviction-projection-sentinel qzv-731 memory should disappear from every read surface';
const target = fabric.encode(makeInput(sentinel, {
  salience: 0.001,
  confidence: 0.05,
  identityRelevance: 0,
  goalRelevance: 0,
}), { tick: 1 });
fabric.projectCompatibility(256);
const initialFrame = fabric.recall(sentinel, 12);
const graphNode = semantic.snapshot().nodes.find(node =>
  node.canonicalProjection?.owner === 'memoryOS2' &&
  node.canonicalProjection.itemId === target.id,
);
assert.ok(graphNode, 'target must have a semantic graph projection');
const semanticAlias = `semantic:${graphNode.id}`;
assert.ok(initialFrame.hits.some(hit => hit.id === target.id || hit.id === semanticAlias),
  'P62 must retain a recall hit for the target before eviction');
assert.ok(multi.snapshot({ clone: false }).some(row =>
  row.id === target.id || row.canonicalProjection?.itemId === target.id),
  'target must have a MultiTimescale projection');

// Add high-value rows so the ordinary 128-item capacity path evicts the sentinel.
// Protected identity and quarantined rows must remain protected.
const protectedIdentity = fabric.encode(makeInput('protected identity continuity sentinel', {
  kind: 'identity', salience: 0.01, confidence: 0.1, epistemicStatus: 'belief',
}), { tick: 2 });
const protectedQuarantine = fabric.encode(makeInput('protected quarantined evidence sentinel', {
  salience: 0.01, confidence: 0.1, epistemicStatus: 'quarantined',
}), { tick: 3 });
for (let index = 0; index < 130; index += 1) {
  fabric.encode(makeInput(`high-value maintenance distractor ${index} with stable unrelated content`), {
    tick: 4 + index,
    emitEvent: false,
  });
}
fabric.projectCompatibility(256);

const result = fabric.maintain({ maxItems: 128, force: true, tick: 999 });
assert.equal(result.skipped, false);
assert.ok(result.changed >= 1, 'capacity maintenance must remove at least one canonical row');
assert.equal(memoryOS.snapshot({ clone: false }).items.some(item => item.id === target.id), false,
  'the weak target must be evicted from canonical MemoryOS2');
assert.ok(memoryOS.snapshot({ clone: false }).items.some(item => item.id === protectedIdentity.id),
  'identity rows must remain protected');
assert.ok(memoryOS.snapshot({ clone: false }).items.some(item => item.id === protectedQuarantine.id),
  'quarantined rows must remain protected');

assert.equal(multi.snapshot({ clone: false }).some(row =>
  row.id === target.id || row.canonicalProjection?.itemId === target.id), false,
  'all MultiTimescale copies must be removed');
const graphAfter = semantic.snapshot();
assert.equal(graphAfter.nodes.some(node =>
  node.canonicalProjection?.owner === 'memoryOS2' &&
  node.canonicalProjection.itemId === target.id), false,
  'canonical semantic graph node must be removed');
assert.equal(graphAfter.edges.some(edge =>
  edge.canonicalProjection?.owner === 'memoryOS2' &&
  (edge.canonicalProjection.fromItemId === target.id ||
   edge.canonicalProjection.toItemId === target.id)), false,
  'canonical semantic graph edges touching the target must be removed');

const p62After = p62.snapshot();
const staleP62Hit = frame => frame?.hits.some(hit =>
  hit.id === target.id || hit.id === semanticAlias);
assert.equal(staleP62Hit(p62After.lastFrame), false, 'P62 lastFrame must not retain the evicted row');
assert.equal(p62After.history.some(staleP62Hit), false, 'P62 history must not retain the evicted row');
assert.equal(fabric.hotIdsSnapshot().includes(target.id), false, 'hot-ID cache must not retain the evicted row');

console.log('MEMORY_MAINTENANCE_PROJECTION_RECONCILE=PASS', JSON.stringify({
  canonicalItems: memoryOS.size(),
  evicted: result.changed,
  protectedIdentityRetained: true,
  protectedQuarantineRetained: true,
  multiTimescaleClean: true,
  semanticGraphClean: true,
  p62HistoryClean: true,
}));
