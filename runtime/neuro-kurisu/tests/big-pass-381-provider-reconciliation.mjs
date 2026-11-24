import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { sha256Stable } from '../src/organism/core/StableSerialization.ts';

const TOOL = 'test.receipt-reconciliation';
const INPUT = { target: 'relay-main', desiredState: 'on' };
const KEY = 'wp45:relay-main:operation-17';
const OPTIONS = { idempotencyKey: KEY, decisionId: 'decision:wp45:relay-main', autonomous: true };
const verified = ({ result }) => ({ verified: result.ok === true && Boolean(result.providerReceipt), basis: 'tool-contract', confidence01: .93, externalObservation: false, notes: 'provider receipt schema checked' });
const makeGateway = (execute, reconcile, finalizer, persist) => {
  const gateway = new ActionGateway();
  gateway.registerTool({ id: TOOL, capability: 'device.set-state', destructive: false, projectAllowed: true,
    execute, reconcile, verify: verified });
  gateway.setExecutionLedgerPersister(persist);
  gateway.setExecutionFinalizer(finalizer);
  return gateway;
};
const approve = async (gateway, input = INPUT, options = OPTIONS, operation = 'execute') => {
  const created = await gateway.requestToolApproval(TOOL, input, `workpass57-${operation}-fixture`, options, operation);
  assert.equal(created.created, true, `persisted ${operation} approval must be created in fixture`);
  const resolved = await gateway.resolveToolApproval(created.request.id, true, 'test-owner');
  assert.equal(resolved.ok, true);
  return { ...options, approvalId: created.request.id };
};
const unresolvedSnapshot = () => ({ version: 1, records: [{
  keyHash: sha256Stable({ idempotencyKey: KEY }),
  requestHash: sha256Stable({ toolId: TOOL, input: INPUT, expectedOutputKeys: null, decisionId: OPTIONS.decisionId, autonomous: true }),
  status: 'pending', recordedAt: Date.now(), executionId: `exec-${sha256Stable({ idempotencyKey: KEY }).slice(0, 32)}`,
  toolId: TOOL, decisionId: OPTIONS.decisionId, autonomous: true,
}] });

// Provider receipt resolves a persisted ambiguous effect after restart without re-execution.
{
  let effects = 0, lookups = 0, finalizations = 0, durable;
  const first = makeGateway(async () => { effects++; return { ok: true, providerReceipt: 'r-17' }; }, undefined,
    async () => { throw new Error('simulated-process-loss-after-provider-accepted'); }, async snapshot => { durable = structuredClone(snapshot); });
  const approvedOptions = await approve(first);
  const attempted = await first.executeTool(TOOL, INPUT, 'before-crash', approvedOptions);
  assert.equal(attempted.outcomeClass, 'idempotency-recovery-required');
  assert.equal(effects, 1);
  assert.equal(durable.records[0].status, 'pending');

  const restarted = makeGateway(async () => { effects++; return { ok: false, providerReceipt: 'duplicate-side-effect' }; }, async (input, context) => {
    lookups++;
    assert.equal(context.executionId, attempted.executionId);
    assert.equal(context.idempotencyKey, durable.records[0].keyHash);
    return { status: 'found', authoritative: true, receiptId: 'provider-receipt-17', result: { ok: true, providerReceipt: 'r-17', appliedState: 'on' }, checkedAt: Date.now() };
  }, async ({ result }) => { finalizations++; assert.equal(result.executionId, attempted.executionId); }, async snapshot => { durable = structuredClone(snapshot); });
  restarted.restoreExecutionLedger(durable);
  const reconcileOptions = await approve(restarted, INPUT, OPTIONS, 'reconcile');
  const recovered = await restarted.reconcileToolExecution(TOOL, INPUT, 'after-restart-reconcile', reconcileOptions);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.verified, true);
  assert.equal(recovered.reconciled, true);
  assert.equal(recovered.providerReceiptId, 'provider-receipt-17');
  assert.equal(recovered.idempotencyStatus, 'reconciled');
  assert.equal(effects, 1, 'receipt lookup must not execute the side effect again');
  assert.equal(lookups, 1);
  assert.equal(finalizations, 1);
  assert.equal(durable.records[0].status, 'completed');
  assert.equal(durable.records[0].response.executionId, attempted.executionId);
  const replay = await restarted.executeTool(TOOL, INPUT, 'normal-replay-after-reconcile', OPTIONS);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.providerReceiptId, 'provider-receipt-17');
  assert.equal(effects, 1);
  assert.equal(lookups, 1);
  assert.equal(finalizations, 1);
}

// Unknown provider status leaves the exact receipt pending and does not finalize/learn.
{
  let durable = unresolvedSnapshot(), lookups = 0, effects = 0, finalizations = 0;
  const gateway = makeGateway(async () => { effects++; return { ok: true }; }, async () => {
    lookups++;
    return { status: 'unknown', reason: 'provider receipt API timed out', retryAfterMs: 500 };
  }, async () => { finalizations++; }, async snapshot => { durable = structuredClone(snapshot); });
  gateway.restoreExecutionLedger(durable);
  const reconcileOptions = await approve(gateway, INPUT, OPTIONS, 'reconcile');
  const result = await gateway.reconcileToolExecution(TOOL, INPUT, 'lookup-timeout', reconcileOptions);
  assert.equal(result.outcomeClass, 'idempotency-recovery-required');
  assert.equal(result.result.error, 'provider-receipt-status-unknown');
  assert.equal(durable.records[0].status, 'pending');
  assert.equal(effects, 0);
  assert.equal(finalizations, 0);
  assert.equal(lookups, 1);
}

// Concurrent reconciliation joins one provider lookup and one finalization.
{
  let durable = unresolvedSnapshot(), lookups = 0, finalizations = 0;
  const gateway = makeGateway(async () => assert.fail('pending reconciliation must not execute'), async () => {
    lookups++; await new Promise(resolve => setTimeout(resolve, 15));
    return { status: 'found', authoritative: true, receiptId: 'provider-concurrent-1', result: { ok: true, providerReceipt: 'r-concurrent' } };
  }, async () => { finalizations++; }, async snapshot => { durable = structuredClone(snapshot); });
  gateway.restoreExecutionLedger(durable);
  const reconcileOptions = await approve(gateway, INPUT, OPTIONS, 'reconcile');
  const [a, b] = await Promise.all([
    gateway.reconcileToolExecution(TOOL, INPUT, 'parallel-reconcile-a', reconcileOptions),
    gateway.reconcileToolExecution(TOOL, INPUT, 'parallel-reconcile-b', reconcileOptions),
  ]);
  assert.equal(a.executionId, b.executionId);
  assert.equal(lookups, 1);
  assert.equal(finalizations, 1);
  assert.equal(durable.records[0].status, 'completed');
}

// An authoritative no-receipt response terminalizes the receipt, but never becomes a tool failure/learning sample.
{
  const store = new MemoryStateStore();
  const seed = new OrganismCore(store, { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await seed.init();
  const core = new OrganismCore(store, { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await core.init();
  let effects = 0, lookups = 0;
  core.registerActionTool({ id: TOOL, capability: 'device.set-state', destructive: false, projectAllowed: true,
    execute: async () => { effects++; return { ok: true, providerReceipt: 'should-not-run' }; },
    reconcile: async (_input, context) => {
      lookups++;
      assert.ok(context.executionId.startsWith('exec-'));
      return { status: 'not-found', authoritative: true, reason: 'provider guarantees complete lookup for this operation key', checkedAt: Date.now() };
    },
    verify: verified,
  });
  core.cognitiveRuntime.actionGateway.restoreExecutionLedger(unresolvedSnapshot());
  const beforeOutcomes = core.outcomeVerificationSnapshot().records.length;
  const reconcileOptions = await approve(core.cognitiveRuntime.actionGateway, INPUT, OPTIONS, 'reconcile');
  const settled = await core.reconcileToolExecution(TOOL, INPUT, 'authoritative-provider-absence', reconcileOptions);
  assert.equal(settled.outcomeClass, 'reconciled-not-executed');
  assert.equal(settled.idempotencyStatus, 'confirmed-not-executed');
  assert.equal(effects, 0);
  assert.equal(lookups, 1);
  assert.equal(core.outcomeVerificationSnapshot().records.length, beforeOutcomes, 'authoritative absence must not become competence/temporal learning');
  const causal = core.cognitiveEventFabricSnapshot();
  assert.ok(causal.recent.some(row => row.stage === 'tool-reconciliation' && row.payload.executionId === settled.executionId && row.payload.status === 'provider-confirmed-not-executed'));
  const saved = await store.load();
  assert.ok(saved.system.actionExecutionLedger.records.some(row => row.status === 'completed' && row.response?.idempotencyStatus === 'confirmed-not-executed'));
  const replay = await core.executeTool(TOOL, INPUT, 'do-not-retry-confirmed-absence', OPTIONS);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(effects, 0);
}

// No provider callback and no receipt may ever fall back to execute.
{
  let effects = 0, durable = unresolvedSnapshot();
  const gateway = makeGateway(async () => { effects++; return { ok: true }; }, undefined, async () => {}, async snapshot => { durable = structuredClone(snapshot); });
  gateway.restoreExecutionLedger(durable);
  const reconcileOptions = await approve(gateway, INPUT, OPTIONS, 'reconcile');
  const result = await gateway.reconcileToolExecution(TOOL, INPUT, 'adapter-missing', reconcileOptions);
  assert.equal(result.outcomeClass, 'idempotency-recovery-required');
  assert.equal(result.result.error, 'tool-does-not-support-receipt-reconciliation');
  assert.equal(effects, 0);
  assert.equal(durable.records[0].status, 'pending');
}

console.log(JSON.stringify({ ok: true, pass: 'workpass45-provider-reconciliation', scenarios: 5, assertions: 'provider-found recovery; unknown status fail-closed; concurrent lookup coalescing; authoritative no-effect terminalization without learning; no fallback execution' }));
