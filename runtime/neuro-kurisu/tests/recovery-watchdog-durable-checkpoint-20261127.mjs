import assert from 'node:assert/strict';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { RecoveryWatchdog } from '../src/organism/persistence/RecoveryWatchdog.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

// Heartbeats prove liveness, not that any persistence boundary committed.
{
  let fail = false;
  const writes = [];
  const store = {
    async load() { return null; },
    async save(value) {
      if (fail) throw new Error('injected-watchdog-store-failure');
      writes.push(structuredClone(value));
    },
  };
  const watchdog = new RecoveryWatchdog('watchdog-checkpoint-test', store, 1_000);

  watchdog.heartbeat({ now: 2_000, tick: 7, learningCount: 3 });
  assert.equal(watchdog.snapshot().lastHeartbeatAt, 2_000);
  assert.equal(
    watchdog.snapshot().lastCheckpointAt,
    1_000,
    'a liveness heartbeat must not advance the durable checkpoint timestamp',
  );

  fail = true;
  await assert.rejects(
    watchdog.checkpoint({ now: 3_000, tick: 8, learningCount: 4 }),
    /injected-watchdog-store-failure/,
  );
  assert.equal(
    watchdog.snapshot().lastCheckpointAt,
    1_000,
    'a failed watchdog store write must leave the last committed checkpoint timestamp unchanged',
  );
  assert.equal(watchdog.snapshot().lastHeartbeatAt, 3_000);

  fail = false;
  const committed = await watchdog.checkpoint({ now: 4_000, tick: 9, learningCount: 5 });
  assert.equal(committed.lastCheckpointAt, 4_000);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].lastCheckpointAt, 4_000);
}

// The production OrganismCore path must not expose an uncommitted timestamp
// when its canonical state store rejects a forced checkpoint.
{
  const backing = new MemoryStateStore();
  let failNextSave = false;
  const store = {
    async load() { return backing.load(); },
    async save(value) {
      if (failNextSave) {
        failNextSave = false;
        throw new Error('injected-core-checkpoint-failure');
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
  const originalNow = Date.now;
  const attemptedCheckpointAt = before.lastCheckpointAt + 60_000;
  try {
    Date.now = () => attemptedCheckpointAt;
    failNextSave = true;
    await assert.rejects(core.flush(), /injected-core-checkpoint-failure/);
    assert.equal(
      core.recoveryWatchdogSnapshot().lastCheckpointAt,
      before.lastCheckpointAt,
      'Core must not advertise a new committed checkpoint when its canonical store rejects the write',
    );

    await core.flush();
    assert.equal(
      core.recoveryWatchdogSnapshot().lastCheckpointAt,
      attemptedCheckpointAt,
      'Core should publish the candidate checkpoint timestamp only after the store commits',
    );
    const persisted = await backing.load();
    assert.equal(persisted.system.recoveryWatchdog.lastCheckpointAt, attemptedCheckpointAt);
  } finally {
    Date.now = originalNow;
  }
}

console.log('RECOVERY_WATCHDOG_CHECKPOINT_COMMIT=PASS');
