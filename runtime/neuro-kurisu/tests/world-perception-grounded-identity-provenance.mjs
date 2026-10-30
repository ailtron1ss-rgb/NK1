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
for (const chair of outputChairs) {
  assert.equal(chair.valueKnown, false, 'semantic confidence must not become a numeric world value');
  assert.equal(chair.visibilityKnown, false, 'non-visual world evidence must not prove camera visibility');
  assert.equal(chair.collectionKnown, false, 'unknown collection state must not become a negative fact');
  assert.equal(chair.evidenceKind, 'model-output', 'evidence provenance must not be upgraded during grounding');
}

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
  world: { scene: 'office', evidenceKind: 'observed', objects: [{ label: 'door', trackId: 'door-1', sourceId: 'sensor', evidenceKind: 'observed' }] },
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

console.log(JSON.stringify({
  ok: true,
  p41SameLabelTracks: chairs.length,
  groundedSameLabelTracks: groundedChairs.length,
  compiledEntityEvidence: entityEvidence.length,
  evidenceKind: outputChairs[0]?.evidenceKind,
  unknownFlagsPreserved: true,
}));
