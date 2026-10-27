import assert from 'node:assert/strict';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';

const original = new MemorySubsystemRuntime();
const retention = original.memoryRetentionEconomy.assess({
  tick: 7,
  at: 1_700_000_000_007,
  id: 'mem:retention-fixture',
  salience01: .95,
  identity01: .8,
  goal01: .7,
  predictionError01: .6,
  novelty01: .65,
  redundancy01: .05,
  storageCost01: .1,
  estimatedBytes: 256,
  memoryByteBudget: 8192,
  provenanceConfidence01: .9,
});
original.memoryRetentionEconomy.observeOutcome({
  score01: retention.score01,
  observedUtility01: .91,
  features: retention.utility,
  learningRate01: .05,
});
original.memoryCausalEconomy.observeMemory({
  memoryId: 'mem:retention-fixture',
  content: 'The memory policy was adjusted after an observed outcome.',
  tick: 7,
  at: 1_700_000_000_007,
  sourceClass: 'user',
  sourceKey: 'test:independent-source',
  confidence01: .9,
  claimKey: 'claim:policy-adjustment',
});
original.memoryCausalEconomy.observeOutcome({
  memoryId: 'mem:retention-fixture',
  decisionId: 'decision:policy-adjustment',
  tick: 8,
  at: 1_700_000_000_008,
  action: 'retain',
  success01: .9,
  surprise01: .25,
  sourceClass: 'user',
});
original.causalLifeGraph.upsertNode({
  kind: 'experience',
  refId: 'experience:memory-policy-adjustment',
  label: 'Memory policy adjusted after outcome',
  tick: 8,
  at: 1_700_000_000_008,
  confidence01: .9,
  external01: 1,
});
assert.equal(
  original.causalLifeGraph.snapshot().observedChains,
  1,
  'causal-life graph summary must update when a node is inserted',
);
original.memoryWorldCausalBridge.record({
  tick: 8,
  at: 1_700_000_000_008,
  memoryIds: ['mem:retention-fixture'],
  query: 'Does the retained memory improve prediction?',
  predictionWithoutMemory01: .2,
  predictionWithMemory01: .8,
  replayDelta01: .2,
  provenance: 'test:paired-prediction',
});

const before = original.snapshot();
// Simulate a persisted lifecycle state from a prior run. The compatibility importer
// must run at this tick, not at the new instance's constructor default.
before.memoryLifecycleAuthority.lastTick = 1234;
for (const key of [
  'memoryRetentionEconomy',
  'memoryCausalEconomy',
  'causalLifeGraph',
  'memoryWorldCausalBridge',
]) {
  assert.ok(Object.hasOwn(before, key), `runtime snapshot omits ${key}`);
}

const restored = new MemorySubsystemRuntime();
let compatibilityImportTick = null;
const consolidateCompatibility = restored.fabric.consolidateCompatibility.bind(restored.fabric);
restored.fabric.consolidateCompatibility = (rows, limit, tick) => {
  compatibilityImportTick = tick;
  return consolidateCompatibility(rows, limit, tick);
};
restored.restoreFromPersisted({ advanced: before });
assert.equal(
  compatibilityImportTick,
  1234,
  'legacy compatibility import must use the restored lifecycle tick, not reset to zero',
);

assert.deepEqual(
  restored.memoryRetentionEconomy.snapshot(),
  before.memoryRetentionEconomy,
  'learned retention weights and budget diagnostics must survive restart',
);
assert.deepEqual(
  restored.memoryCausalEconomy.snapshot(),
  before.memoryCausalEconomy,
  'memory-to-outcome evidence lineage must survive restart',
);
assert.deepEqual(
  restored.causalLifeGraph.snapshot(),
  before.causalLifeGraph,
  'causal autobiographical graph must survive restart',
);
assert.deepEqual(
  restored.memoryWorldCausalBridge.snapshot(),
  before.memoryWorldCausalBridge,
  'verified memory-to-world prediction links must survive restart',
);

console.log('MEMORY_SUBSYSTEM_STATE_ROUNDTRIP_WORKPASS570=PASS', JSON.stringify({
  retainedPolicySamples: restored.memoryRetentionEconomy.snapshot().learningSamples,
  causalObservations: restored.memoryCausalEconomy.snapshot().totalObservations,
  causalLifeNodes: restored.causalLifeGraph.snapshot().totalNodes,
  verifiedWorldLinks: restored.memoryWorldCausalBridge.snapshot().verifiedLinks,
}));
