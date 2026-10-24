import assert from 'node:assert/strict';
import { PersistenceProjectionCoordinator } from '../src/organism/core/PersistenceProjectionCoordinator.ts';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';

const memory = new MemorySubsystemRuntime();
memory.memoryRetentionEconomy.assess({
  tick: 11, at: 1100, id: 'persistent-memory', salience01: .9,
  identity01: .75, goal01: .6, novelty01: .55, estimatedBytes: 160,
  memoryByteBudget: 4096,
});
memory.memoryCausalEconomy.observeMemory({
  memoryId: 'persistent-memory', content: 'A fact linked to an outcome',
  tick: 11, at: 1100, sourceClass: 'user', sourceKey: 'session:11',
  confidence01: .91,
});
memory.causalLifeGraph.upsertNode({
  kind: 'memory', refId: 'persistent-memory', label: 'stable memory node',
  tick: 11, at: 1100, confidence01: .91,
});
memory.memoryWorldCausalBridge.record({
  tick: 11, at: 1100, memoryIds: ['persistent-memory'],
  query: 'Did the memory improve the prediction?',
  predictionWithoutMemory01: .12, predictionWithMemory01: .84,
  replayDelta01: .22, provenance: 'checkpoint-projection-regression',
});

const provider = value => ({ snapshot: () => structuredClone(value) });
const target = {
  state: { tick: 11 },
  facets: { learning: {}, embodiment: {} },
  system: {},
};
const ctx = {
  memorySubsystem: memory,
  // These root aliases are intentionally absent. The coordinator must use the
  // canonical extracted memory subsystem rather than silently omit its state.
  advancedProjectionScheduler: { metrics: () => ({ tick: 11 }) },
  revisionGraph: { currentSnapshot: () => ({}) },
  revisionTokens: provider({ version: 1 }),
  embodimentSubsystem: {},
  worldSubsystem: {},
  evidenceResearchSubsystem: {},
  agencySubsystem: {},
};
new PersistenceProjectionCoordinator().syncRuntimeSystemState(
  target, ctx, { version: 1, frames: 2 }, { deterministicSignature: 'memory-projection-test' },
);

assert.equal(target.system.memoryRetentionEconomy.evaluations, 1);
assert.ok(target.system.memoryCausalEconomy.observations.some(row => row.memoryId === 'persistent-memory'));
assert.ok(target.system.causalLifeGraph.nodes.some(node => node.refId === 'persistent-memory'));
assert.equal(target.system.memoryWorldCausalBridge.recent[0].status, 'verified');

// The system checkpoint is a valid restore source for all four components.
const restored = new MemorySubsystemRuntime();
restored.restoreFromPersisted({ system: target.system });
const after = restored.snapshot();
assert.equal(after.memoryRetentionEconomy.evaluations, 1);
assert.ok(after.memoryCausalEconomy.observations.some(row => row.memoryId === 'persistent-memory'));
assert.ok(after.causalLifeGraph.nodes.some(node => node.refId === 'persistent-memory'));
assert.equal(after.memoryWorldCausalBridge.verifiedLinks, 1);
assert.equal(after.memoryWorldCausalBridge.recent[0].status, 'verified');

console.log('MEMORY_CAUSAL_PERSISTENCE_PROJECTION=PASS');
