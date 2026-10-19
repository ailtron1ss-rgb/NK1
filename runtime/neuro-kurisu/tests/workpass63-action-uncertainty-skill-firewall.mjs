import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { ToolExecutionNoEffectError } from '../src/organism/system/ActionGateway.ts';

process.env.ACTIONS_LIVE = 'false';

// A generic adapter exception after a keyed mutating call must remain ambiguous.
{
  const core = new OrganismCore(new MemoryStateStore(), { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await core.init();
  let externalCommits = 0;
  core.registerActionTool({
    id: 'filesystem.wp63-ambiguous-write', capability: 'filesystem.write', destructive: false,
    requiresIdempotencyKey: true,
    execute: async () => {
      externalCommits++;
      // Simulates a provider accepted the write but its adapter then got a generic
      // network timeout instead of a provider-specific uncertainty exception.
      throw new Error('timeout-after-provider-acceptance');
    },
  });
  const request = await core.requestActionToolApproval('filesystem.wp63-ambiguous-write', { target: 'fixture', value: 'on' }, 'wp63-lost-ack', {
    idempotencyKey: 'wp63:ambiguous:one', decisionId: 'decision:wp63:ambiguous:one',
  }, 'execute');
  assert.equal(request.created, true);
  const approval = await core.resolveActionToolApproval(request.request.id, true);
  assert.equal(approval.ok, true);
  const result = await core.executeTool('filesystem.wp63-ambiguous-write', { target: 'fixture', value: 'on' }, 'wp63-lost-ack', {
    idempotencyKey: 'wp63:ambiguous:one', decisionId: 'decision:wp63:ambiguous:one', approvalId: request.request.id,
  });
  assert.equal(externalCommits, 1);
  assert.equal(result.outcomeClass, 'idempotency-recovery-required', 'a generic error from a keyed mutator is not treated as terminal failure');
  assert.equal(core.actionExecutionLedgerMetrics().hotRecords, 1);
  assert.equal(core.actionRecoveryQueueSnapshot().unresolvedCount, 1);
  assert.equal(core.snapshot().system.actionExecutionLedger.records[0].status, 'pending');
}

// A returned negative response without explicit no-effect evidence is ambiguous too.
{
  const core = new OrganismCore(new MemoryStateStore(), { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await core.init();
  let adapterCalls = 0;
  core.registerActionTool({
    id: 'filesystem.wp63-negative-response', capability: 'filesystem.write', destructive: false,
    requiresIdempotencyKey: true,
    execute: async () => { adapterCalls++; return { ok: false, error: 'remote timeout after acceptance may have happened' }; },
  });
  const request = await core.requestActionToolApproval('filesystem.wp63-negative-response', { target: 'fixture', value: 'on' }, 'wp63-negative-response', {
    idempotencyKey: 'wp63:negative-response:one', decisionId: 'decision:wp63:negative-response:one',
  }, 'execute');
  assert.equal(request.created, true);
  await core.resolveActionToolApproval(request.request.id, true);
  const result = await core.executeTool('filesystem.wp63-negative-response', { target: 'fixture', value: 'on' }, 'wp63-negative-response', {
    idempotencyKey: 'wp63:negative-response:one', decisionId: 'decision:wp63:negative-response:one', approvalId: request.request.id,
  });
  assert.equal(adapterCalls, 1);
  assert.equal(result.outcomeClass, 'idempotency-recovery-required');
  assert.equal(core.snapshot().system.actionExecutionLedger.records[0].status, 'pending');
  assert.equal(core.actionRecoveryQueueSnapshot().unresolvedCount, 1);
}

// Explicit no-effect evidence is terminal and should not poison the recovery queue.
{
  const core = new OrganismCore(new MemoryStateStore(), { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await core.init();
  core.registerActionTool({
    id: 'organism.wp63-no-effect', capability: 'controlled.write', destructive: false,
    requiresIdempotencyKey: true,
    execute: async () => { throw new ToolExecutionNoEffectError('input-validation-before-side-effect'); },
  });
  const result = await core.executeTool('organism.wp63-no-effect', { value: 'invalid' }, 'wp63-definite-no-effect', {
    idempotencyKey: 'wp63:no-effect:one', decisionId: 'decision:wp63:no-effect:one',
  });
  assert.equal(result.outcomeClass, 'failed-no-effect');
  assert.equal(result.ok, false);
  assert.equal(core.actionRecoveryQueueSnapshot().unresolvedCount, 0);
  assert.equal(core.snapshot().system.actionExecutionLedger.records[0].status, 'completed');
}

// Contradicted postconditions must not create repair candidates or invoke a fallback.
{
  const core = new OrganismCore(new MemoryStateStore(), { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
  await core.init();
  let primaryCalls = 0;
  let fallbackCalls = 0;
  core.registerActionTool({
    id: 'organism.wp63-primary', capability: 'controlled.write', destructive: false,
    requiresIdempotencyKey: true,
    execute: async () => { primaryCalls++; return { ok: true, requestedState: 'on' }; },
    verify: async () => ({
      verified: true, basis: 'external-postcondition', externalObservation: true,
      observationId: 'wp63-primary-readback-01', expectedPostcondition: 'target=on',
      observedPostcondition: 'target=off', confidence01: .98,
      notes: 'independent read-back contradicts the requested target state',
    }),
  });
  core.registerActionTool({
    id: 'organism.wp63-fallback', capability: 'controlled.write', destructive: false,
    requiresIdempotencyKey: true,
    execute: async () => { fallbackCalls++; return { ok: true, requestedState: 'on' }; },
    verify: async () => ({ verified: true, basis: 'tool-contract', confidence01: .95, notes: 'fallback fixture' }),
  });
  const compiled = core.compileCompoundSkill({
    projectId: 'wp63-outcome-firewall', name: 'Outcome-firewall fixture', origin: 'test',
    steps: [
      { id: 'write-state', action: 'explore', toolId: 'organism.wp63-primary', input: {}, fallbackToolIds: ['organism.wp63-fallback'] },
      { id: 'confirm-state', action: 'verify', toolId: 'organism.inspect', input: {} },
    ],
  });
  assert.ok(compiled);
  for (let i = 0; i < 6; i++) {
    core.recordCompoundSkillExecution(compiled.id, { success01: 1, verified: true, independent: true, context: `wp63-promote-${i}` });
  }
  const reusable = core.compoundSkillsSnapshot(16).find(row => row.id === compiled.id && row.status === 'reusable');
  assert.ok(reusable, 'fixture skill becomes reusable through verified evidence');
  let repairWrites = 0;
  const library = core.cognitiveRuntime.skillLibrary;
  const recordRepair = library.recordCompoundRepair.bind(library);
  library.recordCompoundRepair = (...args) => { repairWrites++; return recordRepair(...args); };

  const result = await core.executeReusableSkill(reusable.id, { contextKey: 'wp63-contradicted-outcome' }, 'wp63-contradiction', {
    idempotencyKey: 'wp63:skill-invocation:contradiction', decisionId: 'decision:wp63:skill-invocation:contradiction',
  });
  assert.equal(primaryCalls, 1, 'the primary action is entered once');
  assert.equal(fallbackCalls, 0, 'a contradictory/unresolved side effect never triggers a fallback action');
  assert.equal(repairWrites, 0, 'contradictory external evidence is not treated as a skill defect');
  assert.equal(result.results[0].outcomeClass, 'executed-contradicted');
  assert.equal(result.pausedForReconciliation, true);
  assert.equal(result.learningSuppressed, true);
  const queue = core.actionRecoveryQueueSnapshot();
  assert.equal(queue.unresolvedCount, 1, 'completed-but-unverified action remains visible for reconciliation');
  assert.equal(queue.entries[0].toolId, 'organism.wp63-primary');
  assert.equal(queue.entries[0].status, 'outcome-unverified-requires-reconciliation');
  assert.equal(queue.entries[0].outcomeClass, 'executed-contradicted');
}

console.log('WORKPASS63_ACTION_UNCERTAINTY_SKILL_FIREWALL=PASS generic-keyed-exception-pending negative-response-ambiguous explicit-no-effect-terminal contradicted-outcome-no-repair-no-fallback completed-unverified-recovery-queue');
