import assert from 'node:assert/strict';
import { DurableDeliveryOutbox } from '../src/organism/persistence/DurableDeliveryOutbox.ts';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const at = 1_000_000;
const outbox = new DurableDeliveryOutbox({ maxRecords: 8, maxAttempts: 2, retryBaseMs: 1000, retryMaxMs: 4000 });

const created = outbox.enqueue({
  dedupeKey: 'decision:task-7:notify',
  kind: 'task-completion',
  payloadRef: 'message-ref:task-7',
  sourceTaskId: 'task-7',
  decisionId: 'decision-7',
  consentScopeVersion: 'consent-v3',
  expiresAt: at + 60_000,
}, at);
assert.equal(created.duplicate, false);
assert.equal(created.record.status, 'pending');
assert.equal(Object.hasOwn(created.record, 'payload'), false, 'outbox stores a reference, not message text');

const duplicate = outbox.enqueue({
  dedupeKey: 'decision:task-7:notify',
  kind: 'task-completion',
  payloadRef: 'message-ref:task-7',
}, at + 1);
assert.equal(duplicate.duplicate, true);
assert.equal(duplicate.record.id, created.record.id);

const claim = outbox.claimNext('sender-A', at + 2, 5000);
assert.equal(claim?.status, 'leased');
assert.equal(claim?.attemptCount, 1);
assert.equal(outbox.acknowledge(created.record.id, 'sender-B', at + 3), false, 'foreign lease owner cannot acknowledge');
assert.equal(outbox.recordFailure(created.record.id, 'sender-A', 'transport-timeout', at + 4), true);
const afterFailure = outbox.get(created.record.id);
assert.ok(afterFailure, 'failed delivery remains addressable by its stable outbox ID');
assert.equal(afterFailure.status, 'reconciliation-required',
  'a post-lease transport failure is ambiguous and cannot be retried from its error code');
assert.equal(outbox.claimNext('sender-A', at + 500, 5000), null,
  'an ambiguous send remains quarantined until the host checks the recipient');
assert.equal(outbox.resolveReconciliation(created.record.id, 'confirmed-not-delivered', at + 4), true,
  'only authoritative not-delivered evidence can authorize retry');
const reconciledFailure = outbox.get(created.record.id);
assert.equal(reconciledFailure?.status, 'pending');
assert.equal(reconciledFailure?.nextAttemptAt, at + 1004, 'confirmed non-delivery uses bounded exponential backoff');

assert.equal(outbox.claimNext('sender-A', at + 500, 5000), null, 'retry is not eligible before nextAttemptAt');
const secondClaim = outbox.claimNext('sender-A', at + 1004, 5000);
assert.equal(secondClaim?.attemptCount, 2);
assert.equal(outbox.acknowledge(created.record.id, 'sender-A', at + 1005), true);
assert.equal(outbox.get(created.record.id)?.status, 'delivered');
assert.equal(outbox.acknowledge(created.record.id, 'sender-A', at + 1006), false, 'delivery acknowledgement is one-shot');

for (const kind of ['initiative-message', 'social-initiative']) {
  assert.throws(() => outbox.enqueue({
    dedupeKey: `initiative:${kind}`,
    kind,
    payloadRef: `initiative-ref:${kind}`,
  }, at + 1999), /delivery-outbox-kind-invalid/,
  'the generic outbox must not take ownership of social initiative message leases');
}

const leaseRow = outbox.enqueue({ dedupeKey: 'generic:lease:22', kind: 'custom', payloadRef: 'custom:lease-22' }, at + 2000);
assert.ok(outbox.claim(leaseRow.record.id, 'crashed-sender', at + 2001, 1000));
assert.equal(outbox.reapExpiredLeases(at + 3001), 1);
assert.equal(outbox.get(leaseRow.record.id)?.status, 'reconciliation-required',
  'an expired lease is quarantined because the external side effect may have happened');
assert.equal(outbox.claim(leaseRow.record.id, 'sender-B', at + 3002, 1000), null,
  'an expired ambiguous lease must not be retried without host reconciliation');
assert.equal(outbox.resolveReconciliation(leaseRow.record.id, 'unknown', at + 3002), false,
  'an unknown provider result must remain quarantined');
assert.equal(outbox.diagnostics().reconciliationRequired, 1,
  'diagnostics expose quarantined external outcomes');
assert.equal(outbox.pendingCandidate(at + 3002), null,
  'reconciliation-required records are not visible as ordinary pending work');
assert.equal(outbox.resolveReconciliation(leaseRow.record.id, 'confirmed-not-delivered', at + 3002), true,
  'host reconciliation may requeue only after it confirms that no external delivery occurred');
assert.equal(outbox.get(leaseRow.record.id)?.status, 'pending');
assert.equal(outbox.get(leaseRow.record.id)?.nextAttemptAt, at + 4002,
  'reconciled retry observes exponential backoff');
assert.equal(outbox.claim(leaseRow.record.id, 'sender-B', at + 4001, 1000), null);
assert.equal(outbox.claim(leaseRow.record.id, 'sender-B', at + 4002, 1000)?.attemptCount, 2);
assert.equal(outbox.reapExpiredLeases(at + 5002), 1);
assert.equal(outbox.get(leaseRow.record.id)?.status, 'reconciliation-required',
  'the second ambiguous lease also requires reconciliation');
assert.equal(outbox.resolveReconciliation(leaseRow.record.id, 'confirmed-not-delivered', at + 5002), true);
assert.equal(outbox.get(leaseRow.record.id)?.status, 'dead-letter',
  'reconciled attempts cannot exceed the configured attempt ceiling');

const uncertainDelivered = outbox.enqueue({
  dedupeKey: 'generic:reconciliation:delivered',
  kind: 'notification',
  payloadRef: 'notification:reconcile-delivered',
}, at + 6000);
assert.ok(outbox.claim(uncertainDelivered.record.id, 'sender-C', at + 6001, 1000));
assert.equal(outbox.reapExpiredLeases(at + 7001), 1);
assert.equal(outbox.resolveReconciliation(uncertainDelivered.record.id, 'confirmed-delivered', at + 7002), true,
  'authoritative reconciliation can settle an ambiguous send as delivered without a duplicate retry');
assert.equal(outbox.get(uncertainDelivered.record.id)?.status, 'delivered');
assert.equal(outbox.get(uncertainDelivered.record.id)?.deliveredAt, at + 7002);

const expiring = outbox.enqueue({
  dedupeKey: 'reminder:expired',
  kind: 'reminder',
  payloadRef: 'reminder-ref:expired',
  expiresAt: at + 10,
}, at);
assert.equal(outbox.reapExpiredLeases(at + 10), 1);
assert.equal(outbox.get(expiring.record.id)?.status, 'cancelled');

const ambiguousExpiry = outbox.enqueue({
  dedupeKey: 'reminder:ambiguous-expiry',
  kind: 'reminder',
  payloadRef: 'reminder-ref:ambiguous-expiry',
  expiresAt: at + 100,
}, at);
assert.ok(outbox.claim(ambiguousExpiry.record.id, 'sender-expiry', at + 1, 1000));
assert.equal(outbox.recordFailure(ambiguousExpiry.record.id, 'sender-expiry', 'transport-timeout', at + 2), true);
assert.equal(outbox.get(ambiguousExpiry.record.id)?.status, 'reconciliation-required',
  'an expired reminder is not cancelled while its external outcome remains ambiguous');
assert.equal(outbox.resolveReconciliation(ambiguousExpiry.record.id, 'confirmed-not-delivered', at + 101), true);
assert.equal(outbox.get(ambiguousExpiry.record.id)?.status, 'cancelled',
  'expiry is applied only after the host confirms that the recipient did not accept the send');

const cancel = outbox.enqueue({ dedupeKey: 'notification:cancel', kind: 'notification', payloadRef: 'notification-ref:cancel' }, at);
assert.equal(outbox.cancel(cancel.record.id, 'user-revoked-consent'), true);
assert.equal(outbox.cancel(cancel.record.id, 'duplicate-cancel'), false);

const restored = new DurableDeliveryOutbox({ maxRecords: 8, maxAttempts: 2, retryBaseMs: 1000, retryMaxMs: 4000 });
restored.restore(outbox.snapshot());
assert.deepEqual(restored.snapshot(), outbox.snapshot(), 'state round-trips without losing delivery lineage');

const malformed = outbox.snapshot();
malformed.records[0].status = 'sent';
assert.throws(() => restored.restore(malformed), /delivery-outbox-enum-invalid/);

const legacySocial = new DurableDeliveryOutbox({ maxRecords: 4 });
legacySocial.restore({
  version: 1,
  sequence: 1,
  records: [{
    id: 'legacy-social-1',
    dedupeKey: 'legacy-social:1',
    kind: 'social-initiative',
    payloadRef: 'nk1:social-initiative/legacy-1',
    sourceTaskId: null,
    initiativeId: 'legacy-1',
    decisionId: null,
    consentScopeVersion: null,
    createdAt: at,
    nextAttemptAt: at,
    expiresAt: null,
    attemptCount: 1,
    status: 'reconciliation-required',
    leaseOwner: null,
    leaseUntil: 0,
    deliveredAt: null,
    lastErrorCode: 'delivery-lease-expired',
  }],
});
assert.equal(legacySocial.pendingCandidate(at + 1), null,
  'legacy social rows remain readable but are never leased by the generic outbox');
assert.equal(legacySocial.resolveReconciliation('legacy-social-1', 'confirmed-not-delivered', at + 1), false,
  'the generic outbox cannot settle a legacy social initiative owned by the social engine');

const exhaustedPendingState = {
  version: 1,
  sequence: 1,
  records: [{
    id: 'exhausted-pending',
    dedupeKey: 'exhausted-pending',
    kind: 'custom',
    payloadRef: 'custom:exhausted-pending',
    sourceTaskId: null,
    initiativeId: null,
    decisionId: null,
    consentScopeVersion: null,
    createdAt: at,
    nextAttemptAt: at,
    expiresAt: null,
    attemptCount: 2,
    status: 'pending',
    leaseOwner: null,
    leaseUntil: 0,
    deliveredAt: null,
    lastErrorCode: null,
  }],
};
assert.throws(() => restored.restore(exhaustedPendingState), /delivery-outbox-attempts-exhausted-pending/,
  'a restored pending row at the attempt ceiling cannot be claimed again');

const accessorRoot = { version: 1, sequence: 0, records: [] };
Object.defineProperty(accessorRoot, 'records', { enumerable: true, get: () => [] });
assert.throws(() => restored.restore(accessorRoot), /delivery-outbox-accessor-rejected/);

const accessorInput = { kind: 'custom', payloadRef: 'ref:accessor' };
Object.defineProperty(accessorInput, 'dedupeKey', { enumerable: true, get: () => 'unsafe' });
assert.throws(() => restored.enqueue(accessorInput, at), /delivery-outbox-accessor-rejected/);
const proxyInput = new Proxy({ dedupeKey: 'proxy:input', kind: 'custom', payloadRef: 'ref:proxy' }, {});
assert.throws(() => restored.enqueue(proxyInput, at), /delivery-outbox-input-invalid/);
assert.throws(() => restored.enqueue({ dedupeKey: 'extra:field', kind: 'custom', payloadRef: 'ref:extra', payload: 'raw text' }, at), /delivery-outbox-input-field-unsupported/);
assert.throws(() => restored.enqueue({ dedupeKey: 'raw:payload', kind: 'custom', payloadRef: 'This is the message text' }, at), /delivery-outbox-payload-ref-invalid/);

const leasedCancel = restored.enqueue({ dedupeKey: 'cancel:leased', kind: 'custom', payloadRef: 'ref:leased' }, at);
assert.ok(restored.claim(leasedCancel.record.id, 'sender-C', at, 1000));
assert.equal(restored.cancel(leasedCancel.record.id, 'user-revoked-consent'), false, 'a leased side effect must be reconciled before cancellation');

const saturated = new DurableDeliveryOutbox({ maxRecords: 1 });
saturated.enqueue({ dedupeKey: 'active:one', kind: 'custom', payloadRef: 'ref:one' }, at);
assert.throws(() => saturated.enqueue({ dedupeKey: 'active:two', kind: 'custom', payloadRef: 'ref:two' }, at), /delivery-outbox-capacity-reached/);

const runtimeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'nk1-delivery-outbox-runtime-'));
const runtimeConfig = {
  stateFile: path.join(runtimeDirectory, 'organism.json'),
  worldStateFile: path.join(runtimeDirectory, 'world.json'),
  stateStore: new MemoryStateStore(),
  worldStateStore: new MemoryStateStore(),
  journal: new BoundedOperationalJournal(),
  intervalMs: 60_000,
  enableLanguage: false,
  autoRun: false,
  checkpointMinIntervalMs: 0,
  checkpointMaxDirtyCycles: 1,
  deliveryAdmission: (record) => record.consentScopeVersion === 'consent-rev1',
};
let runtime;
let restarted;
let closedRuntime;
try {
  runtime = new OrganismRuntime(runtimeConfig);
  await runtime.init();
  const runtimeItem = await runtime.enqueueDeliveryObligation({
    dedupeKey: 'runtime:decision:1',
    kind: 'task-completion',
    payloadRef: 'runtime-message:decision-1',
    decisionId: 'decision-1',
    consentScopeVersion: 'consent-rev1',
  }, at);
  const runtimeLease = await runtime.prepareNextDeliveryObligation('runtime-sender-A', 1000, at + 5);
  assert.equal(runtimeLease?.id, runtimeItem.record.id, 'Runtime applies host admission before leasing');
  assert.equal(runtimeLease?.attemptCount, 1);
  await runtime.flush();
  await runtime.stop();
  runtime = null;

  restarted = new OrganismRuntime(runtimeConfig);
  await restarted.init();
  const restoredLease = (await restarted.deliveryOutboxSnapshot()).records.find(row => row.id === runtimeItem.record.id);
  assert.equal(restoredLease?.status, 'leased', 'delivery lease is persisted in the Runtime sidecar');
  const quarantined = await restarted.prepareNextDeliveryObligation('runtime-sender-B', 1000, at + 1006);
  assert.equal(quarantined, null, 'Runtime must quarantine an expired ambiguous lease instead of automatically retrying it');
  assert.equal((await restarted.deliveryOutboxSnapshot()).records.find(row => row.id === runtimeItem.record.id)?.status, 'reconciliation-required');
  assert.equal(await restarted.resolveDeliveryObligationReconciliation(
    runtimeItem.record.id, 'confirmed-not-delivered', at + 1006,
  ), true, 'host must explicitly reconcile the external send before authorizing retry');
  assert.equal(await restarted.prepareNextDeliveryObligation('runtime-sender-B', 1000, at + 2005), null,
    'the reconciled retry still observes exponential backoff');
  const recoveredLease = await restarted.prepareNextDeliveryObligation('runtime-sender-B', 1000, at + 2006);
  assert.equal(recoveredLease?.id, runtimeItem.record.id, 'confirmed not-delivered lease is eligible after reconciliation');
  assert.equal(recoveredLease?.attemptCount, 2);
  assert.equal(await restarted.acknowledgeDeliveryObligation(runtimeItem.record.id, 'runtime-sender-B', at + 2007), true);
  assert.equal((await restarted.deliveryOutboxSnapshot()).records.find(row => row.id === runtimeItem.record.id)?.status, 'delivered');
  await restarted.stop();
  restarted = null;

  closedRuntime = new OrganismRuntime({
    ...runtimeConfig,
    stateFile: path.join(runtimeDirectory, 'closed-organism.json'),
    worldStateFile: path.join(runtimeDirectory, 'closed-world.json'),
    stateStore: new MemoryStateStore(),
    worldStateStore: new MemoryStateStore(),
    deliveryAdmission: undefined,
  });
  await closedRuntime.init();
  const closedItem = await closedRuntime.enqueueDeliveryObligation({
    dedupeKey: 'runtime:closed:1',
    kind: 'notification',
    payloadRef: 'runtime-message:closed',
  }, at);
  assert.equal(await closedRuntime.prepareNextDeliveryObligation('unapproved-sender', 1000, at + 1), null,
    'missing host admission keeps outbound delivery closed');
  assert.equal((await closedRuntime.deliveryOutboxSnapshot()).records.find(row => row.id === closedItem.record.id)?.status, 'pending');
  await closedRuntime.stop();
  closedRuntime = null;
} finally {
  await runtime?.stop().catch(() => {});
  await restarted?.stop().catch(() => {});
  await closedRuntime?.stop().catch(() => {});
  await fs.rm(runtimeDirectory, { recursive: true, force: true });
}



{
  const ambiguous = new DurableDeliveryOutbox({ maxRecords: 4, maxAttempts: 3, retryBaseMs: 1000, retryMaxMs: 4000 });
  const queued = ambiguous.enqueue({
    dedupeKey: 'ambiguous:transport-timeout',
    kind: 'notification',
    payloadRef: 'notification:ambiguous-timeout',
  }, at + 20_000);
  assert.ok(ambiguous.claim(queued.record.id, 'sender-A', at + 20_001, 5_000));
  assert.equal(ambiguous.recordFailure(queued.record.id, 'sender-A', 'transport-timeout', at + 20_002), true);
  assert.equal(ambiguous.get(queued.record.id)?.status, 'reconciliation-required',
    'a transport timeout is ambiguous: the recipient may have accepted the message before the ACK was lost');
  assert.equal(ambiguous.claimNext('sender-B', at + 30_000, 1_000), null,
    'an ambiguous send must not be retried before authoritative reconciliation');
  assert.equal(ambiguous.resolveReconciliation(queued.record.id, 'confirmed-not-delivered', at + 30_000), true);
  assert.equal(ambiguous.claim(queued.record.id, 'sender-B', at + 31_001, 1_000)?.status, 'leased',
    'retry is permitted only after the host confirms that the recipient did not accept the message');
}

console.log(JSON.stringify({ test: 'durable-delivery-outbox', status: 'PASS' }));
