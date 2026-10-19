import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

process.env.ACTIONS_LIVE = 'false';
const core = new OrganismCore(new MemoryStateStore(), { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
await core.init();

const proposed = core.agencySubsystem.selfProjects.propose({
  intrinsicOverall: .9, dominant: 'competence', uncertainty: .8, predictionError: .3,
  identityDrift: .1, unresolvedExperiments: 0, activeGoals: [],
});
assert.ok(proposed);
const active = core.agencySubsystem.selfProjects.selectProject(proposed.id);
assert.ok(active);
core.agencySubsystem.projectExecutor.ensure({ id: active.id, origin: active.origin });

let executeCalls = 0;
let reconcileCalls = 0;
core.registerActionTool({
  id: 'test.project-checkpoint-resume', capability: 'test.read', destructive: false,
  projectAllowed: true, requiresIdempotencyKey: true,
  execute: async () => { executeCalls++; return { ok: true, accepted: true, state: 'maybe-changed' }; },
  verify: async () => ({ verified: false, basis: 'none', confidence01: 0, notes: 'fixture-postcondition-not-yet-known' }),
  reconcile: async (_input, context) => {
    reconcileCalls++;
    assert.ok(context.idempotencyKey, 'provider reconciliation receives the original key hash');
    return { status: 'unknown', reason: 'provider-read-after-write-not-yet-available' };
  },
});
const state = core.agencySubsystem.projectExecutor.snapshot();
state.steps[state.cursor].preferredTool = 'test.project-checkpoint-resume';
state.steps[state.cursor].toolInput = {};
core.agencySubsystem.projectExecutor.restore(state);

const first = await core.executeProjectTool('test.project-checkpoint-resume', {}, 'wp60-first-attempt', { idempotencyKey: 'wp60:project-step:attempt-001', decisionId: 'decision:wp60:project-step:attempt-001' });
assert.equal(first.outcomeClass, 'executed-unverified');
assert.equal(executeCalls, 1, 'executor ran once');
let checkpoint = core.agencySubsystem.projectExecutor.snapshot().activeOperation;
assert.ok(checkpoint, 'durable active operation is stored in the project executor snapshot');
assert.equal(checkpoint.stage, 'reconciliation-required');
const originalKey = checkpoint.operationKey;
const originalExecutionId = checkpoint.executionId;
const publicStatus = core.autonomousProjectExecutionStatusSnapshot().activeOperation;
assert.ok(publicStatus, 'active operation is exposed for observability');
assert.equal(Object.hasOwn(publicStatus, 'operationKey'), false, 'secret-like operation key is not exposed to UI');
assert.equal(Object.hasOwn(publicStatus, 'requestFingerprint'), false, 'request fingerprint is not exposed to UI');

// Resume is reconciliation-first: read-only provider check, never action re-execution.
const resumed = await core.executeProjectTool('test.project-checkpoint-resume', {}, 'wp60-resume-after-restart', { idempotencyKey: 'wp60:project-step:attempt-001', decisionId: 'decision:wp60:project-step:attempt-001' });
assert.equal(resumed.outcomeClass, 'idempotency-recovery-required');
assert.equal(executeCalls, 1, 'ambiguous side effect was not repeated');
assert.equal(reconcileCalls, 1, 'read-only provider reconciliation was attempted');
checkpoint = core.agencySubsystem.projectExecutor.snapshot().activeOperation;
assert.equal(checkpoint.operationKey, originalKey);
assert.equal(checkpoint.executionId, originalExecutionId);
assert.equal(checkpoint.stage, 'reconciliation-required');
const resumedStatus = core.autonomousProjectExecutionStatusSnapshot().activeOperation;
assert.equal(Object.hasOwn(resumedStatus, 'operationKey'), false);
assert.equal(Object.hasOwn(resumedStatus, 'requestFingerprint'), false);

// A changed payload remains blocked until the provider result is known.
const different = await core.executeProjectTool('test.project-checkpoint-resume', { alternate: true }, 'wp60-different-request', { idempotencyKey: 'wp60:project-step:attempt-001', decisionId: 'decision:wp60:project-step:attempt-001' });
assert.equal(different.outcomeClass, 'idempotency-recovery-required');
assert.equal(different.result.error, 'project-step-reconciliation-required');
assert.equal(executeCalls, 1, 'changed payload did not repeat side effect');
assert.equal(reconcileCalls, 1, 'changed payload did not redirect the original reconciliation');
console.log('WORKPASS60_PROJECT_RECONCILIATION_RESUME=PASS durable-checkpoint stable-operation-id redacted-status ambiguous-outcome read-only-reconcile no-duplicate-execution changed-request-blocked');
