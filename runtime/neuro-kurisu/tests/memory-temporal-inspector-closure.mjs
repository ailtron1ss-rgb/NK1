import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';
import { EventLog } from '../src/organism/memory/EventSourcing.ts';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem } from '../src/organism/developmental/UnifiedMemorySystem.ts';
import { P62MemoryFabric } from '../src/organism/memory/P62MemoryFabric.ts';
import { SemanticMemoryGraph } from '../src/organism/memory/SemanticMemoryGraph.ts';

const base = Date.now() - 30_000;
const memoryOS = new MemoryOS2({ signalFusionProfile: 'balanced' });
const encode = (content, extra = {}) => memoryOS.encode({
  content,
  kind: 'semantic',
  source: 'memory-temporal-inspector-closure',
  tags: [],
  context: {},
  salience: .8,
  emotionalWeight: .2,
  identityRelevance: .25,
  goalRelevance: .5,
  socialRelevance: .1,
  predictionError: .2,
  confidence: .9,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: base,
  observedAt: base,
  ...extra,
}, { clone: false });

const old = encode('KURISU-741 project continuity uses the mobile branch.');
const revised = memoryOS.reviseContent(old.id, 'KURISU-741 project continuity uses the verified branch.', {
  validAt: base + 10_000,
  reason: 'verified-branch-correction',
});
assert.ok(revised, 'revision must be created');
assert.equal(old.validUntilAt, base + 10_000, 'old revision must retain its validity boundary');

const query = 'KURISU-741 project continuity branch';
const current = memoryOS.retrieve(query, 8, 0, 0, { temporalMode: 'current' });
assert.equal(current[0]?.id, revised.id, 'current retrieval should prefer the currently valid revision');
const currentWithHistoricalAsOf = memoryOS.retrieve(query, 8, 0, 0, { temporalMode: 'current', asOfAt: base + 5_000 });
assert.equal(currentWithHistoricalAsOf[0]?.id, revised.id, 'current mode must ignore incidental historical asOfAt options');
const historic = memoryOS.retrieve(query, 8, 0, 0, { temporalMode: 'at', asOfAt: base + 5_000 });
assert.equal(historic[0]?.id, old.id, 'point-in-time retrieval should recover the old revision');
const archive = memoryOS.retrieve(query, 8, 0, 0, { temporalMode: 'all' });
const archiveIds = new Set(archive.map(row => row.id));
assert.ok(archiveIds.has(old.id), 'all mode must include expired historical revisions');
assert.ok(archiveIds.has(revised.id), 'all mode must include the active revision');
const nullAsOf = memoryOS.retrieve(query, 8, 0, 0, { temporalMode: 'current', asOfAt: null });
assert.equal(nullAsOf[0]?.id, revised.id, 'null asOfAt must default to current time, not Unix epoch');

const events = new EventLog(128);
const fabric = new MemoryFabric(
  memoryOS,
  events,
  new MultiTimescaleMemory(),
  new MemorySubstrateCoordinator(),
  new UnifiedMemorySystem(),
  new P62MemoryFabric(),
  new SemanticMemoryGraph(),
);
const beforeMemory = memoryOS.snapshot();
const beforeFabric = fabric.snapshot();
const beforePolicy = memoryOS.adaptivePolicyDiagnostics();
const preview = fabric.previewRetrieve(query, 8, .6, .4, { temporalMode: 'all' });
assert.ok(preview.some(row => row.id === old.id), 'read-only inspector preview must expose historical revisions');
assert.deepEqual(memoryOS.snapshot(), beforeMemory, 'preview search must not mutate canonical memory state');
assert.deepEqual(fabric.snapshot(), beforeFabric, 'preview search must not change Fabric counters, hot IDs, or outcome ledger');
assert.deepEqual(memoryOS.adaptivePolicyDiagnostics(), beforePolicy, 'preview search must not train or select live adaptive policy');
assert.equal(fabric.inspect().stats.retrievals, beforeFabric.stats.retrievals, 'preview search must not count as an operational retrieval');

console.log('MEMORY_TEMPORAL_INSPECTOR_CLOSURE=PASS', JSON.stringify({
  currentId: current[0]?.id,
  historicalId: historic[0]?.id,
  archiveContainsBoth: archiveIds.has(old.id) && archiveIds.has(revised.id),
  previewReadOnly: true,
}));
