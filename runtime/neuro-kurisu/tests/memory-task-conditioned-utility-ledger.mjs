import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { MemoryTaskConditionedUtilityLedger } from '../src/organism/system/MemoryTaskConditionedUtilityLedger.ts';

const hash = value => createHash('sha256').update(value).digest('hex');
const fingerprint = value => hash('fixture:' + value);
const ledger = new MemoryTaskConditionedUtilityLedger();
const base = {
  memoryId: 'memory:episodic:fixture-01',
  taskKeyHash: fingerprint('task-1'),
  holdoutFingerprint: fingerprint('immutable-holdout-v1'),
  contextFingerprint: fingerprint('context-v1'),
  readerFingerprint: fingerprint('reader-v1:model+prompt+decode+budget'),
  scorerFingerprint: fingerprint('scorer-v1'),
  fillerFingerprint: fingerprint('same-filler-v1'),
  insertionPosition: 512, seed: 7, replicate: 0,
  formationCostTokens: 44, storageBytes: 320, at: 1_000,
};

const first = ledger.register(base);
assert.equal(first.accepted, true);
assert.match(first.probe.id, /^mtu:[a-f0-9]{64}$/);
assert.equal(ledger.register(base).reason, 'duplicate-probe');
assert.equal(JSON.stringify(ledger.snapshot()).includes(base.memoryId), false);

const unverified = ledger.resolve({
  probeId: first.probe.id, withMemoryScore01: .8, withoutMemoryScore01: .5,
  withMemoryInputTokens: 180, withoutMemoryInputTokens: 120,
  withMemoryOutputTokens: 30, withoutMemoryOutputTokens: 30,
  withMemoryRetrievalLatencyMs: 4, withoutMemoryRetrievalLatencyMs: 0,
  independentVerified: false, validationAt: 1_100,
});
assert.equal(unverified.accepted, true);
assert.ok(Math.abs(unverified.outcome.delta01 - .3) < 1e-12);
assert.equal(unverified.aggregate, null);
assert.equal(ledger.diagnostics().pending, 1);
assert.equal(ledger.diagnostics().resolved, 0);
assert.equal(ledger.snapshot().outcomes.length, 0, 'unverified pair outcomes must not be persisted');

const verified = ledger.resolve({
  probeId: first.probe.id, withMemoryScore01: .8, withoutMemoryScore01: .5,
  withMemoryInputTokens: 180, withoutMemoryInputTokens: 120,
  withMemoryOutputTokens: 30, withoutMemoryOutputTokens: 30,
  withMemoryRetrievalLatencyMs: 4, withoutMemoryRetrievalLatencyMs: 0,
  independentVerified: true, validationAt: 1_200,
});
assert.equal(verified.accepted, true);
assert.ok(Math.abs(verified.outcome.delta01 - .3) < 1e-12);
assert.equal(verified.aggregate.samples, 1);
assert.equal(ledger.snapshot().outcomes.length, 1, 'verified pair outcomes must be retained for audit');
assert.equal(verified.aggregate.meanInputTokenDelta, 60);
assert.equal(verified.aggregate.meanRetrievalLatencyDeltaMs, 4);

const second = ledger.register({ ...base, seed: 8, formationCostTokens: 45, storageBytes: 321, at: 2_000 });
assert.equal(second.accepted, true);
const secondResolved = ledger.resolve({
  probeId: second.probe.id, withMemoryScore01: .6, withoutMemoryScore01: .5,
  withMemoryInputTokens: 170, withoutMemoryInputTokens: 120,
  withMemoryOutputTokens: 28, withoutMemoryOutputTokens: 30,
  withMemoryRetrievalLatencyMs: 3, withoutMemoryRetrievalLatencyMs: 0,
  independentVerified: true, validationAt: 2_100,
});
assert.equal(secondResolved.accepted, true);
const lookupInput = {
  memoryId: base.memoryId, taskKeyHash: base.taskKeyHash, holdoutFingerprint: base.holdoutFingerprint,
  contextFingerprint: base.contextFingerprint, readerFingerprint: base.readerFingerprint,
  scorerFingerprint: base.scorerFingerprint, fillerFingerprint: base.fillerFingerprint,
  insertionPosition: base.insertionPosition,
};
const lookup = ledger.lookup(lookupInput);
assert.equal(lookup.samples, 2);
assert.ok(Math.abs(lookup.meanDelta01 - .2) < 1e-12);
assert.ok(lookup.standardError01 > 0);
assert.ok(lookup.lower95Delta01 < lookup.meanDelta01);
assert.equal(lookup.positiveRate01, 1);
assert.equal(lookup.meanFormationCostTokens, 44.5);
assert.equal(lookup.meanStorageBytes, 320.5);
assert.equal(ledger.lookup({ ...lookupInput, taskKeyHash: fingerprint('task-2') }), null);
assert.equal(ledger.lookup({ ...lookupInput, holdoutFingerprint: fingerprint('different-holdout') }), null);
assert.equal(ledger.lookup({ ...lookupInput, insertionPosition: 1024 }), null, 'different insertion positions must not be pooled');

const differentTask = ledger.register({ ...base, taskKeyHash: fingerprint('task-2'), seed: 7, at: 3_000 });
assert.equal(differentTask.accepted, true);
const beforeRegistration = ledger.resolve({
  probeId: differentTask.probe.id, withMemoryScore01: .4, withoutMemoryScore01: .5,
  withMemoryInputTokens: 100, withoutMemoryInputTokens: 100,
  withMemoryOutputTokens: 20, withoutMemoryOutputTokens: 20,
  withMemoryRetrievalLatencyMs: 0, withoutMemoryRetrievalLatencyMs: 0,
  independentVerified: true, validationAt: 2_999,
});
assert.deepEqual(beforeRegistration, { accepted: false, reason: 'validation-before-registration' });

const snapshot = ledger.snapshot();
const restored = new MemoryTaskConditionedUtilityLedger();
restored.restore(snapshot);
assert.deepEqual(restored.snapshot(), snapshot);
assert.equal(restored.snapshot().outcomes.length, 2);
assert.deepEqual(restored.lookup(lookupInput), lookup);

let getterCalled = false;
const accessorInput = Object.defineProperty({}, 'memoryId', {
  enumerable: true, get() { getterCalled = true; return base.memoryId; },
});
assert.equal(restored.register(accessorInput).reason, 'invalid-input');
assert.equal(getterCalled, false);
const sparseRestore = new MemoryTaskConditionedUtilityLedger();
sparseRestore.restore({ ...snapshot, pending: new Array(snapshot.pending.length) });
assert.equal(sparseRestore.diagnostics().registered, 0);
const corrupted = new MemoryTaskConditionedUtilityLedger();
corrupted.restore({ ...snapshot, version: 99 });
assert.equal(corrupted.diagnostics().registered, 0);

const stale = new MemoryTaskConditionedUtilityLedger();
assert.equal(stale.register({ ...base, at: 1 }).accepted, true);
assert.equal(stale.register({ ...base, seed: 9, at: 8 * 86_400_000 + 2 }).accepted, true);
assert.equal(stale.diagnostics().dropped, 1);
const bounded = new MemoryTaskConditionedUtilityLedger();
for (let index = 0; index < 128; index++) {
  assert.equal(bounded.register({ ...base, seed: index, at: 10_000 + index }).accepted, true);
}
assert.equal(bounded.register({ ...base, seed: 999, at: 10_999 }).reason, 'pending-capacity-exhausted');
assert.equal(bounded.diagnostics().pending, 128);

console.log('MEMORY_TASK_CONDITIONED_UTILITY_LEDGER=PASS');
