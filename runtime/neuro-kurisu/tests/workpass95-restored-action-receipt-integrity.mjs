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
  ['verification-contradiction', row => ({ ...row, response: { ...row.response, verified: true } })],
  ['audit-outcome-mismatch', row => ({ ...row, response: { ...row.response, audit: { ...row.response.audit, outcomeClass: 'executed-verified', accepted: true, verified: true } } })],
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

const restoredValid = makeGateway();
restoredValid.restoreExecutionLedger(baseline);
const validReplay = await restoredValid.executeTool('organism.inspect', {}, 'valid-replay', options);
assert.equal(validReplay.ok, true);
assert.equal(validReplay.idempotentReplay, true);
assert.equal(executions, 1, 'a valid receipt still replays without repeating the executor');

console.log('NK1_RESTORED_ACTION_RECEIPT_INTEGRITY=PASS corruptCases=3 validReplay=true duplicateExecution=false');
