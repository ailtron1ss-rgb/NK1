import assert from 'node:assert/strict';
import { OpenLoopRadar, defaultOpenLoopRadarState } from '../src/organism/cognition/evolution/OpenLoopRadar.ts';

let now = 1_800_000_000_000;
const radar = new OpenLoopRadar(() => now);
assert.deepEqual(radar.snapshot(), defaultOpenLoopRadarState());
assert.throws(() => radar.register({ title: 'Unaccepted', kind: 'promise', owner: 'system', accepted: false, source: 'test' }), /explicit-acceptance-required/);

const prerequisite = radar.register({
  title: 'Wait for provider response', kind: 'waiting', owner: 'system', accepted: true,
  source: 'test', dueAt: now + 60_000, priority: 0.7,
});
const dependent = radar.register({
  title: 'Finish integration', kind: 'project_step', owner: 'system', accepted: true,
  source: 'test', dependencies: [prerequisite.id], dueAt: now + 120_000, priority: 0.9,
});
assert.equal(dependent.status, 'blocked');
now += 121_000;

const blockedScan = radar.scan({ now, dueSoonMs: 120_000, reminderCooldownMs: 0 });
assert.equal(blockedScan.find(x => x.record.id === prerequisite.id)?.surfaceReason, 'overdue');
assert.equal(blockedScan.find(x => x.record.id === prerequisite.id)?.shouldSurface, true);
assert.equal(blockedScan.find(x => x.record.id === dependent.id)?.effectiveStatus, 'blocked');
assert.equal(blockedScan.find(x => x.record.id === dependent.id)?.surfaceReason, null,
  'a blocked dependent task must not be surfaced as an actionable overdue item');
assert.equal(blockedScan.find(x => x.record.id === dependent.id)?.shouldSurface, false);

assert.throws(() => radar.fulfill(prerequisite.id, {
  kind: 'user-confirmation', reference: '', verifiedAt: now,
}), /valid-closure-evidence-required/);
assert.throws(() => radar.fulfill(prerequisite.id, {
  kind: 'execution-receipt', reference: 'future', verifiedAt: now + 1,
}), /closure-evidence-cannot-be-from-the-future/);

radar.fulfill(prerequisite.id, { kind: 'external-confirmation', reference: 'ticket:42', verifiedAt: now });
assert.equal(radar.snapshot().records.find(x => x.id === dependent.id)?.status, 'open');
const unblocked = radar.scan({ now, reminderCooldownMs: 0 }).find(x => x.record.id === dependent.id);
assert.equal(unblocked?.surfaceReason, 'dependency-unblocked',
  'dependency completion must produce a distinct, observable unblocked transition');
assert.equal(unblocked?.shouldSurface, true);
assert.equal(radar.scan({ now, quietUntil: now + 60_000, reminderCooldownMs: 0 }).find(x => x.record.id === dependent.id)?.shouldSurface, false);

radar.markSurfaced(dependent.id);
assert.equal(radar.scan({ now, reminderCooldownMs: 60_000 }).find(x => x.record.id === dependent.id)?.shouldSurface, false);
const before = radar.snapshot();
assert.throws(() => radar.fulfill(dependent.id, {
  kind: 'user-confirmation', reference: 'done', verifiedAt: now,
}), /open-loop-already-closed/);

const restored = new OpenLoopRadar(() => now);
restored.restore(before);
assert.deepEqual(restored.snapshot(), before);

const tampered = {
  version: 1, sequence: '999',
  records: [
    before.records[0],
    { ...before.records[1], status: 'fulfilled', closureEvidence: null },
    { ...before.records[1], accepted: false },
  ],
};
restored.restore(tampered);
assert.equal(restored.snapshot().records.length, 1);

const cancellable = restored.register({ title: 'Optional research', kind: 'task', owner: 'user', accepted: true, source: 'test' });
assert.throws(() => restored.cancel(cancellable.id, ' '), /cancellation-reason-required/);
restored.cancel(cancellable.id, 'No longer relevant');
assert.throws(() => restored.reopen(cancellable.id, ''), /reopen-reason-required/);
restored.reopen(cancellable.id, 'Scope changed');
assert.equal(restored.snapshot().records.find(x => x.id === cancellable.id)?.status, 'open');

const expired = restored.register({
  title: 'Temporary', kind: 'waiting', owner: 'system', accepted: true, source: 'test', expiresAt: now - 1,
});
assert.equal(restored.scan({ now, reminderCooldownMs: 0 }).find(x => x.record.id === expired.id)?.effectiveStatus, 'expired');

let getterCalls = 0;
const hostileRecord = {
  id: 'hostile', kind: 'task', owner: 'system', status: 'open', createdAt: now, updatedAt: now, accepted: true,
};
Object.defineProperty(hostileRecord, 'title', { enumerable: true, get() { getterCalls++; return 'do not execute'; } });
const hostileRadar = new OpenLoopRadar(() => now);
hostileRadar.restore({ version: 1, sequence: 0, records: [hostileRecord] });
assert.equal(getterCalls, 0, 'restore must not execute untrusted snapshot getters');
assert.equal(hostileRadar.snapshot().records.length, 0, 'accessor-backed records must be rejected');

const cycleRadar = new OpenLoopRadar(() => now);
const cycleA = { ...before.records[0], id: 'cycle-a', status: 'blocked', dependencies: ['cycle-b'], closureEvidence: null };
const cycleB = { ...before.records[0], id: 'cycle-b', status: 'blocked', dependencies: ['cycle-a'], closureEvidence: null };
const downstream = { ...before.records[0], id: 'cycle-downstream', status: 'blocked', dependencies: ['cycle-a'], closureEvidence: null };
cycleRadar.restore({ version: 1, sequence: 0, records: [cycleA, cycleB, downstream] });
assert.equal(cycleRadar.snapshot().records.length, 0,
  'restore must reject cyclic dependency components and records that depend on rejected nodes');

const capacityRadar = new OpenLoopRadar(() => now);
for (let index = 0; index < 512; index++) {
  capacityRadar.register({ title: 'Active item ' + index, kind: 'task', owner: 'system', accepted: true, source: 'capacity-test' });
}
const atCapacity = capacityRadar.snapshot();
assert.throws(() => capacityRadar.register({
  title: 'Must not evict an active item', kind: 'task', owner: 'system', accepted: true, source: 'capacity-test',
}), /open-loop-capacity-exhausted/);
assert.deepEqual(capacityRadar.snapshot(), atCapacity, 'capacity exhaustion must not silently evict active obligations');

const detached = restored.snapshot();
detached.records[0].title = 'tampered';
assert.notEqual(restored.snapshot().records[0].title, 'tampered');
console.log('OPEN_LOOP_RADAR_CONTRACT=PASS');
