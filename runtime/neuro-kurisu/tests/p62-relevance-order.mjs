import assert from 'node:assert/strict';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { EventLog } from '../src/organism/memory/EventSourcing.ts';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem } from '../src/organism/developmental/UnifiedMemorySystem.ts';
import { P62MemoryFabric } from '../src/organism/memory/P62MemoryFabric.ts';
import { SemanticMemoryGraph } from '../src/organism/memory/SemanticMemoryGraph.ts';

// Calibrate ranking independently of the canonical store. The unrelated memory
// has high confidence/support but should lose to a much more query-relevant memory.
const p62 = new P62MemoryFabric();
const ranking = p62.recall({
  query: 'identity continuity',
  memoryOS: [
    { id: 'high-support-low-relevance', content: 'weather forecast for tomorrow', kind: 'semantic', confidence01: 1, salience01: 0, source: 'canonical' },
    { id: 'high-relevance-low-support', content: 'identity continuity restart details', kind: 'identity', confidence01: .1, salience01: .1, source: 'canonical' },
  ],
  multiTimescale: [],
  semanticNodes: [],
  beliefs: [],
  maxItems: 2,
});
assert.equal(ranking.hits[0]?.id, 'high-relevance-low-support',
  'P62 must rank by relevance before source support');
assert.ok(ranking.hits[0].relevance01 > ranking.hits[1].relevance01);

// Integration regression: relevant canonical memories must remain retrievable
// even when insertion order places them beyond the old first-128 slice.
const now = Date.now();
const memoryOS = new MemoryOS2();
const encode = (id, content) => memoryOS.encode({
  id,
  content,
  kind: 'semantic',
  source: 'p62-recall-fixture',
  tags: ['recall-test'],
  context: { fixture: 'p62-relevance-order' },
  salience: .5,
  emotionalWeight: .1,
  identityRelevance: .2,
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
  validFromAt: now - 1000,
  observedAt: now - 500,
  provenanceClass: 'device',
  sourceAuthority01: .9,
});
encode('target-buried', 'The crimson quasar navigation checksum is Kestrel 391 and must persist across process restart.');
for (let index = 0; index < 150; index++) {
  encode(`noise-${index}`, `Unrelated inventory item ${index} lists ordinary office supplies and generic status.`);
}
const canonicalItems = memoryOS.snapshot({ clone: false }).items;
assert.ok(canonicalItems.findIndex(row => row.id === 'target-buried') >= 128,
  'fixture must put the relevant memory beyond the legacy insertion-order window');

const fabric = new MemoryFabric(
  memoryOS,
  new EventLog(128),
  new MultiTimescaleMemory(),
  new MemorySubstrateCoordinator(),
  new UnifiedMemorySystem(),
  new P62MemoryFabric(),
  new SemanticMemoryGraph(),
  { maxHotItems: 8 },
);
const beforeStats = memoryOS.snapshot({ clone: false }).semanticQueries;
const recalled = fabric.recall('crimson quasar navigation checksum', 8);
assert.ok(recalled.hits.some(row => row.id === 'target-buried'),
  'unified recall must query canonical memory instead of scanning only the first 128 rows');
assert.equal(memoryOS.snapshot({ clone: false }).semanticQueries, beforeStats,
  'query-aware recall candidate generation must not mutate canonical retrieval diagnostics');

console.log('P62_RELEVANCE_ORDER_AND_CANONICAL_RECALL=PASS', JSON.stringify({
  relevanceBeforeSupport: true,
  canonicalMemoryBeyondFirst128: true,
  previewRecallSideEffectFree: true,
  hits: recalled.hits.length,
}));
