import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const config = {
  enableLanguage: false,
  enableWorldModel: true,
  enableSelfProjects: true,
  enableAgencyModel: true,
  enableLifelongLearning: true,
  checkpointMinIntervalMs: 0,
  checkpointMaxDirtyCycles: 1,
  cycleResultMode: 'operational',
  performanceProfile: 'mobile',
};

const store = new MemoryStateStore();
const core = new OrganismCore(store, config);
await core.init();

const observation = {
  text: 'The red lamp in the laboratory is beside the bench; the blue switch controls the lamp.',
  worldContext: {
    location: 'laboratory',
    facts: ['the red lamp is beside the bench', 'the blue switch controls the lamp'],
    objects: [{ id: 'red-lamp', label: 'red lamp', visible: true }],
  },
  novelty: .72,
};

for (let tick = 0; tick < 7; tick += 1) {
  await core.observe(observation);
  await core.feedback({
    success: .72,
    reward: .74,
    evidenceSource: 'device',
    notes: 'deterministic device-side observation for memory-decision receipt regression',
  });
}
await core.flush();

const snapshot = core.snapshot();
const decisions = snapshot.traces.filter(row => row.tick > 0);
const decision = decisions.find(row => row.memoryEvidence?.retrievedMemoryIds?.length > 0);
assert.ok(decision,
  'a decision made after memory retrieval must carry a decision-bound memory evidence receipt');

const receipt = decision.memoryEvidence;
assert.equal(receipt.version, 1);
assert.equal(receipt.tick, decision.tick);
assert.equal(receipt.status, 'retrieved');
assert.equal(receipt.queryKind, 'observation-text');
assert.ok(receipt.receiptId.startsWith(`memory-query:${decision.tick}:`));
assert.match(receipt.queryHash, /^[a-f0-9]{64}$/);
assert.ok(receipt.retrievedMemoryIds.length > 0);
assert.equal(receipt.retrievedCount, receipt.retrievedMemoryIds.length);
assert.deepEqual(receipt.retrievedMemoryIds, snapshot.facets.memory.lastRetrievedMemoryIds,
  'the receipt must describe the actual current retrieval, not a stale prior result');
assert.equal(receipt.appliedToWorldModel, true,
  'the selected decision must retain the memory-to-world application used during its cycle');
assert.ok(receipt.memoryWorldCausalLinkId,
  'the decision receipt must point to its memory/world counterfactual link');
assert.equal(receipt.influenceBasis, 'internal-counterfactual-world-model',
  'an internal model delta must not be mislabeled as independent external causality');

const link = snapshot.system.memoryWorldCausalBridge.recent.find(row =>
  row.id === receipt.memoryWorldCausalLinkId);
assert.ok(link, 'the linked memory/world causal projection must be retained');
assert.equal(link.decisionId, decision.id,
  'the memory/world link must be bound to the exact selected decision ID');
assert.deepEqual(link.memoryIds, receipt.retrievedMemoryIds);
assert.equal(receipt.counterfactualDelta01, link.delta01);
assert.equal(decision.reasoningSignals.memoryRetrievedCount, receipt.retrievedCount);
assert.equal(decision.reasoningSignals.memoryWorldApplied01, 1);

const persisted = await store.load();
const resumed = new OrganismCore(new MemoryStateStore({ initial: persisted }), config);
await resumed.init();
const restored = resumed.snapshot();
const restoredDecision = restored.traces.find(row => row.id === decision.id);
assert.ok(restoredDecision?.memoryEvidence,
  'the decision-bound memory receipt must survive Core snapshot/restore');
assert.deepEqual(restoredDecision.memoryEvidence, receipt);
const restoredLink = restored.system.memoryWorldCausalBridge.recent.find(row =>
  row.id === receipt.memoryWorldCausalLinkId);
assert.equal(restoredLink?.decisionId, decision.id,
  'the causal projection must preserve the same decision binding after restore');

console.log('MEMORY_DECISION_RECEIPT_WORKPASS74=PASS', JSON.stringify({
  tick: decision.tick,
  memoryCount: receipt.retrievedCount,
  memoryWorldDelta01: receipt.counterfactualDelta01,
  decisionBound: restoredLink?.decisionId === decision.id,
  restored: true,
}));
