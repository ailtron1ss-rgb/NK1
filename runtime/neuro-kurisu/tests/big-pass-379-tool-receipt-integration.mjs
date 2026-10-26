import assert from 'node:assert/strict';
import test from 'node:test';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';
import { OutcomeCognitionFabric } from '../src/organism/system/OutcomeCognitionFabric.ts';
import { AutonomousResourceToolLifeController } from '../src/organism/system/AutonomousResourceToolLifeController.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { P65EpistemicLedger } from '../src/organism/memory/P65EpistemicLedger.ts';
import { realityEvidenceEventId } from '../src/organism/system/RealityEvidenceLedger.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const verification = (overrides = {}) => ({
  verified: true,
  basis: 'tool-contract',
  confidence01: 0.93,
  externalObservation: false,
  notes: 'big-pass-379-test',
  ...overrides,
});

const makeGateway = () => {
  const gateway = new ActionGateway();
  gateway.setExecutionLedgerPersister(async () => {});
  return gateway;
};

test('ActionGateway rejects accidental duplicate tool IDs instead of silently shadowing an executor', () => {
  const gateway = makeGateway();
  gateway.registerTool({ id: 'test.registry-owner', capability: 'test.read', destructive: false, execute: async () => ({ ok: true, owner: 'first' }) });
  assert.throws(
    () => gateway.registerTool({ id: 'test.registry-owner', capability: 'test.write', destructive: true, execute: async () => ({ ok: true, owner: 'shadow' }) }),
    /duplicate-tool-id:test\.registry-owner/,
  );
});

test('tool receipt trace is causally linked and replay-deduplicated across snapshot restore', () => {
  const fabric = new CognitiveEventFabric();
  const cycle = fabric.recordOperationalCycle({
    tick: 7,
    observation: { source: 'test-observation', payload: { input: 'safe' } },
    prediction: { source: 'test-prediction', payload: { intent: 'inspect' } },
    action: { source: 'test-decision', payload: { intent: 'inspect' } },
    outcome: { source: 'test-outcome', payload: { ok: true } },
    learning: { source: 'test-learning' },
    selfUpdate: { source: 'test-self-update' },
  });
  assert.equal(fabric.snapshot().cycleCoverage01, 1);
  const decisionId = cycle.action;
  const first = fabric.appendToolReceiptTrace({
    tick: 8, executionId: 'exec-stable-379', toolId: 'organism.inspect', decisionId,
    ok: true, verified: true, outcomeClass: 'executed-verified', confidence01: 0.93,
    verificationBasis: 'tool-contract', externalObservation: false, observationIntegrated: false, at: 1700000000000,
  });
  assert.equal(first.replayed, false);
  let snapshot = fabric.snapshot();
  const action = snapshot.recent.find((row) => row.id === first.actionEventId);
  const outcome = snapshot.recent.find((row) => row.id === first.outcomeEventId);
  const evidence = snapshot.recent.find((row) => row.id === first.evidenceEventId);
  assert.ok(action.parentIds.includes(decisionId), 'an explicitly supplied existing decision is attached as the action parent');
  assert.deepEqual(outcome.parentIds, [action.id]);
  assert.deepEqual(evidence.parentIds, [outcome.id]);
  assert.equal(snapshot.recent.filter((row) => row.payload.executionId === 'exec-stable-379').length, 3);
  assert.equal(snapshot.cycleCoverage01, 1, 'standalone cross-tick tool traces must not dilute operational-cycle coverage');

  const restored = new CognitiveEventFabric();
  restored.restore(snapshot);
  const beforeTotal = restored.snapshot().total;
  const replay = restored.appendToolReceiptTrace({
    tick: 8, executionId: 'exec-stable-379', toolId: 'organism.inspect', decisionId,
    ok: true, verified: true, outcomeClass: 'executed-verified', confidence01: 0.93,
    verificationBasis: 'tool-contract', externalObservation: false, observationIntegrated: false, at: 1700000000000,
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.actionEventId, first.actionEventId);
  assert.equal(restored.snapshot().total, beforeTotal, 'receipt replay cannot emit extra events');
});

test('receipt traces outside the ordinary 96-event window remain restorable and do not create dangling replay guards', () => {
  const fabric = new CognitiveEventFabric(256);
  const first = fabric.appendToolReceiptTrace({
    tick: 1, executionId: 'exec-outside-window', toolId: 'organism.inspect', ok: true, verified: true,
    outcomeClass: 'executed-verified', confidence01: 0.9, verificationBasis: 'tool-contract',
    externalObservation: false, observationIntegrated: false, at: 1700000000000,
  });
  for (let i = 0; i < 110; i++) fabric.append({ tick: i + 2, stage: 'memory', source: 'window-advance', payload: { sequence: i } });
  const snapshot = fabric.snapshot();
  assert.equal(snapshot.recent.some((event) => event.id === first.actionEventId), false, 'trace falls outside 96 ordinary events');
  assert.equal(snapshot.receiptEvents.filter((event) => [first.actionEventId, first.outcomeEventId, first.evidenceEventId].includes(event.id)).length, 3);
  const restored = new CognitiveEventFabric(256);
  restored.restore(snapshot);
  const before = restored.snapshot().total;
  const replay = restored.appendToolReceiptTrace({
    tick: 1, executionId: 'exec-outside-window', toolId: 'organism.inspect', ok: true, verified: true,
    outcomeClass: 'executed-verified', confidence01: 0.9, verificationBasis: 'tool-contract',
    externalObservation: false, observationIntegrated: false, at: 1700000000000,
  });
  assert.equal(replay.replayed, true);
  assert.equal(restored.snapshot().total, before, 'the durable projection index suppresses duplicate trace nodes after restore');
});

test('a trace aged out of the bounded event ring cannot leave a dangling replay guard', () => {
  const fabric = new CognitiveEventFabric(128);
  fabric.appendToolReceiptTrace({
    tick: 1, executionId: 'exec-ring-eviction', toolId: 'organism.inspect', ok: true, verified: true,
    outcomeClass: 'executed-verified', confidence01: 0.9, verificationBasis: 'tool-contract',
    externalObservation: false, observationIntegrated: false, at: 1700000000000,
  });
  for (let i = 0; i < 140; i++) fabric.append({ tick: i + 2, stage: 'memory', source: 'ring-advance' });
  assert.equal(fabric.snapshot().receiptProjectionIndex?.some((row) => row.executionId === 'exec-ring-eviction'), false);
  const rebuilt = fabric.appendToolReceiptTrace({
    tick: 1, executionId: 'exec-ring-eviction', toolId: 'organism.inspect', ok: true, verified: true,
    outcomeClass: 'executed-verified', confidence01: 0.9, verificationBasis: 'tool-contract',
    externalObservation: false, observationIntegrated: false, at: 1700000000001,
  });
  assert.equal(rebuilt.replayed, false, 'old execution trace is rebuilt only after its entire old trace was evicted');
  assert.equal(fabric.snapshot().recent.filter((row) => row.payload.executionId === 'exec-ring-eviction').length, 3);
});

test('stable planner decision IDs survive snapshot restore without duplicating the decision node', () => {
  const fabric = new CognitiveEventFabric();
  const intent = { version: 1, tick: 23, toolId: 'organism.inspect', planner: 'autonomous-resource-tool-life' };
  const id = `cef:autonomous-tool-plan:${Buffer.from(JSON.stringify(intent)).toString('hex').slice(0, 48)}`;
  const first = fabric.append({ id, tick: 23, stage: 'plan', source: 'autonomous-resource-tool-life', payload: { toolId: intent.toolId } });
  const restored = new CognitiveEventFabric();
  restored.restore(fabric.snapshot());
  const replay = restored.append({ id, tick: 23, stage: 'plan', source: 'autonomous-resource-tool-life', payload: { toolId: intent.toolId, changedNarration: true } });
  assert.equal(replay.id, first.id);
  assert.equal(restored.snapshot().total, 1, 'the stable plan node is reused, not appended twice');
  assert.equal(replay.payload.changedNarration, undefined, 'replay preserves the first persisted decision payload');
  assert.throws(() => restored.append({ id, tick: 24, stage: 'plan', source: 'autonomous-resource-tool-life' }), /cognitive-event-id-conflict/);
});

test('external outcome correlation requires exact execution identity and never falls back to tool name', () => {
  const outcomes = new OutcomeCognitionFabric();
  outcomes.project({ tick: 10, tool: 'test.same-tool', ok: true, verification: verification(), executionId: 'exec-a' });
  outcomes.project({ tick: 10, tool: 'test.same-tool', ok: true, verification: verification(), executionId: 'exec-b' });

  const withoutExecution = outcomes.resolveExternalObservation({ tick: 11, tool: 'test.same-tool', observationId: 'external-1', verified: true, confidence01: 0.99 });
  assert.equal(withoutExecution.resolved, false);
  assert.equal(withoutExecution.reason, 'execution-id-required');

  const exact = outcomes.resolveExternalObservation({ tick: 11, tool: 'test.same-tool', executionId: 'exec-b', observationId: 'external-2', verified: true, confidence01: 0.99 });
  assert.equal(exact.resolved, true);
  assert.equal(exact.record.executionId, 'exec-b');
  assert.equal(exact.record.externalObservations?.at(-1)?.observationId, 'external-2', 'external evidence is tracked separately from the original executor verification');
});


test('OrganismCore persists external evidence as a separate node parented by the canonical tool outcome', async () => {
  const store = new MemoryStateStore();
  const core = new OrganismCore(store, { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await core.init();
  let executions = 0;
  core.registerActionTool({
    id: 'test.external-causal', capability: 'device.read', destructive: false, projectAllowed: true,
    observationSource: { sourceId: 'test.sensor.causal', sourceClass: 'device', channel: 'sensor', independenceKey: 'sensor-causal-01' },
    execute: async () => { executions++; return { ok: true, desired: 'relay-on' }; },
    verify: async () => verification({
      basis: 'external-postcondition', externalObservation: true, confidence01: .99,
      observationId: 'tool-verifier-causal-01', expectedPostcondition: 'relay state ON', observedPostcondition: 'relay state ON',
    }),
  });
  const actionOptions = { idempotencyKey: 'workpass44-external-causal-key' };
  const approval = await core.cognitiveRuntime.actionGateway.requestToolApproval('test.external-causal', { relay: 1 }, 'workpass44-external-causal', actionOptions, 'execute');
  assert.equal(approval.created, true);
  assert.equal((await core.cognitiveRuntime.actionGateway.resolveToolApproval(approval.request.id, true, 'test-owner')).ok, true);
  const approvedOptions = { ...actionOptions, approvalId: approval.request.id };
  const first = await core.executeTool('test.external-causal', { relay: 1 }, 'workpass44-external-causal', approvedOptions);
  assert.equal(first.ok, true);
  const initialSnapshot = core.snapshot().system.cognitiveEventFabric;
  const external = initialSnapshot.recent.find(row => row.stage === 'external-evidence' && row.payload.executionId === first.executionId);
  const outcome = initialSnapshot.recent.find(row => row.stage === 'tool-outcome' && row.payload.executionId === first.executionId);
  assert.ok(external, 'actual OrganismCore finalization must write an external evidence event');
  assert.ok(outcome, 'canonical tool outcome must exist');
  assert.deepEqual(external.parentIds, [outcome.id]);
  assert.equal(external.payload.toolId, 'test.external-causal');
  assert.equal(external.payload.evidenceStatus, 'corroborated');
  assert.equal(JSON.stringify(external.payload).includes('relay state ON'), false, 'external CEF nodes retain hashes rather than raw claims');
  const replay = await core.executeTool('test.external-causal', { relay: 1 }, 'workpass44-external-causal-replay', actionOptions);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(executions, 1);
  const afterReplay = core.snapshot().system.cognitiveEventFabric;
  assert.equal(afterReplay.total, initialSnapshot.total);
  assert.equal(afterReplay.recent.filter(row => row.stage === 'external-evidence' && row.payload.executionId === first.executionId).length, 1);
});

test('autonomous tool accounting repairs a missing post-crash record but deduplicates an already recorded receipt', () => {
  const controller = new AutonomousResourceToolLifeController();
  const tool = { id: 'organism.inspect', capability: 'core.read', destructive: false, projectAllowed: true };
  const record = { tick: 6, at: 1700000000000, tool, ok: true, verified: true, cost01: 0.1, reason: 'recovery', executionId: 'exec-auto-379' };
  assert.equal(controller.record(record), true);
  assert.equal(controller.record({ ...record, at: record.at + 1 }), false);
  assert.equal(controller.snapshot().toolExecutions, 1);
  assert.equal(controller.snapshot().toolSuccesses, 1);
});

test('OrganismCore projects a keyed tool receipt into the persisted causal fabric exactly once', async () => {
  const store = new MemoryStateStore();
  const core = new OrganismCore(store, { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await core.init();
  let executions = 0;
  core.registerActionTool({
    id: 'test.trace-once', capability: 'test.read', destructive: false, projectAllowed: true,
    execute: async () => { executions++; return { ok: true, value: 'receipt-trace' }; },
    verify: async () => verification(),
  });
  const planId = `cef:test-plan:${'e'.repeat(48)}`;
  const plan = core.cognitiveRuntime.cognitiveEventFabric.append({ id: planId, tick: core.snapshot().state.tick + 1, stage: 'plan', source: 'test-plan', payload: { capability: 'test.read' } });
  const first = await core.executeTool('test.trace-once', {}, 'big-pass-379-first', { idempotencyKey: 'big-pass-379-key', decisionId: plan.id });
  assert.equal(first.ok, true);
  const afterFirst = core.snapshot().system.cognitiveEventFabric;
  const firstTrace = afterFirst.recent.filter((row) => row.payload.executionId === first.executionId && ['tool-action', 'tool-outcome', 'tool-evidence'].includes(row.stage));
  assert.equal(firstTrace.length, 3);
  assert.ok(afterFirst.recent.find((row) => row.payload.executionId === first.executionId && row.stage === 'tool-action')?.parentIds.includes(plan.id), 'receipt action starts at the canonical plan node');

  const outcomeNode = firstTrace.find((row) => row.stage === 'tool-outcome');
  const projectedEventId = realityEvidenceEventId(first.executionId, 'tool-outcome', 'canonical');
  const realityLedger = core.snapshot().system.realityEvidenceLedger;
  const realityRecord = realityLedger.recent.find((row) => row.eventId === projectedEventId);
  assert.ok(realityRecord, 'canonical execution outcome must project into RealityEvidenceLedger');
  assert.equal(realityRecord.realityClass, 'derived', 'tool-contract verification is not independent external reality evidence');
  assert.ok(realityRecord.parentIds.includes(outcomeNode.id), 'reality evidence must point back to the canonical causal outcome');
  const p65BeforeReplay = core.p65Snapshot();
  const p65Claim = p65BeforeReplay.claimsData.find((row) => row.eventId === projectedEventId);
  assert.ok(p65Claim, 'P65 must carry the same event ID for a cross-ledger join');
  assert.equal(p65Claim.kind, 'inference', 'a tool-contract receipt is an inference, not an independent external observation');
  assert.ok(p65Claim.content.includes(first.executionId));
  const realityTotalBeforeReplay = realityLedger.total;

  const replay = await core.executeTool('test.trace-once', {}, 'big-pass-379-replay', { idempotencyKey: 'big-pass-379-key', decisionId: plan.id });
  assert.equal(replay.idempotentReplay, true);
  assert.equal(executions, 1);
  const afterReplay = core.snapshot().system.cognitiveEventFabric;
  const replayTrace = afterReplay.recent.filter((row) => row.payload.executionId === first.executionId && ['tool-action', 'tool-outcome', 'tool-evidence'].includes(row.stage));
  assert.equal(replayTrace.length, 3);
  assert.equal(afterReplay.total, afterFirst.total);
  assert.equal(core.snapshot().system.realityEvidenceLedger.total, realityTotalBeforeReplay,
    'gateway replay cannot add another RealityEvidenceLedger record');
  assert.equal(core.p65Snapshot().claims, p65BeforeReplay.claims,
    'gateway replay cannot add another epistemic claim');
});

test('P65 event identity survives restore, ignores processing time and rejects changed payloads', () => {
  const ledger = new P65EpistemicLedger();
  const eventId = realityEvidenceEventId('exec-p65-event-identity-517', 'tool-outcome', 'canonical');
  const input = {
    tick: 17, at: 1700000000000, kind: 'inference', content: `outcome:${eventId}:verified=false`,
    confidence01: 0.42, source: 'organism', eventId,
  };
  const first = ledger.record(input);
  assert.equal(ledger.record({ ...input, at: input.at + 5000 }), first);
  assert.throws(() => ledger.record({ ...input, content: input.content + ':changed' }), /p65-event-identity-conflict/);
  const restored = new P65EpistemicLedger();
  restored.restore(ledger.snapshot());
  assert.equal(restored.record({ ...input, at: input.at + 6000 }), first);
  assert.throws(() => restored.record({ ...input, confidence01: 0.99 }), /p65-event-identity-conflict/);
  assert.throws(() => ledger.record({ ...input, eventId: 'bad\nid' }), /p65-event-identity-invalid/);
});
