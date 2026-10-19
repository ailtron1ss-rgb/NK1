import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

process.env.ACTIONS_LIVE = 'false';
const TOOL = 'test.workpass61-reconcile';
const INPUT = { device: 'relay-main', desired: 'on' };
const KEY = 'wp61:relay-main:op-1';
const baseOptions = { idempotencyKey: KEY, decisionId: 'decision:wp61:relay-main', autonomous: false };
const store = new MemoryStateStore();
const core = new OrganismCore(store, { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
await core.init();
let executions = 0;
let lookups = 0;
let verifierCalls = 0;
core.registerActionTool({
  id: TOOL, capability: 'device.set-state', destructive: false, projectAllowed: true, requiresIdempotencyKey: true,
  execute: async () => { executions++; return { ok: false, error: 'provider connection dropped after dispatch' }; },
  reconcile: async (_input, context) => {
    lookups++;
    assert.ok(context.executionId.startsWith('exec-'));
    return { status: 'found', authoritative: true, receiptId: 'provider-receipt-wp61-001', result: { ok: true, appliedState: 'on' }, checkedAt: Date.now() };
  },
  verify: async ({ result }) => {
    verifierCalls++;
    if (result?.appliedState === 'on') return { verified: true, basis: 'external-postcondition', externalObservation: true, observationId: 'provider-observation-wp61-001', expectedPostcondition: 'relay=on', observedPostcondition: 'relay=on', confidence01: .94, notes: 'provider-reconciled postcondition' };
    return { verified: false, basis: 'none', externalObservation: false, confidence01: 0, notes: 'initial executor did not return a confirmed state' };
  },
});

async function approved(operation, options = baseOptions) {
  const request = await core.cognitiveRuntime.actionGateway.requestToolApproval(TOOL, INPUT, `workpass61-${operation}`, options, operation);
  assert.equal(request.created, true);
  const resolved = await core.cognitiveRuntime.actionGateway.resolveToolApproval(request.request.id, true, 'test-owner');
  assert.equal(resolved.ok, true);
  return { ...options, approvalId: request.request.id };
}

const first = await core.executeTool(TOOL, INPUT, 'initial-uncertain-result', await approved('execute'));
assert.equal(first.outcomeClass, 'idempotency-recovery-required', 'provider connection dropped after dispatch; negative response without no-effect proof stays pending');
assert.equal(executions, 1);
const initialOutcomes = core.outcomeCognitionSnapshot();
assert.equal(initialOutcomes.projectionIndex.some(row => row.executionId === first.executionId), false, 'ambiguous pending action is not projected as terminal failure or trained before reconciliation');
const initialCef = core.cognitiveEventFabricSnapshot();
assert.equal(((initialCef?.receiptProjectionIndex) ?? []).some(row => row.executionId === first.executionId), false, 'pending uncertainty does not create a false terminal receipt trio');

const reconciled = await core.reconcileToolExecution(TOOL, INPUT, 'provider-found-after-uncertain-execution', await approved('reconcile'));
assert.equal(reconciled.executionId, first.executionId);
assert.equal(reconciled.reconciled, true);
assert.equal(reconciled.providerReceiptId, 'provider-receipt-wp61-001');
assert.equal(reconciled.verified, true);
assert.equal(reconciled.outcomeClass, 'executed-verified');
assert.equal(executions, 1, 'provider reconciliation never repeats the side effect');
assert.equal(lookups, 1);
assert.equal(verifierCalls, 1, 'verification occurs only once the provider receipt is authoritative');

const revised = core.outcomeCognitionSnapshot();
assert.equal(initialOutcomes.projectionIndex.some(row => row.executionId === first.executionId), false, 'there was no terminal base projection before provider receipt');
assert.equal(revised.projectionIndex.filter(row => row.executionId === first.executionId).length, 1, 'the first authoritative result creates one canonical outcome projection');
assert.equal(revised.evidenceRevisions.filter(row => row.executionId === first.executionId).length, 0, 'no evidence revision is fabricated when the ambiguous pending attempt had no terminal outcome');

const finalCef = core.cognitiveEventFabricSnapshot();
const updatedTrace = finalCef.receiptProjectionIndex.find(row => row.executionId === first.executionId);
assert.ok(updatedTrace, 'first authoritative result creates exactly one CEF receipt trio');
assert.equal(finalCef.recent.filter(row => row.stage === 'tool-action' && row.payload.executionId === first.executionId).length, 1);
assert.equal(finalCef.recent.filter(row => row.stage === 'tool-outcome' && row.payload.executionId === first.executionId).length, 1);
assert.equal(finalCef.recent.filter(row => row.stage === 'tool-evidence' && row.payload.executionId === first.executionId).length, 1);
assert.equal(finalCef.recent.filter(row => row.stage === 'tool-reconciliation' && row.payload.executionId === first.executionId && row.payload.revisionId).length, 0, 'there is no superseded terminal outcome to revise in this pending-first path');

const persisted = await store.load();
assert.equal(persisted.system.outcomeVerification.evidenceRevisions.filter(row => row.executionId === first.executionId).length, 0, 'no synthetic revision is persisted without a prior terminal outcome');
assert.ok(persisted.system.cognitiveEventFabric.receiptProjectionIndex.find(row => row.executionId === first.executionId), 'canonical receipt trio is persisted with organism state');

const replay = await core.executeTool(TOOL, INPUT, 'replay-after-reconciliation', baseOptions);
assert.equal(replay.idempotentReplay, true);
assert.equal(replay.providerReceiptId, 'provider-receipt-wp61-001');
assert.equal(executions, 1);
assert.equal(lookups, 1);
console.log(JSON.stringify({ ok: true, pass: 'workpass61-core-authoritative-reconciliation', scenarios: 1, assertions: 'ambiguous negative response remains pending; authoritative receipt creates one canonical outcome; no premature learning; one side effect; replay' }));
