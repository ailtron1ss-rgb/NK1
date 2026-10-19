import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core = new OrganismCore(new MemoryStateStore(), {
  cycleResultMode: 'operational',
  checkpointMinIntervalMs: 60_000,
  checkpointMaxDirtyCycles: 64,
});
await core.init();

const samples = [];
for (let i = 0; i < 40; i += 1) {
  const started = performance.now();
  await core.observeOperational({
    text: i === 17 ? 'performance spine external refresh probe' : undefined,
    embodiment: {
      bodyEnergy01: .8, thermalStrain01: .18, cognitiveCapacity01: .82,
      sensoryFreshness01: .86, awake: true, battery01: .8, cpuLoad01: .22, ramPressure01: .2,
    },
  });
  samples.push(performance.now() - started);
}

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

const p = core.snapshot();
const spine = core.cognitiveSpineScheduleSnapshot();
const first = median(samples.slice(4, 16));
const last = median(samples.slice(-12));
const ratio = last / Math.max(first, .001);
const perceptionTick = p.facets?.embodiment?.p41TemporalPerception?.tick ?? 0;

assert.ok(p.state.tick >= 40);
assert.ok(spine.opportunities.research > 0);
assert.ok(spine.skips.research > 0 || spine.skips.shadow > 0 || spine.skips.project > 0, 'spine should skip at least one cold operation');
assert.ok(perceptionTick <= p.state.tick, 'perception cadence cannot lead organism tick');
assert.ok(ratio < 8, `short performance scaling unexpectedly high: ${ratio}`);

console.log(`BIG_PASS_41_PERFORMANCE_SPINE=PASS tick=${p.state.tick} firstMedianMs=${first.toFixed(2)} lastMedianMs=${last.toFixed(2)} ratio=${ratio.toFixed(3)} perceptionTick=${perceptionTick} spineSavings=${spine.savings01.toFixed(3)}`);
