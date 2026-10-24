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

console.log('MEMORY_SUBSYSTEM_RUNTIME_PERSISTENCE=PASS');
