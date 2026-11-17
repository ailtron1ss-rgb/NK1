import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nk1-open-loop-runtime-'));
const config = {
  stateFile: path.join(directory, 'organism.json'),
  worldStateFile: path.join(directory, 'world.json'),
  stateStore: new MemoryStateStore(),
  worldStateStore: new MemoryStateStore(),
  journal: new BoundedOperationalJournal(),
  intervalMs: 60_000,
  enableLanguage: false,
  autoRun: false,
  checkpointMinIntervalMs: 0,
  checkpointMaxDirtyCycles: 1,
};
try {
  const runtime = new OrganismRuntime(config);
  await runtime.init();
  assert.equal((await runtime.openLoopSnapshot()).records.length, 0);

  const obligation = await runtime.registerOpenLoop({
    title: 'Verify the next NK1 integration result',
    description: 'Persist across runtime restart and surface only when due.',
    kind: 'task',
    owner: 'system',
    accepted: true,
    source: 'runtime-integration-test',
    dueAt: Date.now() - 1,
    priority: 0.8,
  });
  const diagnostics = await runtime.openLoopDiagnostics();
  assert.equal(diagnostics.activeCount, 1);
  assert.equal(diagnostics.readyToSurface, 1);

  await runtime.acknowledgeOpenLoopSurfaced(obligation.id);
  await runtime.flush();
  await runtime.stop();

  const restarted = new OrganismRuntime(config);
  await restarted.init();
  const restored = await restarted.openLoopSnapshot();
  assert.equal(restored.records.length, 1, 'sidecar state must survive organism runtime restart');
  assert.equal(restored.records[0].id, obligation.id);
  assert.equal(restored.records[0].lastSurfacedAt > 0, true);
  const suppressed = await restarted.scanOpenLoops({ now: Date.now(), reminderCooldownMs: 60_000 });
  assert.equal(suppressed[0]?.shouldSurface, false, 'acknowledged surfacing must survive restart and retain cooldown');

  await assert.rejects(() => restarted.registerOpenLoop({
    title: 'Unaccepted task', kind: 'task', owner: 'system', accepted: false, source: 'test',
  }), /explicit-acceptance-required/);

  await restarted.fulfillOpenLoop(obligation.id, {
    kind: 'execution-receipt', reference: 'runtime-test:verified-result', verifiedAt: Date.now(),
  });
  const final = await restarted.openLoopSnapshot();
  assert.equal(final.records[0].status, 'fulfilled');
  assert.equal(final.records[0].closureEvidence?.reference, 'runtime-test:verified-result');
  await restarted.flush();
  await restarted.stop();

  const dialogueConfig = {
    ...config,
    stateFile: path.join(directory, 'dialogue-organism.json'),
    worldStateFile: path.join(directory, 'dialogue-world.json'),
    stateStore: new MemoryStateStore(),
    worldStateStore: new MemoryStateStore(),
  };
  const dialogueRuntime = new OrganismRuntime(dialogueConfig);
  await dialogueRuntime.init();
  const dialogueObligation = await dialogueRuntime.registerOpenLoop({
    title: 'Revisit the accepted causal-memory follow-up',
    kind: 'task', owner: 'user', accepted: true,
    source: 'runtime-dialogue-bridge-test', dueAt: Date.now() - 1,
  });
  const initiativeId = 'soc:open-loop:runtime:001';
  await dialogueRuntime.reserveOpenLoopForAutonomousInitiative(dialogueObligation.id, initiativeId);
  assert.equal((await dialogueRuntime.scanOpenLoops({ reminderCooldownMs: 0 }))
    .find(row => row.record.id === dialogueObligation.id)?.shouldSurface, false);
  await dialogueRuntime.flush();
  await dialogueRuntime.stop();

  const dialogueRestarted = new OrganismRuntime(dialogueConfig);
  await dialogueRestarted.init();
  const reservedAfterRestart = (await dialogueRestarted.openLoopSnapshot()).records
    .find(row => row.id === dialogueObligation.id);
  assert.equal(reservedAfterRestart?.pendingSurfacingInitiativeId, initiativeId,
    'runtime restart must retain which proactive initiative owns the pending surfacing reservation');
  assert.equal((await dialogueRestarted.scanOpenLoops({ reminderCooldownMs: 0 }))
    .find(row => row.record.id === dialogueObligation.id)?.shouldSurface, false);
  await dialogueRestarted.releaseOpenLoopForAutonomousInitiative(dialogueObligation.id, initiativeId);
  assert.equal((await dialogueRestarted.scanOpenLoops({ reminderCooldownMs: 0 }))
    .find(row => row.record.id === dialogueObligation.id)?.shouldSurface, true,
    'a generation failure after restart must release the reservation without losing the obligation');
  await dialogueRestarted.flush();
  await dialogueRestarted.stop();

  console.log(JSON.stringify({ status: 'OPEN_LOOP_RADAR_RUNTIME_PASS', activeCount: diagnostics.activeCount, restored: restored.records.length, fulfilled: final.records.length, initiativeReservation: 'PASS' }));
} finally {
  await fs.rm(directory, { recursive: true, force: true });
}
