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
// A persistence batch can transiently refuse checkpointing. This is not a
// permanent storage failure: preserve fail-closed behavior but surface a retryable
// status so the external HTTP boundary can wait for the batch to finish.
const busy = new ActionGateway({ live: true });
let busyPersist = false;
let busyWrites = 0;
busy.setExecutionLedgerPersister(async () => {
  busyWrites += 1;
  if (busyPersist) throw new Error('action-ledger-persistence-busy');
});
const busyTool = 'http.research.probe.neurocore';
const busyInput = { kind: 'neurocore' };
busyPersist = true;
const busyRequest = await busy.requestToolApproval(busyTool, busyInput, 'transient batch contention', {}, 'direct');
assert.equal(busyRequest.created, false);
assert.equal(busyRequest.error, 'approval-storage-busy');
assert.equal(busy.toolPermissionSnapshot().pending, 0, 'a rejected busy write must roll the ticket back');
busyPersist = false;
const durableRequest = await busy.requestToolApproval(busyTool, busyInput, 'transient batch contention', {}, 'direct');
assert.equal(durableRequest.created, true);
busyPersist = true;
const busyResolve = await busy.resolveToolApproval(durableRequest.request.id, true);
assert.equal(busyResolve.ok, false);
assert.equal(busyResolve.error, 'approval-storage-busy');
assert.equal(busy.toolPermissionSnapshot().requests.find(row => row.id === durableRequest.request.id).status, 'pending');
busyPersist = false;
assert.equal((await busy.resolveToolApproval(durableRequest.request.id, true)).ok, true);
busyPersist = true;
const busyConsume = await busy.consumeDirectActionApproval(busyTool, busyInput, durableRequest.request.id, {}, 'direct');
assert.equal(busyConsume.ok, false);
assert.equal(busyConsume.reason, 'approval-storage-busy');
assert.equal(busy.toolPermissionSnapshot().requests.find(row => row.id === durableRequest.request.id).status, 'approved');
busyPersist = false;
assert.equal((await busy.consumeDirectActionApproval(busyTool, busyInput, durableRequest.request.id, {}, 'direct')).ok, true);
assert.ok(busyWrites >= 6, 'request, resolution and consumption each attempt a durable write');
console.log('WORKPASS325_APPROVAL_STORAGE_BUSY=PASS operations=request,resolve,consume');

console.log('WORKPASS53_ACTION_APPROVAL_BOUNDARY=PASS scenarios=25');
