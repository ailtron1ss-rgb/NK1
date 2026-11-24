import assert from 'node:assert/strict';
import { OutcomeCognitionFabric } from '../src/organism/system/OutcomeCognitionFabric.ts';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';
import { CanonicalTemporalCreditAuthority } from '../src/organism/learning/CanonicalTemporalCreditAuthority.ts';
import { ExternalEvidenceTrustEngine } from '../src/organism/system/ExternalEvidenceTrust.ts';
import { ExternalObserverFabric } from '../src/organism/system/ExternalObserverFabric.ts';
import { P84AutobiographicalContinuityFabric } from '../src/organism/developmental/P84AutobiographicalContinuityFabric.ts';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';
import { MemoryLifecycleCommandRecoveryRequiredError } from '../src/organism/memory/MemoryFabric.ts';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';

const verification = (overrides = {}) => ({
  verified: false, basis: 'none', confidence01: 0.15, externalObservation: false, notes: 'unknown-by-default', ...overrides,
});
const outcomeGraph = (outcomes) => outcomes.snapshot().causal;

// UNKNOWN is not negative evidence and must not mutate learning/contradiction state.
{
  const outcomes = new OutcomeCognitionFabric();
  const projected = outcomes.project({ tick: 11, tool: 'test.unobserved', ok: true, executionId: 'exec-unknown', verification: verification() });
  const graph = projected.causal;
  assert.equal(graph.nodes.some(node => node.kind === 'learning'), false, 'unknown outcome must not create learning credit');
  assert.equal(graph.nodes.some(node => node.kind === 'prediction-error'), false, 'missing verification is not prediction error');
  assert.equal(graph.edges.some(edge => edge.relation === 'contradicted'), false, 'unknown outcome must not be labelled contradicted');
  assert.equal(outcomes.causalAutobiography(1)[0].verification, 'unverified');
  const before = graph.nodes.length;
  const replay = outcomes.project({ tick: 11, tool: 'test.unobserved', ok: true, executionId: 'exec-unknown', verification: verification() });
  assert.equal(replay.causal.nodes.length, before, 'replaying an identical outcome cannot duplicate causal nodes');
  assert.throws(() => outcomes.project({ tick: 11, tool: 'test.unobserved', ok: false, executionId: 'exec-unknown', verification: verification() }), /outcome-execution-id-conflict/);
}

// A concrete mismatch is contradictory evidence and should create a bounded negative evidence edge.
{
  const outcomes = new OutcomeCognitionFabric();
  const projected = outcomes.project({ tick: 12, tool: 'test.postcondition', ok: true, executionId: 'exec-mismatch', verification: verification({
    basis: 'external-postcondition', externalObservation: true, observationId: 'obs-mismatch', expectedPostcondition: 'mode=active', observedPostcondition: 'mode=idle', confidence01: 0.88,
  }) });
  assert.ok(projected.causal.nodes.some(node => node.kind === 'prediction-error' && node.data?.executionId === 'exec-mismatch'));
  assert.ok(projected.causal.edges.some(edge => edge.relation === 'contradicted'));
  assert.equal(projected.causal.nodes.some(node => node.kind === 'learning' && node.data?.executionId === 'exec-mismatch'), false, 'one tool-side mismatch records prediction error but cannot assign negative skill credit without independent source evidence');
}

// External evidence must attach to the exact execution, support replay and refuse same-key conflicts.
{
  const outcomes = new OutcomeCognitionFabric();
  outcomes.project({ tick: 20, tool: 'test.same-tool', ok: true, executionId: 'exec-a', verification: verification({ confidence01: 0.3 }) });
  outcomes.project({ tick: 20, tool: 'test.same-tool', ok: true, executionId: 'exec-b', verification: verification({ confidence01: 0.4 }) });
  const observation = { tick: 21, tool: 'test.same-tool', executionId: 'exec-b', observationId: 'obs-b-match', verified: true, confidence01: 0.97, expectedPostcondition: 'relay=on', observedPostcondition: 'relay=on' };
  const first = outcomes.resolveExternalObservation(observation);
  assert.equal(first.resolved, true);
  assert.equal(first.record.executionId, 'exec-b');
  assert.equal(first.record.externalEvidenceStatus, 'corroborated');
  const graph = outcomeGraph(outcomes);
  const outcomeB = graph.nodes.find(node => node.kind === 'outcome' && node.data?.executionId === 'exec-b');
  const verificationB = graph.nodes.find(node => node.kind === 'verification' && node.data?.executionId === 'exec-b' && node.data?.observationId === 'obs-b-match');
  assert.ok(outcomeB && verificationB);
  assert.ok(graph.edges.some(edge => edge.from === outcomeB.id && edge.to === verificationB.id && edge.relation === 'verified-by'));
  const countAfterFirst = graph.nodes.length;
  const replay = outcomes.resolveExternalObservation(observation);
  assert.equal(replay.resolved, true);
  assert.equal(replay.replayed, true);
  assert.equal(outcomeGraph(outcomes).nodes.length, countAfterFirst, 'same observation replay emits no duplicate causal evidence');
  const conflict = outcomes.resolveExternalObservation({ ...observation, observedPostcondition: 'relay=off' });
  assert.equal(conflict.resolved, false);
  assert.equal(conflict.reason, 'observation-replay-conflict');

  const second = outcomes.resolveExternalObservation({ ...observation, observationId: 'obs-b-counter', verified: false, confidence01: 0.92, expectedPostcondition: 'relay=on', observedPostcondition: 'relay=off' });
  assert.equal(second.resolved, true);
  assert.equal(second.record.externalEvidenceStatus, 'mixed', 'contradictory evidence must coexist with prior corroboration, not erase it');
  const graph2 = outcomeGraph(outcomes);
  const verificationA = graph2.nodes.find(node => node.kind === 'verification' && node.data?.executionId === 'exec-a' && node.data?.observationId === 'obs-b-match');
  assert.equal(verificationA, undefined, 'same-named tool evidence must never attach to a different execution');
  assert.equal(outcomes.causalAutobiography(5).find(row => row.executionId === 'exec-b').verification, 'conflicting-external-evidence');
}

// Retired memory command receipts must survive state normalization as Bloom tombstones.
{
  const runtime = new MemorySubsystemRuntime();
  const now = 2_100_000_000_000;
  const input = {
    content: 'WorkPass44 stable canonical memory row.', kind: 'episodic', source: 'workpass44', tags: ['workpass44'], context: { branch: 'memory-lifecycle' },
    salience: .7, emotionalWeight: .1, identityRelevance: .2, goalRelevance: .3, socialRelevance: .1, predictionError: .1,
    confidence: .8, epistemicStatus: 'fact', entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [], validFromAt: now, observedAt: now,
  };
  const item = runtime.fabric.encode(input, { commandId: 'wp44:retired-target', tick: 1 });
  for (let i = 0; i < 530; i++) {
    runtime.fabric.updateContext(item.id, { [`bounded-${i}`]: String(i) }, { commandId: `wp44:eviction:${i}`, tick: i + 2 });
  }
  const fabricSnapshot = runtime.fabric.snapshot();
  assert.equal(fabricSnapshot.mutationReceipts.length, 512);
  assert.ok((fabricSnapshot.retiredMutationReceiptCount ?? 0) > 0);
  assert.ok(typeof fabricSnapshot.retiredMutationReceiptBloom === 'string');
  const migrated = migratePersistedOrganism({ schemaVersion: ORGANISM_STATE_SCHEMA, state: { version: ORGANISM_STATE_SCHEMA, tick: 600 }, facets: { advanced: { memoryOS: runtime.memoryOS.snapshot(), memoryFabric: fabricSnapshot } } });
  const restoredSnapshot = migrated.facets.advanced.memoryFabric;
  assert.equal(restoredSnapshot.retiredMutationReceiptBloom, fabricSnapshot.retiredMutationReceiptBloom, 'state migration must not strip retired receipt tombstones');
  assert.equal(restoredSnapshot.retiredMutationReceiptCount, fabricSnapshot.retiredMutationReceiptCount);
  const restored = new MemorySubsystemRuntime();
  restored.memoryOS.restore(migrated.facets.advanced.memoryOS);
  restored.fabric.restore(restoredSnapshot);
  const before = restored.memoryOS.snapshot({ clone: false }).items.find(row => row.id === item.id).context;
  const eventsBefore = restored.events.list().length;
  assert.throws(() => restored.fabric.encode(input, { commandId: 'wp44:retired-target', tick: 700 }), MemoryLifecycleCommandRecoveryRequiredError,
    'a possibly committed command whose exact receipt expired must require reconciliation rather than mutating again');
  assert.deepEqual(restored.memoryOS.snapshot({ clone: false }).items.find(row => row.id === item.id).context, before);
  assert.equal(restored.events.list().length, eventsBefore);
  assert.equal(restored.fabric.updateContext(item.id, { safeNewCommand: 'new' }, { commandId: 'wp44:new-key', tick: 701 }).safeNewCommand, 'new');
}

// Corrupt tombstones fail closed for unknown keyed commands; existing hot receipts remain replayable.
{
  const runtime = new MemorySubsystemRuntime();
  const now = 2_100_000_000_100;
  const item = runtime.fabric.encode({ content: 'corrupt tombstone guard', kind: 'episodic', source: 'workpass44', tags: [], context: {}, salience: .5, emotionalWeight: 0, identityRelevance: 0, goalRelevance: 0, socialRelevance: 0, predictionError: 0, confidence: .5, epistemicStatus: 'fact', entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [], validFromAt: now, observedAt: now }, { commandId: 'wp44:hot', tick: 1 });
  const snap = runtime.fabric.snapshot();
  runtime.fabric.restore({ ...snap, retiredMutationReceiptCount: 1, retiredMutationReceiptBloom: 'broken' });
  assert.equal(runtime.fabric.encode({ content: 'corrupt tombstone guard', kind: 'episodic', source: 'workpass44', tags: [], context: {}, salience: .5, emotionalWeight: 0, identityRelevance: 0, goalRelevance: 0, socialRelevance: 0, predictionError: 0, confidence: .5, epistemicStatus: 'fact', entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [], validFromAt: now, observedAt: now }, { commandId: 'wp44:hot', tick: 2 }).id, item.id, 'an exact hot receipt remains replayable');
  assert.throws(() => runtime.fabric.updateContext(item.id, { blocked: '1' }, { commandId: 'wp44:unknown-under-corruption', tick: 3 }), MemoryLifecycleCommandRecoveryRequiredError);
}


// Independent external evidence is a distinct CEF node bound to the exact outcome receipt.
{
  const fabric = new CognitiveEventFabric(256);
  const trace = fabric.appendToolReceiptTrace({
    tick: 42, executionId: 'exec-external-wp44', toolId: 'device.relay.set', decisionId: undefined,
    ok: true, verified: false, outcomeClass: 'executed-unverified', confidence01: .4,
    verificationBasis: 'none', externalObservation: true, observationId: 'provider-verifier-42',
    expectedPostcondition: 'private relay state ON', observedPostcondition: 'private relay state OFF',
    observationIntegrated: true, at: 2_100_000_000_042,
  });
  const evidenceInput = {
    tick: 43, executionId: 'exec-external-wp44', toolId: 'device.relay.set', observationId: 'sensor-row-42',
    verified: false, confidence01: .81, sourceId: 'test.sensor.alpha', sourceClass: 'device', channel: 'sensor',
    independenceKey: 'sensor-alpha-device', expectedPostcondition: 'private relay state ON',
    observedPostcondition: 'private relay state OFF', reason: 'postcondition-mismatch', at: 2_100_000_000_043,
  };
  const first = fabric.appendToolExternalObservation(evidenceInput);
  assert.equal(first.resolved, true);
  assert.equal(first.replayed, false);
  const event = fabric.recent(16).find(row => row.id === first.eventId);
  assert.equal(event.stage, 'external-evidence');
  assert.deepEqual(event.parentIds, [trace.outcomeEventId], 'independent evidence must descend from the exact outcome node');
  assert.equal(event.payload.executionId, evidenceInput.executionId);
  assert.equal(event.payload.observationId, evidenceInput.observationId);
  assert.equal(event.payload.evidenceStatus, 'contradicted');
  assert.equal(JSON.stringify(event.payload).includes('private relay state'), false, 'raw postcondition strings must not be copied into CEF payloads');
  const beforeReplay = fabric.snapshot().total;
  const replay = fabric.appendToolExternalObservation(evidenceInput);
  assert.equal(replay.replayed, true);
  assert.equal(replay.eventId, first.eventId);
  assert.equal(fabric.snapshot().total, beforeReplay);
  assert.throws(() => fabric.appendToolExternalObservation({ ...evidenceInput, observedPostcondition: 'private relay state UNKNOWN' }), /external-observation-projection-conflict/);
  assert.equal(fabric.appendToolExternalObservation({ ...evidenceInput, executionId: 'exec-other', observationId: 'sensor-row-other' }).reason, 'no-canonical-tool-receipt');

  const restored = new CognitiveEventFabric(256);
  restored.restore(fabric.snapshot());
  const restoredBefore = restored.snapshot().total;
  const afterRestore = restored.appendToolExternalObservation(evidenceInput);
  assert.equal(afterRestore.replayed, true, 'external evidence projection survives state restore with exact identity');
  assert.equal(afterRestore.eventId, first.eventId);
  assert.equal(restored.snapshot().total, restoredBefore);
  const tampered = restored.snapshot();
  tampered.receiptProjectionIndex = tampered.receiptProjectionIndex.map(row => row.executionId === evidenceInput.executionId ? { ...row, externalObservations: [{ observationId: 'sensor-row-42', eventId: 'missing-event', projectionHash: 'a'.repeat(64), projectedAt: 2_100_000_000_043 }] } : row);
  const guarded = new CognitiveEventFabric(256);
  guarded.restore(tampered);
  assert.equal(guarded.snapshot().receiptProjectionIndex.find(row => row.executionId === evidenceInput.executionId).externalObservations, undefined,
    'restore must reject dangling or mismatched external-evidence replay references');
}


// The same independently verified external observation must not create a second temporal reward or delayed policy update.
{
  const temporal = new CanonicalTemporalCreditAuthority({ gamma01: .88, lambda01: .82, maxHorizonTicks: 8 });
  temporal.registerDecision({ decisionId: 'decision-external-wp44', tick: 10, action: 'explore', contextKey: 'device:relay', predicted01: .45, at: 2_100_000_000_100 });
  const event = {
    decisionId: 'decision-external-wp44', outcomeId: 'external-observation:observation-wp44-01', tick: 13,
    reward01: .95, predictionError01: .45, verified01: .9, independent01: .95, autonomous01: 1, at: 2_100_000_000_103,
  };
  const first = temporal.resolveOutcome(event);
  assert.equal(first.assignments.length, 1);
  assert.equal(first.assignments[0].delayTicks, 3);
  const outcomesAfterFirst = temporal.snapshot().outcomes.length;
  const assignmentsAfterFirst = temporal.snapshot().recentAssignments.length;
  const replay = temporal.resolveOutcome(event);
  assert.equal(replay.replayed, true);
  assert.equal(replay.assignments.length, 0, 'idempotent external replay must not generate new credit assignments');
  assert.equal(temporal.snapshot().outcomes.length, outcomesAfterFirst, 'replay must not duplicate the temporal outcome used by future n-step returns');
  assert.equal(temporal.snapshot().recentAssignments.length, assignmentsAfterFirst);
  assert.throws(() => temporal.resolveOutcome({ ...event, reward01: .1 }), /temporal-outcome-id-conflict/);
  const restored = new CanonicalTemporalCreditAuthority();
  restored.restore(temporal.snapshot());
  const afterRestore = restored.resolveOutcome(event);
  assert.equal(afterRestore.replayed, true, 'temporal outcome identity must survive restore');
  assert.equal(restored.snapshot().outcomes.length, outcomesAfterFirst);
}


// Identical external observations cannot amplify trust counters or autobiographical state a second time.
{
  const trust = new ExternalEvidenceTrustEngine();
  const input = { claimKey: 'relay:actual-state', source: 'device', independenceKey: 'sensor:relay-1', confidence01: .92, at: 2_100_000_000_500, evidenceId: 'observer-row-wp44-1' };
  const first = trust.observe(input);
  assert.equal(first.corroborations, 1);
  const replay = trust.observe(input);
  assert.equal(replay.corroborations, 1, 'an exact observation replay must not count as another corroboration');
  assert.equal(replay.lastSeenAt, first.lastSeenAt);
  assert.throws(() => trust.observe({ ...input, claimKey: 'different-claim' }), /external-evidence-id-conflict/);
  const second = trust.observe({ ...input, evidenceId: 'observer-row-wp44-2', at: input.at + 1 });
  assert.equal(second.corroborations, 2, 'a genuinely new source observation can still add corroboration');
  const restoredTrust = new ExternalEvidenceTrustEngine();
  restoredTrust.restore(trust.snapshot());
  assert.equal(restoredTrust.observe({ ...input, evidenceId: 'observer-row-wp44-2', at: input.at + 1 }).corroborations, 2);

  const observer = new ExternalObserverFabric();
  const observedAt = Date.now();
  const observation = observer.observe({ sourceId: 'test.sensor.replay', sourceClass: 'device', channel: 'sensor', independenceKey: 'sensor-replay-1', claimKey: 'relay:state', observedPostcondition: 'relay state ON', confidence01: .99, observedAt, actionRef: 'exec-observer-replay', tool: 'device.relay.set', payload: { relay: 'ON', sequence: 1 } });
  const assessment = observer.assess(observation.id, 'relay state ON');
  const sourceAfterFirstAssessment = observer.snapshot().sources.find(source => source.id === observation.sourceId);
  observer.assess(observation.id, 'relay state ON');
  const sourceAfterReplay = observer.snapshot().sources.find(source => source.id === observation.sourceId);
  assert.equal(sourceAfterReplay.accepted, sourceAfterFirstAssessment.accepted, 'assessing one observation twice must not increment source acceptance');
  assert.equal(sourceAfterReplay.reliability01, sourceAfterFirstAssessment.reliability01, 'replay must not rewrite source reliability');

  const p84 = new P84AutobiographicalContinuityFabric();
  const moment = { tick: 15, at: observedAt, action: 'external-observation', outcome01: assessment.verified ? 1 : null, observationIds: [observation.id], evidenceIds: [observation.id], idempotencyKey: `external-observation:${observation.id}`, realityHash: 'relay-world-1', realityRevision: 1, realityConfidence01: .9, significance01: .8, changeSummary: 'replay-test' };
  const p84First = p84.ingest(moment);
  const p84Replay = p84.ingest(moment);
  assert.equal(p84Replay.revision, p84First.revision, 'autobiographical evidence ingestion replays without creating another moment');
  p84.learnFromVerifiedOutcome({ action: 'verify', success01: 1, confidence01: .9, evidence01: .9, evidenceId: `external-observation:${observation.id}`, at: observedAt });
  const profileFirst = p84.snapshot().actionOutcomeProfiles.verify;
  const carryoverFirst = p84.snapshot().carryoverRevision;
  p84.learnFromVerifiedOutcome({ action: 'verify', success01: 1, confidence01: .9, evidence01: .9, evidenceId: `external-observation:${observation.id}`, at: observedAt });
  assert.equal(p84.snapshot().actionOutcomeProfiles.verify.samples, profileFirst.samples);
  assert.equal(p84.snapshot().carryoverRevision, carryoverFirst);
  const restoredP84 = new P84AutobiographicalContinuityFabric();
  restoredP84.restore(p84.snapshot());
  restoredP84.learnFromVerifiedOutcome({ action: 'verify', success01: 1, confidence01: .9, evidence01: .9, evidenceId: `external-observation:${observation.id}`, at: observedAt });
  assert.equal(restoredP84.snapshot().carryoverRevision, carryoverFirst, 'outcome learning replay guard survives restore');
}

console.log(JSON.stringify({ ok: true, assertions: 'unknown-vs-contradicted; execution-bound external evidence; CEF evidence replay/restore; temporal reward idempotency; trust/observer/P84 replay; retired receipt fail-closed; migration retention; corruption safety' }));
