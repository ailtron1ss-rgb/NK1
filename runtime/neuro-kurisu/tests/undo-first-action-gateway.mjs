import assert from 'node:assert/strict';
import {
  ActionGateway,
  ToolExecutionUncertainError,
  ToolExecutionNoEffectError,
} from '../src/organism/system/ActionGateway.ts';

const BEFORE = 'a'.repeat(64);
const AFTER = 'b'.repeat(64);
const OTHER = 'c'.repeat(64);
const ORIGINAL_KEY = 'undo-first:relay:operation-01';

function makeGateway({ prepare = true, stateHash = BEFORE, uncertain = false, driftDuringPreparation = false, driftAfterPreconditionRead = false, failPendingPersist = false, ledgerFull = false, maxIdempotencyRecords = 64 } = {}) {
  const gateway = new ActionGateway({ live: true, maxIdempotencyRecords });
  const events = [];
  const state = { hash: stateHash };
  const counts = { mutation: 0, compensation: 0, preparation: 0, cleanup: 0 };
  let durableSnapshot = { version: 1, records: [] };

  gateway.setExecutionLedgerPersister(async (snapshot) => {
    const pending = snapshot.records?.find((row) =>
      row.toolId === 'test.undo.mutate' && row.status === 'pending'
    );
    if (pending) {
      events.push('pending-persist');
      if (prepare) assert.ok(pending.undoPlan, 'undo plan must be durable before executor entry');
      if (failPendingPersist) throw new Error('simulated-durable-ledger-write-failure');
    }
    durableSnapshot = structuredClone(snapshot);
  });
  if (ledgerFull) gateway.restoreExecutionLedger({
    version: 1,
    records: [{
      keyHash: 'd'.repeat(64),
      requestHash: 'e'.repeat(64),
      status: 'pending',
      recordedAt: 1,
      executionId: 'exec-prefilled-receipt',
      toolId: 'test.undo.preexisting',
    }],
  });

  gateway.registerTool({
    id: 'test.undo.state-read',
    capability: 'state.read',
    destructive: false,
    execute: async () => ({ stateHash: state.hash }),
    verify: async ({ result }) => {
      if (driftAfterPreconditionRead) state.hash = OTHER;
      return {
        verified: true,
        basis: 'external-postcondition',
        confidence01: 1,
        externalObservation: true,
        observationId: `readback-${String(result.stateHash).slice(0, 12)}`,
        expectedPostcondition: String(result.stateHash),
        observedPostcondition: String(result.stateHash),
        notes: 'independent read-only state fingerprint',
      };
    },
  });

  gateway.registerTool({
    id: 'test.undo.restore',
    capability: 'state.write',
    destructive: false,
    requiresIdempotencyKey: true,
    supportsAtomicUndoPrecondition: true,
    verify: async () => ({
      verified: true,
      basis: 'tool-contract',
      confidence01: 1,
      externalObservation: false,
      notes: 'compensation tool contract accepted the state reset',
    }),
    reconcile: async () => ({
      status: 'unknown',
      reason: 'test provider cannot yet resolve this compensation receipt',
    }),
    execute: async (input, context) => {
      events.push('compensate');
      assert.equal(context.expectedPreconditionHash, AFTER, 'compensator receives the expected post-action fingerprint for an atomic compare-and-set');
      assert.equal(input.recoveryArtifactRef, 'snapshot:relay-01:before-v17', 'durable recovery artifact handle reaches the provider compensator');
      if (state.hash !== context.expectedPreconditionHash) throw new ToolExecutionNoEffectError('state changed before compensation');
      counts.compensation += 1;
      state.hash = BEFORE;
      return { accepted: true };
    },
  });

  gateway.registerTool({
    id: 'test.undo.mutate',
    capability: 'state.write',
    destructive: false,
    requiresUndoFirst: true,
    supportsAtomicUndoPrecondition: true,
    ...(prepare ? {
      undoFirst: {
        prepare: async (_input, context) => {
          counts.preparation += 1;
          events.push('prepare');
          assert.match(context.executionId, /^exec-/);
          assert.match(context.idempotencyKey, /^[a-f0-9]{64}$/);
          const plan = {
            version: 1,
            strategy: 'compensate',
            summary: 'restore relay-01 to its exact captured pre-action state',
            beforeStateHash: BEFORE,
            afterStateHash: AFTER,
            recoveryArtifactRef: 'snapshot:relay-01:before-v17',
            compensation: {
              toolId: 'test.undo.restore',
              input: { target: 'relay-01', stateHash: BEFORE, recoveryArtifactRef: 'snapshot:relay-01:before-v17' },
            },
            verification: {
              toolId: 'test.undo.state-read',
              input: { target: 'relay-01' },
            },
          };
          if (driftDuringPreparation) state.hash = OTHER;
          return plan;
        },
        discardPrepared: async (recoveryArtifactRef, context) => {
          events.push('discard-prepared');
          assert.equal(recoveryArtifactRef, 'snapshot:relay-01:before-v17');
          assert.match(context.executionId, /^exec-/);
          counts.cleanup += 1;
        },
      },
    } : {}),
    verify: async () => ({
      verified: true,
      basis: 'tool-contract',
      confidence01: 1,
      externalObservation: false,
      notes: 'primary action output contract is valid; independent state fingerprint is checked by the undo verifier',
    }),
    execute: async (_input, context) => {
      events.push('execute');
      assert.equal(context.expectedPreconditionHash, BEFORE, 'primary adapter receives the preflight state for atomic compare-and-set');
      if (uncertain) throw new ToolExecutionUncertainError('provider timed out after send');
      if (state.hash !== context.expectedPreconditionHash) throw new ToolExecutionNoEffectError('captured state changed before mutation');
      counts.mutation += 1;
      state.hash = AFTER;
      return { accepted: true };
    },
  });

  return { gateway, events, state, counts, getSnapshot: () => structuredClone(durableSnapshot) };
}

// Missing preparation is a pre-execution refusal, not a warning after the side effect.
{
  const { gateway, counts } = makeGateway({ prepare: false });
  const result = await gateway.executeTool(
    'test.undo.mutate',
    { target: 'relay-01' },
    'missing-undo-plan',
    { idempotencyKey: 'undo-first:missing-plan' },
  );
  assert.equal(result.outcomeClass, 'undo-plan-required');
  assert.equal(counts.mutation, 0);
}

// The recovery plan must be prepared and durably committed before the side effect.
{
  const { gateway, events, state, counts, getSnapshot } = makeGateway();
  const result = await gateway.executeTool(
    'test.undo.mutate',
    { target: 'relay-01' },
    'undo-first-ordering',
    { idempotencyKey: ORIGINAL_KEY },
  );
  assert.equal(result.outcomeClass, 'executed-verified');
  assert.equal(counts.preparation, 1);
  assert.equal(counts.mutation, 1);
  assert.ok(events.indexOf('prepare') < events.indexOf('pending-persist'));
  assert.ok(events.indexOf('pending-persist') < events.indexOf('execute'));
  const pendingPlan = getSnapshot().records.find((row) => row.toolId === 'test.undo.mutate');
  assert.equal(pendingPlan.status, 'completed');
  assert.equal(pendingPlan.undoPlan.beforeStateHash, BEFORE);
  assert.equal(pendingPlan.undoPlan.afterStateHash, AFTER);
  assert.equal(pendingPlan.undoPlan.recoveryArtifactRef, 'snapshot:relay-01:before-v17');
  assert.match(pendingPlan.undoPlan.planHash, /^[a-f0-9]{64}$/);

  const undo = await gateway.executeUndoForKey(ORIGINAL_KEY, 'restore relay after verified mutation');
  assert.equal(undo.status, 'restored');
  assert.equal(state.hash, BEFORE);
  assert.equal(counts.compensation, 1);

  const repeated = await gateway.executeUndoForKey(ORIGINAL_KEY, 'duplicate restore request');
  assert.equal(repeated.status, 'already-restored');
  assert.equal(counts.compensation, 1, 'a repeated undo request must not repeat the compensating side effect');
}

// A plan that points to an unknown or unsafe recovery tool must block the original action.
{
  const gateway = new ActionGateway({ live: true });
  let effects = 0;
  gateway.setExecutionLedgerPersister(async () => {});
  gateway.registerTool({
    id: 'test.undo.invalid',
    capability: 'state.write',
    destructive: false,
    requiresUndoFirst: true,
    undoFirst: {
      prepare: async () => ({
        version: 1,
        strategy: 'compensate',
        summary: 'invalid unknown compensator',
        beforeStateHash: BEFORE,
        afterStateHash: AFTER,
        compensation: { toolId: 'missing.restore', input: {} },
        verification: { toolId: 'test.undo.state-read', input: {} },
      }),
    },
    execute: async () => { effects += 1; return { accepted: true }; },
  });
  const result = await gateway.executeTool(
    'test.undo.invalid', {}, 'invalid-undo-plan',
    { idempotencyKey: 'undo-first:invalid-plan' },
  );
  assert.equal(result.outcomeClass, 'undo-plan-invalid');
  assert.equal(effects, 0);
}

// A changed external state is never overwritten by a stale compensator.
{
  const { gateway, state, counts } = makeGateway();
  const result = await gateway.executeTool(
    'test.undo.mutate', { target: 'relay-01' }, 'state-drift',
    { idempotencyKey: 'undo-first:state-drift' },
  );
  assert.equal(result.outcomeClass, 'executed-verified');
  state.hash = OTHER;
  const undo = await gateway.executeUndoForKey('undo-first:state-drift', 'stale undo');
  assert.equal(undo.status, 'state-diverged');
  assert.equal(counts.compensation, 0);
  assert.equal(state.hash, OTHER);
}

// Ambiguous original effects stay pending; undo must wait for authoritative reconciliation.
{
  const { gateway, counts, getSnapshot } = makeGateway({ uncertain: true });
  const result = await gateway.executeTool(
    'test.undo.mutate', { target: 'relay-01' }, 'ambiguous-original',
    { idempotencyKey: 'undo-first:ambiguous' },
  );
  assert.equal(result.outcomeClass, 'idempotency-recovery-required');
  assert.equal(getSnapshot().records[0].status, 'pending');
  const undo = await gateway.executeUndoForKey('undo-first:ambiguous', 'do not guess');
  assert.equal(undo.status, 'operation-unresolved');
  assert.equal(counts.compensation, 0);
}

// The recovery plan survives ledger restore and remains bound to the original execution.
{
  const first = makeGateway();
  const result = await first.gateway.executeTool(
    'test.undo.mutate', { target: 'relay-01' }, 'restore-roundtrip',
    { idempotencyKey: 'undo-first:restore-roundtrip' },
  );
  assert.equal(result.outcomeClass, 'executed-verified');
  const snapshot = first.getSnapshot();
  const second = makeGateway({ stateHash: AFTER });
  second.gateway.restoreExecutionLedger(snapshot);
  const undo = await second.gateway.executeUndoForKey('undo-first:restore-roundtrip', 'undo after process restart');
  assert.equal(undo.status, 'restored');
  assert.equal(second.state.hash, BEFORE);
  assert.equal(second.counts.compensation, 1);
}


// A concurrent change between prepare() and primary execution must be caught by the
// adapter's atomic compare-and-set, rather than overwritten by a stale action.
{
  const { gateway, state, counts } = makeGateway({ driftDuringPreparation: true });
  const result = await gateway.executeTool(
    'test.undo.mutate', { target: 'relay-01' }, 'preflight-race',
    { idempotencyKey: 'undo-first:preflight-race' },
  );
  assert.equal(result.outcomeClass, 'failed-no-effect');
  assert.equal(counts.mutation, 0);
  assert.equal(state.hash, OTHER);
}

// The canonical request fingerprint for legacy keyed operations must remain byte-for-byte
// compatible when no atomic precondition is supplied.
{
  const { sha256Stable } = await import('../src/organism/core/StableSerialization.ts');
  const gateway = new ActionGateway();
  const input = { target: 'legacy-read' };
  const toolId = 'test.undo.legacy-read';
  const key = 'legacy-receipt-no-precondition';
  let persisted;
  gateway.setExecutionLedgerPersister(async snapshot => { persisted = structuredClone(snapshot); });
  gateway.registerTool({
    id: toolId,
    capability: 'state.read',
    destructive: false,
    execute: async () => ({ value: 'stable' }),
  });
  const result = await gateway.executeTool(toolId, input, 'legacy-format', { idempotencyKey: key });
  assert.equal(result.outcomeClass, 'executed-unverified');
  const expectedOldHash = sha256Stable({
    toolId,
    input,
    expectedOutputKeys: null,
    decisionId: null,
    autonomous: false,
  });
  assert.equal(persisted.records[0].requestHash, expectedOldHash, 'legacy receipt fingerprints stay stable when no expected precondition is used');
}


// A state change after the independent readback but before compensation must be
// rejected by the compensator's atomic compare-and-set, not overwritten.
{
  const { gateway, state, counts } = makeGateway({ driftAfterPreconditionRead: true });
  const result = await gateway.executeTool(
    'test.undo.mutate', { target: 'relay-01' }, 'compensation-race',
    { idempotencyKey: 'undo-first:compensation-race' },
  );
  assert.equal(result.outcomeClass, 'executed-verified');
  const undo = await gateway.executeUndoForKey('undo-first:compensation-race', 'raced compensation');
  assert.equal(undo.status, 'state-diverged');
  assert.equal(counts.compensation, 0);
  assert.equal(state.hash, OTHER);
}

// A ledger-capacity refusal happens before the pending persister is called, so
// the preflight snapshot is definitely orphaned and must be released.
{
  const { gateway, counts, events } = makeGateway({ ledgerFull: true, maxIdempotencyRecords: 1 });
  const result = await gateway.executeTool(
    'test.undo.mutate',
    { target: 'relay-01' },
    'ledger-capacity-refusal',
    { idempotencyKey: 'undo-first:ledger-capacity-refusal' },
  );
  assert.equal(result.outcomeClass, 'idempotency-ledger-full');
  assert.equal(counts.mutation, 0);
  assert.equal(counts.cleanup, 1);
  assert.ok(events.includes('discard-prepared'));
  assert.equal(events.includes('pending-persist'), false);
}

// A rejected persister call has an ambiguous commit outcome; keep the recovery
// artifact because the pending receipt may already be durable despite a lost ACK.
{
  const { gateway, counts, events } = makeGateway({ failPendingPersist: true });
  const result = await gateway.executeTool(
    'test.undo.mutate',
    { target: 'relay-01' },
    'ambiguous-ledger-write',
    { idempotencyKey: 'undo-first:ambiguous-ledger-write' },
  );
  assert.equal(result.outcomeClass, 'idempotency-storage-failed');
  assert.equal(counts.mutation, 0);
  assert.equal(counts.cleanup, 0);
  assert.ok(events.includes('pending-persist'));
  assert.equal(result.result.recoveryArtifactDisposition, 'retained-after-ambiguous-persist');
}

console.log('UNDO_FIRST_ACTION_GATEWAY=PASS cases=11');
