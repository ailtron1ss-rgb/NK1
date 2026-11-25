import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';

function makeGateway() {
  const calls = { web: 0, code: 0, device: 0 };
  let persisted = null;
  let failPersist = false;
  const gateway = new ActionGateway({ live: true });
  gateway.setExecutionLedgerPersister(async snapshot => {
    if (failPersist) throw new Error('injected-permission-state-write-failure');
    persisted = structuredClone(snapshot);
  });
  gateway.registerTool({
    id: 'fixture.web.search', capability: 'external.web.search', permissionClass: 'web',
    destructive: false, projectAllowed: true,
    execute: async input => { calls.web += 1; return { ok: true, query: String(input.query), resultCount: 1 }; },
  });
  gateway.registerTool({
    id: 'fixture.code.inspect', capability: 'code.inspect', permissionClass: 'code',
    destructive: false, projectAllowed: true,
    execute: async () => { calls.code += 1; return { ok: true, inspected: true }; },
  });
  gateway.registerTool({
    id: 'fixture.device.capture', capability: 'device.camera.capture', permissionClass: 'device',
    destructive: false, projectAllowed: true,
    execute: async () => { calls.device += 1; return { ok: true, captured: true }; },
  });
  return {
    gateway, calls,
    get persisted() { return persisted ? structuredClone(persisted) : null; },
    set failPersist(value) { failPersist = value; },
  };
}

const rig = makeGateway();
assert.equal(typeof rig.gateway.setToolPermissionMode, 'function',
  'ActionGateway must expose a persisted category permission-mode boundary');
assert.equal(typeof rig.gateway.resolveToolApprovalChoice, 'function',
  'approval decisions must support always/session/once/deny choices');
assert.equal(typeof rig.gateway.clearToolPermissionSession, 'function',
  'the host must be able to end and revoke a permission session explicitly');

const defaults = rig.gateway.toolPermissionSnapshot();
assert.equal(defaults.categoryModes.web, 'auto');
assert.equal(defaults.categoryModes.code, 'auto');
assert.equal(defaults.effectiveModes.web, 'first_ask');
assert.equal(defaults.effectiveModes.device, 'first_ask');
assert.equal(defaults.effectiveModes.filesystem, 'always_ask');
assert.equal(defaults.effectiveModes.code, 'always_ask');
assert.equal(defaults.effectiveModes.system, 'always_ask');
assert.equal(defaults.effectiveModes['self-modification'], 'always_ask');

// First-ask session choice is host-session scoped, and its raw session ID never enters snapshots or public tickets.
{
  const request = await rig.gateway.requestToolApproval(
    'fixture.web.search', { query: 'alpha' }, 'web search', { permissionSessionId: 'host-session-alpha' }, 'execute',
  );
  assert.equal(request.created, true);
  assert.equal(Object.hasOwn(request.request, 'permissionSessionId'), false);
  const resolved = await rig.gateway.resolveToolApprovalChoice(request.request.id, 'session');
  assert.equal(resolved.ok, true);
  assert.equal(JSON.stringify(rig.persisted).includes('host-session-alpha'), false);

  const sameSession = await rig.gateway.executeTool(
    'fixture.web.search', { query: 'beta' }, 'same-session follow-up', { permissionSessionId: 'host-session-alpha' },
  );
  assert.equal(sameSession.ok, true);
  assert.equal(rig.calls.web, 1);

  const otherSession = await rig.gateway.executeTool(
    'fixture.web.search', { query: 'gamma' }, 'different-session', { permissionSessionId: 'host-session-beta' },
  );
  assert.equal(otherSession.ok, false);
  assert.equal(otherSession.outcomeClass, 'approval-required');
  assert.equal(rig.calls.web, 1);

  rig.gateway.clearToolPermissionSession('host-session-alpha');
  const endedSession = await rig.gateway.executeTool(
    'fixture.web.search', { query: 'delta' }, 'ended-session', { permissionSessionId: 'host-session-alpha' },
  );
  assert.equal(endedSession.ok, false);
  assert.equal(endedSession.outcomeClass, 'approval-required');
}

// Session grants are process-local: restart restores modes and one-shot tickets, never session authority.
{
  const snapshot = rig.gateway.snapshotExecutionLedger();
  const restarted = new ActionGateway({ live: true });
  restarted.setExecutionLedgerPersister(async () => {});
  restarted.restoreExecutionLedger(snapshot);
  const result = await restarted.executeTool(
    'fixture.web.search', { query: 'after-restart' }, 'session must not survive restart', { permissionSessionId: 'host-session-alpha' },
  );
  assert.equal(result.ok, false);
  assert.equal(result.outcomeClass, 'approval-required');
}

// Always-ask never accepts category-wide or session-wide choices; once remains exact and one-shot.
{
  const local = makeGateway();
  assert.equal((await local.gateway.setToolPermissionMode('web', 'always_ask')).ok, true);
  const request = await local.gateway.requestToolApproval(
    'fixture.web.search', { query: 'once' }, 'strict web approval', { permissionSessionId: 'host-session-x' }, 'execute',
  );
  assert.equal(request.created, true);
  const sessionChoice = await local.gateway.resolveToolApprovalChoice(request.request.id, 'session');
  assert.equal(sessionChoice.ok, false);
  assert.equal(sessionChoice.error, 'permission-choice-not-available');
  const alwaysChoice = await local.gateway.resolveToolApprovalChoice(request.request.id, 'always');
  assert.equal(alwaysChoice.ok, false);
  assert.equal(alwaysChoice.error, 'permission-choice-not-available');
  const onceChoice = await local.gateway.resolveToolApprovalChoice(request.request.id, 'once');
  assert.equal(onceChoice.ok, true);
  const execution = await local.gateway.executeTool(
    'fixture.web.search', { query: 'once' }, 'exact once', { approvalId: request.request.id, permissionSessionId: 'host-session-x' },
  );
  assert.equal(execution.ok, true);
  const replayApproval = await local.gateway.executeTool(
    'fixture.web.search', { query: 'once' }, 'ticket cannot be reused', { approvalId: request.request.id, permissionSessionId: 'host-session-x' },
  );
  assert.equal(replayApproval.ok, false);
  assert.equal(replayApproval.outcomeClass, 'approval-invalid');
}

// Explicit "always" persists allow; policy change invalidates other class tickets and survives restart.
{
  const local = makeGateway();
  const request = await local.gateway.requestToolApproval(
    'fixture.web.search', { query: 'persisted' }, 'remember web category', {}, 'execute',
  );
  assert.equal(request.created, true);
  const choice = await local.gateway.resolveToolApprovalChoice(request.request.id, 'always');
  assert.equal(choice.ok, true);
  assert.equal(local.gateway.toolPermissionSnapshot().effectiveModes.web, 'allow');

  const snapshot = local.gateway.snapshotExecutionLedger();
  const restarted = new ActionGateway({ live: true });
  restarted.setExecutionLedgerPersister(async () => {});
  restarted.restoreExecutionLedger(snapshot);
  assert.equal(restarted.toolPermissionSnapshot().effectiveModes.web, 'allow');
  const allowed = await restarted.executeTool('fixture.web.search', { query: 'automatic' }, 'persistent category allow');
  assert.equal(allowed.ok, true);
}

// Deny mode dominates even an earlier approved ticket; unknown modes are rejected.
{
  const local = makeGateway();
  const request = await local.gateway.requestToolApproval('fixture.web.search', { query: 'deny' }, 'ticket to revoke', {}, 'execute');
  assert.equal(request.created, true);
  assert.equal((await local.gateway.resolveToolApprovalChoice(request.request.id, 'once')).ok, true);
  assert.equal((await local.gateway.setToolPermissionMode('web', 'deny')).ok, true);
  const denied = await local.gateway.executeTool(
    'fixture.web.search', { query: 'deny' }, 'policy deny', { approvalId: request.request.id },
  );
  assert.equal(denied.ok, false);
  assert.equal(denied.outcomeClass, 'policy-refused');
  assert.equal(local.calls.web, 0);
  await assert.rejects(() => local.gateway.setToolPermissionMode('web', 'unrestricted'), /invalid.*permission.*mode/i);
}

// Failed persistence must not leave a permanent allow or a live session grant.
{
  const local = makeGateway();
  const priorMode = local.gateway.toolPermissionSnapshot().effectiveModes.web;
  local.failPersist = true;
  const failedMode = await local.gateway.setToolPermissionMode('web', 'allow');
  assert.equal(failedMode.ok, false);
  assert.equal(local.gateway.toolPermissionSnapshot().effectiveModes.web, priorMode);

  local.failPersist = false;
  const request = await local.gateway.requestToolApproval(
    'fixture.web.search', { query: 'no-grant-on-write-failure' }, 'session rollback', { permissionSessionId: 'volatile-session' }, 'execute',
  );
  assert.equal(request.created, true);
  local.failPersist = true;
  const failedChoice = await local.gateway.resolveToolApprovalChoice(request.request.id, 'session');
  assert.equal(failedChoice.ok, false);
  local.failPersist = false;
  const blocked = await local.gateway.executeTool(
    'fixture.web.search', { query: 'follow-up' }, 'grant must roll back', { permissionSessionId: 'volatile-session' },
  );
  assert.equal(blocked.ok, false);
  assert.equal(blocked.outcomeClass, 'approval-required');
}

// Existing boolean approval API remains a one-shot compatibility wrapper.
{
  const local = makeGateway();
  const request = await local.gateway.requestToolApproval('fixture.web.search', { query: 'legacy' }, 'legacy API', {}, 'execute');
  assert.equal((await local.gateway.resolveToolApproval(request.request.id, true)).ok, true);
  const execution = await local.gateway.executeTool(
    'fixture.web.search', { query: 'legacy' }, 'legacy one-shot', { approvalId: request.request.id },
  );
  assert.equal(execution.ok, true);
}

console.log('NEKO_ACTION_PERMISSION_MODES=PASS cases=8');
