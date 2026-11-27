import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

// Opt-in benchmark: ~2 minutes. It answers a question the unit tests cannot — does the
// eviction weight change anything under real byte-budget pressure, and in which direction.
const STEPS = Number(process.argv[2] || 120);
const cfg = {
  enableLanguage: false, checkpointMinIntervalMs: 0, checkpointMaxDirtyCycles: 1,
  cycleResultMode: 'operational', performanceProfile: 'mobile',
  enableWorldModel: true, enableSelfProjects: true, enableAgencyModel: true, enableLifelongLearning: true,
};

async function run(mode) {
  const previous = process.env.NEURO_MEMORY_WRITE_POLICY;
  process.env.NEURO_MEMORY_WRITE_POLICY = mode;
  const core = new OrganismCore(new MemoryStateStore(), cfg);
  await core.init();
  for (let i = 0; i < STEPS; i++) {
    const success = 0.3 + 0.4 * ((i % 4) / 4);
    const reward = 0.2 + 0.3 * ((i % 3) / 3);
    await core.observe({
      text: `note ${i % 7} about lab routine ${i % 13}`,
      worldContext: { location: 'lab', objects: [], events: [] },
      novelty: 0.3 + 0.2 * ((i % 5) / 5), reward, success,
      embodiment: {
        bodyEnergy01: 0.6, cognitiveCapacity01: 0.6, thermalStrain01: 0.3, sensoryFreshness01: 0.6,
        awake: true, battery01: 0.6, cpuLoad01: 0.4, ramPressure01: 0.4,
      },
    });
    await core.feedback({ success, reward, evidenceSource: 'internal-observation' });
  }
  const budget = core.memorySubsystem.memoryOS.budgetDiagnostics();
  const items = core.memorySubsystem.memoryOS.snapshot().items ?? [];
  const policy = core.memoryWritePolicySnapshot();
  if (previous === undefined) delete process.env.NEURO_MEMORY_WRITE_POLICY;
  else process.env.NEURO_MEMORY_WRITE_POLICY = previous;
  const mean = (pick) => (items.length ? Number((items.reduce((total, item) => total + pick(item), 0) / items.length).toFixed(4)) : 0);
  return {
    mode,
    survivors: items.length,
    bytes: budget.estimatedBytes,
    budget: budget.byteBudget,
    evictions: budget.budgetEvictions,
    meanConfidence: mean((m) => m.confidence ?? 0),
    meanSalience: mean((m) => m.salience ?? 0),
    meanPredictionError: mean((m) => m.predictionError ?? 0),
    adjusted: policy.evictionAdjusted,
    shadowWouldAdjust: policy.evictionShadowWouldAdjust,
  };
}

const shadow = await run('shadow');
const active = await run('active');

// Invariants only. The quality deltas are smaller than the run-to-run spread of this runtime
// (wall-clock derived features), so the benchmark reports them instead of asserting a winner.
if (!(shadow.shadowWouldAdjust > 0)) throw new Error(`shadow must record would-be adjustments, got ${shadow.shadowWouldAdjust}`);
if (!(active.adjusted > 0)) throw new Error(`active must apply eviction weights, got ${active.adjusted}`);
if (!(shadow.evictions > 0 && active.evictions > 0)) throw new Error('both runs must exercise byte-budget eviction');
for (const run of [shadow, active]) {
  if (run.bytes > run.budget * 1.08) throw new Error(`${run.mode} overshoots the byte budget: ${run.bytes} > ${run.budget}`);
}

console.log(`MEMORY_WRITE_POLICY_EVICTION_PRESSURE=PASS ${JSON.stringify({ steps: STEPS, shadow, active })}`);
