import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { ToolExecutionUncertainError } from '../src/organism/system/ActionGateway.ts';

const directory = await mkdtemp(join(tmpdir(), 'nk-workpass72-action-self-authorship-'));
const statePath = join(directory, 'organism-state.json');
const config = {
  spineOnly: true,
  cycleResultMode: 'operational',
  enableLanguage: false,
  checkpointMinIntervalMs: 0,
  checkpointMaxDirtyCycles: 1,
};
const input = { target: 'relay-01', desiredState: 'on' };
const idempotencyKey = 'workpass72:relay-01:desired-state-v1';
const toolId = 'test.workpass72-relay';
let externalState = 'off';
let executeCalls = 0;
let reconcileCalls = 0;

const makeTool = ({ loseInitialAck = false } = {}) => ({
  id: toolId,
  capability: 'test.write',
  destructive: false,
  projectAllowed: true,
  requiresIdempotencyKey: true,
  execute: async (_input, context) => {
    executeCalls += 1;
    assert.ok(context.executionId.startsWith('exec-'));
    assert.ok(context.decisionId);
    externalState = 'on';
    if (loseInitialAck) {
      throw new ToolExecutionUncertainError('provider-accepted-relay-command-but-ack-was-lost');
    }
    return { ok: true, state: externalState };
  },
  reconcile: async (_input, context) => {
    reconcileCalls += 1;
    assert.ok(context.executionId.startsWith('exec-'));
    assert.ok(context.decisionId);
    if (externalState !== 'on') {
      return { status: 'unknown', reason: 'provider-receipt-not-visible-yet', retryAfterMs: 50 };
    }
    return {
      status: 'found',
      authoritative: true,
      receiptId: `provider-receipt:${context.executionId}`,
      result: { ok: true, state: externalState },
      checkedAt: Date.now(),
    };
  },
  verify: ({ result }) => ({
    verified: result.state === 'on',
    basis: 'external-postcondition',
    externalObservation: true,
    confidence01: .99,
    observationId: 'sensor:relay-01:workpass72',
    expectedPostcondition: 'relay=on',
    observedPostcondition: `relay=${String(result.state)}`,
  }),
});

async function chooseDecision(core) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const cycle = await core.observe({ novelty: 1, uncertainty: 1, surprise: .35 });
    const decision = cycle?.decision;
    const action = decision?.selected?.action;
    if (!decision?.id || !action || action === 'wait' || action === 'defer') continue;
    const pending = core.selfAuthorshipSnapshot().pendingDecisions.find(row => row.decisionId === decision.id);
    if (pending) return decision;
  }
  throw new Error('workpass72-fixture-could-not-create-a-persisted-autonomous-decision');
}

try {
  const first = new OrganismCore(new FileStateStore(statePath, {
    backupEverySaves: 100,
    directoryFsyncEverySaves: 100,
  }), config);
  await first.init();
  assert.equal(first.actionExecutionLedgerMetrics().archive.loaded, true,
    'the canonical file-backed action archive must be loaded before executing tools');

  const decision = await chooseDecision(first);
  const decisionId = decision.id;
  const beforeExecution = first.selfAuthorshipSnapshot();
  assert.equal(beforeExecution.autonomousActionCount, 0);
  assert.ok(beforeExecution.pendingDecisions.some(row => row.decisionId === decisionId),
    'the selected autonomous decision must be pending before the tool side effect');

  first.registerActionTool(makeTool({ loseInitialAck: true }));
  const lostAck = await first.executeTool(toolId, input, 'workpass72-lose-provider-ack', {
    idempotencyKey,
    decisionId,
    autonomous: true,
  });
  assert.equal(lostAck.outcomeClass, 'idempotency-recovery-required',
    'an uncertain provider acknowledgement must leave the operation pending');
  assert.equal(executeCalls, 1, 'the external side effect happened exactly once before the lost acknowledgement');
  assert.equal(first.selfAuthorshipSnapshot().autonomousActionCount, 0,
    'an ambiguous action must not earn authorship before read-only reconciliation');

  await first.flush();
  const firstSnapshot = first.snapshot();
  const pendingReceipt = firstSnapshot.system.actionExecutionLedger.records.find(row => row.executionId === lostAck.executionId);
  assert.equal(pendingReceipt?.status, 'pending');
  assert.equal(pendingReceipt?.decisionId, decisionId,
    'the durable ActionGateway receipt must retain the exact originating decision ID');
  assert.equal(firstSnapshot.facets.learning.selfAuthorship.pendingDecisions.some(row => row.decisionId === decisionId), true,
    'the unresolved authorship intent must persist beside the action receipt');

  // A new Core instance models process restart. The external provider state is
  // deliberately kept outside NK1, as it would be on a real device/service.
  const resumed = new OrganismCore(new FileStateStore(statePath, {
    backupEverySaves: 100,
    directoryFsyncEverySaves: 100,
  }), config);
  await resumed.init();
  assert.equal(resumed.actionExecutionLedgerMetrics().archive.loaded, true);
  assert.equal(resumed.selfAuthorshipSnapshot().pendingDecisions.some(row => row.decisionId === decisionId), true,
    'pending authorship must survive the same durable restart boundary as the receipt');
  assert.equal(resumed.actionRecoveryQueueSnapshot().unresolvedCount, 1,
    'the recovered operation must remain visible in the unresolved receipt queue');

  resumed.registerActionTool(makeTool());
  const reconciled = await resumed.reconcileToolExecution(toolId, input, 'workpass72-read-only-provider-reconciliation', {
    idempotencyKey,
    decisionId,
    autonomous: true,
  });
  assert.equal(reconciled.ok, true);
  assert.equal(reconciled.verified, true);
  assert.equal(reconciled.outcomeClass, 'executed-verified');
  assert.equal(reconciled.executionId, lostAck.executionId,
    'provider reconciliation must preserve the original execution identity');
  assert.equal(executeCalls, 1, 'restart reconciliation must never re-run the external side effect');
  assert.equal(reconcileCalls, 1, 'the provider must be queried through its read-only receipt lookup');

  const settled = resumed.selfAuthorshipSnapshot();
  assert.equal(settled.autonomousActionCount, 1,
    'a verified ActionGateway receipt bound to a selected decision must settle SelfAuthorship without a separate manual feedback call');
  assert.equal(settled.pendingDecisions.some(row => row.decisionId === decisionId), false,
    'the verified receipt must close the matching pending authorship entry');
  const settledSnapshot = resumed.snapshot();
  const completedReceipt = settledSnapshot.system.actionExecutionLedger.records.find(row => row.executionId === lostAck.executionId);
  assert.equal(completedReceipt?.status, 'completed');
  assert.equal(completedReceipt?.decisionId, decisionId);
  assert.equal(completedReceipt?.response?.verified, true);
  assert.ok(settledSnapshot.system.cognitiveEventFabric.recent.some(row =>
    row.payload?.executionId === lostAck.executionId && row.payload?.decisionId === decisionId),
  'the causal receipt trace must preserve the same decision/execution binding');

  // An exact replay returns the completed receipt and must not award the same
  // internally authored action twice.
  const replay = await resumed.executeTool(toolId, input, 'workpass72-completed-replay', {
    idempotencyKey,
    decisionId,
    autonomous: true,
  });
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.executionId, lostAck.executionId);
  assert.equal(executeCalls, 1);
  assert.equal(reconcileCalls, 1);
  assert.equal(resumed.selfAuthorshipSnapshot().autonomousActionCount, 1);

  console.log('ACTION_RECEIPT_SELF_AUTHORSHIP_RECOVERY_WORKPASS72=PASS');
} finally {
  await rm(directory, { recursive: true, force: true });
}
