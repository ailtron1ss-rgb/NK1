import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';

const toolId = 'test.crash-write';
const request = { target: 'relay-01', value: true };
const options = { idempotencyKey: 'wp44:external-relay-01:desired-state-v1', decisionId: 'cef:decision:relay-01', autonomous: true };
const makeGateway = (execute, finalizer, persist) => {
  const gateway = new ActionGateway();
  gateway.registerTool({ id: toolId, capability: 'device.set-state', destructive: false, projectAllowed: true, execute, verify: async () => ({ verified: true, basis: 'tool-contract', confidence01: .9, externalObservation: false, notes: 'tool-response-only' }) });
  gateway.setExecutionLedgerPersister(persist);
  gateway.setExecutionFinalizer(finalizer);
  return gateway;
};
const approve = async gateway => {
  const created = await gateway.requestToolApproval(toolId, request, 'workpass57-crash-fixture', options, 'execute');
  assert.equal(created.created, true, 'test fixture must persist the current one-use approval contract');
  const resolved = await gateway.resolveToolApproval(created.request.id, true, 'test-owner');
  assert.equal(resolved.ok, true);
  return { ...options, approvalId: created.request.id };
};

// Crash before pending receipt persistence: no executor entry / side effect.
{
  let effects = 0;
  let writes = 0;
  const gateway = makeGateway(async () => { effects++; return { ok: true }; }, async () => {}, async snapshot => { if (snapshot.records?.some(row => row.status === 'pending')) { writes++; throw new Error('pre-effect-persist-failed'); } });
  const approvedOptions = await approve(gateway);
  const result = await gateway.executeTool(toolId, request, 'wp44-pre-effect', approvedOptions);
  assert.equal(result.outcomeClass, 'idempotency-storage-failed');
  assert.equal(effects, 0, 'pending receipt must durably commit before executor entry');
}

// Crash/exception immediately after the external side effect and before finalization.
// The durable pending receipt contains a stable execution identity; restart must not execute again.
{
  let effects = 0;
  let durable;
  const first = makeGateway(async (input, context) => { effects++; assert.ok(context.executionId.startsWith('exec-')); assert.equal(context.idempotencyKey.length, 64); return { ok: true, remoteReceipt: `remote-${context.idempotencyKey.slice(0, 12)}` }; }, async () => { throw new Error('injected-crash-after-external-effect'); }, async snapshot => { durable = structuredClone(snapshot); });
  const approvedOptions = await approve(first);
  const firstResult = await first.executeTool(toolId, request, 'wp44-post-effect', approvedOptions);
  assert.equal(firstResult.outcomeClass, 'idempotency-recovery-required');
  assert.equal(effects, 1);
  assert.equal(durable.records[0].status, 'pending');
  assert.equal(durable.records[0].executionId, firstResult.executionId);
  const next = makeGateway(async () => { effects++; return { ok: true }; }, async () => {}, async snapshot => { durable = structuredClone(snapshot); });
  next.restoreExecutionLedger(durable);
  const recovered = await next.executeTool(toolId, request, 'wp44-post-effect-retry', options);
  assert.equal(recovered.outcomeClass, 'idempotency-recovery-required');
  assert.equal(recovered.executionId, firstResult.executionId, 'receipt execution ID stays stable across restart');
  assert.equal(effects, 1, 'ambiguous side effect is never automatically repeated');
}

// Crash while committing the completed receipt: ActionGateway must restore pending fail-closed state.
{
  let effects = 0;
  let writes = 0;
  let durable;
  const gateway = makeGateway(async () => { effects++; return { ok: true, value: 1 }; }, async () => {}, async snapshot => {
    const row = snapshot.records.find(entry => entry.status === 'completed');
    if (row && ++writes <= 1) throw new Error('injected-completed-receipt-write-failure');
    durable = structuredClone(snapshot);
  });
  const approvedOptions = await approve(gateway);
  const result = await gateway.executeTool(toolId, request, 'wp44-complete-persist-fault', approvedOptions);
  assert.equal(result.outcomeClass, 'idempotency-recovery-required');
  assert.equal(effects, 1);
  assert.ok(durable.records.some(row => row.status === 'pending'), 'failed completed commit leaves a durable pending receipt');
  const next = makeGateway(async () => { effects++; return { ok: true }; }, async () => {}, async snapshot => { durable = structuredClone(snapshot); });
  next.restoreExecutionLedger(durable);
  const retry = await next.executeTool(toolId, request, 'wp44-complete-persist-retry', options);
  assert.equal(retry.outcomeClass, 'idempotency-recovery-required');
  assert.equal(effects, 1);
}

// Completed receipt survives restart and replays the same execution identity/result without re-running finalization.
{
  let effects = 0;
  let finalizations = 0;
  let durable;
  const first = makeGateway(async (input, context) => { effects++; return { ok: true, operation: context.executionId, token: context.idempotencyKey }; }, async ({ result }) => { finalizations++; assert.ok(result.executionId); }, async snapshot => { durable = structuredClone(snapshot); });
  const approvedOptions = await approve(first);
  const original = await first.executeTool(toolId, request, 'wp44-complete-replay', approvedOptions);
  assert.equal(original.ok, true);
  assert.equal(original.executionId, durable.records.find(row => row.status === 'completed').executionId);
  const restarted = makeGateway(async () => { effects++; return { ok: false }; }, async () => { finalizations++; }, async snapshot => { durable = structuredClone(snapshot); });
  restarted.restoreExecutionLedger(durable);
  const replay = await restarted.executeTool(toolId, request, 'wp44-completed-replay', options);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.executionId, original.executionId);
  assert.equal(replay.result.operation, original.result.operation);
  assert.equal(effects, 1);
  assert.equal(finalizations, 1, 'completed receipt replay must not finalize/learn twice');
  const conflict = await restarted.executeTool(toolId, { ...request, value: false }, 'wp44-conflicting-key', options);
  assert.equal(conflict.outcomeClass, 'idempotency-conflict');
  assert.equal(effects, 1);
}

console.log(JSON.stringify({ ok: true, assertions: 'pre-effect durable gate; post-effect pending reconciliation; completed-commit failure; stable executor idempotency context; post-restart replay; conflicting-key refusal' }));
