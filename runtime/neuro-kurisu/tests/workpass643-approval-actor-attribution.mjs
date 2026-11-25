import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { apiApprovalActor } from '../src/organism/system/ApiSecurityPolicy.ts';

assert.equal(apiApprovalActor('authenticated'), 'api-token-holder');
assert.equal(apiApprovalActor('loopback-research-mode'), 'loopback-local-client');
assert.throws(() => apiApprovalActor('public-health'), /api-approval-actor-unavailable/);
assert.throws(() => apiApprovalActor('caller-supplied-owner'), /api-approval-actor-unavailable/);

const gateway = new ActionGateway({ live: true });
let persisted;
gateway.setExecutionLedgerPersister(async (snapshot) => { persisted = structuredClone(snapshot); });
gateway.registerTool({
  id: 'fixture.approval.attribution',
  capability: 'device.protected.operation',
  permissionClass: 'device',
  destructive: true,
  execute: async () => ({ accepted: true }),
});

for (const actor of ['api-token-holder', 'loopback-local-client', 'owner']) {
  const request = await gateway.requestToolApproval(
    'fixture.approval.attribution',
    { operation: 'attribution-check' },
    'verify approval actor provenance',
    {},
    'execute',
  );
  assert.equal(request.created, true);
  const resolved = await gateway.resolveToolApproval(request.request.id, true, actor);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.request.actor, actor,
    'resolved approval receipts must expose the exact trusted actor, not a default owner');
  const row = persisted.permissions.requests.find((item) => item.id === request.request.id);
  assert.equal(row.actor, actor, 'the canonical persisted approval ledger must retain the actor');
}

const restored = new ActionGateway({ live: true });
restored.restoreExecutionLedger(persisted);
const restoredRows = restored.toolPermissionSnapshot().requests;
for (const actor of ['api-token-holder', 'loopback-local-client', 'owner']) {
  assert.ok(restoredRows.some((row) => row.actor === actor),
    'approval actor provenance must survive ActionGateway snapshot restore');
}

const oldSnapshot = structuredClone(persisted);
for (const row of oldSnapshot.permissions.requests) delete row.actor;
const legacyRestored = new ActionGateway({ live: true });
legacyRestored.restoreExecutionLedger(oldSnapshot);
assert.ok(legacyRestored.toolPermissionSnapshot().requests.every((row) => row.actor === undefined),
  'legacy tickets without an actor must not be retroactively attributed to the owner');

const coreSource = await readFile(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
assert.match(coreSource, /resolveActionToolApproval\(requestId:string,\s*approved:boolean,\s*actor:import\(['"]\.\.\/system\/ActionGateway\.ts['"]\)\.ActionToolApprovalActor='owner'\)/);
assert.match(coreSource, /resolveToolApproval\(requestId,approved,actor\)/);
assert.match(coreSource, /actor:'creator',decision:approved\?'approved':'declined'/,
  'P34 creator remains the domain approval role; transport principal is recorded separately');

const serverSource = await readFile(new URL('../src/server/server.mjs', import.meta.url), 'utf8');
assert.match(serverSource, /const actor=apiApprovalActor\(auth\.reason\)/);
assert.match(serverSource, /resolveActionToolApproval\(requestId,input\.approved===true,actor\)/);
assert.doesNotMatch(
  serverSource.slice(serverSource.indexOf("url.pathname === '/api/organism/tools/permissions/resolve'")),
  /input\.actor|input\.approver/,
  'the actor must come from the authenticated server context, never request JSON',
);

console.log('WORKPASS643_APPROVAL_ACTOR_ATTRIBUTION=PASS');
