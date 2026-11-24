import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const store = new MemoryStateStore();
const core = new OrganismCore(store, {
  enableLanguage: false,
  performanceProfile: 'mobile',
  cycleResultMode: 'operational',
  checkpointMaxDirtyCycles: 64,
  checkpointMinIntervalMs: 600_000,
});
await core.init();
const initial = core.snapshot();
const initialCert = initial.system.failureRecoveryCertification;
assert.equal(initialCert.checkpoints, 1, 'init should create one durable recovery certificate');
const initialHash = initial.system.lastStateHash;
assert.equal(initialHash, initialCert.lastCheckpointHash, 'integrity and recovery hashes must share the canonical durable hash');

for (let i = 0; i < 3; i++) {
  await core.observe({ text: `R11 durability cycle ${i}`, novelty: .3, surprise: .15 }, 'operational');
  await core.feedback({ success: .74, reward: .58, surprise: .14, evidenceSource: 'unknown' });
}
const partial = core.snapshot();
assert.equal(partial.system.failureRecoveryCertification.checkpoints, initialCert.checkpoints, 'partial checkpoints must not certify non-durable state');
assert.equal(partial.system.lastStateHash, initialHash, 'last durable hash must remain stable before full flush');

await core.flush();
const durable = await store.load();
assert(durable, 'flush must persist a durable snapshot');
const durableCert = durable.system.failureRecoveryCertification;
assert.equal(durableCert.checkpoints, initialCert.checkpoints + 1, 'flush must create exactly one new durable recovery certificate');
assert.equal(durable.system.lastStateHash, durableCert.lastCheckpointHash, 'flush must reuse the canonical durable hash');
assert.equal(core.recoveryVerify(durable), true, 'the durable snapshot must verify against its certificate');

const manualHash = core.recoveryCheckpoint({ canonical: 'r11-manual-recovery-test', tick: durable.state.tick });
assert.equal(typeof manualHash, 'string');
assert(core.recoveryVerify({ canonical: 'r11-manual-recovery-test', tick: durable.state.tick }));
assert.equal(core.recoveryVerify({ canonical: 'tampered', tick: durable.state.tick }), false);

console.log(JSON.stringify({
  pass: true,
  initialCheckpoints: initialCert.checkpoints,
  partialCheckpoints: partial.system.failureRecoveryCertification.checkpoints,
  durableCheckpoints: durableCert.checkpoints,
  canonicalHashEqual: durable.system.lastStateHash === durableCert.lastCheckpointHash,
  manualRecovery: { hashLength: manualHash.length, verify: true, tamperRejected: true },
}, null, 2));
