import assert from 'node:assert/strict';
import {
  ActionGateway,
  ToolExecutionUncertainError,
} from '../src/organism/system/ActionGateway.ts';

const BEFORE = 'a'.repeat(64);
const AFTER = 'b'.repeat(64);
const OTHER = 'c'.repeat(64);
const ORIGINAL_KEY = 'undo-first:relay:operation-01';

function makeGateway({ prepare = true, stateHash = BEFORE, uncertain = false } = {}) {
  const gateway = new ActionGateway({ live: true });
  const events = [];
  const state = { hash: stateHash };
  const counts = { mutation: 0, compensation: 0, preparation: 0 };
  let durableSnapshot = { version: 1, records: [] };

  gateway.setExecutionLedgerPersister(async (snapshot) => {
    durableSnapshot = structuredClone(snapshot);
    const pending = snapshot.records?.find((row) =>
      row.toolId === 'test.undo.mutate' && row.status === 'pending'
    );
    if (pending) {
      events.push('pending-persist');
      if (prepare) assert.ok(pending.undoPlan, 'undo plan must be durable before executor entry');
    }
  });

  gateway.registerTool({
    id: 'test.undo.state-read',
    capability: 'state.read',
    destructive: false,
    execute: async () => ({ stateHash: state.hash }),
    verify: async ({ result }) => ({
      verified: true,
      basis: 'external-postcondition',
      confidence01: 1,
      externalObservation: true,
      observationId: `readback-${String(result.stateHash).slice(0, 12)}`,
      expectedPostcondition: String(result.stateHash),
      observedPostcondition: String(result.stateHash),
      notes: 'independent read-only state fingerprint',
    }),
  });

  gateway.registerTool({
    id: 'test.undo.restore',
    capability: 'state.write',
    destructive: false,
    requiresIdempotencyKey: true,
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
    execute: async () => {
      events.push('compensate');
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
    ...(prepare ? {
      undoFirst: {
        prepare: async (_input, context) => {
          counts.preparation += 1;
          events.push('prepare');
          assert.match(context.executionId, /^exec-/);
          assert.match(context.idempotencyKey, /^[a-f0-9]{64}$/);
          return {
            version: 1,
            strategy: 'compensate',
            summary: 'restore relay-01 to its exact captured pre-action state',
            beforeStateHash: BEFORE,
            afterStateHash: AFTER,
            compensation: {
              toolId: 'test.undo.restore',
              input: { target: 'relay-01', stateHash: BEFORE },
            },
            verification: {
              toolId: 'test.undo.state-read',
              input: { target: 'relay-01' },
            },
          };
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
    execute: async () => {
      events.push('execute');
      counts.mutation += 1;
      if (uncertain) throw new ToolExecutionUncertainError('provider timed out after send');
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

console.log('UNDO_FIRST_ACTION_GATEWAY=PASS cases=6');
