import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const config = {
  enableLanguage: false,
  checkpointMinIntervalMs: 0,
  checkpointMaxDirtyCycles: 1,
  cycleResultMode: 'operational',
};
const core = new OrganismCore(new MemoryStateStore(), config);
await core.init();
try {
  const scenario = await core.executeTool('organism.future.scenarios.create', {
    id: 'shared-future-action-integration',
    title: 'Verified action consequence',
    owner: 'system',
    consequences: [{
      id: 'device-ready',
      description: 'The device reaches the requested ready state.',
      probability01: 0.8,
      impact01: 0.9,
    }],
  }, 'create integration scenario', { idempotencyKey: 'sf-action-integration-scenario-v1' });
  assert.equal(scenario.ok, true, JSON.stringify(scenario.result));

  const cycle = await core.observe({ text: 'Prepare a decision for an independently observed action result.' }, 'operational');
  assert.ok(cycle.decision?.id, 'the organism must provide the canonical decision identity');

  core.registerActionTool({
    id: 'observer.shared-future',
    capability: 'test.observation',
    destructive: false,
    execute: async () => ({ ok: true, state: 'ready' }),
  });

  const actionBinding = {
    decisionId: cycle.decision.id,
    toolId: 'observer.shared-future',
    consequenceId: 'device-ready',
    expectedPostcondition: 'state=ready',
  };
  const proposed = await core.executeTool('organism.future.decisions.propose', {
    id: 'shared-future-action-decision',
    scenarioId: 'shared-future-action-integration',
    title: 'Reach and verify device ready state',
    owner: 'system',
    actionBinding,
  }, 'propose bound action decision', { idempotencyKey: 'sf-action-integration-decision-v1' });
  assert.equal(proposed.ok, true, JSON.stringify(proposed.result));
  assert.deepEqual(proposed.result.decision.actionBinding, actionBinding,
    'Shared Future decisions must bind one exact canonical organism decision, tool and consequence');

  const approval = await core.requestActionToolApproval(
    'organism.future.decisions.confirm',
    { decisionId: 'shared-future-action-decision' },
    'confirm the shared future action plan',
    { autonomous: false },
    'execute',
  );
  assert.equal(approval.created, true, JSON.stringify(approval));
  const approvalResolved = await core.resolveActionToolApproval(approval.request.id, true);
  assert.equal(approvalResolved.ok, true, JSON.stringify(approvalResolved));
  const confirmed = await core.executeTool(
    'organism.future.decisions.confirm',
    { decisionId: 'shared-future-action-decision' },
    'confirm the shared future action plan',
    { autonomous: false, approvalId: approval.request.id, idempotencyKey: 'sf-action-integration-confirm-v1' },
  );
  assert.equal(confirmed.ok, true, JSON.stringify(confirmed.result));

  const execution = await core.executeTool(
    'observer.shared-future',
    {},
    'execute action bound to the shared future decision',
    { decisionId: cycle.decision.id },
  );
  assert.equal(execution.ok, true);
  assert.ok(execution.executionId);

  const actionBindingReceipt = core.snapshot().system.sharedFutureActionBindings?.records?.find(
    (row) => row.executionId === execution.executionId,
  );
  assert.ok(actionBindingReceipt, 'the trusted ActionGateway finalizer must persist the execution-to-decision link');
  assert.equal(actionBindingReceipt.actionDecisionId, cycle.decision.id);
  assert.equal(actionBindingReceipt.toolId, 'observer.shared-future');
  assert.equal(actionBindingReceipt.sharedFutureDecisionId, 'shared-future-action-decision');
  assert.equal(actionBindingReceipt.expectedPostcondition, 'state=ready');
  assert.equal(actionBindingReceipt.outcomeClass, 'executed-unverified');

  const feedback = await core.ingestExternalObservation({
    sourceId: 'device-shared-future-a',
    sourceClass: 'device',
    channel: 'sensor',
    independenceKey: 'shared-future-device-a',
    claimKey: 'shared-future:device-ready',
    observedPostcondition: 'state=ready',
    facts: ['state=ready'],
    confidence01: 0.99,
    actionRef: execution.executionId,
    tool: 'observer.shared-future',
    tick: cycle.decision.tick + 1,
    expectedPostcondition: 'state=ready',
    decisionId: cycle.decision.id,
    autonomous: true,
    observedAt: 1_798_000_000_000,
  });
  assert.equal(feedback.temporalReafference?.eligible, true, JSON.stringify(feedback.temporalReafference));
  assert.equal(feedback.sharedFutureOutcome?.recorded, true, JSON.stringify(feedback.sharedFutureOutcome));
  assert.equal(feedback.sharedFutureOutcome?.independentlyVerified, true);

  const listed = await core.executeTool('organism.future.outcomes.list', {
    scenarioId: 'shared-future-action-integration',
  });
  assert.equal(listed.ok, true);
  assert.equal(listed.result.outcomes.length, 1);
  const outcome = listed.result.outcomes[0];
  assert.equal(outcome.occurred, true);
  assert.equal(outcome.forecastProbability01, 0.8);
  assert.equal(outcome.brierScore01, 0.04);
  assert.equal(outcome.authority, 'independent-external');
  assert.equal(outcome.independentlyVerified, true);
  assert.equal(outcome.actionDecisionId, cycle.decision.id);
  assert.equal(outcome.actionToolId, 'observer.shared-future');
  assert.equal(outcome.executionId, execution.executionId);
  assert.equal(outcome.sourceClass, 'device');
  assert.equal(outcome.independenceKey, 'shared-future-device-a');

  await core.flush();
  const persisted = core.snapshot();
  const restarted = new OrganismCore(new MemoryStateStore({ initial: persisted }), config);
  await restarted.init();
  try {
    const restored = await restarted.executeTool('organism.future.outcomes.list', {
      scenarioId: 'shared-future-action-integration',
    });
    assert.equal(restored.result.outcomes.length, 1);
    const restoredOutcomeForDiagnostics = restored.result.outcomes[0];
    assert.equal(
      restarted.snapshot().system.sharedFutureActionBindings?.records?.length,
      1,
      'the canonical execution-to-decision binding must survive the persisted-state migration',
    );
    assert.equal(restored.result.outcomes[0].independentlyVerified, true,
      'independent verification must survive only after it is revalidated against the canonical outcome projection');

    const tampered = structuredClone(persisted);
    tampered.system.outcomeVerification.records = [];
    tampered.system.outcomeVerification.projectionIndex = [];
    const downgraded = new OrganismCore(new MemoryStateStore({ initial: tampered }), config);
    await downgraded.init();
    try {
      const restoredUntrusted = await downgraded.executeTool('organism.future.outcomes.list', {
        scenarioId: 'shared-future-action-integration',
      });
      assert.equal(restoredUntrusted.result.outcomes[0].independentlyVerified, false,
        'removing the canonical evidence projection must downgrade a restored outcome');
    } finally {
      await downgraded.flush();
    }

    const missingActionLink = structuredClone(persisted);
    missingActionLink.system.sharedFutureActionBindings.records = [];
    const downgradedBinding = new OrganismCore(new MemoryStateStore({ initial: missingActionLink }), config);
    await downgradedBinding.init();
    try {
      const restoredWithoutBinding = await downgradedBinding.executeTool('organism.future.outcomes.list', {
        scenarioId: 'shared-future-action-integration',
      });
      assert.equal(restoredWithoutBinding.result.outcomes[0].independentlyVerified, false,
        'removing the trusted ActionGateway execution/decision link must downgrade the restored outcome');
    } finally {
      await downgradedBinding.flush();
    }

    const duplicateActionLink = structuredClone(persisted);
    duplicateActionLink.system.sharedFutureActionBindings.records.push({
      ...actionBindingReceipt,
      id: 'sf-action-link:conflicting-execution-binding',
      actionDecisionId: 'forged-canonical-decision',
    });
    const downgradedDuplicate = new OrganismCore(new MemoryStateStore({ initial: duplicateActionLink }), config);
    await downgradedDuplicate.init();
    try {
      const restoredWithConflictingLink = await downgradedDuplicate.executeTool('organism.future.outcomes.list', {
        scenarioId: 'shared-future-action-integration',
      });
      assert.equal(restoredWithConflictingLink.result.outcomes[0].independentlyVerified, false,
        'a duplicate execution ID with a conflicting decision link must invalidate the correlation');
    } finally {
      await downgradedDuplicate.flush();
    }
  } finally {
    await restarted.flush();
  }

  console.log('SHARED_FUTURE_ACTION_OUTCOME_INTEGRATION=PASS', JSON.stringify({
    decisionId: cycle.decision.id,
    executionId: execution.executionId,
    brierScore01: outcome.brierScore01,
    independentlyVerified: outcome.independentlyVerified,
    restoreRevalidated: true,
    tamperDowngraded: true,
  }));
} finally {
  await core.flush();
}
