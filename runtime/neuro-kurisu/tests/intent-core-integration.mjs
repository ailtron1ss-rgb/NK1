import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { ToolExecutionUncertainError } from '../src/organism/system/ActionGateway.ts';

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

let fixtureExecutions = 0;
let fixtureReconciliations = 0;
const registerReceiptFixture = target => target.registerActionTool({
  id: 'organism.intent.fixture',
  capability: 'core.read',
  destructive: false,
  projectAllowed: true,
  requiresIdempotencyKey: true,
  execute: async () => {
    fixtureExecutions += 1;
    throw new ToolExecutionUncertainError('fixture-provider-ack-lost-after-dispatch');
  },
  reconcile: async (_input, context) => {
    fixtureReconciliations += 1;
    assert.ok(context.idempotencyKey);
    return {
      status: 'found',
      authoritative: true,
      receiptId: 'fixture-provider-receipt-01',
      result: { ok: true, verified: true, providerState: 'committed', providerReceiptId: 'fixture-provider-receipt-01' },
      checkedAt: Date.now(),
    };
  },
});
registerReceiptFixture(core);

const pendingDraft = core.compileIntent({
  requestId: 'intent:core-integration:pending-receipt',
  text: 'Confirm the fixture operation with its authoritative provider receipt.',
  extraction: {
    goal: 'Confirm the fixture operation',
    expectedOutcome: 'An authoritative provider receipt',
    acceptanceCriteria: ['Return the provider receipt identity'],
    permissions: { allowedActions: ['organism.intent.fixture'] },
    stopConditions: ['Stop if provider receipt lookup is unknown'],
  },
});
const pendingScope = { allowedActions: ['organism.intent.fixture'], acknowledgedAssumptions: [], riskAcknowledged: false };
const pendingTicket = await core.requestIntentApproval(pendingDraft, pendingScope, 'Approve fixture operation');
assert.equal(pendingTicket.created, true);
assert.equal((await core.resolveIntentApprovalRequest(pendingTicket.request.id, true, 'integration-test-owner')).ok, true);
const pendingApproved = await core.approveIntent(pendingDraft, {
  ...pendingScope,
  evidenceRef: pendingTicket.request.id,
});
const pendingDispatch = await core.executeIntent(pendingApproved, {
  toolId: 'organism.intent.fixture',
  input: { operation: 'commit-probe' },
  reason: 'intent-core-integration-pending',
  options: { idempotencyKey: 'intent:recovery:01', decisionId: 'decision:core-recovery' },
});
assert.equal(pendingDispatch.executed, true, 'the intent gate should dispatch the keyed operation exactly once');
assert.equal(pendingDispatch.result.outcomeClass, 'idempotency-recovery-required',
  'a lost provider acknowledgement must remain an unresolved keyed receipt');
assert.equal(fixtureExecutions, 1);

const persisted = await store.load();
assert.ok(persisted?.system?.intentContracts?.records?.some(row => row.id === approved.id),
  'approved contracts must be checkpointed with organism system state');

const restarted = new OrganismCore(store, config);
await restarted.init();
const restored = restarted.getIntentContract(approved.id);
assert.ok(restored, 'a host-key-attested approved contract must restore after Core restart');
assert.equal(restored.approval.status, 'approved');

const recoveryCalls = [];
const restarted = new OrganismCore(store, config);
registerReceiptFixture(restarted);
await restarted.init();
const restored = restarted.getIntentContract(approved.id);
assert.ok(restored, 'a host-key-attested approved contract must restore after Core restart');
assert.equal(restored.approval.status, 'approved');
const restoredPending = restarted.getIntentContract(pendingApproved.id);
assert.ok(restoredPending, 'a pending receipt intent must restore after Core restart');
assert.equal(restoredPending.approval.status, 'approved');

const gateway = restarted.cognitiveRuntime.actionGateway;
let executeDuringReconciliation = 0;
const originalExecute = gateway.executeTool.bind(gateway);
gateway.executeTool = async (...args) => {
  executeDuringReconciliation += 1;
  return originalExecute(...args);
};
const originalReconcile = gateway.reconcileToolExecution.bind(gateway);
gateway.reconcileToolExecution = async (...args) => {
  recoveryCalls.push({ id: args[0], input: structuredClone(args[1]), reason: args[2], options: structuredClone(args[3]) });
  return originalReconcile(...args);
};
const reconciled = await restarted.reconcileIntentExecution(restoredPending, {
  toolId: 'organism.intent.fixture',
  input: { operation: 'commit-probe' },
  reason: 'intent-restart-reconciliation',
  options: { idempotencyKey: 'intent:recovery:01', decisionId: 'decision:core-recovery' },
});
assert.equal(reconciled.attempted, true, 'read-only receipt lookup attempt must be correlated to its prepared intent');
assert.equal(recoveryCalls.length, 1, 'intent reconciliation must be forwarded exactly once');
assert.equal(recoveryCalls[0].id, 'organism.intent.fixture');
assert.equal(recoveryCalls[0].options.decisionId, 'decision:core-recovery',
  'intent integration must preserve canonical cognitive decision identity');
assert.equal(executeDuringReconciliation, 0, 'read-only reconciliation must never enter ActionGateway.executeTool');
assert.equal(fixtureExecutions, 1, 'the original side-effect executor must never be re-entered after restart');
assert.equal(fixtureReconciliations, 1, 'only the provider receipt lookup must run after restart');
assert.equal(reconciled.result.idempotencyStatus, 'reconciled');
gateway.executeTool = originalExecute;
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
