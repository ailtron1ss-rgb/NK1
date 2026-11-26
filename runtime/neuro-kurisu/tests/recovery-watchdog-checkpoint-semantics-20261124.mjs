import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { RecoveryWatchdog } from '../src/organism/persistence/RecoveryWatchdog.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const directory = await mkdtemp(path.join(os.tmpdir(), 'nk1-watchdog-checkpoint-'));
test.after(async () => rm(directory, { recursive: true, force: true }));

const t0 = 1_900_000_000_000;

test('a fresh watchdog does not claim a checkpoint before its first durable commit', () => {
  const watchdog = new RecoveryWatchdog('neuro-kurisu', undefined, t0);
  assert.equal(watchdog.snapshot().lastCheckpointAt, 0,
    'construction and initial liveness are not proof of a durable checkpoint');
  assert.equal(watchdog.heartbeat({ now: t0 + 1 }).lastCheckpointAt, 0,
    'an initial heartbeat must leave the no-checkpoint state intact');
});

test('restore sanitizes missing, malformed, negative and future checkpoint timestamps', async () => {
  const seed = new RecoveryWatchdog('neuro-kurisu', undefined, t0).snapshot();
  const watchdog = new RecoveryWatchdog('neuro-kurisu', undefined, t0 + 10);
  const malformed = await watchdog.restore(t0 + 20, { ...seed, lastCheckpointAt: 'not-a-timestamp' });
  assert.equal(malformed.lastCheckpointAt, 0);
  const outOfRange = await watchdog.restore(t0 + 25, { ...seed, lastCheckpointAt: Number.MAX_SAFE_INTEGER + 1 });
  assert.equal(outOfRange.lastCheckpointAt, 0);
  const negative = await watchdog.restore(t0 + 30, { ...seed, lastCheckpointAt: -1 });
  assert.equal(negative.lastCheckpointAt, 0);
  const future = await watchdog.restore(t0 + 35, { ...seed, lastCheckpointAt: t0 + 100_000 });
  assert.equal(future.lastCheckpointAt, 0,
    'a timestamp too far in the future must not be accepted as a previous durable commit');

  const legacy = new RecoveryWatchdog('neuro-kurisu', undefined, t0 + 40);
  const legacySeed = { ...seed };
  delete legacySeed.lastCheckpointAt;
  const restoredLegacy = await legacy.restore(t0 + 50, legacySeed);
  assert.equal(restoredLegacy.lastCheckpointAt, 0,
    'pre-checkpoint-schema watchdog snapshots must default to no known durable checkpoint');
});

test('heartbeat and recovery do not claim a durable checkpoint', async () => {
  const store = new FileStateStore(path.join(directory, 'watchdog.json'), { backupEverySaves: 1 });
  const watchdog = new RecoveryWatchdog('neuro-kurisu', store, t0);
  await watchdog.checkpoint({ now: t0 + 100, tick: 5, learningCount: 2 });
  const committedCheckpointAt = watchdog.snapshot().lastCheckpointAt;
  assert.equal(committedCheckpointAt, t0 + 100);

  const heartbeat = watchdog.heartbeat({ now: t0 + 500, tick: 6, learningCount: 3 });
  assert.equal(heartbeat.lastHeartbeatAt, t0 + 500);
  assert.equal(heartbeat.lastTick, 6);
  assert.equal(heartbeat.lastLearningCount, 3);
  assert.equal(heartbeat.lastCheckpointAt, committedCheckpointAt,
    'a live heartbeat must not advance the last durable checkpoint timestamp');

  const recovered = watchdog.markRecovered('provider-reconciled', t0 + 700);
  assert.equal(recovered.lastHeartbeatAt, t0 + 700);
  assert.equal(recovered.status, 'recovered');
  assert.equal(recovered.lastCheckpointAt, committedCheckpointAt,
    'a recovery decision is not itself a durable checkpoint');
});

test('explicit checkpoint advances and persists checkpoint time', async () => {
  const store = new FileStateStore(path.join(directory, 'explicit.json'), { backupEverySaves: 1 });
  const watchdog = new RecoveryWatchdog('neuro-kurisu', store, t0);
  const committed = await watchdog.checkpoint({ now: t0 + 900, tick: 9, learningCount: 4 });
  assert.equal(committed.lastCheckpointAt, t0 + 900);
  const persisted = await store.load();
  assert.equal(persisted.lastCheckpointAt, t0 + 900);
  assert.equal(persisted.lastHeartbeatAt, t0 + 900);
});

test('failed checkpoint commit rolls the watchdog state back', async () => {
  const watchdog = new RecoveryWatchdog('neuro-kurisu', undefined, t0);
  const before = watchdog.snapshot();
  await assert.rejects(
    watchdog.checkpoint({ now: t0 + 1_000, tick: 11, learningCount: 5 }, async () => {
      throw new Error('injected-core-commit-failure');
    }),
    /injected-core-commit-failure/,
  );
  assert.deepEqual(watchdog.snapshot(), before,
    'a failed canonical commit must not leave an in-memory success timestamp or heartbeat');
});

test('Core only advances the checkpoint timestamp after its durable store commit succeeds', async () => {
  const statePath = path.join(directory, 'core.json');
  const durableStore = new FileStateStore(statePath);
  let failNextSave = false;
  const controlledStore = {
    load: (...args) => durableStore.load(...args),
    save: (...args) => {
      if (failNextSave) {
        failNextSave = false;
        return Promise.reject(new Error('injected-core-store-save-failure'));
      }
      return durableStore.save(...args);
    },
  };
  let sidecarProjectionWrites = 0;
  const openLoopStore = {
    load: async () => null,
    save: async () => { sidecarProjectionWrites += 1; },
  };
  const runtime = new OrganismRuntime({
    stateFile: statePath,
    worldStateFile: path.join(directory, 'core.world.json'),
    stateStore: controlledStore,
    openLoopStore,
    autoRun: false,
    enableLanguage: false,
    checkpointMinIntervalMs: 0,
    checkpointMaxDirtyCycles: 1,
  });
  await runtime.init();
  try {
    const before = runtime.core.recoveryWatchdogSnapshot();
    const beforeEnvelopeGeneration = runtime.core.systemSnapshot().runtimeCheckpointEnvelope?.generation ?? 0;
    const beforeSidecarProjectionWrites = sidecarProjectionWrites;
    await new Promise(resolve => setTimeout(resolve, 3));
    failNextSave = true;
    await assert.rejects(runtime.flush(), /injected-core-store-save-failure/);
    const afterFailure = runtime.core.recoveryWatchdogSnapshot();
    assert.equal(afterFailure.lastCheckpointAt, before.lastCheckpointAt,
      'failed FileStateStore.save must not advance the last successful checkpoint marker');
    assert.ok(afterFailure.lastHeartbeatAt >= before.lastHeartbeatAt,
      'the live heartbeat remains truthful even when the subsequent disk commit fails');
    assert.equal(afterFailure.lastTick, before.lastTick);
    assert.equal(afterFailure.lastLearningCount, before.lastLearningCount);
    assert.equal(runtime.core.systemSnapshot().runtimeCheckpointEnvelope?.generation ?? 0,
      beforeEnvelopeGeneration,
      'a failed canonical Core save must roll back the speculative in-memory envelope generation');
    assert.equal(sidecarProjectionWrites, beforeSidecarProjectionWrites,
      'sidecar projections must not run when the canonical checkpoint commit fails');

    await new Promise(resolve => setTimeout(resolve, 3));
    await runtime.flush();
    const afterSuccess = runtime.core.recoveryWatchdogSnapshot();
    assert.ok(afterSuccess.lastCheckpointAt > before.lastCheckpointAt,
      'a successful full Core flush must advance the durable checkpoint timestamp');
    assert.equal(runtime.core.systemSnapshot().runtimeCheckpointEnvelope?.generation ?? 0,
      beforeEnvelopeGeneration + 1,
      'the next successful checkpoint must advance exactly one committed envelope generation');
    assert.ok(sidecarProjectionWrites > beforeSidecarProjectionWrites,
      'runtime sidecars must be projected only after the canonical save succeeds');
    const persisted = await durableStore.load();
    assert.equal(persisted.system.recoveryWatchdog.lastCheckpointAt, afterSuccess.lastCheckpointAt,
      'the canonical persisted Core object must contain the checkpoint timestamp that was actually committed');
  } finally {
    await runtime.stop();
  }
});

console.log('RECOVERY_WATCHDOG_CHECKPOINT_SEMANTICS=PASS');
