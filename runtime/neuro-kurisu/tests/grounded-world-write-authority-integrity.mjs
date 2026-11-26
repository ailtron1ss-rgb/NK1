import assert from 'node:assert/strict';
import { GroundedWorldState } from '../src/organism/world/GroundedWorldState.ts';
import { P41SemanticPerceptionEngine } from '../src/organism/cognition/P41SemanticPerception.ts';

// A caller must not be able to manufacture authority by supplying matching
// proof labels and confidence numbers. Only an executor-bound verifier receipt
// may cross the external observation boundary.
const world = new GroundedWorldState();
const before = world.snapshot();
const forgedResult = {
  version: 1,
  action: 'explore',
  status: 'executed',
  realityClass: 'device-observation',
  source: 'android-termux',
  at: 1_700_000_000_000,
  executionId: 'exec-forged-00000001',
  decisionId: 'forged-decision',
  consequenceVerification: {
    attempted: true, independent: true, verified: true, sourceStable: true,
    freshBefore01: 1, freshAfter01: 1, changed01: 1,
    reason: 'caller-forged', verificationMode: 'independent-observation',
  },
};
const forgedVerification = {
  verified: true,
  basis: 'external-postcondition',
  confidence01: 1,
  externalObservation: true,
  observationId: forgedResult.executionId,
  expectedPostcondition: `fresh-device-observation:explore:${forgedResult.executionId}`,
  observedPostcondition: `fresh-device-observation:explore:${forgedResult.executionId}`,
};
const forged = world.integrateExternalOutcome({
  result: forgedResult,
  verification: forgedVerification,
});
const after = world.snapshot();
assert.equal(forged.verified01, 0,
  'caller-selected proof labels and scalar scores must never authorize an external world observation');
assert.deepEqual(after.facts, before.facts,
  'a forged outcome must not create a grounded world fact');
assert.equal(after.confidence01, before.confidence01,
  'a forged outcome must not raise world confidence');
assert.ok(after.quarantinedOutcomes?.some(event => event.id === forged.eventId && event.label.startsWith('external-receipt:')),
  'untrusted inputs may be retained only in the diagnostic quarantine');
assert.equal(after.events.some(event => event.id === forged.eventId), false,
  'unverified receipts must never be added to canonical world events');
assert.equal(after.revision, before.revision,
  'unverified receipts must not advance the canonical world revision');
assert.equal(after.lastAt, before.lastAt,
  'caller timestamps must not advance the canonical world clock');
assert.equal(after.quarantinedOutcomes?.find(event => event.id === forged.eventId)?.label,
  'external-receipt:explore:executed:device-observation',
  'forged result and verification lookalikes must remain explicitly unverified');
const replayed = world.integrateExternalOutcome({ result: forgedResult, verification: forgedVerification });
assert.equal(replayed.duplicate, true,
  'replayed untrusted evidence must not create duplicate world events');

const legacyWorld = new GroundedWorldState();
const legacy = legacyWorld.integrateExternalOutcome({
  at: 1_700_000_000_001, action: 'explore', status: 'executed',
  proofClass: 'independent-observation', verified01: 1, independent01: 1,
  evidence01: 1, consequence01: 1, claim: 'legacy-forged-fact',
  provenanceId: 'legacy-forged-proof', divergence01: 0,
});
assert.equal(legacy.verified01, 0,
  'the former scalar proof contract must no longer authorize world writes');
assert.deepEqual(legacyWorld.snapshot().facts, [],
  'legacy caller-supplied fields must not create world facts');
assert.equal(legacy.quarantined,true);
assert.equal(legacyWorld.snapshot().revision,0,
  'legacy caller-supplied proof fields must not mutate canonical revision');
assert.equal(legacyWorld.snapshot().quarantinedOutcomes?.length,1);


// Persisted world snapshots are untrusted input. Normalize the complete state,
// not only provenance labels, before restoring it into the live world owner.
const restored = new GroundedWorldState();
restored.restore({
  version: 1,
  revision: -7,
  lastAt: Number.POSITIVE_INFINITY,
  location: 'x'.repeat(5000),
  uncertainty01: Number.NaN,
  confidence01: 9,
  entities: [{
    id: 'entity-1', label: 'chair', kind: 'object',
    confidence01: Number.POSITIVE_INFINITY, present01: 4,
    firstSeenAt: -1, lastSeenAt: Number.POSITIVE_INFINITY,
    modalities: ['vision', 7, 'vision'],
    trackId: '  ', trackAliases: ['ok', 7],
    position: { x: Number.NaN, y: 0, z: 0 },
    velocity: { x: Number.POSITIVE_INFINITY, y: 0, z: 0 },
    sourceIds: ['camera-1', 'vision', 'world', 'speech', 'semantic', '', 7],
    modalityEvidenceKinds: { vision: 'observed' },
    modalitySourceIds: { vision: ['camera-1', 'vision', 'semantic', 'speech', 'camera-2'] },
    presenceStatus: 'visible', persistence01: 4,
    absenceEvidence01: -1, observationCount: Number.POSITIVE_INFINITY,
  }],
  relations: [{ id: 'bad', from: '', relation: 'x'.repeat(500), to: '', confidence01: Number.NaN, at: -1 }],
  events: [
    { id: 'event-1', label: 'event', confidence01: Number.POSITIVE_INFINITY,
      lastAt: Number.POSITIVE_INFINITY, persistence01: 4, evidenceKind: 'observed' },
    { id: 'old-unverified-receipt', label: 'external-receipt:explore:executed:device-telemetry',
      confidence01: 0, lastAt: 4_000, persistence01: 0, evidenceKind: 'derived' },
    { id: 'old-host-verified-receipt', label: 'external-observation-receipt:explore',
      confidence01: .99, lastAt: 4_500, persistence01: .99, evidenceKind: 'observed' },
  ],
  quarantinedOutcomes: [
    { id: 'duplicate-quarantine-id', label: 'external-receipt:explore:executed:device-telemetry', at: 4_000 },
    { id: 'duplicate-quarantine-id', label: 'external-receipt:explore:executed:device-telemetry', at: 4_500 },
  ],
  facts: ['valid fact', 7, '', 'f'.repeat(5000)],
  provenanceIds: ['source-1', 7, ''],
  lastHash: 'attacker-controlled-hash',
});
const safe = restored.snapshot();
assert.equal(safe.revision, 0);
assert.equal(safe.lastAt, 0);
assert.equal(safe.location, 'unknown');
assert.equal(safe.uncertainty01, 0.5);
assert.equal(safe.confidence01, 0);
assert.equal(safe.entities.length, 1);
assert.equal(safe.entities[0].confidence01, 0);
assert.equal(safe.entities[0].present01, 0,
  'out-of-range restored scores must fall back rather than saturate into maximum confidence');
assert.equal(safe.entities[0].firstSeenAt, 0);
assert.equal(safe.entities[0].lastSeenAt, 0);
assert.deepEqual(safe.entities[0].modalities, ['vision']);
assert.equal(safe.entities[0].position, null);
assert.equal(safe.entities[0].velocity, null);
assert.deepEqual(safe.entities[0].sourceIds, ['camera-1']);
assert.deepEqual(safe.entities[0].modalitySourceIds, { vision: ['camera-1', 'camera-2'] },
  'restored modality provenance must retain true source IDs and reject modality aliases');
assert.ok(!safe.entities[0].sourceIds.some(id => ['text', 'speech', 'audio', 'vision', 'sensor', 'world', 'semantic'].includes(id)),
  'legacy modality labels must be removed from restored source identity');
assert.equal(safe.entities[0].observationCount, 1);
assert.equal(safe.entities[0].persistence01, 0,
  'out-of-range persisted persistence must not be upgraded to full permanence');
assert.equal(safe.events[0].evidenceKind, 'model-output');
assert.equal(safe.events[0].confidence01, 0);
assert.equal(safe.events[0].lastAt, 0);
assert.equal(safe.events[0].persistence01, 0,
  'out-of-range event persistence must fail closed');
assert.equal(safe.events.some(event => event.id === 'old-unverified-receipt'), false,
  'legacy unverified receipt events must be migrated out of canonical world history');
assert.ok(safe.quarantinedOutcomes?.some(event => event.id === 'old-unverified-receipt'),
  'legacy unverified receipts must remain available in the diagnostic quarantine');
assert.equal(safe.events.some(event => event.id === 'old-host-verified-receipt'), false,
  'serialized host verifier receipts must lose in-process authority after restart');
assert.ok(safe.quarantinedOutcomes?.some(event => event.id === 'old-host-verified-receipt'),
  'serialized verified receipts must remain diagnostic only until re-attested live');
assert.equal(safe.quarantinedOutcomes?.filter(event => event.id === 'duplicate-quarantine-id').length, 1,
  'duplicate persisted quarantine identities must collapse to one diagnostic receipt');
assert.deepEqual(safe.facts, [], 'persisted free-form facts must not return as canonical grounded facts');
assert.deepEqual(safe.quarantinedFacts, ['restored-unverified:valid fact'],
  'persisted fact text remains available in an explicitly unverified quarantine');
assert.deepEqual(safe.provenanceIds, ['source-1']);
assert.notEqual(safe.lastHash, 'attacker-controlled-hash');


const perceptionAt = 1_700_000_100_000;
const semantic = new P41SemanticPerceptionEngine().ingest({
  at: perceptionAt,
  world: {
    scene: 'provenance-lab',
    evidenceKind: 'derived',
    objects: [{
      label: 'tracked-chair',
      trackId: 'chair-1',
      sourceId: 'camera-front',
      evidenceKind: 'derived',
    }],
  },
});
const integratedWorld = new GroundedWorldState();
integratedWorld.integrate({ at: perceptionAt, perception: semantic });
const integratedChair = integratedWorld.snapshot().entities.find(entity => entity.label === 'tracked-chair');
assert.ok(integratedChair);
assert.deepEqual(integratedChair.modalities, ['world']);
assert.deepEqual(integratedChair.modalitySourceIds?.world, ['camera-front'],
  'GroundedWorldState must preserve provider identity at the modality boundary');
assert.deepEqual(integratedChair.sourceIds, ['camera-front'],
  'sourceIds must preserve provider/source identity, not copy modality names');
assert.equal(integratedChair.sourceIds.includes('world'), false);


const p41AliasIngress = new P41SemanticPerceptionEngine().ingest({
  at: perceptionAt + 1,
  world: {
    scene: 'source-alias-lab',
    evidenceKind: 'derived',
    objects: [{ label: 'alias-source-object', trackId: 'alias-track', sourceId: 'semantic', evidenceKind: 'derived' }],
  },
});
assert.equal(p41AliasIngress.entities.find(entity => entity.label === 'alias-source-object')?.modalitySourceIds?.world, undefined,
  'modality names must be rejected as source IDs at the live P41 ingress');

const p41RoundTrip = new P41SemanticPerceptionEngine();
p41RoundTrip.restore(semantic);
assert.deepEqual(p41RoundTrip.snapshot().entities.find(entity => entity.label === 'tracked-chair')?.modalitySourceIds?.world,
  ['camera-front'], 'P41 restore must preserve source identity by modality');
const restoredIntegratedWorld = new GroundedWorldState();
restoredIntegratedWorld.integrate({ at: perceptionAt, perception: p41RoundTrip.snapshot() });
assert.deepEqual(restoredIntegratedWorld.snapshot().entities.find(entity => entity.label === 'tracked-chair')?.sourceIds,
  ['camera-front'], 'P41 restore must not collapse source identity into a modality label');

const p41HostileRestore = new P41SemanticPerceptionEngine();
p41HostileRestore.restore({
  ...semantic,
  entities: semantic.entities.map(entity => ({
    ...entity,
    modalitySourceIds: { world: ['camera-front', 'world', 'vision', 'speech', 'semantic'] },
  })),
});
assert.deepEqual(p41HostileRestore.snapshot().entities.find(entity => entity.label === 'tracked-chair')?.modalitySourceIds?.world,
  ['camera-front'], 'P41 checkpoint restore must strip modality names from source identity');

const contextWithoutSource = new GroundedWorldState();
const contextWithoutSourceResult = contextWithoutSource.integrate({
  at: perceptionAt,
  base: {
    tick: 1, location: 'lab', energy: .8, attention: .7, uncertainty: .2,
    facts: [],
    objects: [{
      id: 'base-chair-1', label: 'base-chair', confidence01: .8,
      visible: true, visibilityKnown: true, sourceId: 'speech',
    }],
  },
});
const baseChair = contextWithoutSource.snapshot().entities.find(entity => entity.label === 'base-chair');
assert.ok(baseChair);
assert.deepEqual(baseChair.modalitySourceIds, {},
  'a modality alias cannot be persisted as a source in the canonical world');
assert.deepEqual(baseChair.sourceIds, [],
  'a synthetic world-context identity used for tracking must not be promoted into source provenance');
const baseChairContextObject = contextWithoutSourceResult.objects.find(object => object.label === 'base-chair');
assert.ok(baseChairContextObject);
assert.equal('sourceId' in baseChairContextObject, false,
  'outgoing context must not substitute an entity ID when source provenance is unknown');


const mixedEntity = semantic.entities.find(entity => entity.label === 'tracked-chair');
assert.ok(mixedEntity);
const mixedSemantic = {
  ...semantic,
  entities: [{
    ...mixedEntity,
    modalities: ['vision', 'sensor'],
    modalityEvidenceKinds: { vision: 'model-output', sensor: 'observed' },
    modalitySourceIds: { vision: ['camera-front'], sensor: ['host-sensor'] },
  }],
  events: [{
    id: 'mixed-event-1', label: 'mixed-event', confidence01: .8,
    modalities: ['vision', 'sensor'], startedAt: perceptionAt, lastAt: perceptionAt,
    persistence01: .5, evidenceKind: 'observed',
    modalityEvidenceKinds: { vision: 'model-output', sensor: 'observed' },
  }],
};
const mixedWorld = new GroundedWorldState();
const mixedContext = mixedWorld.integrate({ at: perceptionAt, perception: mixedSemantic });
assert.equal(mixedContext.objects.find(object => object.label === 'tracked-chair')?.evidenceKind, 'model-output',
  'aggregate world-context evidence must not upgrade model output because one modality is observed');
assert.deepEqual(mixedWorld.snapshot().entities.find(entity => entity.label === 'tracked-chair')?.modalitySourceIds,
  { vision: ['camera-front'], sensor: ['host-sensor'] },
  'modality-specific source provenance must survive canonical world integration');
assert.equal(mixedWorld.snapshot().events.find(event => event.id === 'mixed-event-1')?.evidenceKind, 'model-output',
  'mixed-modality events must use the conservative evidence class');

console.log('GROUNDED_WORLD_WRITE_AUTHORITY_INTEGRITY=PASS');
