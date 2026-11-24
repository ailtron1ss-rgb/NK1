import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const dir = await mkdtemp(path.join(tmpdir(), 'p2853-core-'));
const makeRuntime = (stateFile, worldStateFile, initial) => new OrganismRuntime({
  stateFile,
  worldStateFile,
  enableLanguage: false,
  stateStore: new MemoryStateStore(initial ? { initial } : undefined),
  worldStateStore: new MemoryStateStore(),
  journal: new BoundedOperationalJournal(),
  performanceProfile: 'mobile',
  cycleResultMode: 'summary',
});

try {
  const runtime = makeRuntime(
    path.join(dir, 'state.json'),
    path.join(dir, 'world.json'),
  );
  await runtime.init();

  for (let i = 0; i < 12; i += 1) await runtime.autonomousStep();

  const after = runtime.core.neuralExperienceBranchDiagnostics();
  assert.equal(after.version, 32);
  assert(after.tick >= 12, 'core did not advance to the expected tick horizon');
  assert(after.crossModalUpdates >= 12, 'cross-modal binding did not execute through the core');
  assert(after.offlineConsolidation.cycles >= 1, 'offline consolidation did not execute through the core');
  assert(after.multiscalePlasticityUpdates >= 12, 'multiscale plasticity did not execute through the core');
  assert(after.slowMemoryConsolidation.retrievals >= 12, 'slow-memory retrieval did not execute through the core');
  assert(after.slowMemoryConsolidation.visits.some((count) => count > 0), 'slow-memory contexts remained empty');
  assert(after.hierarchicalSlowMemory.retrievals >= 12, 'hierarchical slow-memory retrieval did not execute through the core');

  const snapshot = runtime.core.snapshot();
  const restored = makeRuntime(
    path.join(dir, 'state2.json'),
    path.join(dir, 'world2.json'),
    snapshot,
  );
  await restored.init();
  const rd = restored.core.neuralExperienceBranchDiagnostics();

  assert.equal(rd.version, 32);
  assert.deepEqual(rd.slowMemoryConsolidation.visits, after.slowMemoryConsolidation.visits, 'slow-memory context visits did not persist');
  assert.equal(rd.hierarchicalSlowMemory.updates, after.hierarchicalSlowMemory.updates, 'hierarchical slow-memory updates did not persist');
  assert.equal(rd.hierarchicalSlowMemory.actionUpdates, after.hierarchicalSlowMemory.actionUpdates, 'hierarchical action policy did not persist');
  assert.equal(rd.slowMemoryConsolidation.updates, after.slowMemoryConsolidation.updates, 'slow-memory update count did not persist');
  assert.equal(rd.slowMemoryConsolidation.retrievals, after.slowMemoryConsolidation.retrievals, 'slow-memory retrieval count did not persist');
  assert.equal(rd.offlineConsolidation.cycles, after.offlineConsolidation.cycles, 'offline consolidation cycles did not persist');
  assert.equal(rd.multiscalePlasticityUpdates, after.multiscalePlasticityUpdates, 'multiscale plasticity did not persist');
  assert.equal(rd.replayTransferRejected, after.replayTransferRejected, 'transfer gate state did not persist');

  console.log(JSON.stringify({
    ok: true,
    tick: after.tick,
    version: after.version,
    slowMemory: {
      visits: after.slowMemoryConsolidation.visits,
      retrievals: after.slowMemoryConsolidation.retrievals,
      updates: after.slowMemoryConsolidation.updates,
      agreement01: after.slowMemoryConsolidation.agreement01,
      stability01: after.slowMemoryConsolidation.stability01,
      hierarchicalRetrievals: after.hierarchicalSlowMemory.retrievals,
      hierarchicalUpdates: after.hierarchicalSlowMemory.updates,
      schemaVisits: after.hierarchicalSlowMemory.schemaVisits,
      actionUpdates: after.hierarchicalSlowMemory.actionUpdates,
    },
    offline: {
      cycles: after.offlineConsolidation.cycles,
      replaySamples: after.offlineConsolidation.replaySamples,
    },
    multiscaleUpdates: after.multiscalePlasticityUpdates,
    transferRejected: after.replayTransferRejected,
    persisted: true,
  }, null, 2));

  await restored.stop();
  await runtime.stop();
} finally {
  await rm(dir, { recursive: true, force: true });
}
