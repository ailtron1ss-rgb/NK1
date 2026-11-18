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

// Expired obligations stay non-actionable while any prerequisite is still unresolved.
const expiredBlockedRadar = new OpenLoopRadar(() => now);
const expiredBlockedParent = expiredBlockedRadar.register({
  title: 'Expired external prerequisite', kind: 'waiting', owner: 'system',
  accepted: true, source: 'expired-blocked-contract', dueAt: now - 10_000, expiresAt: now - 1,
});
const expiredBlockedChild = expiredBlockedRadar.register({
  title: 'Expired dependent step', kind: 'project_step', owner: 'system',
  accepted: true, source: 'expired-blocked-contract', dependencies: [expiredBlockedParent.id],
  dueAt: now - 5_000, expiresAt: now - 1,
});
const expiredBlockedCandidate = expiredBlockedRadar.scan({ now, reminderCooldownMs: 0 })
  .find(row => row.record.id === expiredBlockedChild.id);
assert.equal(expiredBlockedCandidate?.effectiveStatus, 'blocked');
assert.equal(expiredBlockedCandidate?.surfaceReason, null);
assert.equal(expiredBlockedCandidate?.shouldSurface, false,
  'expiry must not make a blocked dependent task actionable');

// If a prerequisite is reopened, an already reserved dependant must lose the
// stale initiative lease because its prompt was composed against the old graph.
const leaseReconciliationRadar = new OpenLoopRadar(() => now);
const leaseGate = leaseReconciliationRadar.register({
  title: 'Verified prerequisite', kind: 'task', owner: 'system',
  accepted: true, source: 'lease-reconciliation-contract',
});
leaseGate && leaseReconciliationRadar.fulfill(leaseGate.id, {
  kind: 'external-confirmation', reference: 'verified-prerequisite', verifiedAt: now,
});
const leaseDependent = leaseReconciliationRadar.register({
  title: 'Dependent work item', kind: 'project_step', owner: 'system',
  accepted: true, source: 'lease-reconciliation-contract', dependencies: [leaseGate.id], dueAt: now - 1,
});
const staleInitiative = 'soc:open-loop:stale-dependency:001';
leaseReconciliationRadar.reserveForInitiative(leaseDependent.id, staleInitiative);
leaseReconciliationRadar.reopen(leaseGate.id, 'Prerequisite needs re-verification');
const leaseDependentAfterReopen = leaseReconciliationRadar.snapshot().records
  .find(row => row.id === leaseDependent.id);
assert.equal(leaseDependentAfterReopen?.status, 'blocked');
assert.equal(leaseDependentAfterReopen?.pendingSurfacingInitiativeId, null,
  'dependency reconciliation must release a reservation whose underlying prompt context is stale');
assert.equal(leaseDependentAfterReopen?.pendingSurfacingLeaseUntil, 0);

const cycleRadar = new OpenLoopRadar(() => now);
const cycleA = { ...before.records[0], id: 'cycle-a', status: 'blocked', dependencies: ['cycle-b'], closureEvidence: null };
const cycleB = { ...before.records[0], id: 'cycle-b', status: 'blocked', dependencies: ['cycle-a'], closureEvidence: null };
const downstream = { ...before.records[0], id: 'cycle-downstream', status: 'blocked', dependencies: ['cycle-a'], closureEvidence: null };
cycleRadar.restore({ version: 1, sequence: 0, records: [cycleA, cycleB, downstream] });
assert.equal(cycleRadar.snapshot().records.length, 0,
  'restore must reject cyclic dependency components and records that depend on rejected nodes');

const duplicateLeaseRadar = new OpenLoopRadar(() => now);
const duplicateLeasePrimary = duplicateLeaseRadar.register({
  title: 'Primary reservation record', kind: 'task', owner: 'system',
  accepted: true, source: 'duplicate-lease-restore-contract', dueAt: now - 1,
});
const primaryLeaseId = 'soc:open-loop:duplicate-restore:001';
duplicateLeaseRadar.reserveForInitiative(duplicateLeasePrimary.id, primaryLeaseId);
const duplicateLeaseSnapshot = duplicateLeaseRadar.snapshot();
const primaryLeaseRecord = duplicateLeaseSnapshot.records[0];
const duplicateLeaseRecord = {
  ...primaryLeaseRecord,
  id: 'open-loop-duplicate-reservation-record',
  title: 'Second record with duplicated lease owner',
  createdAt: primaryLeaseRecord.createdAt - 1,
  updatedAt: primaryLeaseRecord.updatedAt - 1,
};
const duplicateLeaseRestored = new OpenLoopRadar(() => now);
duplicateLeaseRestored.restore({
  ...duplicateLeaseSnapshot,
  records: [primaryLeaseRecord, duplicateLeaseRecord],
});
const duplicateLeaseRows = duplicateLeaseRestored.snapshot().records
  .filter(record => record.pendingSurfacingInitiativeId === primaryLeaseId);
assert.equal(duplicateLeaseRows.length, 1,
  'restoring a duplicated initiative lease must retain only one owner');
assert.equal(duplicateLeaseRestored.snapshot().records.length, 2,
  'duplicate lease repair must preserve both accepted obligations');

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

let retryWindowNow = now;
const retryWindowRadar = new OpenLoopRadar(() => retryWindowNow);
const expiredKey = 'request:retry:after-retention';
const firstWindowRecord = retryWindowRadar.register({
  title: 'First accepted operation', kind: 'task', owner: 'system',
  accepted: true, source: 'idempotency-expiry-test', idempotencyKey: expiredKey,
});
retryWindowRadar.fulfill(firstWindowRecord.id, {
  kind: 'execution-receipt', reference: 'first-operation-complete', verifiedAt: retryWindowNow,
});
retryWindowNow += 24 * 60 * 60 * 1000 + 1;
const secondWindowRecord = retryWindowRadar.register({
  title: 'New operation after idempotency retention expired', kind: 'task', owner: 'system',
  accepted: true, source: 'idempotency-expiry-test', idempotencyKey: expiredKey,
});
const afterKeyExpiry = retryWindowRadar.snapshot();
assert.equal(afterKeyExpiry.records.length, 2,
  'expired idempotency keys may be reused without deleting terminal history');
assert.equal(afterKeyExpiry.records.find(record => record.id === firstWindowRecord.id)?.idempotencyKey, null,
  'the old terminal history must release its expired retry key when the key is reused');
assert.equal(afterKeyExpiry.records.find(record => record.id === secondWindowRecord.id)?.idempotencyKey, expiredKey);
const restoredAfterKeyExpiry = new OpenLoopRadar(() => retryWindowNow);
restoredAfterKeyExpiry.restore(afterKeyExpiry);
assert.equal(restoredAfterKeyExpiry.snapshot().records.length, 2,
  'both historical and new operations must survive restore without duplicate-key conflicts');

const initiativeRadar = new OpenLoopRadar(() => now);
const dialogueObligation = initiativeRadar.register({
  title: 'Revisit the causal-memory validation', kind: 'task', owner: 'user',
  accepted: true, source: 'autonomous-dialogue-test', dueAt: now - 1, priority: 0.9,
});
const initiativeId = 'soc:open-loop:contract:001';
const reserved = initiativeRadar.reserveForInitiative(dialogueObligation.id, initiativeId);
assert.equal(reserved.pendingSurfacingInitiativeId, initiativeId);
const duplicateInitiativeCandidate = initiativeRadar.register({
  title: 'Another accepted follow-up for reservation uniqueness', kind: 'task', owner: 'user',
  accepted: true, source: 'initiative-uniqueness-test', dueAt: now - 1,
});
assert.throws(
  () => initiativeRadar.reserveForInitiative(duplicateInitiativeCandidate.id, initiativeId),
  /open-loop-initiative-already-bound/,
  'one proactive initiative must own at most one open-loop reservation',
);
assert.equal(initiativeRadar.scan({ now, reminderCooldownMs: 0 })
  .find(row => row.record.id === dialogueObligation.id)?.shouldSurface, false,
  'one proactive initiative reservation must suppress duplicate surfacing');

const restoredInitiativeRadar = new OpenLoopRadar(() => now);
restoredInitiativeRadar.restore(initiativeRadar.snapshot());
assert.equal(restoredInitiativeRadar.snapshot().records.find(record => record.id === dialogueObligation.id)?.pendingSurfacingInitiativeId, initiativeId,
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
assert.equal(restoredInitiativeRadar.snapshot().records.find(record => record.id === dialogueObligation.id)?.lastSurfacedAt, now);
assert.equal(restoredInitiativeRadar.scan({ now, reminderCooldownMs: 60_000 })
  .find(row => row.record.id === dialogueObligation.id)?.shouldSurface, false,
  'delivered proactive reminder must respect a positive reminder cooldown');

const terminalLeaseRadar = new OpenLoopRadar(() => now);
const terminalFulfilled = terminalLeaseRadar.register({
  title: 'Finish accepted review', kind: 'task', owner: 'user', accepted: true,
  source: 'terminal-lease-test', dueAt: now - 1,
});
terminalLeaseRadar.reserveForInitiative(terminalFulfilled.id, 'soc:open-loop:terminal:fulfilled');
terminalLeaseRadar.fulfill(terminalFulfilled.id, {
  kind: 'user-confirmation', reference: 'terminal-fulfillment', verifiedAt: now,
});
assert.equal(terminalLeaseRadar.snapshot().records[0].pendingSurfacingInitiativeId, null,
  'fulfillment must release the autonomous dialogue reservation');
const terminalCancelled = terminalLeaseRadar.register({
  title: 'Cancel accepted review', kind: 'task', owner: 'user', accepted: true,
  source: 'terminal-lease-test', dueAt: now - 1,
});
terminalLeaseRadar.reserveForInitiative(terminalCancelled.id, 'soc:open-loop:terminal:cancelled');
terminalLeaseRadar.cancel(terminalCancelled.id, 'No longer required');
assert.equal(terminalLeaseRadar.snapshot().records.find(row => row.id === terminalCancelled.id)?.pendingSurfacingInitiativeId, null,
  'cancellation must release the autonomous dialogue reservation');
const terminalRestored = new OpenLoopRadar(() => now);
terminalRestored.restore(terminalLeaseRadar.snapshot());
assert.equal(terminalRestored.snapshot().records.length, 2,
  'terminal obligations must remain restorable after their active reservation is cleared');

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
assert.equal(leaseRadar.acknowledgeInitiative('soc:open-loop:lease:001'), true,
  'a delayed acknowledgement for the same delivered initiative must still be accepted after lease expiry');
assert.equal(leaseRadar.scan({ now, reminderCooldownMs: 60_000 })
  .find(row => row.record.id === leaseItem.id)?.shouldSurface, false,
  'a delayed but valid display acknowledgement must start the reminder cooldown');

const capacityRadar = new OpenLoopRadar(() => now);
for (let index = 0; index < 512; index++) {
  capacityRadar.register({ title: 'Active item ' + index, kind: 'task', owner: 'system', accepted: true, source: 'capacity-test' });
}
const atCapacity = capacityRadar.snapshot();
assert.throws(() => capacityRadar.register({
  title: 'Must not evict an active item', kind: 'task', owner: 'system', accepted: true, source: 'capacity-test',
}), /open-loop-capacity-exhausted/);
assert.deepEqual(capacityRadar.snapshot(), atCapacity, 'capacity exhaustion must not silently evict active obligations');

const terminalCapacityRadar = new OpenLoopRadar(() => now);
const protectedPrerequisite = terminalCapacityRadar.register({
  title: 'Keep verified prerequisite history', kind: 'task', owner: 'system',
  accepted: true, source: 'terminal-capacity-test',
});
const dependentOfTerminal = terminalCapacityRadar.register({
  title: 'Active task depending on verified history', kind: 'task', owner: 'system',
  accepted: true, source: 'terminal-capacity-test', dependencies: [protectedPrerequisite.id],
});
terminalCapacityRadar.fulfill(protectedPrerequisite.id, {
  kind: 'execution-receipt', reference: 'protected-prerequisite-receipt', verifiedAt: now,
});
const evictableTerminal = terminalCapacityRadar.register({
  title: 'Old terminal history eligible only under capacity pressure', kind: 'task',
  owner: 'system', accepted: true, source: 'terminal-capacity-test',
});
terminalCapacityRadar.fulfill(evictableTerminal.id, {
  kind: 'execution-receipt', reference: 'evictable-terminal-receipt', verifiedAt: now,
});
for (let index = 0; index < 509; index += 1) {
  terminalCapacityRadar.register({
    title: 'Active capacity item ' + index, kind: 'task', owner: 'system',
    accepted: true, source: 'terminal-capacity-test',
  });
}
assert.equal(terminalCapacityRadar.snapshot().records.length, 512,
  'terminal history must be retained until the bounded registry is full');
const admittedAfterPrune = terminalCapacityRadar.register({
  title: 'Admit new work by pruning only safe terminal history', kind: 'task',
  owner: 'system', accepted: true, source: 'terminal-capacity-test',
});
const afterTerminalPrune = terminalCapacityRadar.snapshot();
const retainedIds = new Set(afterTerminalPrune.records.map(record => record.id));
assert.equal(afterTerminalPrune.records.length, 512);
assert.equal(retainedIds.has(admittedAfterPrune.id), true);
assert.equal(retainedIds.has(protectedPrerequisite.id), true,
  'terminal prerequisites referenced by an active obligation must never be evicted');
assert.equal(retainedIds.has(dependentOfTerminal.id), true,
  'capacity pruning must not remove active obligations');
assert.equal(retainedIds.has(evictableTerminal.id), false,
  'only unreferenced terminal history may be evicted when the registry is full');

const transitiveCapacityRadar = new OpenLoopRadar(() => now);
const chainRoot = transitiveCapacityRadar.register({
  title: 'Transitive root prerequisite', kind: 'task', owner: 'system',
  accepted: true, source: 'transitive-capacity-test',
});
const chainMiddle = transitiveCapacityRadar.register({
  title: 'Terminal prerequisite depending on root', kind: 'task', owner: 'system',
  accepted: true, source: 'transitive-capacity-test', dependencies: [chainRoot.id],
});
const chainLeaf = transitiveCapacityRadar.register({
  title: 'Active obligation depending on terminal chain', kind: 'task', owner: 'system',
  accepted: true, source: 'transitive-capacity-test', dependencies: [chainMiddle.id],
});
transitiveCapacityRadar.fulfill(chainRoot.id, {
  kind: 'execution-receipt', reference: 'transitive-root-receipt', verifiedAt: now,
});
transitiveCapacityRadar.fulfill(chainMiddle.id, {
  kind: 'execution-receipt', reference: 'transitive-middle-receipt', verifiedAt: now,
});
const disposableAncestor = transitiveCapacityRadar.register({
  title: 'Unreferenced terminal record', kind: 'task', owner: 'system',
  accepted: true, source: 'transitive-capacity-test',
});
transitiveCapacityRadar.fulfill(disposableAncestor.id, {
  kind: 'execution-receipt', reference: 'disposable-history-receipt', verifiedAt: now,
});
for (let index = 0; index < 508; index += 1) {
  transitiveCapacityRadar.register({
    title: 'Transitive capacity item ' + index, kind: 'task', owner: 'system',
    accepted: true, source: 'transitive-capacity-test',
  });
}
assert.equal(transitiveCapacityRadar.snapshot().records.length, 512);
transitiveCapacityRadar.register({
  title: 'New work after transitive-safe pruning', kind: 'task', owner: 'system',
  accepted: true, source: 'transitive-capacity-test',
});
const transitiveAfterPrune = transitiveCapacityRadar.snapshot();
const transitiveRetainedIds = new Set(transitiveAfterPrune.records.map(record => record.id));
assert.equal(transitiveAfterPrune.records.length, 512);
assert.equal(transitiveRetainedIds.has(chainLeaf.id), true);
assert.equal(transitiveRetainedIds.has(chainMiddle.id), true,
  'terminal prerequisites directly referenced by active work must be retained');
assert.equal(transitiveRetainedIds.has(chainRoot.id), true,
  'terminal ancestors of a protected prerequisite must also be retained');
assert.equal(transitiveRetainedIds.has(disposableAncestor.id), false,
  'only terminal records outside every active dependency ancestry may be pruned');
const transitiveRestored = new OpenLoopRadar(() => now);
transitiveRestored.restore(transitiveAfterPrune);
assert.equal(transitiveRestored.snapshot().records.length, 512,
  'capacity pruning must preserve a snapshot that can be restored without losing active dependency chains');

// A new item and all of its terminal prerequisite ancestry must be protected
// before capacity pruning. Only an unrelated terminal leaf may be evicted.
const referencedTerminalCapacityRadar = new OpenLoopRadar(() => now);
const referencedTerminalRoot = referencedTerminalCapacityRadar.register({
  title: 'Root of retained terminal prerequisite chain', kind: 'task', owner: 'system',
  accepted: true, source: 'incoming-dependency-capacity-test',
});
const referencedTerminalMiddle = referencedTerminalCapacityRadar.register({
  title: 'Terminal prerequisite that depends on the root', kind: 'task', owner: 'system',
  accepted: true, source: 'incoming-dependency-capacity-test',
  dependencies: [referencedTerminalRoot.id],
});
referencedTerminalCapacityRadar.fulfill(referencedTerminalRoot.id, {
  kind: 'execution-receipt', reference: 'incoming-chain-root-receipt', verifiedAt: now,
});
referencedTerminalCapacityRadar.fulfill(referencedTerminalMiddle.id, {
  kind: 'execution-receipt', reference: 'incoming-chain-middle-receipt', verifiedAt: now,
});
const unrelatedTerminalLeaf = referencedTerminalCapacityRadar.register({
  title: 'Unrelated terminal leaf may be pruned', kind: 'task', owner: 'system',
  accepted: true, source: 'incoming-dependency-capacity-test',
});
referencedTerminalCapacityRadar.fulfill(unrelatedTerminalLeaf.id, {
  kind: 'execution-receipt', reference: 'unrelated-terminal-leaf-receipt', verifiedAt: now,
});
for (let index = 0; index < 509; index += 1) {
  referencedTerminalCapacityRadar.register({
    title: 'Fill capacity without consuming retained ancestry ' + index,
    kind: 'task', owner: 'system', accepted: true, source: 'incoming-dependency-capacity-test',
  });
}
assert.equal(referencedTerminalCapacityRadar.snapshot().records.length, 512);
const admittedWithTerminalPrerequisite = referencedTerminalCapacityRadar.register({
  title: 'New obligation depending on completed work', kind: 'project_step', owner: 'system',
  accepted: true, source: 'incoming-dependency-capacity-test',
  dependencies: [referencedTerminalMiddle.id],
});
const referencedTerminalSnapshot = referencedTerminalCapacityRadar.snapshot();
const referencedTerminalIds = new Set(referencedTerminalSnapshot.records.map(record => record.id));
assert.equal(referencedTerminalSnapshot.records.length, 512);
assert.equal(referencedTerminalIds.has(admittedWithTerminalPrerequisite.id), true);
assert.equal(referencedTerminalIds.has(referencedTerminalMiddle.id), true,
  'capacity admission must retain a terminal prerequisite referenced by the new obligation');
assert.equal(referencedTerminalIds.has(referencedTerminalRoot.id), true,
  'capacity admission must retain the transitive ancestry of the new prerequisite');
assert.equal(referencedTerminalIds.has(unrelatedTerminalLeaf.id), false,
  'capacity admission may prune an unrelated terminal leaf');
const referencedTerminalRestored = new OpenLoopRadar(() => now);
referencedTerminalRestored.restore(referencedTerminalSnapshot);
assert.equal(referencedTerminalRestored.snapshot().records.length, 512,
  'capacity pruning must leave a fully restorable dependency graph');
assert.equal(referencedTerminalRestored.snapshot().records.some(record => record.id === admittedWithTerminalPrerequisite.id), true);

const lifecycleRadar = new OpenLoopRadar(() => now);
const snoozed = lifecycleRadar.register({
  title: 'Review the deferred milestone', kind: 'task', owner: 'user',
  accepted: true, source: 'snooze-contract', dueAt: now - 1,
});
const snoozedUntil = now + 90_000;
const snoozedRecord = lifecycleRadar.snooze(snoozed.id, snoozedUntil, 'Waiting for the next planning window');
assert.equal(snoozedRecord.snoozedUntil, snoozedUntil);
const snoozedCandidate = lifecycleRadar.scan({ now, reminderCooldownMs: 0 })
  .find(row => row.record.id === snoozed.id);
assert.equal(snoozedCandidate?.shouldSurface, false);
assert.equal(snoozedCandidate?.suppressionReason, 'snoozed');
assert.equal(snoozedCandidate?.snoozeRemainingMs, 90_000);
const snoozeSnapshot = lifecycleRadar.snapshot();
const restoredSnoozeRadar = new OpenLoopRadar(() => now);
restoredSnoozeRadar.restore(snoozeSnapshot);
assert.equal(restoredSnoozeRadar.scan({ now, reminderCooldownMs: 0 })
  .find(row => row.record.id === snoozed.id)?.suppressionReason, 'snoozed',
  'snooze must survive process restart');
now = snoozedUntil;
assert.equal(restoredSnoozeRadar.scan({ now, reminderCooldownMs: 0 })
  .find(row => row.record.id === snoozed.id)?.shouldSurface, true,
  'snoozed obligations must become eligible again at their wake time');
const snoozeInitiative = 'soc:open-loop:snooze:001';
restoredSnoozeRadar.reserveForInitiative(snoozed.id, snoozeInitiative);
const movedWakeTime = now + 120_000;
restoredSnoozeRadar.snooze(snoozed.id, movedWakeTime, 'User asked to revisit later');
assert.equal(restoredSnoozeRadar.snapshot().records.find(row => row.id === snoozed.id)?.pendingSurfacingInitiativeId, null,
  'snoozing must release an in-flight autonomous dialogue reservation');
assert.throws(() => restoredSnoozeRadar.snooze(snoozed.id, now, 'not future'), /future timestamp/);
assert.throws(() => restoredSnoozeRadar.snooze(snoozed.id, now + 366 * 86_400_000, 'too distant'), /365-day/);
assert.throws(() => restoredSnoozeRadar.snooze(snoozed.id, now + 60_000, ''), /snooze-reason-required/);

const dependencyRadar = new OpenLoopRadar(() => now);
const cancelledPrerequisite = dependencyRadar.register({
  title: 'Superseded provider task', kind: 'waiting', owner: 'system',
  accepted: true, source: 'dependency-edit-contract',
});
const activeDependent = dependencyRadar.register({
  title: 'Continue after provider task', kind: 'project_step', owner: 'system',
  accepted: true, source: 'dependency-edit-contract', dependencies: [cancelledPrerequisite.id],
});
dependencyRadar.cancel(cancelledPrerequisite.id, 'Provider path was retired');
assert.equal(dependencyRadar.snapshot().records.find(row => row.id === activeDependent.id)?.status, 'blocked');
assert.throws(() => dependencyRadar.updateDependencies(activeDependent.id, [], '  '), /dependency-change-reason-required/);
const dependencyInitiative = 'soc:open-loop:dependency-edit:001';
dependencyRadar.reserveForInitiative(activeDependent.id, dependencyInitiative);
dependencyRadar.updateDependencies(activeDependent.id, [], 'Use the replacement provider path');
assert.equal(dependencyRadar.snapshot().records.find(row => row.id === activeDependent.id)?.pendingSurfacingInitiativeId, null,
  'changing dependency semantics must release any in-flight initiative built from the old dependency graph');
assert.equal(dependencyRadar.snapshot().records.find(row => row.id === activeDependent.id)?.status, 'open',
  'removing an obsolete cancelled prerequisite must unblock the dependent task');

const cycleLeft = dependencyRadar.register({
  title: 'Cycle left', kind: 'task', owner: 'system', accepted: true, source: 'dependency-cycle-contract',
});
const cycleRight = dependencyRadar.register({
  title: 'Cycle right', kind: 'task', owner: 'system', accepted: true,
  source: 'dependency-cycle-contract', dependencies: [cycleLeft.id],
});
const beforeCycleMutation = dependencyRadar.snapshot();
assert.throws(() => dependencyRadar.updateDependencies(cycleLeft.id, [cycleRight.id], 'Would create a cycle'),
  /open-loop-dependency-cycle/);
assert.deepEqual(dependencyRadar.snapshot(), beforeCycleMutation);
assert.throws(() => dependencyRadar.updateDependencies(cycleLeft.id, ['missing-dependency'], 'Invalid reference'),
  /unknown-dependency/);
assert.deepEqual(dependencyRadar.snapshot(), beforeCycleMutation);

const detached = restored.snapshot();
detached.records[0].title = 'tampered';
assert.notEqual(restored.snapshot().records[0].title, 'tampered');
console.log('OPEN_LOOP_RADAR_CONTRACT=PASS');
