import assert from 'node:assert/strict';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';

const runtime = new MemorySubsystemRuntime();
runtime.memoryRetentionEconomy.assess({
  tick: 4, at: 400, id: 'memory-a', salience01: .8, identity01: .7,
  goal01: .6, novelty01: .5, estimatedBytes: 128, memoryByteBudget: 4096,
});
runtime.memoryCausalEconomy.observeMemory({
  memoryId: 'memory-a', content: 'Kurisu memory persistence', tick: 4,
  at: 400, sourceClass: 'user', sourceKey: 'session:one', confidence01: .9,
});
runtime.causalLifeGraph.upsertNode({
  kind: 'memory', refId: 'memory-a', label: 'persistent memory',
  tick: 4, at: 400, confidence01: .9,
});
runtime.memoryWorldCausalBridge.record({
  tick: 4, at: 400, memoryIds: ['memory-a'], query: 'What did we learn?',
  predictionWithoutMemory01: .15, predictionWithMemory01: .82,
  replayDelta01: .25, provenance: 'memory-persistence-regression',
});

runtime.memoryOS.restore({
  version: 7,
  byteBudget: 524288,
  items: [{
    id: 'native-snapshot-memory',
    content: 'A canonical memory record must survive the subsystem snapshot API.',
    kind: 'episodic',
    createdAt: 300,
    lastAccessAt: 320,
    salience: .8,
    emotionalWeight: .1,
    identityRelevance: .4,
    goalRelevance: .3,
    socialRelevance: .2,
    predictionError: .1,
    temperature01: .2,
    confidence: .93,
    epistemicStatus: 'fact',
    source: 'user-session',
    entities: [],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
    contradictionLinks: [],
    revisionHistory: [],
    validFromAt: 250,
    validUntilAt: null,
    observedAt: 300,
    supersedesId: null,
    supersededById: null,
    revisionGroupId: 'native-snapshot-memory',
    revisionSequence: 1,
    provenanceClass: 'user',
    sourceAuthority01: .7,
    independenceKey: 'native-session',
    evidenceFreshnessAt: 300,
    evidenceSources: [{
      source: 'session:native',
      provenanceClass: 'user',
      sourceAuthority01: .7,
      independenceKey: 'native-session',
      observedAt: 300,
      evidenceFreshnessAt: 300,
      stance: 'supports',
    }],
    evidenceLineageKeys: ['session:native'],
    confidenceRevisionHistory: [],
    dormant: false,
    retrievalCount: 0,
    semanticVector: [],
    tags: ['round-trip'],
  }],
});
runtime.memoryLifecycleAuthority.restore({
  version: 1, cycles: 5, maintenanceRuns: 2, consolidationRuns: 1,
  lastTick: 44, lastConsolidation: [], meanPressure01: .3, meanMemoryLoad01: .4,
});

const before = runtime.snapshot();
assert.equal(before.memoryRetentionEconomy.evaluations, 1);
assert.equal(before.memoryCausalEconomy.observations.length, 1);
assert.ok(before.causalLifeGraph.nodes.some(node => node.refId === 'memory-a'));
assert.equal(before.memoryWorldCausalBridge.recent[0].status, 'verified');

const restored = new MemorySubsystemRuntime();
restored.restoreFromPersisted({ advanced: before });
const after = restored.snapshot();
assert.equal(after.memoryRetentionEconomy.evaluations, before.memoryRetentionEconomy.evaluations);
assert.equal(after.memoryRetentionEconomy.recent[0].id, 'memory-a');
assert.ok(after.memoryCausalEconomy.observations.some(row => row.memoryId === 'memory-a'));
assert.ok(after.causalLifeGraph.nodes.some(node => node.refId === 'memory-a'));
assert.equal(after.memoryWorldCausalBridge.verifiedLinks, 1);
assert.equal(after.memoryWorldCausalBridge.recent[0].status, 'verified');

const nativeRestored = new MemorySubsystemRuntime();
// This is the direct public snapshot() → restoreFromPersisted() contract, not an
// organism-shaped { advanced } envelope. Both formats must preserve canonical memory.
nativeRestored.restoreFromPersisted(before);
const nativeAfter = nativeRestored.snapshot();
const canonical = nativeAfter.memoryOS.items.find(row => row.id === 'native-snapshot-memory');
assert.ok(canonical, 'native subsystem snapshots must restore canonical MemoryOS2 records');
assert.equal(canonical.validFromAt, 250);
assert.equal(canonical.epistemicStatus, 'fact');
assert.equal(canonical.provenanceClass, 'user');
assert.equal(canonical.evidenceSources[0].source, 'session:native');
assert.equal(nativeAfter.memoryLifecycleAuthority.lastTick, 44);
assert.equal(nativeAfter.memoryLifecycleAuthority.cycles, 5);
assert.equal(nativeAfter.memoryRetentionEconomy.evaluations, 1);
assert.ok(nativeAfter.memoryCausalEconomy.observations.some(row => row.memoryId === 'memory-a'));
assert.ok(nativeAfter.causalLifeGraph.nodes.some(node => node.refId === 'memory-a'));
assert.equal(nativeAfter.memoryWorldCausalBridge.verifiedLinks, 1);

console.log('MEMORY_SUBSYSTEM_RUNTIME_PERSISTENCE=PASS');
