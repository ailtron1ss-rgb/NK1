import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { AutonomousResourceToolLifeController } from '../src/organism/system/AutonomousResourceToolLifeController.ts';

const gateway = new ActionGateway();
let executions = 0;
let lastSnapshot;
gateway.setExecutionLedgerPersister(async snapshot => { lastSnapshot = structuredClone(snapshot); });
gateway.registerTool({
  id: 'device.set-state', capability: 'device.set-state', destructive: false,
  execute: async input => { executions++; return { ok: true, state: input.state }; },
});
gateway.registerTool({
  id: 'device.read', capability: 'device.read', destructive: false,
  execute: async () => { executions++; return { ok: true, state: 'idle' }; },
});
gateway.registerTool({
  id: 'filesystem.write-file', capability: 'filesystem.write', destructive: false,
  execute: async () => { executions++; return { ok: true }; },
});
gateway.registerTool({
  id: 'organism.inspect', capability: 'core.read', destructive: false,
  execute: async () => { executions++; return { ok: true }; },
});

const listed = gateway.listTools();
assert.equal(listed.find(row => row.id === 'device.set-state').requiresIdempotencyKey, true,
  'mutation-shaped device tools require durable idempotency even when an old registration omitted the flag');
assert.equal(listed.find(row => row.id === 'filesystem.write-file').requiresIdempotencyKey, true,
  'filesystem writes require durable idempotency');
assert.equal(listed.find(row => row.id === 'device.read').requiresIdempotencyKey, false,
  'explicit read-only actions are not forced into the side-effect ledger');

const unkeyedWrite = await gateway.executeTool('device.set-state', { state: 'on' }, 'test-unkeyed-write');
assert.equal(unkeyedWrite.outcomeClass, 'idempotency-key-required');
assert.equal(unkeyedWrite.result.error, 'idempotency-key-required');
assert.equal(executions, 0, 'the unkeyed mutation is refused before calling its executor');

const readWithoutApproval = await gateway.executeTool('device.read', {}, 'test-read-needs-device-approval');
assert.equal(readWithoutApproval.outcomeClass, 'approval-required',
  'read-only classification does not weaken the independent approval policy for protected devices');
assert.equal(executions, 0);

const options = { idempotencyKey: 'workpass57:relay:desired-state:v1', decisionId: 'decision:workpass57:relay', autonomous: false };
const approval = await gateway.requestToolApproval('device.set-state', { state: 'on' }, 'workpass57-test', options, 'execute');
assert.equal(approval.created, true);
assert.equal((await gateway.resolveToolApproval(approval.request.id, true, 'test-owner')).ok, true);
const executed = await gateway.executeTool('device.set-state', { state: 'on' }, 'test-keyed-approved-write', { ...options, approvalId: approval.request.id });
assert.equal(executed.ok, true);
assert.equal(executed.idempotencyStatus, 'recorded');
assert.equal(executions, 1);
assert.ok(lastSnapshot.records.some(row => row.status === 'completed' && row.executionId === executed.executionId),
  'a side effect commits a durable completed receipt before success is returned');
const replay = await gateway.executeTool('device.set-state', { state: 'on' }, 'test-replay', { ...options });
assert.equal(replay.idempotentReplay, true);
assert.equal(executions, 1, 'replay does not repeat the external effect and does not require a second approval');

const planner = new AutonomousResourceToolLifeController();
const planned = planner.plan({
  tick: 1, at: 1700000000000, energy01: 0.95, thermal01: 0.1, ramPressure01: 0.1,
  externalInteractionBudget01: 0.95, initiative01: 0.8, uncertainty01: 0.7, goalPressure01: 0.4,
  homeostaticPressure01: 0.1,
  tools: [
    { id: 'device.set-state', capability: 'device.set-state', destructive: false, projectAllowed: true, requiresApproval: true, requiresIdempotencyKey: true },
    { id: 'organism.inspect', capability: 'core.read', destructive: false, projectAllowed: true, requiresApproval: false, requiresIdempotencyKey: false },
  ],
});
assert.equal(planned.allowed, true);
assert.equal(planned.tool.id, 'organism.inspect', 'autonomous tool planning must exclude actions that need owner approval');
const blockedPlanner = new AutonomousResourceToolLifeController();
const blocked = blockedPlanner.plan({
  tick: 1, at: 1700000000000, energy01: 0.95, thermal01: 0.1, ramPressure01: 0.1,
  externalInteractionBudget01: 0.95, initiative01: 0.8, uncertainty01: 0.7, goalPressure01: 0.4,
  homeostaticPressure01: 0.1,
  tools: [{ id: 'device.set-state', capability: 'device.set-state', destructive: false, projectAllowed: true, requiresApproval: true, requiresIdempotencyKey: true }],
});
assert.equal(blocked.allowed, false);
assert.equal(blocked.reason, 'no-autonomous-permitted-tool');
assert.equal(blockedPlanner.summary().permissionBlocked, 1);

console.log('WORKPASS57_ACTION_IDEMPOTENCY_POLICY=PASS implicit-mutation-classification durable-receipt approval-replay autonomous-permission-boundary');
