import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const cfg = { enableLanguage: false, checkpointMinIntervalMs: 0, checkpointMaxDirtyCycles: 1, cycleResultMode: 'operational', performanceProfile: 'mobile', enableWorldModel: true, enableSelfProjects: true, enableAgencyModel: true, enableLifelongLearning: true };

const cycle = async (core, i) => {
  await core.observe({
    text: `write policy assimilation cycle ${i}`,
    worldContext: { location: 'assimilation-lab', objects: [{ label: i % 2 ? 'lamp' : 'table', visible: true }], events: [{ type: 'pulse', importance: 0.6 }] },
    novelty: 0.42 + (i % 4) * 0.07,
    reward: i % 3 === 0 ? 0.82 : 0.61,
    success: i % 3 === 0 ? 0.78 : 0.64,
    embodiment: { bodyEnergy01: 0.84, cognitiveCapacity01: 0.86, thermalStrain01: 0.18, sensoryFreshness01: 0.9, awake: true, battery01: 0.81, cpuLoad01: 0.23, ramPressure01: 0.22 },
  });
  await core.feedback({ success: i % 3 === 0 ? 0.8 : 0.65, reward: i % 3 === 0 ? 0.84 : 0.62, evidenceSource: 'internal-observation' });
};

// --- shadow mode is the default and never changes retention behaviour ---
const store = new MemoryStateStore();
const core = new OrganismCore(store, cfg);
await core.init();
for (let i = 0; i < 10; i++) await cycle(core, i);

const shadow = core.memoryWritePolicySnapshot();
assert.equal(shadow.mode, 'shadow', 'default mode must be shadow');
assert.ok(shadow.decisions > 0, 'shadow mode must still record decisions');
assert.equal(shadow.activeDecisions, 0);
assert.ok(shadow.meanWriteGain01 >= 0.75 && shadow.meanWriteGain01 <= 1.25, `mean gain out of bounds: ${shadow.meanWriteGain01}`);
assert.ok(shadow.trackedMemories > 0, 'per-memory stability history must be tracked');
assert.equal(shadow.hippo.order, 8);
assert.ok(shadow.hippo.samples > 0, 'HiPPO history must consume the error stream');

// --- the slice is part of the persisted state and survives a restart ---
const persisted = core.memoryRetentionEconomySnapshot();
assert.ok(persisted, 'retention economy snapshot must exist');
const beforeRestart = core.memoryWritePolicySnapshot();

const restarted = new OrganismCore(store, cfg);
await restarted.init();
const afterRestart = restarted.memoryWritePolicySnapshot();
assert.equal(afterRestart.decisions, beforeRestart.decisions, 'decision count must survive restart');
assert.equal(afterRestart.mode, 'shadow');
assert.ok(Math.abs(afterRestart.hippo.stateNorm - beforeRestart.hippo.stateNorm) < 1e-6, 'HiPPO history state must be restored');
assert.ok(afterRestart.trackedMemories > 0, 'per-memory history must be restored');

// --- active mode is opt-in through the environment ---
const previous = process.env.NEURO_MEMORY_WRITE_POLICY;
process.env.NEURO_MEMORY_WRITE_POLICY = 'active';
const activeStore = new MemoryStateStore();
const activeCore = new OrganismCore(activeStore, cfg);
await activeCore.init();
for (let i = 0; i < 6; i++) await cycle(activeCore, i);
const active = activeCore.memoryWritePolicySnapshot();
assert.equal(active.mode, 'active');
assert.ok(active.activeDecisions > 0, 'active mode must count applied decisions');
if (previous === undefined) delete process.env.NEURO_MEMORY_WRITE_POLICY;
else process.env.NEURO_MEMORY_WRITE_POLICY = previous;

console.log(`MEMORY_WRITE_POLICY_RUNTIME=PASS ${JSON.stringify({
  shadowDecisions: shadow.decisions,
  shadowGain: Number(shadow.meanWriteGain01.toFixed(3)),
  tracked: shadow.trackedMemories,
  restoredDecisions: afterRestart.decisions,
  activeDecisions: active.activeDecisions,
  promotions: active.promotions,
})}`);
