import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { OutcomeCognitionFabric } from '../src/organism/system/OutcomeCognitionFabric.ts';
import { OutcomeVerificationService, assessExternalPostcondition } from '../src/organism/system/OutcomeVerificationService.ts';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';
import { ExternalObserverFabric } from '../src/organism/system/ExternalObserverFabric.ts';


// A clear same-field mismatch remains high-confidence contradiction evidence; low
// semantic overlap is unknown and must not be promoted into a contradiction.
{
  const observer=new ExternalObserverFabric();
  const known=observer.observe({sourceId:'sensor-a',sourceClass:'device',channel:'sensor',claimKey:'relay-state',observedPostcondition:'relay=OFF',confidence01:1,observedAt:Date.now(),independenceKey:'device-bus-a'});
  const assessed=observer.assess(known.id,'relay=ON');
  assert.equal(assessed.assessment,'mismatch');
  assert.equal(assessed.verified,false);
  assert.ok(assessed.confidence01>=.72, 'clear contradiction confidence must not collapse with similarity');
  const vague=observer.observe({sourceId:'sensor-a',sourceClass:'device',channel:'sensor',claimKey:'relay-state-vague',observedPostcondition:'completely different unstructured narrative',confidence01:1,observedAt:Date.now(),independenceKey:'device-bus-a'});
  const unclear=observer.assess(vague.id,'relay=ON');
  assert.equal(unclear.assessment,'unknown');
  assert.equal(unclear.verified,false);
}

const service = new OutcomeVerificationService();
const mismatch = await service.verify({ toolId: 'organism.write-state', input: { state: 'ON' }, result: { ok: true } }, () => ({
  verified: true, basis: 'external-postcondition', externalObservation: true, confidence01: .91,
  observationId: 'sensor-observation-mismatch-57', expectedPostcondition: 'relay=ON', observedPostcondition: 'relay=OFF',
}));
assert.equal(mismatch.verified, false, 'a credible observation of the wrong state must not mean verified success');
assert.equal(mismatch.basis, 'external-postcondition', 'retain trustworthy contradictory evidence for causal accounting');
assert.equal(mismatch.externalObservation, true);
assert.equal(assessExternalPostcondition(mismatch), 'contradiction');
const incomplete = await service.verify({ toolId: 'organism.write-state', input: {}, result: { ok: true } }, () => ({
  verified: true, basis: 'external-postcondition', externalObservation: true, confidence01: .95, observationId: 'obs-missing-postconditions',
}));
assert.equal(incomplete.verified, false);
assert.equal(assessExternalPostcondition(incomplete), 'not-external', 'incomplete external contracts must fail closed');

// A contradiction at the actual tool gateway is represented as an explicit failed
// postcondition, not as a tool-contract success.
const gateway = new ActionGateway();
gateway.setExecutionLedgerPersister(async () => {});
gateway.registerTool({
  id: 'organism.write-state', capability: 'state write', destructive: false, requiresIdempotencyKey: true,
  execute: async () => ({ ok: true, accepted: true }),
  verify: () => ({ verified: true, basis: 'external-postcondition', externalObservation: true, confidence01: .93,
    observationId: 'sensor-gateway-mismatch-57', expectedPostcondition: 'relay=ON', observedPostcondition: 'relay=OFF' }),
});
const gatewayResult = await gateway.executeTool('organism.write-state', { state: 'ON' }, 'workpass57-contradiction', { idempotencyKey: 'wp57:contradiction:relay' });
assert.equal(gatewayResult.ok, false);
assert.equal(gatewayResult.verified, false);
assert.equal(gatewayResult.outcomeClass, 'executed-contradicted');
assert.equal(gatewayResult.audit.reason, 'external-postcondition-contradicted');
const mismatchFabric = new OutcomeCognitionFabric();
mismatchFabric.project({ tick: 1, tool: 'organism.write-state', ok: false, executionId: 'exec-autobio-mismatch', outcomeClass: 'executed-contradicted', verification: mismatch });
assert.equal(mismatchFabric.causalAutobiography(1)[0].verification, 'externally-contradicted');

const fabric = new OutcomeCognitionFabric(32);
const old = fabric.project({ tick: 1, tool: 'filesystem.write', ok: true, executionId: 'exec-late-observation-57', outcomeClass: 'executed-unverified', verification: { verified: false, basis: 'none', confidence01: 0, externalObservation: false } });
assert.equal(old.verificationRecord.verified, false);
for (let i = 0; i < 120; i++) {
  fabric.project({ tick: i + 2, tool: `organism.inspect-${i}`, ok: true, executionId: `exec-late-filler-${i}`, outcomeClass: 'executed-unverified', verification: { verified: false, basis: 'none', confidence01: 0, externalObservation: false } });
}
assert.equal(fabric.summary().records, 32, 'the user-facing recent record ring remains bounded');
assert.ok(fabric.snapshot().projectionIndex.some(row => row.executionId === 'exec-late-observation-57'), 'the receipt correlation index outlives the short display ring');

const snap = fabric.snapshot();
const migrated = migratePersistedOrganism({ schemaVersion: ORGANISM_STATE_SCHEMA, state: { version: ORGANISM_STATE_SCHEMA, tick: 200 }, system: { outcomeVerification: snap, causalAccountability: snap.causal } });
const restored = new OutcomeCognitionFabric(32);
restored.restore({ ...migrated.system.outcomeVerification, causal: migrated.system.causalAccountability });
const causalBefore = restored.snapshot().causal.nodes.length;
const firstSource = { tick: 200, executionId: 'exec-late-observation-57', tool: 'filesystem.write', observationId: 'external-late-observation-57', verified: false, confidence01: .88, expectedPostcondition: 'file=committed', observedPostcondition: 'file=missing', assessment: 'mismatch', sourceId: 'sensor-device-a', sourceClass: 'device', independenceKey: 'device-controller-a', reason: 'confirmed postcondition mismatch' };
const late = restored.resolveExternalObservation(firstSource);
assert.equal(late.resolved, true, 'late evidence remains correlatable after the source record leaves the recent ring and passes through state migration');
assert.equal(late.replayed, false);
assert.equal(late.record.externalEvidenceStatus, 'contradicted');
assert.ok(late.causal.nodes.some(node => node.kind === 'verification' && node.data?.executionId === 'exec-late-observation-57' && node.data?.contradicted === true));
assert.equal(late.causal.nodes.some(node => node.kind === 'learning' && node.data?.executionId === 'exec-late-observation-57'), false, 'one independent contradiction is evidence, not negative skill credit');
const afterFirst = restored.snapshot().causal.nodes.length;
assert.ok(afterFirst >= causalBefore);
const duplicateLineage = restored.resolveExternalObservation({ ...firstSource, tick: 201, observationId: 'external-late-observation-57-same-lineage', sourceId: 'sensor-device-a-redundant' });
assert.equal(duplicateLineage.resolved, true);
assert.equal(duplicateLineage.causal.nodes.some(node => node.kind === 'learning' && node.data?.executionId === 'exec-late-observation-57'), false, 'two observers sharing one independence key remain one source');
const secondSource = restored.resolveExternalObservation({ ...firstSource, tick: 202, observationId: 'external-late-observation-57-independent', sourceId: 'sensor-device-b', independenceKey: 'independent-device-b' });
assert.equal(secondSource.resolved, true);
const learning = secondSource.causal.nodes.find(node => node.kind === 'learning' && node.data?.executionId === 'exec-late-observation-57');
assert.ok(learning, 'two independent high-confidence contradictions may now assign bounded negative evidence');
assert.equal(learning.data?.independentContradictionSources, 2);
const afterCorroboration = restored.snapshot().causal.nodes.length;
const replay = restored.resolveExternalObservation({ ...firstSource, tick: 203, sourceId: 'sensor-device-b', independenceKey: 'independent-device-b', observationId: 'external-late-observation-57-independent' });
assert.equal(replay.resolved, true);
assert.equal(replay.replayed, true);
assert.equal(restored.snapshot().causal.nodes.length, afterCorroboration, 'replaying delayed evidence cannot create another learning event');

const unknown = restored.resolveExternalObservation({ tick: 202, executionId: 'exec-late-filler-119', tool: 'organism.inspect-119', observationId: 'unknown-only-57', verified: false, confidence01: .2, reason: 'provider returned no postcondition' });
assert.equal(unknown.resolved, true);
assert.equal(unknown.record.externalEvidenceStatus, 'none');
assert.equal(unknown.causal.nodes.some(node => node.kind === 'learning' && node.data?.observationId === 'unknown-only-57'), false, 'unknown evidence is not negative competence feedback');

console.log('WORKPASS57_OUTCOME_CAUSALITY_INDEX=PASS explicit-contradiction late-evidence-after-ring-eviction persisted-correlation replay-dedupe unknown-not-negative-learning');
