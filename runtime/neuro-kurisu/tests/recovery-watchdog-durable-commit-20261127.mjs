import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { RecoveryWatchdog } from '../src/organism/persistence/RecoveryWatchdog.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

test('construction, heartbeat and recovery do not claim a durable checkpoint', async () => {
  const watchdog = new RecoveryWatchdog('nk1-watchdog-test', undefined, 1_000);
  assert.equal(watchdog.snapshot().lastCheckpointAt, 0);

  const heartbeat = watchdog.heartbeat({ now: 2_000, tick: 7, learningCount: 4 });
  assert.equal(heartbeat.lastHeartbeatAt, 2_000);
  assert.equal(heartbeat.lastTick, 7);
  assert.equal(heartbeat.lastLearningCount, 4);
  assert.equal(heartbeat.lastCheckpointAt, 0);

  const recovered = watchdog.markRecovered('process-resume', 2_500);
  assert.equal(recovered.lastHeartbeatAt, 2_500);
  assert.equal(recovered.status, 'recovered');
  assert.equal(recovered.lastCheckpointAt, 0);
});

test('restore rejects malformed, missing, negative and implausibly future checkpoint timestamps', async () => {
  const base = new RecoveryWatchdog('nk1-watchdog-restore', undefined, 1_000).snapshot();
  const watchdog = new RecoveryWatchdog('nk1-watchdog-restore', undefined, 2_000);

  for (const lastCheckpointAt of ['not-a-time', -1, Number.MAX_SAFE_INTEGER + 1, 62_001]) {
    const restored = await watchdog.restore(2_000, { ...base, lastCheckpointAt });
    assert.equal(restored.lastCheckpointAt, 0, `invalid checkpoint timestamp must be rejected: ${String(lastCheckpointAt)}`);
  }
  const missing = { ...base };
  delete missing.lastCheckpointAt;
  assert.equal((await watchdog.restore(2_000, missing)).lastCheckpointAt, 0);

  const valid = await watchdog.restore(2_000, { ...base, lastCheckpointAt: 1_500 });
  assert.equal(valid.lastCheckpointAt, 1_500);
});

test('standalone checkpoint persists a detached candidate before committing its timestamp', async () => {
  let fail = true;
  const writes = [];
  const store = {
    async load() { return null; },
    async save(value) {
      if (fail) throw new Error('injected-watchdog-store-failure');
      writes.push(structuredClone(value));
    },
  };
  const watchdog = new RecoveryWatchdog('nk1-watchdog-standalone', store, 1_000);
  const before = watchdog.snapshot();

  await assert.rejects(
    watchdog.checkpoint({ now: 2_000, tick: 8, learningCount: 5 }),
    /injected-watchdog-store-failure/,
  );
  const failed = watchdog.snapshot();
  assert.equal(failed.lastCheckpointAt, before.lastCheckpointAt);
  assert.equal(failed.lastHeartbeatAt, 2_000, 'liveness remains truthful after a persistence failure');
  assert.equal(failed.lastTick, 8);
  assert.equal(failed.lastLearningCount, 5);
  assert.equal(writes.length, 0);

  fail = false;
  const committed = await watchdog.checkpoint({ now: 3_000, tick: 9, learningCount: 6 });
  assert.equal(committed.lastCheckpointAt, 3_000);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].lastCheckpointAt, 3_000);
});

test('OrganismCore publishes RecoveryWatchdog checkpoint time only after canonical save succeeds', async () => {
  const backing = new MemoryStateStore();
  let failNextSave = false;
  const store = {
    async load() { return backing.load(); },
    async save(value) {
      if (failNextSave) {
        failNextSave = false;
        throw new Error('injected-canonical-core-save-failure');
      }
      await backing.save(value);
    },
    metrics() { return backing.metrics(); },
  };
  const core = new OrganismCore(store, {
    enableLanguage: false,
    performanceProfile: 'mobile',
    cycleResultMode: 'operational',
    checkpointMinIntervalMs: 0,
    checkpointMaxDirtyCycles: 1,
  });
  await core.init();
  const before = core.recoveryWatchdogSnapshot();
  const durableBefore = await backing.load();
  const originalNow = Date.now;
  const attemptedAt = Math.max(Date.now() + 60_000, before.lastCheckpointAt + 60_000);

  try {
    Date.now = () => attemptedAt;
    failNextSave = true;
    await assert.rejects(core.flush(), /injected-canonical-core-save-failure/);

    const afterFailure = core.recoveryWatchdogSnapshot();
    assert.equal(afterFailure.lastCheckpointAt, before.lastCheckpointAt,
      'the failed canonical Core save must not advance lastCheckpointAt');
    assert.ok(afterFailure.lastHeartbeatAt >= before.lastHeartbeatAt,
      'the heartbeat must remain a truthful liveness signal even when persistence fails');
    assert.equal(afterFailure.lastTick, before.lastTick);
    const durableAfterFailure = await backing.load();
    assert.equal(
      durableAfterFailure.system.recoveryWatchdog.lastCheckpointAt,
      durableBefore.system.recoveryWatchdog.lastCheckpointAt,
      'the canonical stored object must remain at its previous committed watchdog timestamp',
    );

    await core.flush();
    const afterSuccess = core.recoveryWatchdogSnapshot();
    assert.equal(afterSuccess.lastCheckpointAt, attemptedAt,
      'the watchdog marker advances to the candidate timestamp only after save succeeds');
    const durableAfterSuccess = await backing.load();
    assert.equal(durableAfterSuccess.system.recoveryWatchdog.lastCheckpointAt, attemptedAt,
      'the same timestamp must be present in the canonical persisted organism');
  } finally {
    Date.now = originalNow;
  }
});

test('checkpoint without a backing store never claims a durable commit', async () => {
  const watchdog = new RecoveryWatchdog('nk1-watchdog-no-store', undefined, 1_000);

  const checkpoint = await watchdog.checkpoint({ now: 3_000, tick: 2, learningCount: 1 });

  assert.equal(checkpoint.lastHeartbeatAt, 3_000,
    'the liveness heartbeat must still advance without a persistence owner');
  assert.equal(checkpoint.lastTick, 2);
  assert.equal(checkpoint.lastLearningCount, 1);
  assert.equal(checkpoint.lastCheckpointAt, 0,
    'without a backing store, checkpoint() must not report a durable commit');
  assert.equal(watchdog.snapshot().lastCheckpointAt, 0,
    'the in-memory durable marker must remain unchanged without a successful save');
});

console.log('RECOVERY_WATCHDOG_DURABLE_COMMIT=PASS');
