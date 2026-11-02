/**
 * WorkPass-A03 end-to-end: attention allocation, workspace competition and the
 * unified cognitive cycle inside one running organism.
 *
 * This asserts observable behaviour of the real OrganismRuntime (not a synthetic
 * single-module fixture) and measures bounded latency. It does not claim
 * real-world attention quality, only that the mechanism runs, stays bounded,
 * survives restart and is traceable through the cycle.
 */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const dir = await mkdtemp(path.join(tmpdir(), 'nk-a03-'));
// A shared store instance models the durable medium: a new runtime process reads
// the snapshot the previous process checkpointed.
const stateStore = new MemoryStateStore();
const worldStore = new MemoryStateStore();
const makeRuntime = () => new OrganismRuntime({
  stateFile: path.join(dir, 'state.json'), worldStateFile: path.join(dir, 'world.json'),
  enableLanguage: false, stateStore, worldStateStore: worldStore,
  journal: new BoundedOperationalJournal(), performanceProfile: 'mobile', cycleResultMode: 'summary',
});

try {
  const runtime = makeRuntime();
  await runtime.init();
  const steps = 40;
  const latencies = [];
  for (let i = 0; i < steps; i++) {
    const startedAt = performance.now();
    await runtime.autonomousStep();
    latencies.push(performance.now() - startedAt);
  }

  const memory = runtime.core.memorySnapshot();
  const attention = memory.attention;
  const workspace = memory.workspace;
  const allocator = memory.attentionAllocator;

  // 1. Attention is a real decision with provenance, not a fixed label.
  assert.ok(attention?.decision, 'attention must carry a decision trace');
  assert.ok(typeof attention.decision.target === 'string' && attention.decision.target.length > 0);
  assert.ok(attention.decision.considered >= 1, 'allocation must consider at least one candidate');
  assert.ok(Number.isFinite(attention.confidence) && attention.confidence >= 0 && attention.confidence <= 1);
  assert.ok(Number.isFinite(attention.salience));
  assert.ok(['full', 'degraded', 'minimal'].includes(attention.decision.resourceMode));
  assert.equal(typeof attention.decision.factors.goal, 'number');

  // 2. Allocator state is persisted and coherent.
  assert.ok(allocator, 'allocator state must be persisted for restart');
  assert.ok(allocator.allocations >= steps, `allocator must have run each cycle (got ${allocator.allocations})`);
  assert.ok(allocator.switches <= allocator.allocations);
  // Stability: a reliable allocator must not flip every cycle. The observed run
  // switched 6/40; the bound leaves room for environment variance while still
  // catching a return of the per-cycle thrash defect (33/40).
  assert.ok(allocator.switches <= Math.ceil(allocator.allocations * .6), `attention thrash: ${allocator.switches}/${allocator.allocations} switches`);

  // 3. The workspace stays bounded, de-duplicated and genuinely contested.
  assert.ok(workspace.items.length <= workspace.capacity, 'workspace must stay within capacity');
  assert.equal(new Set(workspace.items.map(item => item.id)).size, workspace.items.length, 'workspace ids must be unique');
  assert.ok(Array.isArray(workspace.suppressed) && workspace.suppressed.length <= 8);
  assert.ok((workspace.competitors ?? 0) >= workspace.items.length);
  assert.ok(workspace.lastDecision && Array.isArray(workspace.lastDecision.admitted));
  // Attention/workspace integration: the coalition must carry more than one
  // cognitive source, i.e. attention content competes with decision candidates.
  const workspaceSources = [...new Set(workspace.items.map(item => item.source))];
  assert.ok(workspaceSources.length >= 2, `workspace coalition must span sources (got ${workspaceSources.join(',')})`);

  // 4. The unified cognitive cycle counts attention/workspace evidence.
  const cycle = runtime.core.unifiedCognitiveCycleSnapshot();
  assert.ok(cycle.cycles >= steps, `cycle must evaluate every step (got ${cycle.cycles})`);
  assert.ok(cycle.completeCycles > 0, 'at least one cycle must be complete in a clean autonomous run');
  assert.ok(!(cycle.lastMissingStages ?? []).includes('attention'), 'attention must not be missing from the cycle');

  // 5. The attention stage event is recorded with the new provenance payload.
  const fabric = runtime.core.cognitiveEventFabricSnapshot();
  const events = fabric?.recent ?? [];
  const attentionEvents = events.filter(event => event.stage === 'attention');
  assert.ok(attentionEvents.length > 0, 'attention stage events must be recorded');
  const lastAttentionEvent = attentionEvents.at(-1);
  assert.ok('attentionTarget' in (lastAttentionEvent.payload ?? {}), 'attention event must carry the selected target');

  // 6. Measured cost: report observed latency; a pathological regression (e.g.
  //    unbounded competition) would show up as a large p95.
  latencies.sort((a, b) => a - b);
  const median = latencies[Math.floor(latencies.length / 2)];
  const p95 = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * .95))];
  assert.ok(Number.isFinite(median) && median > 0);

  // 7. Restart: attention/workspace state must survive and continue to advance.
  //    `stop()` performs the durable checkpoint, exactly as a real shutdown.
  await runtime.stop();
  const restored = makeRuntime();
  await restored.init();
  const restoredMemory = restored.core.memorySnapshot();
  assert.equal(restoredMemory.workspace.items.length, workspace.items.length, 'workspace coalition must survive restart');
  assert.ok(restoredMemory.attentionAllocator, 'allocator state must survive restart');
  assert.ok(restoredMemory.attentionAllocator.allocations >= allocator.allocations - 1);
  await restored.autonomousStep();
  const afterRestart = restored.core.memorySnapshot();
  assert.ok(afterRestart.attention?.decision, 'attention must resume after restart');
  assert.ok(afterRestart.workspace.items.length <= afterRestart.workspace.capacity);
  await restored.stop();

  console.log(JSON.stringify({
    pass: true, steps, medianStepMs: Number(median.toFixed(2)), p95StepMs: Number(p95.toFixed(2)),
    attention: { target: attention.decision.target, reason: attention.decision.reason, mode: attention.decision.resourceMode, switches: allocator.switches },
    workspace: { items: workspace.items.length, capacity: workspace.capacity, competitors: workspace.competitors, sources: [...new Set(workspace.items.map(i => i.source))] },
    cycle: { cycles: cycle.cycles, complete: cycle.completeCycles, coverage: Number(cycle.meanStageCoverage01.toFixed(3)) },
  }));
} finally {
  await rm(dir, { recursive: true, force: true });
}
