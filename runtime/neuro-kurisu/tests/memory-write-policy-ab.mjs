import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

/**
 * Controlled A/B for the assimilated write policy.
 *
 * The core step path contains no Math.random, so two runs with the same config and the
 * same input sequence are comparable: the only difference is `shadow` vs `active`.
 * This test answers the question the unit tests cannot: does enabling the policy change
 * retention outcomes, and does it stay inside its declared bounds?
 */
const cfg = { enableLanguage: false, checkpointMinIntervalMs: 0, checkpointMaxDirtyCycles: 1, cycleResultMode: 'operational', performanceProfile: 'mobile', enableWorldModel: true, enableSelfProjects: true, enableAgencyModel: true, enableLifelongLearning: true };
const STEPS = 24;

const input = i => ({
  text: `ablation memory record ${i}: the lab lamp flickers during the calibration run`,
  worldContext: { location: 'ablation-lab', objects: [{ label: i % 3 ? 'lamp' : 'table', visible: true }], events: [{ type: 'pulse', importance: 0.55 + (i % 5) * 0.08 }] },
  novelty: 0.3 + (i % 6) * 0.1,
  reward: i % 4 === 0 ? 0.8 : 0.55,
  success: i % 4 === 0 ? 0.75 : 0.6,
  embodiment: { bodyEnergy01: 0.8, cognitiveCapacity01: 0.85, thermalStrain01: 0.2, sensoryFreshness01: 0.88, awake: true, battery01: 0.78, cpuLoad01: 0.25, ramPressure01: 0.25 },
});

async function run(mode) {
  const previous = process.env.NEURO_MEMORY_WRITE_POLICY;
  process.env.NEURO_MEMORY_WRITE_POLICY = mode;
  try {
    const core = new OrganismCore(new MemoryStateStore(), cfg);
    await core.init();
    for (let i = 0; i < STEPS; i++) {
      await core.observe(input(i));
      await core.feedback({ success: i % 4 === 0 ? 0.78 : 0.62, reward: i % 4 === 0 ? 0.8 : 0.6, evidenceSource: 'internal-observation' });
    }
    const retention = core.memoryRetentionEconomySnapshot();
    const policy = core.memoryWritePolicySnapshot();
    const stateBytes = new TextEncoder().encode(JSON.stringify({ retention, policy })).byteLength;
    return { retention, policy, stateBytes };
  } finally {
    if (previous === undefined) delete process.env.NEURO_MEMORY_WRITE_POLICY;
    else process.env.NEURO_MEMORY_WRITE_POLICY = previous;
  }
}

const shadowA = await run('shadow');
const shadowB = await run('shadow');
const active = await run('active');

// 1. The experiment must be stable enough to compare. The runtime derives several
//    features from wall-clock time, so runs are not bit-identical; counts must match
//    and the aggregate score must stay inside a tight tolerance.
assert.equal(shadowA.retention.evaluations, shadowB.retention.evaluations, 'shadow runs must evaluate the same number of writes');
assert.equal(shadowA.retention.retained, shadowB.retention.retained, 'shadow runs must retain the same count');
assert.equal(shadowA.retention.dormantCandidates, shadowB.retention.dormantCandidates, 'shadow runs must agree on dormancy');
const shadowDrift = Math.abs(shadowA.retention.meanScore01 - shadowB.retention.meanScore01);
assert.ok(shadowDrift < 0.02, `shadow runs drifted too far (${shadowDrift.toFixed(4)}); the comparison would be meaningless`);

// 2. Active mode must actually apply the policy.
assert.ok(shadowA.policy.decisions > 0, 'shadow run must record decisions');
assert.equal(shadowA.policy.activeDecisions, 0);
assert.ok(active.policy.activeDecisions > 0, 'active run must count applied decisions');
assert.equal(active.retention.evaluations, shadowA.retention.evaluations, 'the policy must not skip assessments');

// 3. The policy must stay inside its declared bounds.
const gainDelta = Math.abs(active.policy.meanWriteGain01 - shadowA.policy.meanWriteGain01);
assert.ok(gainDelta < 0.05, `mean gain drifted too far between modes: ${gainDelta}`);
assert.ok(active.policy.meanWriteGain01 >= 0.75 && active.policy.meanWriteGain01 <= 1.25);
const dormantDelta = Math.abs(active.retention.dormantCandidates - shadowA.retention.dormantCandidates);
assert.ok(dormantDelta <= Math.ceil(shadowA.retention.evaluations * 0.25), `dormancy changed too much: ${dormantDelta}`);
const retainedDelta = Math.abs(active.retention.retained - shadowA.retention.retained);
assert.ok(retainedDelta <= Math.ceil(shadowA.retention.evaluations * 0.25), `retention changed too much: ${retainedDelta}`);

// 4. Bounded cost: the extra slice must stay small relative to the retention slice.
const growth01 = (active.stateBytes - shadowA.stateBytes) / Math.max(1, shadowA.stateBytes);
assert.ok(growth01 < 0.05, `policy slice grew state by ${(growth01 * 100).toFixed(1)}%`);

const report = {
  evaluations: shadowA.retention.evaluations,
  shadow: { retained: shadowA.retention.retained, dormant: shadowA.retention.dormantCandidates, discard: shadowA.retention.discardCandidates, meanScore: Number(shadowA.retention.meanScore01.toFixed(4)), gain: Number(shadowA.policy.meanWriteGain01.toFixed(4)) },
  active: { retained: active.retention.retained, dormant: active.retention.dormantCandidates, discard: active.retention.discardCandidates, meanScore: Number(active.retention.meanScore01.toFixed(4)), gain: Number(active.policy.meanWriteGain01.toFixed(4)) },
  stateDeltaPct: Number((growth01 * 100).toFixed(2)),
};
console.log('MEMORY_WRITE_POLICY_AB=PASS ' + JSON.stringify(report));
