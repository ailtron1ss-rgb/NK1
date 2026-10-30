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
assert.ok(staleWorld.facts.includes('historical-observed-evidence:old:door-open'));
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
assert.equal(observed.entities.find(entity => entity.label === 'door')?.modalityEvidenceKinds?.world, 'observed');
assert.equal(observed.sceneEvidenceKind, 'observed');
assert.equal(observed.events.find(event => event.label === 'door-opened')?.evidenceKind, 'observed');

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

// Keep the base truthfulness results above as one focused regression summary.
console.log(JSON.stringify({
  ok: true,
  p41SameLabelTracks: chairs.length,
  groundedSameLabelTracks: groundedChairs.length,
  compiledEntityEvidence: entityEvidence.length,
  evidenceKind: outputChairs[0]?.evidenceKind,
  unknownFlagsPreserved: true,
}));
