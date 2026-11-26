import assert from 'node:assert/strict';
import { P41SemanticPerceptionEngine } from '../src/organism/cognition/P41SemanticPerception.ts';
import { GroundedWorldState } from '../src/organism/world/GroundedWorldState.ts';
import { PerceptualEvidenceCompiler } from '../src/organism/body/PerceptualEvidenceCompiler.ts';
import { normalizeWorldContext } from '../src/organism/core/WorldContextNormalizer.ts';

const at = 1_000;
const engine = new P41SemanticPerceptionEngine();
const state = engine.ingest({
  at,
  world: {
    scene: 'laboratory',
    evidenceKind: 'model-output',
    objects: [
      { label: 'chair', trackId: 'chair-A', sourceId: 'sensor-feed', confidence01: 0.91, evidenceKind: 'model-output' },
      { label: 'chair', trackId: 'chair-B', sourceId: 'sensor-feed', confidence01: 0.88, evidenceKind: 'model-output' },
    ],
    events: ['person-entered-room'],
  },
});

const chairs = state.entities.filter(entity => entity.label === 'chair' && entity.kind === 'object');
assert.equal(chairs.length, 2, 'P41 must keep two same-label instances');
assert.equal(new Set(chairs.map(entity => entity.trackId)).size, 2);
for (const chair of chairs) {
  assert.equal(chair.modalityEvidenceKinds?.world, 'model-output');
}
assert.equal(state.sceneEvidenceKind, 'model-output', 'scene provenance must survive semantic ingestion');
assert.equal(state.events.find(event => event.label === 'person-entered-room')?.evidenceKind, 'model-output');

// A model result must not be upgraded to a direct observation while compiling evidence.
const compiler = new PerceptualEvidenceCompiler();
const evidence = compiler.compile({ at, semantic: state });
const entityEvidence = evidence.evidence.filter(row => row.claim.startsWith('entity:') && row.claim.includes(':chair'));
assert.equal(entityEvidence.length, 2, 'evidence compiler must retain both object instances');
assert.ok(entityEvidence.every(row => row.kind === 'model-output'));
assert.equal(evidence.evidence.find(row => row.claim === 'scene:laboratory')?.kind, 'model-output');
assert.equal(evidence.evidence.find(row => row.claim.includes('person-entered-room'))?.kind, 'model-output');

// A later Core world snapshot carries stable IDs, but has no measured value,
// collection status, or visual-visibility observation. Those unknowns stay unknown.
const base = {
  tick: 1,
  location: 'laboratory',
  energy: 0.8,
  attention: 0.7,
  uncertainty: 0.3,
  facts: [],
  events: [],
  objects: [
    { id: 'chair-A', label: 'chair', location: 'laboratory', value: 0, valueKnown: false, visible: false, visibilityKnown: false, collected: false, collectionKnown: false, confidence01: 0.91, evidenceKind: 'unresolved', sourceId: 'sensor-feed' },
    { id: 'chair-B', label: 'chair', location: 'laboratory', value: 0, valueKnown: false, visible: false, visibilityKnown: false, collected: false, collectionKnown: false, confidence01: 0.88, evidenceKind: 'unresolved', sourceId: 'sensor-feed' },
  ],
};
const grounded = new GroundedWorldState();
const world = grounded.integrate({ at, base, perception: state, evidence });
const groundedChairs = grounded.snapshot().entities.filter(entity => entity.label === 'chair' && entity.kind === 'object');
assert.equal(groundedChairs.length, 2, 'GroundedWorldState must not collapse repeated objects by label');
assert.equal(new Set(groundedChairs.map(entity => entity.trackId)).size, 2);
const outputChairs = world.objects.filter(object => object.label === 'chair');
assert.equal(outputChairs.length, 2);
assert.equal(grounded.snapshot().events.find(event => event.label === 'person-entered-room')?.evidenceKind, 'model-output');
assert.ok(world.facts.includes('model-output-event:person-entered-room'));
for (const chair of outputChairs) {
  assert.equal(chair.valueKnown, false, 'semantic confidence must not become a numeric world value');
  assert.equal(chair.visibilityKnown, false, 'non-visual world evidence must not prove camera visibility');
  assert.equal(chair.collectionKnown, false, 'unknown collection state must not become a negative fact');
  assert.equal(chair.evidenceKind, 'model-output', 'evidence provenance must not be upgraded during grounding');
}

// Old observed evidence may remain in the bounded history, but it cannot raise
// current grounded confidence or be presented as a fresh current-world fact.
const stale = new GroundedWorldState();
const staleAt = at + 6_001;
const staleEvidence = {
  version: 1,
  at,
  updates: 1,
  scene: 'laboratory',
  evidence: [{ id: 'stale-observed-receipt', at, modality: 'sensor', claim: 'old:door-open', confidence01: 1, uncertainty01: 0, kind: 'observed', parents: [] }],
  metrics: {},
  activeQuery: null,
  lastHash: 'stale',
};
const staleWorld = stale.integrate({ at: staleAt, perception: state, evidence: staleEvidence });
assert.ok(!stale.snapshot().provenanceIds.includes('stale-observed-receipt'));
assert.ok(staleWorld.facts.includes('historical-derived-evidence:old:door-open'));
assert.ok(!staleWorld.facts.includes('observed-evidence:old:door-open'));

// A same-cycle unresolved world summary must not downgrade a direct vision model result.
const fusedEngine = new P41SemanticPerceptionEngine();
const fused = fusedEngine.ingest({
  at: 4_000,
  vision: { semantic: true, sceneLabel: 'laboratory', confidence01: 0.93, objects: [], relations: [], events: [] },
  world: { scene: 'laboratory', objects: [] },
});
assert.equal(fused.sceneEvidenceKind, 'model-output');

// Missing provenance is fail-closed; explicit independent evidence remains representable.
const unknownEngine = new P41SemanticPerceptionEngine();
const unknown = unknownEngine.ingest({
  at: 2_000,
  world: { scene: 'office', objects: [{ label: 'desk', trackId: 'desk-1', sourceId: 'world' }] },
});
assert.equal(unknown.entities.find(entity => entity.label === 'desk')?.modalityEvidenceKinds?.world, 'unresolved');
assert.equal(unknown.sceneEvidenceKind, 'unresolved');
assert.equal(unknown.events.find(event => event.label === 'person-entered-room'), undefined);

const unknownEventEngine = new P41SemanticPerceptionEngine();
const unknownEvent = unknownEventEngine.ingest({
  at: 2_500,
  world: { scene: 'office', events: ['door-opened'] },
});
assert.equal(unknownEvent.events.find(event => event.label === 'door-opened')?.evidenceKind, 'unresolved');

const observedEngine = new P41SemanticPerceptionEngine();
const observed = observedEngine.ingest({
  at: 3_000,
  world: { scene: 'office', evidenceKind: 'observed', objects: [{ label: 'door', trackId: 'door-1', sourceId: 'sensor', evidenceKind: 'observed' }], events: ['door-opened'] },
});
assert.equal(observed.entities.find(entity => entity.label === 'door')?.modalityEvidenceKinds?.world, 'derived', 'caller-supplied observed labels are not admission receipts');
assert.equal(observed.sceneEvidenceKind, 'derived');
assert.equal(observed.events.find(event => event.label === 'door-opened')?.evidenceKind, 'derived');


// Persisted P41 provenance labels are not host capabilities and must fail closed.
const restoredP41 = new P41SemanticPerceptionEngine();
restoredP41.restore({
  sceneEvidenceKind: 'observed',
  entities: [{
    id:'restored-door',label:'door',kind:'object',confidence01:.99,salience01:.8,present01:1,
    firstSeenAt:1,lastSeenAt:2,observations:9,modalities:['world'],position:null,
    modalityEvidenceKinds:{world:'observed'},
  }],
  relations:[{id:'restored-rel',from:'door',relation:'is',to:'open',confidence01:.99,modality:'world',evidenceKind:'observed',at:2}],
  events:[{id:'restored-event',label:'door-opened',confidence01:.99,modalities:['world'],startedAt:1,lastAt:2,persistence01:1,evidenceKind:'observed',modalityEvidenceKinds:{world:'observed'}}],
  epistemic:{version:1,claims:[{id:'restored-claim',at:2,modality:'world',claim:'door is open',source:'observed',confidence01:1,targetIds:[]}],contradictionPairs:0,resolvedPairs:0,corroboratedPairs:0,meanConfidence01:1,lastAt:2},
});
const restoredP41State = restoredP41.snapshot();
assert.equal(restoredP41State.sceneEvidenceKind,'derived');
assert.equal(restoredP41State.entities[0]?.modalityEvidenceKinds?.world,'derived');
assert.equal(restoredP41State.relations[0]?.evidenceKind,'derived');
assert.equal(restoredP41State.events[0]?.evidenceKind,'derived');
assert.equal(restoredP41State.events[0]?.modalityEvidenceKinds?.world,'derived');
assert.equal(restoredP41State.epistemic?.claims[0]?.source,'derived');

const sensorIngress = new P41SemanticPerceptionEngine().ingest({at:3_500,sensor:{location:'laboratory',freshness01:1}});
assert.equal(sensorIngress.entities.find(entity=>entity.kind==='place')?.modalityEvidenceKinds?.sensor,'derived');
assert.equal(sensorIngress.entities.find(entity=>entity.kind==='body')?.modalityEvidenceKinds?.sensor,'derived');

// Explicit unknown flags must survive the untrusted world-context boundary.
const normalized = normalizeWorldContext({
  tick: 1, location: 'lab', energy: 0.8, attention: 0.8, uncertainty: 0.2, facts: [], events: [],
  objects: [
    { id: 'unknown-object', label: 'object', location: 'lab', value: 0, valueKnown: false, visible: false, visibilityKnown: false, collected: false, collectionKnown: false, evidenceKind: 'model-output' },
  ],
});
assert.ok(normalized);
assert.equal(normalized.objects[0].valueKnown, false);
assert.equal(normalized.objects[0].visibilityKnown, false);
assert.equal(normalized.objects[0].collectionKnown, false);
assert.equal(normalized.objects[0].evidenceKind, 'model-output');

const imageSpaceNormalized=normalizeWorldContext({
  tick:2,location:'lab',energy:.8,attention:.7,uncertainty:.2,facts:[],events:[],
  objects:[
    {id:'screen-chair',label:'chair',location:'lab',value:0,valueKnown:false,visible:true,visibilityKnown:true,collected:false,collectionKnown:false,evidenceKind:'model-output',
      bbox2D:{x:.1,y:.2,width:.3,height:.4},bboxCameraId:1,bboxAt:2000,bboxConfidence01:.82},
    {id:'bad-box',label:'chair',location:'lab',value:0,valueKnown:false,visible:true,visibilityKnown:true,collected:false,collectionKnown:false,evidenceKind:'model-output',
      bbox2D:{x:.9,y:.2,width:.3,height:.4},bboxCameraId:1,bboxAt:2000,bboxConfidence01:.99},
    {id:'no-camera',label:'chair',location:'lab',value:0,valueKnown:false,visible:true,visibilityKnown:true,collected:false,collectionKnown:false,evidenceKind:'model-output',
      bbox2D:{x:.1,y:.2,width:.3,height:.4},bboxAt:2000,bboxConfidence01:.99},
  ],
});
assert.ok(imageSpaceNormalized);
assert.deepEqual(imageSpaceNormalized.objects[0].bbox2D,{x:.1,y:.2,width:.3,height:.4});
assert.equal(imageSpaceNormalized.objects[0].bboxCameraId,1);
assert.equal(imageSpaceNormalized.objects[0].bboxAt,2000);
assert.equal(imageSpaceNormalized.objects[0].bboxConfidence01,.82);
assert.equal('bbox2D' in imageSpaceNormalized.objects[1],false,'out-of-frame boxes are rejected');
assert.equal('bbox2D' in imageSpaceNormalized.objects[2],false,'image boxes without a camera namespace are rejected');

// Spatial coordinates are forwarded only as a complete tuple bound to a
// declared coordinate frame. A 2D image point is not a 3D world position.
const spatialNormalized = normalizeWorldContext({
  tick: 2, location: 'lab', energy: .8, attention: .7, uncertainty: .2, facts: [], events: [],
  objects: [
    { id: 'tracked-crate', label: 'crate', location: 'lab', value: 0, valueKnown: false, visible: true, visibilityKnown: true, collected: false, collectionKnown: true, confidence01: .9, evidenceKind: 'observed', sourceId: 'depth-camera', x: -1.25, y: 0.75, z: 2.5, coordinateFrameId: 'depth-camera:world-v1' },
    { id: 'pixel-chair', label: 'chair', location: 'lab', value: 0, valueKnown: false, visible: true, visibilityKnown: true, collected: false, collectionKnown: true, confidence01: .8, evidenceKind: 'model-output', x: .2, y: .4 },
    { id: 'partial-crate', label: 'crate', location: 'lab', value: 0, valueKnown: false, visible: true, visibilityKnown: true, collected: false, collectionKnown: true, confidence01: .8, evidenceKind: 'observed', x: 1, y: 2, z: 3 },
  ],
});
assert.ok(spatialNormalized);
assert.deepEqual(
  { x: spatialNormalized.objects[0].x, y: spatialNormalized.objects[0].y, z: spatialNormalized.objects[0].z, frame: spatialNormalized.objects[0].coordinateFrameId },
  { x: -1.25, y: .75, z: 2.5, frame: 'depth-camera:world-v1' },
  'finite coordinates and the explicit frame must be preserved without unit-range clamping',
);
assert.equal('x' in spatialNormalized.objects[1], false, 'image-relative coordinates without a calibrated frame stay unknown');
assert.equal('coordinateFrameId' in spatialNormalized.objects[2], false, 'a frame without a complete source coordinate tuple is not manufactured');

// P41 and GroundedWorldState must preserve the same calibrated position/frame pair.
const spatialEngine = new P41SemanticPerceptionEngine();
const spatialPerception = spatialEngine.ingest({
  at: 5_000,
  world: {
    scene: 'laboratory',
    evidenceKind: 'observed',
    objects: [{
      label: 'crate', trackId: 'tracked-crate', sourceId: 'depth-camera',
      confidence01: .9, evidenceKind: 'observed',
      x: -1.25, y: .75, z: 2.5, coordinateFrameId: 'depth-camera:world-v1',
    }],
  },
});
const spatialEntity = spatialPerception.entities.find(entity => entity.label === 'crate');
assert.deepEqual(spatialEntity?.position, { x: -1.25, y: .75, z: 2.5 });
assert.equal(spatialEntity?.positionFrameId, 'depth-camera:world-v1');
const spatialGrounding = new GroundedWorldState();
const spatialWorld = spatialGrounding.integrate({
  at: 5_000,
  base: {
    tick: 2, location: 'laboratory', energy: .8, attention: .7, uncertainty: .2,
    facts: [], events: [],
    objects: [{
      id: 'tracked-crate', label: 'crate', location: 'laboratory',
      value: 0, valueKnown: false, visible: true, visibilityKnown: true,
      collected: false, collectionKnown: false, confidence01: .9, evidenceKind: 'unresolved', sourceId: 'depth-camera',
      x: -1.25, y: .75, z: 2.5, coordinateFrameId: 'depth-camera:world-v1',
    }],
  },
  perception: spatialPerception,
});
const spatialOutput = spatialWorld.objects.find(object => object.label === 'crate');
assert.deepEqual({ x: spatialOutput?.x, y: spatialOutput?.y, z: spatialOutput?.z, frame: spatialOutput?.coordinateFrameId },
  { x: -1.25, y: .75, z: 2.5, frame: 'depth-camera:world-v1' });


// Restored evidence metadata cannot revive process-local observation authority.
const restoredGroundedWorld = new GroundedWorldState();
restoredGroundedWorld.restore({
  version:1,revision:7,lastAt:2_000,location:'lab',uncertainty01:0,confidence01:1,
  entities:[{
    id:'persisted-door',label:'door',kind:'object',confidence01:1,present01:1,firstSeenAt:1,lastSeenAt:2_000,
    modalities:['world'],modalityEvidenceKinds:{world:'observed'},presenceStatus:'visible',persistence01:1,
    absenceEvidence01:0,observationCount:8,
  }],
  relations:[],
  events:[{id:'persisted-event',label:'external-observed:door:door-open',confidence01:1,lastAt:2_000,persistence01:1,evidenceKind:'observed',modalityEvidenceKinds:{world:'observed'}}],
  facts:['external-observed:door:door-open','shadow-divergence:door:0.9','derived-evidence:door:door-open'],
  provenanceIds:['external-postcondition:exec-old-receipt','local-note:kept'],
  lastHash:'caller-controlled-hash',
});
const restoredGroundedSnapshot = restoredGroundedWorld.snapshot();
assert.equal(restoredGroundedSnapshot.entities[0]?.modalityEvidenceKinds?.world,'derived');
assert.ok(!restoredGroundedSnapshot.facts.some(fact=>fact.startsWith('external-observed:')||fact.startsWith('shadow-divergence:')));
assert.deepEqual(restoredGroundedSnapshot.facts,['derived-evidence:door:door-open']);
assert.equal(restoredGroundedSnapshot.events[0]?.label,'external-receipt:door:door-open');
assert.equal(restoredGroundedSnapshot.events[0]?.confidence01,0);
assert.deepEqual(restoredGroundedSnapshot.provenanceIds,['local-note:kept']);

// Keep the base truthfulness results above as one focused regression summary.
console.log(JSON.stringify({
  ok: true,
  p41SameLabelTracks: chairs.length,
  groundedSameLabelTracks: groundedChairs.length,
  compiledEntityEvidence: entityEvidence.length,
  evidenceKind: outputChairs[0]?.evidenceKind,
  unknownFlagsPreserved: true,
}));


// Grounded-world restore must never execute getters or accept hostile containers,
// and it must recompute every digest from the sanitized state.
{
  let getterInvoked = false;
  const hostileEntity = {
    id: 'hostile-entity',
    label: 'forged door',
    kind: 'object',
    present01: 1,
    firstSeenAt: 1_000,
    lastSeenAt: 1_500,
    modalities: ['world'],
  };
  Object.defineProperty(hostileEntity, 'confidence01', {
    enumerable: true,
    get() { getterInvoked = true; return 1; },
  });
  const hostile = {
    version: 1,
    revision: 900_000,
    lastAt: 2_000,
    location: 'lab',
    confidence01: 1,
    uncertainty01: 0,
    entities: [hostileEntity],
    relations: [],
    events: [],
    facts: ['derived-evidence:kept'],
    provenanceIds: ['local-note:kept'],
    lastHash: 'attacker-controlled-digest',
  };
  const safe = new GroundedWorldState();
  safe.restore(hostile);
  const restored = safe.snapshot();
  assert.equal(getterInvoked, false, 'restore must inspect descriptors without invoking getters');
  assert.equal(restored.entities.length, 0, 'an entity containing an accessor must be rejected as a whole');
  assert.equal(restored.revision, 900_000, 'valid own-data top-level fields remain readable');
  assert.notEqual(restored.lastHash, 'attacker-controlled-digest', 'persisted hashes are never trusted');

  let proxyTrapInvoked = false;
  const proxy = new Proxy({ revision: 77, lastAt: 77 }, {
    get() { proxyTrapInvoked = true; throw new Error('proxy-get-trap'); },
    ownKeys() { proxyTrapInvoked = true; throw new Error('proxy-ownKeys-trap'); },
  });
  const proxyRestored = new GroundedWorldState();
  proxyRestored.restore(proxy);
  assert.equal(proxyTrapInvoked, false, 'Proxy detection must happen before reflection or property reads');
  assert.equal(proxyRestored.snapshot().revision, 0);
  assert.equal(proxyRestored.snapshot().lastAt, 0);
}

// Restore sanitizes malformed counters, timestamps, relations, positions, facts,
// and provenance rather than spreading arbitrary persisted values into the world.
{
  const safe = new GroundedWorldState();
  safe.restore({
    version: 1,
    revision: -1,
    lastAt: 2_000,
    location: { injected: true },
    uncertainty01: 4,
    confidence01: Number.NaN,
    entities: [{
      id: 'entity-1',
      label: 'crate',
      kind: 'object',
      confidence01: 2,
      present01: -1,
      firstSeenAt: 1_500,
      lastSeenAt: 1_000,
      modalities: ['world', 7, 'world'],
      position: { x: 1, y: 2, z: 3 },
      observationCount: -40,
      persistence01: Number.POSITIVE_INFINITY,
      absenceEvidence01: 0.3,
    }],
    relations: [
      { id: 'relation-1', from: 'crate', relation: 'near', to: 'door', confidence01: 0.8, at: 1_700 },
      { id: 'bad-relation', from: '', relation: 'near', to: 'door', confidence01: 9, at: 1_700 },
    ],
    events: [{
      id: 'event-1', label: 'external-observed:door-open', confidence01: 1,
      lastAt: 1_800, persistence01: 1, evidenceKind: 'observed',
    }],
    facts: ['derived-evidence:crate', 'external-observed:door-open', 'shadow-divergence:door:1'],
    provenanceIds: ['local-note:kept', 'external-postcondition:old-exec'],
    lastHash: 'forged',
  });
  const snapshot = safe.snapshot();
  assert.equal(snapshot.revision, 0);
  assert.equal(snapshot.location, 'unknown');
  assert.equal(snapshot.uncertainty01, 0.5);
  assert.equal(snapshot.confidence01, 0);
  assert.equal(snapshot.entities.length, 1);
  assert.equal(snapshot.entities[0].confidence01, 1);
  assert.equal(snapshot.entities[0].present01, 0);
  assert.equal(snapshot.entities[0].firstSeenAt, 1_000);
  assert.equal(snapshot.entities[0].lastSeenAt, 1_000);
  assert.deepEqual(snapshot.entities[0].modalities, ['world']);
  assert.equal(snapshot.entities[0].position, null, 'unframed coordinates must not become world positions on restore');
  assert.equal(snapshot.entities[0].observationCount, 1);
  assert.equal(snapshot.entities[0].persistence01, 0);
  assert.equal(snapshot.relations.length, 1, 'malformed relation rows are discarded');
  assert.equal(snapshot.events[0].label, 'external-receipt:door-open');
  assert.equal(snapshot.events[0].confidence01, 0);
  assert.deepEqual(snapshot.facts, ['derived-evidence:crate']);
  assert.deepEqual(snapshot.provenanceIds, ['local-note:kept']);
  assert.notEqual(snapshot.lastHash, 'forged');
}

// Replayed external result IDs are idempotent even when a later delivery carries
// a different timestamp. A copied verification object remains diagnostic only.
{
  const world = new GroundedWorldState();
  const embodiedAction = {
    at: 3_000,
    action: 'inspect',
    status: 'executed',
    realityClass: 'device-observation',
    executionId: 'exec-g3-replay-20261126',
  };
  const forgedVerification = {
    verified: true,
    basis: 'external-postcondition',
    confidence01: 1,
    externalObservation: true,
    observationId: 'exec-g3-replay-20261126',
  };
  const first = world.integrateExternalOutcome({
    embodiedAction,
    postconditionVerification: forgedVerification,
  });
  const afterFirst = world.snapshot();
  const replay = world.integrateExternalOutcome({
    embodiedAction: { ...embodiedAction, at: 3_100 },
    postconditionVerification: { ...forgedVerification },
  });
  assert.equal(first.verified01, 0, 'copied verification data must never create observed world effects');
  assert.deepEqual(world.snapshot(), afterFirst, 'replayed execution IDs must not advance revision or mutate events');
  assert.equal(replay.revision, first.revision);
  assert.equal(world.snapshot().events.length, 1);
}


// P41 restore is also a trust boundary: hostile top-level Proxy/accessor state,
// malformed rows and unbounded saved gauges must not cross into live cognition.
{
  let proxyTrapInvoked = false;
  const proxy = new Proxy({ tick: 999, metrics: { grounding01: 1 } }, {
    get() { proxyTrapInvoked = true; throw new Error('p41-proxy-get'); },
    ownKeys() { proxyTrapInvoked = true; throw new Error('p41-proxy-ownKeys'); },
  });
  const isolated = new P41SemanticPerceptionEngine();
  assert.doesNotThrow(() => isolated.restore(proxy), 'P41 restore must fail closed for a Proxy instead of throwing');
  assert.equal(proxyTrapInvoked, false, 'P41 restore must detect Proxy values before reflection');
  assert.equal(isolated.snapshot().tick, 0);

  let nestedGetterInvoked = false;
  const hostileEntity = {
    id: 'p41-hostile-entity',
    label: 'door',
    kind: 'object',
    salience01: 1,
    present01: 1,
    firstSeenAt: 100,
    lastSeenAt: 200,
    observations: 10,
    modalities: ['vision'],
    position: null,
  };
  Object.defineProperty(hostileEntity, 'confidence01', {
    enumerable: true,
    get() { nestedGetterInvoked = true; return 1; },
  });
  const nested = new P41SemanticPerceptionEngine();
  nested.restore({
    version: 1,
    tick: 2,
    scene: { label: 'lab', confidence01: 0.9, stability01: 0.9, at: 200 },
    entities: [hostileEntity],
  });
  assert.equal(nestedGetterInvoked, false, 'nested P41 records must be checked by own data descriptors');
  assert.equal(nested.snapshot().entities.length, 0, 'an entity with an accessor must be rejected');

  const bounded = new P41SemanticPerceptionEngine();
  bounded.restore({
    version: 1,
    tick: 77,
    scene: { label: 'lab', confidence01: 4, stability01: -3, at: 500 },
    sceneEvidenceKind: 'observed',
    relations: [{
      id: 'rel-1', from: 'door', relation: 'is', to: 'open',
      confidence01: 7, modality: 'world', evidenceKind: 'observed', at: 500,
    }],
    metrics: {
      grounding01: 9,
      temporalBinding01: -1,
      objectPermanence01: 0.4,
      crossModalAgreement01: 1.5,
      crossModalEvidenceCoverage01: 0.7,
      outcomeAlignment01: 0.8,
      activePerceptionUtility01: 0.2,
      unresolvedRate01: 0.1,
      updates: 900_000,
      sceneContinuity01: 0.3,
      temporalGrounding01: 0.4,
      evidenceTraceability01: 0.5,
      epistemicContradictions: 800_000,
    },
    actionBias: { respond: 500, explore: -500 },
    modalityReliability: {
      vision: { reliability01: 8, observations: 900_000, calibrationSamples: 99_999 },
    },
  });
  const snapshot = bounded.snapshot();
  assert.ok(snapshot.scene.confidence01 >= 0 && snapshot.scene.confidence01 <= 1);
  assert.ok(snapshot.scene.stability01 >= 0 && snapshot.scene.stability01 <= 1);
  assert.equal(snapshot.sceneEvidenceKind, 'derived');
  assert.equal(snapshot.relations[0]?.confidence01, 0, 'out-of-range persisted confidence fails closed to the safe default');
  assert.equal(snapshot.relations[0]?.evidenceKind, 'derived');
  assert.equal(snapshot.metrics.grounding01 <= 1, true);
  assert.equal(snapshot.metrics.temporalBinding01 >= 0, true);
  assert.equal(snapshot.metrics.updates <= 900_000, true);
  assert.equal(Math.abs(snapshot.actionBias.respond) <= 1, true);
  assert.equal(Math.abs(snapshot.actionBias.explore) <= 1, true);
  assert.equal(snapshot.modalityReliability.vision.reliability01 <= 1, true);
  assert.equal(snapshot.modalityReliability.vision.observations <= 900_000, true);
}
