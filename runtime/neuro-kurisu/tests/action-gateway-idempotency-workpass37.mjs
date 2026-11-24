import assert from 'node:assert/strict';
import test from 'node:test';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const makeGateway = (config = {}) => { const gateway = new ActionGateway(config); gateway.setExecutionLedgerPersister(async () => {}); return gateway; };

test('same idempotency key joins concurrent execution and replays the completed receipt', async () => {
  const gateway = makeGateway({ live: false });
  let calls = 0;
  gateway.registerTool({
    id: 'test.idempotent', capability: 'test.read', destructive: false,
    execute: async (input) => { calls++; await wait(15); return { ok: true, value: input.value }; },
    verify: ({ result }) => ({ verified: true, basis: 'tool-contract', confidence01: .9, externalObservation: false, notes: String(result.value) }),
  });

  const [first, concurrent] = await Promise.all([
    gateway.executeTool('test.idempotent', { value: 42 }, 'test', { idempotencyKey: 'request-42' }),
    gateway.executeTool('test.idempotent', { value: 42 }, 'retry', { idempotencyKey: 'request-42' }),
  ]);
  assert.equal(calls, 1, 'same-key concurrent retries must share the executor call');
  assert.equal(first.executionId, concurrent.executionId);
  assert.equal(concurrent.idempotentReplay, true);
  assert.equal(first.ok, true);

  const replay = await gateway.executeTool('test.idempotent', { value: 42 }, 'retry-after-completion', { idempotencyKey: 'request-42' });
  assert.equal(replay.executionId, first.executionId);
  assert.equal(replay.idempotencyStatus, 'replayed');
  assert.equal(calls, 1);
});

test('key collision with a different request fails closed and never invokes the tool twice', async () => {
  const gateway = makeGateway();
  let calls = 0;
  gateway.registerTool({ id: 'test.collision', capability: 'test', destructive: false, execute: async (input) => { calls++; return { ok: true, value: input.value }; } });
  await gateway.executeTool('test.collision', { value: 'a' }, 'first', { idempotencyKey: 'same-key' });
  const conflict = await gateway.executeTool('test.collision', { value: 'b' }, 'collision', { idempotencyKey: 'same-key' });
  assert.equal(conflict.outcomeClass, 'idempotency-conflict');
  assert.equal(conflict.result.error, 'idempotency-key-reused-with-different-request');
  assert.equal(calls, 1);
});

test('completed receipt replays after ledger snapshot/restore; orphaned pending receipts require reconciliation', async () => {
  const origin = makeGateway();
  let calls = 0;
  origin.registerTool({ id: 'test.restore', capability: 'test', destructive: false, execute: async () => { calls++; return { ok: true, value: 'durable' }; } });
  const first = await origin.executeTool('test.restore', {}, 'first', { idempotencyKey: 'persisted-1' });
  const snapshot = origin.snapshotExecutionLedger();
  const restored = makeGateway();
  restored.restoreExecutionLedger(snapshot);
  restored.registerTool({ id: 'test.restore', capability: 'test', destructive: false, execute: async () => { calls++; return { ok: true, value: 'should-not-run' }; } });
  const again = await restored.executeTool('test.restore', {}, 'restart-retry', { idempotencyKey: 'persisted-1' });
  assert.equal(again.executionId, first.executionId);
  assert.equal(again.result.value, 'durable');
  assert.equal(again.idempotencyStatus, 'replayed');
  assert.equal(calls, 1);

  const pending = { version: 1, records: [{ ...snapshot.records[0], keyHash: 'a'.repeat(64), requestHash: 'b'.repeat(64), status: 'pending', response: undefined, responseOmitted: false }] };
  restored.restoreExecutionLedger(pending);
  const uncertain = await restored.executeTool('test.restore', {}, 'do-not-repeat', { idempotencyKey: 'new-key-with-pending-hash' });
  // The pending fixture is keyed by hash; a different key is intentionally distinct and remains eligible.
  assert.equal(uncertain.ok, true);
  const pendingKey = 'pending-recovery';
  const pendingHash = (await import('../src/organism/core/StableSerialization.ts')).sha256Stable({ idempotencyKey: pendingKey });
  restored.restoreExecutionLedger({ version: 1, records: [{ keyHash: pendingHash, requestHash: (await import('../src/organism/core/StableSerialization.ts')).sha256Stable({ toolId: 'test.restore', input: {}, expectedOutputKeys: null, decisionId: null, autonomous: false }), status: 'pending', recordedAt: Date.now() }] });
  const failClosed = await restored.executeTool('test.restore', {}, 'must-not-run', { idempotencyKey: pendingKey });
  assert.equal(failClosed.outcomeClass, 'idempotency-recovery-required');
  assert.equal(calls, 2, 'only the distinct new key should execute once; recovered pending key must not execute');
});

test('failed ledger persistence prevents the side effect from starting', async () => {
  const gateway = makeGateway();
  let calls = 0;
  gateway.registerTool({ id: 'test.persistence', capability: 'test', destructive: false, execute: async () => { calls++; return { ok: true }; } });
  gateway.setExecutionLedgerPersister(async () => { throw new Error('store-offline'); });
  const result = await gateway.executeTool('test.persistence', {}, 'persistence-failure', { idempotencyKey: 'no-exec-without-receipt' });
  assert.equal(result.outcomeClass, 'idempotency-storage-failed');
  assert.equal(calls, 0, 'the pending receipt must be persisted before invoking the tool');
});

test('OrganismCore persists and restores keyed execution receipts across core restart', async () => {
  const store = new MemoryStateStore();
  const core = new OrganismCore(store, { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await core.init();
  let calls = 0;
  core.registerActionTool({ id: 'test.core-idempotent', capability: 'test.read', destructive: false, projectAllowed: true, execute: async () => { calls++; return { ok: true, receipt: 'persisted' }; } });
  const first = await core.executeTool('test.core-idempotent', {}, 'core-first', { idempotencyKey: 'core-operation-1' });
  assert.equal(first.ok, true);
  assert.ok(core.snapshot().system.actionExecutionLedger.records.some((row) => row.status === 'completed'));

  const restoredCore = new OrganismCore(store, { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await restoredCore.init();
  restoredCore.registerActionTool({ id: 'test.core-idempotent', capability: 'test.read', destructive: false, projectAllowed: true, execute: async () => { calls++; return { ok: true, receipt: 'duplicate' }; } });
  const replay = await restoredCore.executeTool('test.core-idempotent', {}, 'core-retry', { idempotencyKey: 'core-operation-1' });
  assert.equal(replay.executionId, first.executionId);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.result.receipt, 'persisted');
  assert.equal(calls, 1);
});

test('reusable skill retries replay step receipts without duplicate causal projection or learning credit', async () => {
  const core = new OrganismCore(new MemoryStateStore(), { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await core.init();
  let sideEffects = 0;
  for (const id of ['test.skill.step-a', 'test.skill.step-b']) {
    core.registerActionTool({
      id, capability: 'test.read', destructive: false, projectAllowed: false,
      execute: async (input) => { sideEffects++; return { ok: true, value: `${id}:${String(input.value ?? 'v')}` }; },
      verify: async () => ({ verified: true, basis: 'tool-contract', confidence01: .96, externalObservation: false, notes: 'skill-idempotency-test' }),
    });
  }
  const compiled = core.compileCompoundSkill({ projectId: 'wp37-skill-idempotency', name: 'idempotent-skill', origin: 'intrinsic', steps: [
    { id: 'a', action: 'explore', toolId: 'test.skill.step-a', input: { value: 'a' } },
    { id: 'b', action: 'verify', toolId: 'test.skill.step-b', input: { value: 'b' } },
  ] });
  assert.ok(compiled);
  for (let i = 0; i < 5; i++) core.recordCompoundSkillExecution(compiled.id, { success01: 1, verified: true, independent: true, context: `idempotent skill context ${i}` });
  const reusable = core.reusableCompoundSkill('idempotent skill context 4');
  assert.ok(reusable?.status === 'reusable');
  const keyedOptions = { idempotencyKey: 'skill-parent-request-37' };
  const first = await core.executeReusableSkill(reusable.id, { contextKey: 'same-request-context', independentEvidence: true }, 'skill-first', keyedOptions);
  assert.equal(first.ok, true);
  assert.equal(first.results.length, 2);
  assert.equal(sideEffects, 2);
  const outcomeCount = core.outcomeVerificationSnapshot().records.length;
  const skillExecutionEventCount = core.snapshot().facets.memory.eventLog.filter((e) => e.type === 'compound-skill-execution').length;
  const repeat = await core.executeReusableSkill(reusable.id, { contextKey: 'same-request-context', independentEvidence: true }, 'skill-retry', keyedOptions);
  assert.equal(repeat.ok, true);
  assert.equal(repeat.idempotentReplay, true);
  assert.equal(sideEffects, 2, 'retry must not repeat any underlying tool side effect');
  assert.equal(core.outcomeVerificationSnapshot().records.length, outcomeCount, 'replayed receipts must not duplicate causal/outcome projections');
  assert.equal(core.snapshot().facets.memory.eventLog.filter((e) => e.type === 'compound-skill-execution').length, skillExecutionEventCount, 'replayed skill must not receive additional learning credit');
});

test('an execution-finalizer failure leaves the receipt pending and blocks side-effect replay', async () => {
  const gateway = makeGateway();
  let calls = 0;
  gateway.registerTool({ id: 'test.finalizer-failure', capability: 'test.write', destructive: false, execute: async () => { calls++; return { ok: true, applied: true }; } });
  gateway.setExecutionLedgerPersister(async () => {});
  gateway.setExecutionFinalizer(async () => { throw new Error('causal-projection-storage-failed'); });
  const first = await gateway.executeTool('test.finalizer-failure', {}, 'first', { idempotencyKey: 'finalizer-failure-key' });
  assert.equal(first.outcomeClass, 'idempotency-recovery-required');
  assert.equal(first.idempotencyStatus, 'recovery-required');
  assert.equal(calls, 1);
  const retry = await gateway.executeTool('test.finalizer-failure', {}, 'retry', { idempotencyKey: 'finalizer-failure-key' });
  assert.equal(retry.outcomeClass, 'idempotency-recovery-required');
  assert.equal(retry.result.error, 'idempotency-recovery-required');
  assert.equal(calls, 1, 'a failed post-action commit must never cause automatic re-execution');
});

test('external tool postconditions enter the canonical observer and commit atomically with the action receipt', async () => {
  const store = new MemoryStateStore();
  const core = new OrganismCore(store, { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await core.init();
  // Get an exact decision ID from the canonical decision authority; the action
  // result must not infer that ID from its own execution receipt.
  await core.observe({ text: 'verify the switch state before changing it' }, 'operational');
  const pendingDecision = core.snapshot().system.canonicalTemporalCredit.pending.find((row) => !row.resolved);
  assert.ok(pendingDecision?.decisionId, 'the core should expose an exact pending decision for external reafference');
  let calls = 0;
  core.registerActionTool({
    id: 'test.external-observation', capability: 'test.remote', destructive: false, projectAllowed: false,
    observationSource: { sourceId: 'test.remote-api', sourceClass: 'external-api', channel: 'http', independenceKey: 'test-api-instance' },
    execute: async () => { calls++; return { ok: true, changed: true }; },
    verify: async () => ({
      verified: true, basis: 'external-postcondition', externalObservation: true, confidence01: .98,
      observationId: 'external-observation-fixture-1', expectedPostcondition: 'switch=on', observedPostcondition: 'switch=on',
      notes: 'fixture source confirms remote postcondition',
      observedWorldContextAfter: { tick: 1, location: 'lab', energy: .8, attention: .7, uncertainty: .1, facts: ['switch=on'], objects: [], events: ['switch:turned-on'] },
    }),
  });
  const result = await core.executeTool('test.external-observation', { command: 'on' }, 'external-verification-test', { idempotencyKey: 'external-operation-1', decisionId: pendingDecision.decisionId, autonomous: true });
  assert.equal(result.ok, true);
  assert.equal(core.externalObserverSnapshot().observations.length, 1, 'tool postcondition must enter the single observer fabric');
  assert.equal(core.externalObserverSnapshot().assessments.length, 1);
  const saved = await store.load();
  assert.ok(saved.system.actionExecutionLedger.records.some((row) => row.status === 'completed'), 'completed receipt must be durable');
  assert.equal(saved.system.externalObserver.observations.length, 1, 'receipt and postcondition evidence must be committed together');
  assert.ok(saved.system.outcomeVerification.records.some((row) => row.executionId === result.executionId), 'outcome projection must commit with receipt');
  assert.equal(saved.system.canonicalTemporalCredit.pending.find((row) => row.decisionId === pendingDecision.decisionId)?.resolved, true, 'the exact pending decision must receive grounded reafference');
  assert.ok(saved.system.canonicalTemporalCredit.recentAssignments.some((row) => row.decisionId === pendingDecision.decisionId), 'temporal credit assignment must be persisted with the receipt');

  const restored = new OrganismCore(store, { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await restored.init();
  restored.registerActionTool({
    id: 'test.external-observation', capability: 'test.remote', destructive: false, projectAllowed: false,
    observationSource: { sourceId: 'test.remote-api', sourceClass: 'external-api', channel: 'http', independenceKey: 'test-api-instance' },
    execute: async () => { calls++; return { ok: true, changed: 'duplicate' }; },
    verify: async () => ({ verified: true, basis: 'external-postcondition', externalObservation: true, confidence01: .98, observationId: 'external-observation-fixture-2', expectedPostcondition: 'switch=on', observedPostcondition: 'switch=on' }),
  });
  const replay = await restored.executeTool('test.external-observation', { command: 'on' }, 'external-verification-retry', { idempotencyKey: 'external-operation-1', decisionId: pendingDecision.decisionId, autonomous: true });
  assert.equal(replay.idempotentReplay, true);
  assert.equal(calls, 1, 'restore/retry must not invoke the connector again');
  assert.equal(restored.externalObserverSnapshot().observations.length, 1, 'replay must not duplicate external observations');
  assert.equal(restored.outcomeVerificationSnapshot().records.filter((row) => row.executionId === result.executionId).length, 1, 'replay must not duplicate the outcome record');
});

test('completion receipt persistence failure is reported as recovery-required and cannot replay in-process', async () => {
  const gateway = makeGateway();
  let calls = 0;
  let persists = 0;
  gateway.registerTool({ id: 'test.completion-commit', capability: 'test.write', destructive: false, execute: async () => { calls++; return { ok: true, committed: true }; } });
  gateway.setExecutionLedgerPersister(async (snapshot) => {
    persists++;
    if (snapshot.records.some((row) => row.status === 'completed')) throw new Error('commit-store-offline');
    if (persists > 1) throw new Error('repair-store-offline');
  });
  const first = await gateway.executeTool('test.completion-commit', {}, 'commit-failure', { idempotencyKey: 'commit-failure-key' });
  assert.equal(calls, 1, 'the external side effect may already have happened exactly once');
  assert.equal(first.ok, false);
  assert.equal(first.outcomeClass, 'idempotency-recovery-required');
  assert.equal(first.idempotencyStatus, 'recovery-required');
  assert.equal(first.result.error, 'completion-receipt-persistence-failed');
  const retry = await gateway.executeTool('test.completion-commit', {}, 'do-not-repeat', { idempotencyKey: 'commit-failure-key' });
  assert.equal(retry.outcomeClass, 'idempotency-recovery-required');
  assert.equal(retry.result.error, 'idempotency-recovery-required');
  assert.equal(calls, 1, 'a missing durable completed receipt must never trigger a second side effect');
});

test('missing required output keys fail before outcome finalization and are durably replayed as failure', async () => {
  const gateway = makeGateway();
  let calls = 0;
  let finalizations = 0;
  gateway.registerTool({ id: 'test.required-output', capability: 'test.read', destructive: false, execute: async () => { calls++; return { ok: true, actual: 'value' }; } });
  gateway.setExecutionLedgerPersister(async () => {});
  gateway.setExecutionFinalizer(async ({ result }) => {
    finalizations++;
    assert.equal(result.ok, false);
    assert.equal(result.outcomeClass, 'execution-failed');
  });
  const options = { idempotencyKey: 'required-output-key', expectedOutputKeys: ['required'] };
  const first = await gateway.executeTool('test.required-output', {}, 'missing-required-output', options);
  assert.equal(first.ok, false);
  assert.equal(first.outcomeClass, 'execution-failed');
  assert.equal(first.result.error, 'missing-expected-output:required');
  const replay = await gateway.executeTool('test.required-output', {}, 'repeat-failed-output', options);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.ok, false);
  assert.equal(replay.outcomeClass, 'execution-failed');
  assert.equal(calls, 1);
  assert.equal(finalizations, 1);
});

test('oversized result payload returns the same bounded receipt on first response and replay', async () => {
  const gateway = makeGateway();
  let calls = 0;
  gateway.setExecutionLedgerPersister(async () => {});
  gateway.registerTool({ id: 'test.large-output', capability: 'test.read', destructive: false, execute: async () => { calls++; return { ok: true, verified: true, data: 'x'.repeat(52 * 1024) }; } });
  const options = { idempotencyKey: 'large-output-key', expectedOutputKeys: ['ok'] };
  const first = await gateway.executeTool('test.large-output', {}, 'large-result', options);
  const replay = await gateway.executeTool('test.large-output', {}, 'large-result-retry', options);
  assert.equal(first.ok, true);
  assert.equal(first.idempotencyStatus, 'payload-omitted');
  assert.equal(first.result.error, 'idempotency-replay-payload-omitted');
  assert.equal(replay.ok, first.ok);
  assert.equal(replay.verified, first.verified);
  assert.equal(replay.outcomeClass, first.outcomeClass);
  assert.equal(replay.executionId, first.executionId);
  assert.equal(replay.result.error, first.result.error);
  assert.equal(calls, 1);
});

test('expected output keys use the same normalization for request identity and validation', async () => {
  const gateway = makeGateway();
  let calls = 0;
  gateway.setExecutionLedgerPersister(async () => {});
  gateway.registerTool({ id: 'test.expected-key-normalization', capability: 'test.read', destructive: false, execute: async () => { calls++; return { ok: true, value: 1 }; } });
  const first = await gateway.executeTool('test.expected-key-normalization', {}, 'first', { idempotencyKey: 'expected-key-normalization', expectedOutputKeys: [' value ', '', 'value'] });
  const repeat = await gateway.executeTool('test.expected-key-normalization', {}, 'same-normalized-request', { idempotencyKey: 'expected-key-normalization', expectedOutputKeys: ['value'] });
  assert.equal(first.ok, true);
  assert.equal(repeat.idempotentReplay, true);
  assert.equal(calls, 1);
});

test('idempotency key cannot silently rebind an action to a different decision or autonomy context', async () => {
  const gateway = makeGateway();
  gateway.setExecutionLedgerPersister(async () => {});
  let calls = 0;
  gateway.registerTool({ id: 'test.decision-binding', capability: 'test.write', destructive: false, execute: async () => { calls++; return { ok: true, receipt: 'bound' }; } });
  const first = await gateway.executeTool('test.decision-binding', { value: 1 }, 'decision-a', { idempotencyKey: 'decision-bound-operation', decisionId: 'decision-a', autonomous: true });
  assert.equal(first.ok, true);
  const differentDecision = await gateway.executeTool('test.decision-binding', { value: 1 }, 'decision-b', { idempotencyKey: 'decision-bound-operation', decisionId: 'decision-b', autonomous: true });
  assert.equal(differentDecision.outcomeClass, 'idempotency-conflict');
  assert.equal(differentDecision.result.error, 'idempotency-key-reused-with-different-request');
  const differentAutonomy = await gateway.executeTool('test.decision-binding', { value: 1 }, 'manual-context', { idempotencyKey: 'decision-bound-operation', decisionId: 'decision-a', autonomous: false });
  assert.equal(differentAutonomy.outcomeClass, 'idempotency-conflict');
  assert.equal(calls, 1, 'same side effect key must not be rebound to another decision/agency context');
});
