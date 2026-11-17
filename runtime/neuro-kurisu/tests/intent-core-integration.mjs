import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const approvalKey = 'nk1-intent-integration-test-key-32-bytes';
const store = new MemoryStateStore();
const config = {
  cycleResultMode: 'operational',
  checkpointMinIntervalMs: 0,
  intentApprovalKey: approvalKey,
};
const core = new OrganismCore(store, config);
await core.init();

const draft = core.compileIntent({
  requestId: 'intent:core-integration:inspect',
  text: 'Inspect the current NK1 organism state and report the verified status.',
  extraction: {
    goal: 'Inspect the current NK1 organism state',
    expectedOutcome: 'A verified current-state report',
    acceptanceCriteria: ['Return the current tick and action state'],
    permissions: { allowedActions: ['organism.inspect'] },
    stopConditions: ['Stop if the organism is not initialized'],
  },
});
assert.equal(draft.approval.status, 'not-approved');

const blockedDraftExecution = await core.executeIntent(draft, {
  toolId: 'organism.inspect', input: {}, reason: 'must-not-run-before-user-approval',
});
assert.equal(blockedDraftExecution.executed, false,
  'the Core execution route must reject an unapproved contract before calling ActionGateway');

const scope = {
  allowedActions: ['organism.inspect'],
  acknowledgedAssumptions: [],
  riskAcknowledged: false,
};
const approvalRequest = await core.requestIntentApproval(draft, scope, 'Review NK1 inspection intent');
assert.equal(approvalRequest.created, true);
assert.equal(approvalRequest.request.status, 'pending');
assert.equal(approvalRequest.request.toolId, 'system.intent.approve');

const resolved = await core.resolveIntentApprovalRequest(approvalRequest.request.id, true, 'integration-test-owner');
assert.equal(resolved.ok, true);
assert.equal(resolved.request.status, 'approved');

const approved = await core.approveIntent(draft, {
  ...scope,
  at: Date.now(),
  evidenceRef: approvalRequest.request.id,
});
assert.equal(approved.approval.status, 'approved');
assert.ok(approved.approval.signature, 'the Core must sign host-attested approval');

const execution = await core.executeIntent(approved, {
  toolId: 'organism.inspect', input: {}, reason: 'intent-core-integration',
});
assert.equal(execution.executed, true);
assert.equal(execution.contractId, approved.id);
assert.equal(execution.result.ok, true);
assert.equal(execution.result.tool, 'organism.inspect');
assert.ok(execution.result.executionId);

const persisted = await store.load();
assert.ok(persisted?.system?.intentContracts?.records?.some(row => row.id === approved.id),
  'approved contracts must be checkpointed with organism system state');

const restarted = new OrganismCore(store, config);
await restarted.init();
const restored = restarted.getIntentContract(approved.id);
assert.ok(restored, 'a host-key-attested approved contract must restore after Core restart');
assert.equal(restored.approval.status, 'approved');

const recoveryCalls = [];
const gateway = restarted.cognitiveRuntime.actionGateway;
const originalReconcile = gateway.reconcileToolExecution.bind(gateway);
gateway.reconcileToolExecution = async (id, input, reason, options) => {
  recoveryCalls.push({ id, input: structuredClone(input), reason, options: structuredClone(options) });
  return {
    ok: false, verified: false, executionId: 'exec-intent-recovery-0001',
    tool: id, capability: 'fixture', result: { error: 'no-pending-receipt-fixture' },
    audit: { at: Date.now(), action: 'tool', tool: id, accepted: false, mode: 'dry-run', reason: 'no-pending-receipt-fixture' },
    verification: { verified: false, basis: 'none', confidence01: 0, externalObservation: false, notes: 'fixture' },
    outcomeClass: 'idempotency-recovery-required',
  };
};
const reconciled = await restarted.reconcileIntentExecution(restored, {
  toolId: 'organism.inspect', input: { scope: 'status' }, reason: 'intent-restart-reconciliation',
  options: { idempotencyKey: 'intent:recovery:01', decisionId: 'decision:core-recovery' },
});
assert.equal(reconciled.executed, true);
assert.equal(recoveryCalls.length, 1, 'intent reconciliation must be forwarded exactly once');
assert.equal(recoveryCalls[0].id, 'organism.inspect');
assert.equal(recoveryCalls[0].options.decisionId, 'decision:core-recovery',
  'intent integration must preserve canonical cognitive decision identity');
gateway.reconcileToolExecution = originalReconcile;

const replayDraft = restarted.compileIntent({
  requestId: 'intent:core-integration:second',
  text: 'Inspect state',
  extraction: {
    expectedOutcome: 'State report',
    acceptanceCriteria: ['Return tick'],
    permissions: { allowedActions: ['organism.inspect'] },
    stopConditions: ['Stop on missing state'],
  },
});
await assert.rejects(
  () => restarted.approveIntent(replayDraft, {
    ...scope, at: Date.now(), evidenceRef: approvalRequest.request.id,
  }),
  /approval|intent|not approved|does not match/i,
  'a consumed host approval ticket cannot approve a different intent contract',
);

console.log('NK1_INTENT_CORE_INTEGRATION=PASS hostApproval=true coreDispatch=true finalizerRoute=true durableRestore=true readOnlyReconciliation=true');
