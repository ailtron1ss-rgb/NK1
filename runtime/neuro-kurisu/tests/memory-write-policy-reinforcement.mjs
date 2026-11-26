import assert from 'node:assert/strict';
import { MemoryWritePolicy } from '../src/organism/system/MemoryWritePolicy.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

// The policy used to see each memory exactly once, at write time. With one observation the
// stability gate (minimumUpdates = 8) could never promote and the eviction weight stayed at a
// third of its strength, so retrieval reinforcement is the evidence stream that makes the
// per-memory history real. These assertions pin that down.

// --- reinforcement accumulates history and eventually clears the stability gate ---
const policy = new MemoryWritePolicy({ mode: 'active' });
policy.observeOutcome({ tick: 0, id: 'm-stable', success01: 0.9, predictionError01: 0.05, retentionScore01: 0.6 });
const afterWrite = policy.observeReinforcement({ tick: 1, id: 'm-stable', salience01: 0.6, predictionError01: 0.05 });
assert.equal(afterWrite.observations, 2, 'reinforcement must build on the write observation');
assert.equal(afterWrite.promoteEligible, false, 'two observations are not enough for the gate');

let last = afterWrite;
for (let tick = 2; tick <= 9; tick++) last = policy.observeReinforcement({ tick, id: 'm-stable', salience01: 0.6, predictionError01: 0.05 });
assert.ok(last.observations >= 8, `expected >= 8 observations, got ${last.observations}`);
assert.equal(last.promoteEligible, true, 'stable, low-error reinforcement must satisfy the gate');
assert.ok(policy.diagnostics().reinforcements >= 8);
assert.ok(policy.diagnostics().promoteEligible >= 1, 'promotion eligibility must be counted');

// --- a well-evidenced memory is protected at full strength, an unobserved one is untouched ---
const protectedWeight = policy.evictionWeight01('m-stable');
assert.ok(protectedWeight > 1, `stable reinforced memory must be protected, got ${protectedWeight}`);
assert.ok(protectedWeight <= 1.2, `weight must stay inside the documented bound, got ${protectedWeight}`);
assert.equal(policy.evictionWeight01('never-seen'), 1, 'unobserved memory keeps the default order');

// --- the counters are part of the persisted slice ---
const snapshot = policy.snapshot();
const restored = new MemoryWritePolicy({ mode: 'active' });
restored.restore(snapshot);
const restoredDiagnostics = restored.diagnostics();
assert.equal(restoredDiagnostics.reinforcements, policy.diagnostics().reinforcements, 'reinforcement count must survive restore');
assert.equal(restoredDiagnostics.promoteEligible, policy.diagnostics().promoteEligible);
assert.equal(restored.evictionWeight01('m-stable'), protectedWeight, 'restored history must produce the same weight');

// --- batched deep-work routing is bounded and reproducible ---
const batch = [
    { id: 'a', predictionError01: 0.9, uncertainty01: 0.9 },
    { id: 'b', predictionError01: 0.05, uncertainty01: 0.05 },
    { id: 'c', predictionError01: 0.5, uncertainty01: 0.4 },
    { id: 'd', predictionError01: 0.1, uncertainty01: 0.2 },
];
const plan = policy.planDeepWork(batch);
assert.equal(plan.mask.length, batch.length, 'one routing bit per candidate');
assert.ok(plan.deepCount >= 1, 'at least one candidate must take the expensive path');
assert.ok(plan.deepFraction01 <= 0.95 + 1e-9 && plan.deepFraction01 >= 0.05 - 1e-9, `fraction out of the bounded contract: ${plan.deepFraction01}`);
const replay = policy.planDeepWork(batch);
assert.deepEqual(replay.mask, plan.mask, 'identical batches must route identically');
assert.ok(policy.diagnostics().deepWorkBatch.passes >= 2);
assert.equal(policy.diagnostics().deepWorkBatch.candidates, batch.length * 2);

// A batch with no internal differences must not send everything down the expensive path: the
// relative threshold is strict, so the selector falls back to the minimum fraction instead.
const flat = Array.from({ length: 4 }, (_, index) => ({ id: `flat-${index}`, predictionError01: 0.4, uncertainty01: 0.3 }));
const flatPlan = policy.planDeepWork(flat);
assert.equal(flatPlan.deepCount, 1, `identically difficult batch must route the minimum, got ${flatPlan.deepCount}`);
assert.equal(flatPlan.reason, 'raised-to-minimum');
assert.ok(plan.deepFraction01 > 0.25 && plan.deepFraction01 < 0.95, `varied batch must be split, got ${plan.deepFraction01}`);

// --- `off` must cost nothing: no state, no counters, same as decide()/evictionWeight01() ---
const offPolicy = new MemoryWritePolicy({ mode: 'off' });
const offReinforcement = offPolicy.observeReinforcement({ tick: 1, id: 'm-off', salience01: 0.5, predictionError01: 0.1 });
assert.equal(offReinforcement.observations, 0, 'off mode must not accumulate history');
const offPlan = offPolicy.planDeepWork(batch);
assert.equal(offPlan.deepCount, 0);
assert.equal(offPolicy.diagnostics().reinforcements, 0);
assert.equal(offPolicy.diagnostics().deepWorkBatch.passes, 0);
assert.equal(offPolicy.diagnostics().trackedMemories, 0);
assert.equal(offPolicy.evictionWeight01('m-off'), 1);

// --- the runtime feeds both streams from real cycles ---
const cfg = { enableLanguage: false, checkpointMinIntervalMs: 0, checkpointMaxDirtyCycles: 1, cycleResultMode: 'operational', performanceProfile: 'mobile', enableWorldModel: true, enableSelfProjects: true, enableAgencyModel: true, enableLifelongLearning: true };
const store = new MemoryStateStore();
const core = new OrganismCore(store, cfg);
await core.init();
for (let i = 0; i < 12; i++) {
    await core.observe({
        text: `reinforcement evidence cycle ${i % 3} about the same lab routine`,
        worldContext: { location: 'assimilation-lab', objects: [{ label: 'lamp', visible: true }], events: [] },
        novelty: 0.3, reward: 0.6, success: 0.7,
        embodiment: { bodyEnergy01: 0.8, cognitiveCapacity01: 0.8, thermalStrain01: 0.2, sensoryFreshness01: 0.8, awake: true, battery01: 0.8, cpuLoad01: 0.2, ramPressure01: 0.2 },
    });
    await core.feedback({ success: 0.7, reward: 0.6, evidenceSource: 'internal-observation' });
}
const live = core.memoryWritePolicySnapshot();
assert.ok(live.reinforcements > 0, 'retrieval must feed the policy in a real cycle');
assert.ok(live.deepWorkBatch.passes > 0, 'the consolidation batch must reach the deep-work selector');

const restarted = new OrganismCore(store, cfg);
await restarted.init();
const afterRestart = restarted.memoryWritePolicySnapshot();
assert.equal(afterRestart.reinforcements, live.reinforcements, 'reinforcement evidence must survive restart');
assert.equal(afterRestart.deepWorkBatch.passes, live.deepWorkBatch.passes, 'batch routing counters must survive restart');

console.log(`MEMORY_WRITE_POLICY_REINFORCEMENT=PASS ${JSON.stringify({
    reinforcements: live.reinforcements,
    promoteEligible: live.promoteEligible,
    protectedWeight: Number(protectedWeight.toFixed(4)),
    deepWorkBatch: live.deepWorkBatch,
})}`);
