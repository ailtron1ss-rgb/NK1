import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

// Opt-in evaluation (~4 minutes). The pressure benchmark showed the eviction weight engages but
// its byte effect changes sign between runs. The question that matters is different: when the
// policy protects a memory, is it a memory the runtime actually uses again? Retention value
// without retrieval value is just a bigger store.
const STEPS = Number(process.argv[2] || 150);
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
    // Repeating the same few topics makes retrieval non-trivial: if every observation were
    // unique, nothing would ever be recalled and the metric would be meaningless.
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
  const retrievals = items.map((item) => Number(item.retrievalCount ?? 0));
  const used = retrievals.filter((count) => count > 0).length;
  return {
    mode,
    survivors: items.length,
    bytes: budget.estimatedBytes,
    budget: budget.byteBudget,
    evictions: budget.budgetEvictions,
    totalRetrievals: retrievals.reduce((total, count) => total + count, 0),
    usedMemories: used,
    usedShare01: items.length ? Number((used / items.length).toFixed(4)) : 0,
    bytesPerRetrieval: retrievals.reduce((total, count) => total + count, 0) > 0
      ? Number((budget.estimatedBytes / retrievals.reduce((total, count) => total + count, 0)).toFixed(1))
      : null,
    reinforcements: policy.reinforcements,
    evictionAdjusted: policy.evictionAdjusted,
    evictionShadowWouldAdjust: policy.evictionShadowWouldAdjust,
  };
}

const shadow = await run('shadow');
const active = await run('active');

// Invariants only: the runtime is not bit-reproducible between runs, so the numbers are reported
// side by side and any claim about a winner has to survive repetition.
if (!(shadow.totalRetrievals > 0)) throw new Error('the benchmark must produce retrievals, otherwise the metric is empty');
if (!(active.totalRetrievals > 0)) throw new Error('the benchmark must produce retrievals in active mode too');
if (!(shadow.reinforcements > 0 && active.reinforcements > 0)) throw new Error('retrieval reinforcement must reach the policy in both modes');

console.log(`MEMORY_WRITE_POLICY_RETRIEVAL_HIT=PASS ${JSON.stringify({ steps: STEPS, shadow, active })}`);
