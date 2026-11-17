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
assert.throws(() => radar.fulfill(dependent.id, {
  kind: 'user-confirmation', reference: 'cannot-complete-blocked', verifiedAt: now,
}), /open-loop-blocked-cannot-be-fulfilled/,
  'blocked obligations cannot be declared complete while prerequisites remain open');
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
assert.equal(radar.snapshot().records.find(x => x.id === dependent.id)?.status, 'open',
  'display acknowledgement must not imply task completion');
const before = radar.snapshot();
radar.fulfill(dependent.id, { kind: 'user-confirmation', reference: 'done', verifiedAt: now });
assert.throws(() => radar.fulfill(dependent.id, {
  kind: 'user-confirmation', reference: 'done-again', verifiedAt: now,
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
assert.equal(restored.snapshot().records.length, 0, 'records with a missing or rejected prerequisite must not be restored as zombie open loops');

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

const oversizedRadar = new OpenLoopRadar(() => now);
assert.throws(() => oversizedRadar.restore({
  version: 1, sequence: 0, records: new Array(2049).fill(null),
}), /open-loop-state-invalid-or-unsupported/,
'oversized persisted snapshots must fail closed instead of truncating possible commitments');

let inputGetterCalls = 0;
const hostileInput = { accepted: true, owner: 'system', kind: 'task', source: 'test' };
Object.defineProperty(hostileInput, 'title', { enumerable: true, get() { inputGetterCalls++; return 'hostile'; } });
assert.throws(() => new OpenLoopRadar(() => now).register(hostileInput), /title must be a non-empty string/);
assert.equal(inputGetterCalls, 0, 'register must not execute caller-provided getters');

const invalidStateRadar = new OpenLoopRadar(() => now);
assert.throws(() => invalidStateRadar.restore({ version: 99, records: [] }), /open-loop-state-invalid-or-unsupported/);
const malformedFulfillment = {
  ...before.records[0], id: 'bad-closure-time', dependencies: [], status: 'fulfilled',
  closureEvidence: {
    kind: 'user-confirmation', reference: 'bad-evidence',
    verifiedAt: before.records[0].createdAt - 1,
  },
};
const rejectBadClosure = new OpenLoopRadar(() => now);
rejectBadClosure.restore({ version: 1, sequence: 0, records: [malformedFulfillment] });
assert.equal(rejectBadClosure.snapshot().records.length, 0,
  'restored completion evidence must not predate the obligation');

const idempotentRadar = new OpenLoopRadar(() => now);
const idempotentInput = {
  title: 'Retry-safe obligation', kind: 'task', owner: 'system', accepted: true,
  source: 'api-contract-test', idempotencyKey: 'request:retry:001',
};
const firstAccepted = idempotentRadar.register(idempotentInput);
const retried = idempotentRadar.register({ ...idempotentInput });
assert.equal(retried.id, firstAccepted.id);
assert.equal(idempotentRadar.snapshot().records.length, 1,
  'a retried create request with the same key must not create duplicate obligations');
assert.throws(() => idempotentRadar.register({
  ...idempotentInput, title: 'Different task, same idempotency key',
}), /open-loop-idempotency-conflict/);

const initiativeRadar = new OpenLoopRadar(() => now);
const dialogueObligation = initiativeRadar.register({
  title: 'Revisit the causal-memory validation', kind: 'task', owner: 'user',
  accepted: true, source: 'autonomous-dialogue-test', dueAt: now - 1, priority: 0.9,
});
const initiativeId = 'soc:open-loop:contract:001';
const reserved = initiativeRadar.reserveForInitiative(dialogueObligation.id, initiativeId);
assert.equal(reserved.pendingSurfacingInitiativeId, initiativeId);
assert.equal(initiativeRadar.scan({ now, reminderCooldownMs: 0 })
  .find(row => row.record.id === dialogueObligation.id)?.shouldSurface, false,
  'one proactive initiative reservation must suppress duplicate surfacing');

const restoredInitiativeRadar = new OpenLoopRadar(() => now);
restoredInitiativeRadar.restore(initiativeRadar.snapshot());
assert.equal(restoredInitiativeRadar.snapshot().records[0].pendingSurfacingInitiativeId, initiativeId,
  'pending initiative ownership must survive restart');
assert.equal(restoredInitiativeRadar.releaseInitiative('wrong-initiative'), false);
assert.throws(() => restoredInitiativeRadar.reserveForInitiative(dialogueObligation.id, 'soc:open-loop:contract:002'),
  /open-loop-not-ready-to-surface|open-loop-initiative-already-bound/);
assert.equal(restoredInitiativeRadar.releaseInitiative(initiativeId), true);
assert.equal(restoredInitiativeRadar.scan({ now, reminderCooldownMs: 0 })
  .find(row => row.record.id === dialogueObligation.id)?.shouldSurface, true,
  'failed generation release must make the accepted obligation eligible again');
const secondInitiativeId = 'soc:open-loop:contract:002';
restoredInitiativeRadar.reserveForInitiative(dialogueObligation.id, secondInitiativeId);
assert.equal(restoredInitiativeRadar.acknowledgeInitiative(secondInitiativeId), true);
assert.equal(restoredInitiativeRadar.acknowledgeInitiative(secondInitiativeId), false,
  'delivered initiative acknowledgement must be idempotent');
assert.equal(restoredInitiativeRadar.snapshot().records[0].lastSurfacedAt, now);
assert.equal(restoredInitiativeRadar.scan({ now, reminderCooldownMs: 0 })
  .find(row => row.record.id === dialogueObligation.id)?.shouldSurface, false,
  'delivered proactive reminder must respect the reminder cooldown');

const leaseRadar = new OpenLoopRadar(() => now);
const leaseItem = leaseRadar.register({
  title: 'Review the accepted follow-up', kind: 'task', owner: 'user',
  accepted: true, source: 'lease-test', dueAt: now - 1,
});
leaseRadar.reserveForInitiative(leaseItem.id, 'soc:open-loop:lease:001');
now += 16 * 60 * 1000;
assert.equal(leaseRadar.scan({ now, reminderCooldownMs: 0 })
  .find(row => row.record.id === leaseItem.id)?.shouldSurface, true,
  'an abandoned generation reservation must expire instead of hiding a commitment forever');

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
