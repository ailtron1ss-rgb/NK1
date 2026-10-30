import assert from 'node:assert/strict';
import {
  P41SemanticPerceptionEngine,
  defaultP41SemanticPerception,
} from '../src/organism/cognition/P41SemanticPerception.ts';
import { PerceptualEpistemicGraph } from '../src/organism/cognition/PerceptualEpistemicGraph.ts';

function semanticVision(objects, at, extra = {}) {
  return {
    at,
    vision: {
      semantic: true,
      cameraId: 0,
      sceneLabel: 'laboratory',
      confidence01: 0.9,
      latencyMs: 40,
      objects,
      ...extra,
    },
  };
}

// Two visually identical instances must remain two tracks rather than one label bucket.
{
  const engine = new P41SemanticPerceptionEngine();
  const objects = [
    { label: 'chair', trackId: 'chair-A', sourceId: 'detector', coordinateFrameId: 'lab-map', x: 0, y: 0, z: 0, confidence01: 0.9 },
    { label: 'chair', trackId: 'chair-B', sourceId: 'detector', coordinateFrameId: 'lab-map', x: 3, y: 0, z: 0, confidence01: 0.8 },
  ];
  const first = engine.ingest(semanticVision(objects, 10_000));
  const chairs = first.entities.filter(entity => entity.label === 'chair' && entity.kind === 'object');
  assert.equal(chairs.length, 2);
  assert.equal(new Set(chairs.map(entity => entity.id)).size, 2);
  const originalIds = new Map(chairs.map(entity => [entity.trackId, entity.id]));

  const second = engine.ingest(semanticVision([
    { ...objects[1], x: 3.1 },
    { ...objects[0], x: 0.1 },
  ], 11_000));
  const updated = second.entities.filter(entity => entity.label === 'chair' && entity.kind === 'object');
  assert.equal(updated.length, 2);
  for (const entity of updated) {
    assert.equal(entity.id, originalIds.get(entity.trackId), 'stable object identity must survive detector ordering changes');
    assert.equal(entity.observations, 2);
    assert.ok(Math.abs((entity.velocity?.x ?? 0) - 0.1) < 0.02, 'velocity should use the declared common coordinate frame');
  }
}

// Geometry-only tracking is enabled only when both observations declare the same coordinate frame.
{
  const engine = new P41SemanticPerceptionEngine();
  const first = engine.ingest(semanticVision([
    { label: 'cup', coordinateFrameId: 'map-A', x: 0, y: 0, z: 0 },
    { label: 'cup', coordinateFrameId: 'map-A', x: 2, y: 0, z: 0 },
  ], 20_000));
  const original = first.entities.filter(entity => entity.label === 'cup').map(entity => entity.id);
  const second = engine.ingest(semanticVision([
    { label: 'cup', coordinateFrameId: 'map-A', x: 2.1, y: 0, z: 0 },
    { label: 'cup', coordinateFrameId: 'map-A', x: 0.1, y: 0, z: 0 },
  ], 21_000));
  assert.equal(second.entities.filter(entity => entity.label === 'cup').length, 2);
  assert.deepEqual(new Set(second.entities.filter(entity => entity.label === 'cup').map(entity => entity.id)), new Set(original));

  const otherFrame = engine.ingest(semanticVision([
    { label: 'cup', coordinateFrameId: 'map-B', x: 0.1, y: 0, z: 0 },
  ], 22_000));
  assert.equal(otherFrame.entities.filter(entity => entity.label === 'cup').length, 3, 'coordinates from an unrelated frame must not merge tracks');
}

// Cross-modal aliasing is conservative: one candidate can be associated, two candidates are ambiguous.
{
  const engine = new P41SemanticPerceptionEngine();
  const first = engine.ingest(semanticVision([
    { label: 'lamp', trackId: 'lamp-v-1', sourceId: 'vision', confidence01: 0.8 },
  ], 30_000));
  const firstLamp = first.entities.find(entity => entity.label === 'lamp');
  assert.ok(firstLamp);

  const second = engine.ingest({
    at: 30_500,
    world: {
      scene: 'laboratory',
      objects: [{ label: 'lamp', trackId: 'lamp-world-1', sourceId: 'world', confidence01: 0.7 }],
    },
  });
  const lamps = second.entities.filter(entity => entity.label === 'lamp');
  assert.equal(lamps.length, 1);
  assert.equal(lamps[0].id, firstLamp.id);
  assert.equal(lamps[0].trackId, 'vision:0:vision:lamp-v-1', 'the primary track key must not be overwritten by a cross-modal alias');
  assert.ok(lamps[0].trackAliases?.includes('world:world:lamp-world-1'));
  assert.ok(lamps[0].modalities.includes('vision') && lamps[0].modalities.includes('world'));
  assert.ok(second.metrics.crossModalEvidenceCoverage01 > 0);

  const ambiguous = new P41SemanticPerceptionEngine();
  ambiguous.ingest(semanticVision([
    { label: 'book', trackId: 'book-A', sourceId: 'vision' },
    { label: 'book', trackId: 'book-B', sourceId: 'vision' },
  ], 40_000));
  const afterAmbiguousWorld = ambiguous.ingest({
    at: 40_500,
    world: { objects: [{ label: 'book', trackId: 'book-world', sourceId: 'world' }] },
  });
  assert.equal(afterAmbiguousWorld.entities.filter(entity => entity.label === 'book').length, 3);

  const stale = new P41SemanticPerceptionEngine();
  stale.ingest(semanticVision([{ label: 'mug', trackId: 'mug-v', sourceId: 'vision' }], 45_000));
  const staleWorld = stale.ingest({
    at: 55_001,
    world: { objects: [{ label: 'mug', trackId: 'mug-world', sourceId: 'world' }] },
  });
  assert.equal(staleWorld.entities.filter(entity => entity.label === 'mug').length, 2, 'old visual evidence must not silently corroborate a much later world observation');
  assert.equal(staleWorld.metrics.crossModalEvidenceCoverage01, 0, 'stale modality history must not count as current cross-modal coverage');
}

// Model-reported confidence is not empirical accuracy; only an independent receipt may calibrate reliability.
{
  const engine = new P41SemanticPerceptionEngine();
  const before = engine.snapshot().modalityReliability.vision;
  engine.ingest(semanticVision([{ label: 'door', trackId: 'door-1', confidence01: 0.99 }], 50_000));
  const afterObservation = engine.snapshot().modalityReliability.vision;
  assert.equal(afterObservation.reliability01, before.reliability01, 'model confidence must not self-certify model accuracy');
  assert.ok(afterObservation.reportedQuality01 > before.reportedQuality01);

  assert.equal(engine.observeModalityOutcome({
    modality: 'vision',
    predictedConfidence01: 0.9,
    correctness01: 0.5,
    evidenceId: 'human-label-0001',
    evidenceSource: 'human-annotation',
    at: 51_000,
  }), true);
  const calibrated = engine.snapshot().modalityReliability.vision;
  assert.ok(calibrated.calibrationSamples === 1);
  assert.ok(Math.abs(calibrated.calibrationMae01 - 0.4) < 0.0001);
  assert.ok(calibrated.reliability01 < before.reliability01 + 0.1);
  assert.equal(engine.observeModalityOutcome({
    modality: 'vision',
    predictedConfidence01: 0.9,
    correctness01: 0.5,
    evidenceId: 'human-label-0001',
    evidenceSource: 'human-annotation',
    at: 51_001,
  }), false, 'the same evidence receipt cannot be replayed to alter calibration');
  assert.equal(engine.observeModalityOutcome({
    modality: 'vision',
    predictedConfidence01: 0.9,
    correctness01: 0.5,
    evidenceId: 'model-self-report',
    evidenceSource: 'model-output',
  }), false, 'a model cannot act as its own independent evaluator');
}

// Fulfilment measures transport/service success only; expired requests cannot be fulfilled.
{
  const engine = new P41SemanticPerceptionEngine();
  engine.ingest({ at: 60_000, vision: { semantic: false } });
  const pending = engine.nextPerception(60_001);
  assert.ok(pending);
  const reliability = engine.snapshot().modalityReliability.vision.reliability01;
  assert.equal(engine.fulfill(pending.id, true, 60_002), true);
  const state = engine.snapshot();
  assert.equal(state.modalityReliability.vision.reliability01, reliability);
  assert.ok(state.modalityReliability.vision.serviceSuccess01 > 0.5);

  engine.ingest({ at: 70_000, audio: { semantic: false } });
  const audio = engine.nextPerception(70_001);
  assert.ok(audio);
  engine.ingest({ at: 70_002, audio: { semantic: false } });
  assert.equal(engine.snapshot().pending.filter(item => item.modality === 'audio' && item.status === 'pending').length, 1, 'repeated unresolved samples must not enqueue duplicate live requests');
  assert.equal(engine.nextPerception(70_003)?.id, audio.id);
  assert.equal(engine.nextPerception(audio.expiresAt + 1), null);
  assert.equal(engine.fulfill(audio.id, true, audio.expiresAt + 2), false);
  assert.equal(engine.snapshot().pending.find(item => item.id === audio.id)?.status, 'expired');

  engine.ingest({ at: audio.expiresAt + 10, audio: { semantic: false } });
  const renewed = engine.nextPerception(audio.expiresAt + 11);
  assert.ok(renewed);
  assert.notEqual(renewed.id, audio.id, 'a later retry must receive a new generation ID');
  assert.equal(engine.fulfill(renewed.id, true, audio.expiresAt + 12), true, 'the renewed request must not resolve against the expired predecessor');
}

// Backdated samples cannot rewind a scene/identity history after a newer snapshot exists.
{
  const engine = new P41SemanticPerceptionEngine();
  engine.ingest(semanticVision([{ label: 'door', trackId: 'door-current', sourceId: 'detector' }], 90_000));
  const before = engine.snapshot();
  const after = engine.ingest(semanticVision([{ label: 'window', trackId: 'window-old', sourceId: 'detector' }], 89_000));
  assert.equal(after.tick, before.tick, 'out-of-order perception input must not advance the semantic timeline');
  assert.equal(after.entities.some(entity => entity.label === 'window'), false);
  assert.equal(after.snapshots[0].at, before.snapshots[0].at);
}

// Legacy checkpoints restore without NaN/undefined calibration fields or loss of known observations.
{
  const legacy = defaultP41SemanticPerception();
  delete legacy.calibrationEvidenceIds;
  delete legacy.nextTrackSequence;
  delete legacy.metrics.crossModalEvidenceCoverage01;
  for (const value of Object.values(legacy.modalityReliability)) {
    delete value.reportedQuality01;
    delete value.serviceSuccess01;
    delete value.calibrationSamples;
    delete value.calibrationMae01;
    delete value.calibrationBias01;
    delete value.lastVerifiedAt;
  }
  legacy.entities = [{
    id: 'legacy-chair', label: 'chair', kind: 'object', confidence01: 0.7, salience01: 0.5,
    present01: 0.8, firstSeenAt: 1, lastSeenAt: 2, observations: 2, modalities: ['vision'],
    position: null,
  }];
  const restored = new P41SemanticPerceptionEngine();
  restored.restore(legacy);
  assert.equal(restored.snapshot().entities[0].id, 'legacy-chair');
  assert.equal(restored.snapshot().modalityReliability.vision.calibrationSamples, 0);
  assert.equal(restored.snapshot().metrics.crossModalEvidenceCoverage01, 0);
}

// Repeated observations corroborate; only an explicit supersedes edge resolves an older claim.
{
  const graph = new PerceptualEpistemicGraph();
  const first = graph.add({ at: 1, modality: 'vision', claim: 'door is open', source: 'model-output', confidence01: 0.6 });
  const replay = graph.add({ at: 1, modality: 'vision', claim: 'door is open', source: 'model-output', confidence01: 0.6 });
  assert.equal(replay.id, first.id);
  assert.equal(graph.snapshot().claims.length, 1, 'an identical receipt replay must be idempotent');
  graph.add({ at: 2, modality: 'vision', claim: 'door is open', source: 'model-output', confidence01: 0.7 });
  assert.equal(graph.snapshot().corroboratedPairs, 0, 'repeated same-modality claims are not independent corroboration');
  graph.add({ at: 3, modality: 'world', claim: 'door is open', source: 'observed', confidence01: 0.9 });
  assert.equal(graph.snapshot().corroboratedPairs, 2);
  assert.equal(graph.snapshot().resolvedPairs, 0);
  graph.add({ at: 4, modality: 'vision', claim: 'door is closed', source: 'observed', confidence01: 0.9, supersedes: first.id });
  assert.equal(graph.snapshot().resolvedPairs, 1);
}

console.log('P41_PERCEPTUAL_INTEGRITY_DEEP_PASS=PASS');
