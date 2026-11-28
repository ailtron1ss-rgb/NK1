import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';

const gateway = new ActionGateway({ live: true });
let saved = null;
let failPersist = false;
gateway.setExecutionLedgerPersister(async (snapshot) => {
  if (failPersist) throw new Error('injected-storage-failure');
  saved = structuredClone(snapshot);
});
let calls = 0;
gateway.registerTool({
  id: 'fixture.web.search', capability: 'external.web.search', destructive: false, projectAllowed: true,
  execute: async (input) => { calls += 1; return { ok: true, query: String(input.query), resultCount: 1 }; },
});

// Protected tool cannot execute before a durable approval exists.
const denied = await gateway.executeTool('fixture.web.search', { query: 'alpha' }, 'test-before-approval');
assert.equal(denied.ok, false);
assert.equal(denied.outcomeClass, 'approval-required');
assert.equal(calls, 0);

// Approval ticket is bound to exact input and operation; public view never exposes the full hash.
const request = await gateway.requestToolApproval('fixture.web.search', { query: 'alpha' }, 'explicit web probe', {}, 'execute');
assert.equal(request.created, true);
assert.ok(request.request?.id);
assert.equal(Object.hasOwn(request.request, 'requestHash'), false);
assert.equal(saved.permissions.requests[0].requestHash.length, 64, 'full hash is persisted privately for exact binding');
const previewTicket=await gateway.requestToolApproval('fixture.web.search',{query:'Contact user@example.com or +1 (555) 123-4567 using https://alice:secret@host.invalid/?access_token=private-token'},'preview redaction',{},'execute');
const preview=JSON.stringify(previewTicket.request.inputPreview);
assert.equal(preview.includes('user@example.com'),false,'email is redacted from public approval preview');
assert.equal(preview.includes('555'),false,'phone-like strings are redacted from public approval preview');
assert.equal(preview.includes('alice:secret'),false,'URL credentials are redacted from public approval preview');
assert.equal(preview.includes('private-token'),false,'credential query parameters are redacted from public approval preview');
assert.equal((await gateway.resolveToolApproval(request.request.id, true)).ok, true);
const modified = await gateway.executeTool('fixture.web.search', { query: 'beta' }, 'mutated after approval', { approvalId: request.request.id });
assert.equal(modified.ok, false);
assert.equal(modified.outcomeClass, 'approval-invalid');
assert.equal(calls, 0);

// Persisted approval survives reconstruction and is consumed atomically once.
const restore = new ActionGateway({ live: true });
restore.setExecutionLedgerPersister(async (snapshot) => { saved = structuredClone(snapshot); });
restore.registerTool({
  id: 'fixture.web.search', capability: 'external.web.search', destructive: false, projectAllowed: true,
  execute: async (input) => { calls += 1; return { ok: true, query: String(input.query), resultCount: 1 }; },
});
restore.restoreExecutionLedger(saved);
const ticketId = request.request.id;
const results = await Promise.all([
  restore.consumeDirectActionApproval('http.research.probe.neurocore', { kind: 'neurocore' }, 'no-such-ticket', {}, 'direct'),
  restore.consumeDirectActionApproval('fixture.web.search', { query: 'alpha' }, ticketId, {}, 'execute'),
  restore.consumeDirectActionApproval('fixture.web.search', { query: 'alpha' }, ticketId, {}, 'execute'),
]);
assert.equal(results[0].ok, false);
assert.equal(results.filter(row => row.ok).length, 1, 'parallel attempts must consume a ticket at most once');
assert.equal(results.filter(row => row.reason === 'approval-not-approved:consumed').length, 1);

// A failed durable write must roll the consumption back in memory so retry remains possible.
const rollback = new ActionGateway({ live: true });
let writes = 0; let persisted = null;
rollback.setExecutionLedgerPersister(async (snapshot) => { writes += 1; if (writes >= 3 && failPersistRollback) throw new Error('no-disk'); persisted = structuredClone(snapshot); });
let failPersistRollback = false;
rollback.registerTool({ id:'fixture.code.modify', capability:'code.modify', destructive:true, projectAllowed:false, execute:async()=>({ok:true}) });
const codeTicket = await rollback.requestToolApproval('fixture.code.modify',{path:'safe/example.ts',content:'tiny change'},'code change',{},'execute');
await rollback.resolveToolApproval(codeTicket.request.id,true);
failPersistRollback = true;
const failedConsume = await rollback.consumeDirectActionApproval('fixture.code.modify',{path:'safe/example.ts',content:'tiny change'},codeTicket.request.id,{},'execute');
assert.equal(failedConsume.ok,false);
assert.equal(failedConsume.reason,'approval-storage-failed');
failPersistRollback = false;
const retryConsume = await rollback.consumeDirectActionApproval('fixture.code.modify',{path:'safe/example.ts',content:'tiny change'},codeTicket.request.id,{},'execute');
assert.equal(retryConsume.ok,true,'failed durable consumption is rolled back instead of losing the ticket');

// Sensitive action families and external outbound routes are classified as protected.
const families = new ActionGateway({ live: true });
families.setExecutionLedgerPersister(async () => {});
assert.equal((await families.requestToolApproval('http.voice.listen',{},'mic',{},'direct')).request.permissionClass,'device');
assert.equal((await families.requestToolApproval('http.integration.outbound',{channel:'telegram',target:'user',payload:{text:'hi'}},'send',{},'direct')).request.permissionClass,'web');
assert.equal((await families.requestToolApproval('http.research.probe.nomega-registry',{kind:'nomega-registry'},'probe',{},'direct')).request.permissionClass,'web');

{
  const opaque = new ActionGateway({ live: true });
  let persisted = null;
  let executions = 0;
  opaque.setExecutionLedgerPersister(async (snapshot) => { persisted = structuredClone(snapshot); });
  opaque.registerTool({
    id: 'fixture.provider.commit',
    capability: 'provider.custom.operation',
    destructive: true,
    requiresIdempotencyKey: true,
    projectAllowed: true,
    execute: async (input) => {
      executions += 1;
      return { accepted: true, target: String(input.target) };
    },
  });
  const listed = opaque.listTools().find((tool) => tool.id === 'fixture.provider.commit');
  assert.equal(listed.permissionClass, 'system',
    'an unclassified tool with an explicit side-effect/idempotency contract defaults to system permission');
  assert.equal(listed.requiresApproval, true,
    'the registration surface must not hide the approval requirement');
  const governance = opaque.toolGovernanceReport().tools.find((tool) => tool.id === 'fixture.provider.commit');
  assert.equal(governance.required.approval, true,
    'governance reports must count the fail-closed approval requirement');
  assert.equal(governance.permissionClass, 'system');

  const request = await opaque.requestToolApproval(
    'fixture.provider.commit', { target: 'archive-42' }, 'opaque provider mutation', {}, 'execute',
  );
  assert.equal(request.created, true);
  assert.equal(request.request.permissionClass, 'system');
  assert.equal(persisted.permissions.requests.at(-1).permissionClass, 'system');

  const blocked = await opaque.executeTool(
    'fixture.provider.commit', { target: 'archive-42' }, 'without approval',
    { idempotencyKey: 'opaque-provider-commit-1' },
  );
  assert.equal(blocked.ok, false);
  assert.equal(blocked.outcomeClass, 'approval-required');
  assert.equal(executions, 0);

  assert.equal((await opaque.resolveToolApproval(request.request.id, true)).ok, true);
  const executed = await opaque.executeTool(
    'fixture.provider.commit', { target: 'archive-42' }, 'approved exact operation',
    { idempotencyKey: 'opaque-provider-commit-1', approvalId: request.request.id },
  );
  assert.equal(executions, 1);
  assert.equal(executed.idempotencyStatus, 'recorded');
  assert.equal(persisted.permissions.requests.find((row) => row.id === request.request.id).status, 'consumed');

  const safe = new ActionGateway({ live: true });
  safe.setExecutionLedgerPersister(async () => {});
  safe.registerTool({
    id: 'fixture.internal.preview',
    capability: 'local.metadata.preview',
    destructive: false,
    projectAllowed: true,
    execute: async () => ({ preview: true }),
  });
  const safeEntry = safe.listTools().find((tool) => tool.id === 'fixture.internal.preview');
  assert.equal(safeEntry.permissionClass, 'none');
  assert.equal(safeEntry.requiresApproval, false,
    'ordinary unclassified read-only helpers remain usable without an approval prompt');
}

{
  const cases = [
    { id: 'fixture.vendor.destructive', flags: { destructive: true } },
    { id: 'fixture.vendor.undo-required', flags: { requiresUndoFirst: true } },
    { id: 'fixture.vendor.undo-preparation', flags: { undoFirst: { prepare: () => ({}) } } },
  ];
  for (const item of cases) {
    const gateway = new ActionGateway({ live: true });
    gateway.setExecutionLedgerPersister(async () => {});
    gateway.registerTool({
      id: item.id,
      capability: 'opaque.provider.operation',
      projectAllowed: false,
      execute: async () => ({ accepted: true }),
      ...item.flags,
    });
    const listed = gateway.listTools().find((tool) => tool.id === item.id);
    assert.equal(listed.permissionClass, 'system', item.id + ' must default to the system approval class');
    assert.equal(listed.requiresApproval, true, item.id + ' must be marked as approval-required');
    const report = gateway.toolGovernanceReport().tools.find((tool) => tool.id === item.id);
    assert.equal(report.required.approval, true, item.id + ' must be visible as a governance approval requirement');
    const ticket = await gateway.requestToolApproval(item.id, { target: 'resource-7' }, 'high-risk opaque tool', {}, 'execute');
    assert.equal(ticket.created, true, item.id + ' must produce a persisted system-class ticket');
    assert.equal(ticket.request.permissionClass, 'system');
  }
}

{
  const gateway = new ActionGateway({ live: true });
  gateway.setExecutionLedgerPersister(async () => {});
  gateway.registerTool({
    id: 'fixture.web.search',
    capability: 'external.web.search',
    destructive: false,
    permissionClass: 'web',
    execute: async () => ({ results: [] }),
  });
  assert.equal(gateway.listTools().find((tool) => tool.id === 'fixture.web.search').permissionClass, 'web',
    'an explicit canonical permission class must take precedence over the conservative fallback');
  gateway.registerTool({
    id: 'organism.device.speak',
    capability: 'conversational.audio.output',
    destructive: false,
    execute: async () => ({ spoken: true }),
  });
  assert.equal(gateway.listTools().find((tool) => tool.id === 'organism.device.speak').requiresApproval, false,
    'the intentionally safe synthesized-speech exception remains approval-free');
}


{
  const idempotentOnly = new ActionGateway({ live: true });
  idempotentOnly.setExecutionLedgerPersister(async () => {});
  let executions = 0;
  idempotentOnly.registerTool({
    id: 'catalog.update',
    capability: 'catalog.write',
    destructive: false,
    requiresIdempotencyKey: true,
    execute: async () => { executions += 1; return { updated: true }; },
  });
  const descriptor = idempotentOnly.listTools().find(tool => tool.id === 'catalog.update');
  assert.equal(descriptor.permissionClass, 'none',
    'durable idempotency is a replay-safety contract, not an approval class');
  assert.equal(descriptor.requiresApproval, false);
  const result = await idempotentOnly.executeTool(
    'catalog.update', { key: 'valid-key' }, 'idempotent update',
    { idempotencyKey: 'catalog-update-001' },
  );
  assert.equal(result.ok, true);
  assert.equal(executions, 1);
}

console.log('WORKPASS53_ACTION_APPROVAL_BOUNDARY=PASS scenarios=27');
