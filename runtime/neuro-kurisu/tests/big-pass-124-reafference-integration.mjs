import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core = new OrganismCore(new MemoryStateStore(), {
  enableLanguage: false,
  checkpointMinIntervalMs: 0,
  checkpointMaxDirtyCycles: 1,
  cycleResultMode: 'operational',
});
await core.init();
try {
  const cycle = await core.observe({ text: 'Record a decision for a delayed verification fixture.' }, 'operational');
  assert.ok(cycle.decision?.id, 'the canonical cycle must produce a correlationable decision id');
  assert.ok(cycle.decision.agencyEvidence, 'decision must carry the WILL-inspired field projection');
  assert.equal(cycle.decision.agencyEvidence.affectsSelection, false);
  assert.equal(cycle.decision.agencyEvidence.selectionOwner, 'OrganismCore-canonical-arbiters');
  assert.equal(cycle.decision.agencyEvidence.tick, cycle.decision.tick);

  core.registerActionTool({
    id: 'observer.reafference', capability: 'test.observation', destructive: false,
    execute: async () => ({ ok: true, state: 'ready' }),
    verify: async ({ result }) => ({ verified: result?.state === 'ready', basis: 'tool-contract', confidence01: .86, externalObservation: false, notes: 'fixture only' }),
  });
  const execution = await core.executeTool('observer.reafference', {}, 'workpass6-reafference-test');
  assert.ok(execution.ok && execution.executionId);

  const feedback = await core.ingestExternalObservation({
    sourceId: 'device-workpass6', sourceClass: 'device', channel: 'sensor',
    independenceKey: 'external-fixture-device-a', claimKey: 'workpass6:state',
    observedPostcondition: 'state=ready', facts: ['state=ready'], confidence01: .99,
    actionRef: execution.executionId, tool: 'observer.reafference',
    tick: cycle.decision.tick + 1,
    expectedPostcondition: 'state=ready', decisionId: cycle.decision.id, autonomous: true,
  });
  assert.equal(feedback.resolution?.resolved, true, 'external evidence must correlate to the canonical execution receipt');
  assert.equal(feedback.temporalReafference?.eligible, true, JSON.stringify(feedback.temporalReafference));
  assert.equal(feedback.temporalReafference?.direction, 'confirmed');
  assert.equal(feedback.temporalReafference?.assignments, 1, 'explicit reafference must resolve exactly one target decision');
  assert.equal(feedback.temporalReafference?.appliedDelayedAssignments, 1, 'independent delayed credit must return through the existing adaptive policy owner');
  const verifiedEpisode = core.snapshot().facets.advanced.memoryOS.items.find((row) => row.source === 'verified-external-action-outcome' && row.context?.observationId === feedback.observation.id);
  assert.ok(verifiedEpisode, 'grounded external consequence must be recorded in the single canonical MemoryOS2 as an episodic memory');
  assert.equal(verifiedEpisode.kind, 'episodic');
  assert.equal(verifiedEpisode.epistemicStatus, 'fact');
  assert.equal(verifiedEpisode.context?.decisionId, cycle.decision.id, 'episode preserves exact decision provenance');
  assert.equal(verifiedEpisode.context?.executionId, execution.executionId, 'episode preserves receipt correlation');
  assert.equal(verifiedEpisode.independenceKey, 'external-fixture-device-a');
  assert.ok(verifiedEpisode.evidenceSources?.some((source) => source.source === `external-observation:${feedback.observation.id}`));
  assert.ok(core.canonicalTemporalCreditDiagnostics().resolvedDecisions >= 1);
  assert.equal(core.canonicalTemporalCreditDiagnostics().openDecisions, 0);

  // Evidence must survive the canonical persisted-trace path and restart.
  const persisted = core.snapshot();
  const persistedTrace = persisted.traces.find((row) => row.id === cycle.decision.id);
  assert.ok(persistedTrace?.agencyEvidence, 'agency evidence must be carried by the persisted decision trace');
  assert.equal(persistedTrace.agencyEvidence.selectedCandidateId, cycle.decision.agencyEvidence.selectedCandidateId);
  const restarted = new OrganismCore(new MemoryStateStore({ initial: persisted }), {
    enableLanguage: false, checkpointMinIntervalMs: 0, checkpointMaxDirtyCycles: 1, cycleResultMode: 'operational',
  });
  await restarted.init();
  try {
    const restartedTrace = restarted.consolidationInputSnapshot().traces.find((row) => row.id === cycle.decision.id);
    const restartedEpisode = restarted.snapshot().facets.advanced.memoryOS.items.find((row) => row.context?.observationId === feedback.observation.id);
    assert.ok(restartedEpisode, 'verified action memory survives restart');
    assert.equal(restartedEpisode.context?.decisionId, cycle.decision.id);
    assert.ok(restartedTrace?.agencyEvidence, 'agency evidence must survive migration and restart');
    assert.equal(restartedTrace.agencyEvidence.version, 1);
    assert.equal(restartedTrace.agencyEvidence.affectsSelection, false);
  } finally {
    await restarted.flush();
  }

  await core.flush();
  console.log('BIG_PASS_124_REAFFERENCE_INTEGRATION=PASS', JSON.stringify({ decisionId: cycle.decision.id, action: cycle.decision.selected?.action, affordances: cycle.decision.agencyEvidence.affordances.length, persisted: Boolean(persistedTrace?.agencyEvidence), restarted: true, temporal: feedback.temporalReafference }));
} finally {
  await core.flush();
}
