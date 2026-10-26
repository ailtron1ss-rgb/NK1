import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';

const key = 'workpass95:receipt-integrity:v1';
const options = { idempotencyKey: key, decisionId: 'decision:workpass95:receipt-integrity' };
let executions = 0;
const makeGateway = () => {
  const gateway = new ActionGateway();
  gateway.setExecutionLedgerPersister(async () => {});
  gateway.registerTool({
    id: 'organism.inspect', capability: 'core.read', destructive: false,
    execute: async () => { executions += 1; return { ok: true, state: 'ready' }; },
  });
  return gateway;
};

const original = makeGateway();
const first = await original.executeTool('organism.inspect', {}, 'receipt-integrity-fixture', options);
assert.equal(first.ok, true);
assert.equal(executions, 1);
const baseline = original.snapshotExecutionLedger();
assert.equal(baseline.records.length, 1);
assert.equal(baseline.records[0].status, 'completed');

for (const [name, corrupt] of [
  ['execution-identity-mismatch', row => ({ ...row, response: { ...row.response, executionId: 'exec-forged-identity' } })],
  ['tool-identity-mismatch', row => ({ ...row, response: { ...row.response, tool: 'organism.forged-tool' } })],
  ['audit-execution-identity-mismatch', row => ({ ...row, response: { ...row.response, audit: { ...row.response.audit, executionId: 'exec-forged-audit' } } })],
  ['verification-contradiction', row => ({ ...row, response: { ...row.response, verified: true } })],
  ['audit-outcome-mismatch', row => ({ ...row, response: { ...row.response, audit: { ...row.response.audit, outcomeClass: 'executed-verified', accepted: true, verified: true } } })],
  ['oversized-receipt', row => ({ ...row, response: { ...row.response, result: { payload: 'x'.repeat(50 * 1024) } } })],
]) {
  const snapshot = structuredClone(baseline);
  snapshot.records[0] = corrupt(snapshot.records[0]);
  const restored = makeGateway();
  restored.restoreExecutionLedger(snapshot);
  const replay = await restored.executeTool('organism.inspect', {}, `tampered-replay:${name}`, options);
  assert.notEqual(replay.ok, true, `${name}: malformed persisted response must never replay as success`);
  assert.equal(replay.outcomeClass, 'idempotency-recovery-required', `${name}: invalid receipt is retained as a recovery tombstone`);
  assert.equal(replay.result.error, 'idempotency-recovery-required');
  assert.equal(executions, 1, `${name}: rejecting a malformed receipt must not re-run the original side effect`);
}

// Root/row accessors must not execute, and failed restore must preserve the live ledger.
let rootGetterCalls = 0;
const accessorRoot = {};
Object.defineProperty(accessorRoot, 'records', {
  enumerable: true,
  get() { rootGetterCalls += 1; return baseline.records; },
});
assert.throws(() => original.restoreExecutionLedger(accessorRoot), /accessor-field:records/);
assert.equal(rootGetterCalls, 0, 'root getters must not execute during restore');

let rowGetterCalls = 0;
const accessorRow = { ...baseline.records[0] };
Object.defineProperty(accessorRow, 'keyHash', {
  enumerable: true,
  get() { rowGetterCalls += 1; return baseline.records[0].keyHash; },
});
assert.throws(() => original.restoreExecutionLedger({
  version: 1, records: [accessorRow], permissions: baseline.permissions,
}), /accessor-field:keyHash/);
assert.equal(rowGetterCalls, 0, 'ledger row getters must not execute during restore');

assert.throws(() => original.restoreExecutionLedger({
  version: 1, records: new Array(1), permissions: baseline.permissions,
}), /sparse-or-accessor-slot/);

// A nested response accessor becomes a recovery tombstone without executing.
let responseGetterCalls = 0;
const accessorResponse = { ...baseline.records[0].response };
Object.defineProperty(accessorResponse, 'executionId', {
  enumerable: true,
  get() { responseGetterCalls += 1; return baseline.records[0].response.executionId; },
});
const nestedAccessorSnapshot = {
  version: 1,
  records: [{ ...baseline.records[0], response: accessorResponse }],
  permissions: baseline.permissions,
};
const nestedAccessorGateway = makeGateway();
nestedAccessorGateway.restoreExecutionLedger(nestedAccessorSnapshot);
assert.equal(responseGetterCalls, 0, 'nested receipt getters must not execute');
const nestedAccessorReplay = await nestedAccessorGateway.executeTool('organism.inspect', {}, 'nested-accessor-replay', options);
assert.equal(nestedAccessorReplay.ok, false);
assert.equal(nestedAccessorReplay.outcomeClass, 'idempotency-recovery-required');
assert.equal(executions, 1, 'nested accessor receipt must not cause re-execution');

// The earlier live ledger survives failed root/row restores and remains replayable.
const priorReplay = await original.executeTool('organism.inspect', {}, 'restore-atomicity-check', options);
assert.equal(priorReplay.ok, true);
assert.equal(priorReplay.idempotentReplay, true);
assert.equal(executions, 1);

const restoredValid = makeGateway();
restoredValid.restoreExecutionLedger(baseline);
const validReplay = await restoredValid.executeTool('organism.inspect', {}, 'valid-replay', options);
assert.equal(validReplay.ok, true);
assert.equal(validReplay.idempotentReplay, true);
assert.equal(executions, 1, 'a valid receipt still replays without repeating the executor');

console.log('NK1_RESTORED_ACTION_RECEIPT_INTEGRITY=PASS corruptCases=6 validReplay=true duplicateExecution=false');
