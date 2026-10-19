import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { RecoveryWatchdog } from '../src/organism/persistence/RecoveryWatchdog.ts';

const root = 'state/recovery-watchdog-b324';
await rm(root, { recursive:true, force:true });
await mkdir(root, { recursive:true });
const path = `${root}/watchdog.json`;
const t0 = 1_900_000_000_000;

const store1 = new FileStateStore(path, { backupEverySaves:1, strictDirectoryFsync:true });
const w1 = new RecoveryWatchdog('neuro-kurisu-b324', store1, t0);
await w1.checkpoint({ now:t0, tick:12, learningCount:9 });
const stale = w1.observe({ now:t0 + 31_000, staleAfterMs:30_000 });
assert.equal(stale.status, 'stale');

const store2 = new FileStateStore(path, { backupEverySaves:1, strictDirectoryFsync:true });
const w2 = new RecoveryWatchdog('neuro-kurisu-b324', store2, t0 + 40_000);
const restored = await w2.restore(t0 + 40_000);
assert.equal(restored.status, 'recovered');
assert.equal(restored.lastTick, 12);
assert.equal(restored.lastLearningCount, 9);
assert.equal(restored.recoveryCount, 1);
assert.equal(restored.lastRecoveryReason, 'process-resume');

const resumed = await w2.checkpoint({ now:t0 + 40_500, tick:13, learningCount:10 });
assert.equal(resumed.status, 'healthy');
assert.equal(resumed.lastTick, 13);
assert.equal(resumed.lastLearningCount, 10);
assert.equal(resumed.recoveryCount, 1);

const recovered = w2.markRecovered('explicit-watchdog-recovery', t0 + 41_000);
assert.equal(recovered.status, 'recovered');
assert.equal(recovered.recoveryCount, 2);

console.log(JSON.stringify({
  pass:true,
  stale:{status:stale.status},
  restore:{status:restored.status,tick:restored.lastTick,learning:restored.lastLearningCount,recoveryCount:restored.recoveryCount},
  resumed:{status:resumed.status,tick:resumed.lastTick,learning:resumed.lastLearningCount},
  explicitRecovery:{status:recovered.status,recoveryCount:recovered.recoveryCount}
}, null, 2));
