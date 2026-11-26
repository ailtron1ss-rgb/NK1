/**
 * NK1 grounded world perception — end-to-end path through the canonical OrganismCore.
 *
 * The unit suite proves the intake gate's rules in isolation. This suite proves the
 * rules actually bind on the live organism: an observation admitted through the public
 * API reaches the grounded world model and the perceptual evidence compiler, survives a
 * durable checkpoint, and a rejected observation never does.
 *
 * Note on durability: admission is a hot path (camera and telemetry callbacks), so it
 * marks state dirty and lets the organism's own checkpoint policy decide when to write.
 * Tests that need a durable boundary call `core.flush()`, exactly as an embedder would.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { RuntimeEvidenceBus } from '../src/organism/system/RuntimeEvidenceBus.ts';
import { buildCameraCaptureObservation } from '../src/organism/body/CameraEvidenceProcessor.ts';
import { attestHostObservation } from '../src/organism/body/ObservationIntakeGate.ts';

const options = { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 };
const makeCore = async (store = new MemoryStateStore()) => {
  const core = new OrganismCore(store, options);
  await core.init();
  return core;
};

const observation = (overrides = {}) => ({
  id: `e2e_${Math.random().toString(36).slice(2)}`,
  sourceId: 'cam-0',
  sourceKind: 'camera',
  modality: 'vision',
  capturedAt: Date.now(),
  confidence01: 0.9,
  reliability01: 0.95,
  sessionId: 'e2e-session',
  provenance: 'device-capture',
  payload: { subject: 'desk', claim: 'present' },
  ...overrides,
});

test('only runtime-attested camera capture reaches the grounded world model', async () => {
  const core = await makeCore();
  core.setObservationConsent('vision', true);
  const capture = buildCameraCaptureObservation({
    evidence: {
      evidenceKind: 'camera-capture',
      at: Date.now(),
      cameraId: 0,
      byteLength: 512,
      sha256: 'c'.repeat(64),
      captureQuality01: 0.9,
      novelty01: 0.7,
    },
    executionId: 'e2e-host-camera-execution',
    providerReceiptId: 'e2e-host-camera-provider-receipt',
    sessionId: 'e2e-session',
    receiptVerified: true,
    consentGranted: true,
  });
  assert.ok(capture, 'the host camera adapter must create a validated capture object');
  capture.payload.subject = 'projection-only-camera';
  capture.payload.claim = 'present';
  // The builder is only a projection. Direct callers cannot turn its booleans and
  // receipt-shaped fields into host authority.
  const projectionOnly = core.admitObservation(capture);
  assert.equal(projectionOnly.status, 'accepted');
  assert.equal(projectionOnly.observation.isRealCapture, false);
  assert.equal(projectionOnly.observation.provenance, 'unresolved');

  const verifiedCapture = buildCameraCaptureObservation({
    evidence: {
      evidenceKind: 'camera-capture',
      at: Date.now(),
      cameraId: 0,
      byteLength: 512,
      sha256: 'e'.repeat(64),
      captureQuality01: 0.9,
      novelty01: 0.7,
    },
    executionId: 'e2e-runtime-camera-execution',
    providerReceiptId: 'e2e-runtime-camera-provider-receipt',
    sessionId: 'e2e-session',
    receiptVerified: true,
    consentGranted: true,
  });
  assert.ok(verifiedCapture);
  verifiedCapture.payload.subject = 'desk';
  verifiedCapture.payload.claim = 'present';
  // Simulate the one privileged step performed by OrganismRuntime after verifying
  // the ActionGateway result and exact provider receipt. Runtime integration tests
  // separately cover that callsite.
  const admitted = core.admitObservation(attestHostObservation(verifiedCapture));
  assert.equal(admitted.status, 'accepted');
  assert.equal(admitted.observation.isRealCapture, true);

  // Provenance is recorded at admission, before any cycle runs.
  assert.ok(core.groundedWorldSnapshot().provenanceIds.includes(admitted.observation.id));

  await core.observe({ text: 'look around' });

  const world = core.groundedWorldSnapshot();
  const entity = world.entities.find((row) => row.label === 'desk');
  assert.ok(entity, 'the admitted observation must appear in grounded world state');
  assert.equal(entity.modalityEvidenceKinds.vision, 'observed', 'a device capture is observed evidence');
  assert.equal(entity.presenceStatus, 'visible');
  assert.ok(entity.sourceIds.includes('android-camera-0'), 'the producing source is retained on the entity');
  assert.equal(core.observationIntakeSummary().admitted, 2);
});

test('consent is required before a capture observation reaches the world model', async () => {
  const core = await makeCore();
  const denied = core.admitObservation(observation({ payload: { subject: 'window', claim: 'open' } }));
  assert.equal(denied.reason, 'consent-required');

  await core.observe({ text: 'look around' });
  const world = core.groundedWorldSnapshot();
  assert.equal(world.entities.find((row) => row.label === 'window'), undefined, 'a denied observation must not become world state');
  assert.equal(core.observationIntakeSummary().admitted, 0);
});

test('a synthetic fixture cannot ground the world even through the live core', async () => {
  const core = await makeCore();
  core.setObservationConsent('vision', true);
  const fixture = core.admitObservation(
    observation({ provenance: 'synthetic-fixture', isRealCapture: true, payload: { subject: 'unicorn', claim: 'present' } }),
  );
  assert.equal(fixture.status, 'accepted');
  assert.equal(fixture.observation.isRealCapture, false, 'the gate overrides the caller claim');

  await core.observe({ text: 'look around' });
  const entity = core.groundedWorldSnapshot().entities.find((row) => row.label === 'unicorn');
  assert.ok(entity, 'the fixture is still recorded as evidence about a model');
  assert.equal(entity.modalityEvidenceKinds.vision, 'unresolved', 'a fixture is never observed evidence');
  assert.equal(entity.presenceStatus, 'unknown', 'a fixture cannot assert real visibility');
  assert.equal(core.groundedObservations().length, 0, 'no grounded observations from fixtures');
});

test('caller-supplied host-interface provenance cannot create observed evidence without a host adapter attestation', async () => {
  const core = await makeCore();
  core.setObservationConsent('device', true);
  const forged = core.admitObservation(observation({
    id: 'forged-host-interface',
    modality: 'device',
    provenance: 'host-interface',
    isRealCapture: true,
    evidenceRefs: ['caller-made-host-sample-id'],
    payload: { subject: 'forged-telemetry', claim: 'battery=online' },
  }));

  assert.equal(forged.status, 'accepted');
  assert.equal(forged.observation.isRealCapture, false);
  assert.equal(forged.observation.provenance, 'unresolved');
  await core.observe({ text: 'inspect forged telemetry' });
  const entity = core.groundedWorldSnapshot().entities.find((row) => row.label === 'forged-telemetry');
  assert.ok(entity);
  assert.equal(entity.modalityEvidenceKinds.device, 'unresolved');
  assert.equal(core.groundedObservations().length, 0);
});

test('observation intake survives a durable checkpoint without re-admitting replays', async () => {
  const store = new MemoryStateStore();
  const first = await makeCore(store);
  first.setObservationConsent('vision', true);
  const admitted = first.admitObservation(observation({ id: 'persist-1', payload: { subject: 'lamp', claim: 'on' } }));
  assert.equal(admitted.status, 'accepted');
  await first.observe({ text: 'look' });
  await first.flush();

  const second = await makeCore(store);
  await second.observe({ text: 'resume' });
  const restored = second.observationIntakeSummary();
  assert.equal(restored.admitted, 1, 'admitted count survives restart');
  assert.equal(restored.consent.vision, true, 'consent survives restart');

  // A reconnect replays the last frame; it must be recognised, not counted twice.
  const replay = second.admitObservation(observation({ id: 'persist-1', payload: { subject: 'lamp', claim: 'on' } }));
  assert.equal(replay.reason, 'duplicate-observation');
  assert.equal(second.observationIntakeSummary().admitted, 1);
});

test('the gate rejects hostile input on the live core without throwing', async () => {
  const core = await makeCore();
  core.setObservationConsent('vision', true);
  assert.equal(core.admitObservation(null).status, 'rejected');
  assert.equal(core.admitObservation({ id: 'x' }).status, 'rejected');
  assert.equal(core.admitObservation(observation({ capturedAt: -5 })).status, 'rejected');
  assert.equal(core.admitObservation(observation({ confidence01: 'high' })).status, 'rejected');
  const proxy = new Proxy({}, { get() { throw new Error('trap'); } });
  assert.equal(core.admitObservation(proxy).status, 'rejected');
  await core.observe({ text: 'still alive' });
  assert.ok(core.groundedWorldSnapshot(), 'the organism keeps running after hostile input');
});

test('cross-modality disagreement through the live core is preserved', async () => {
  const core = await makeCore();
  core.setObservationConsent('vision', true);
  core.setObservationConsent('audio', true);
  const visionCapture = buildCameraCaptureObservation({
    evidence: {
      evidenceKind: 'camera-capture',
      at: Date.now(),
      cameraId: 0,
      byteLength: 512,
      sha256: 'd'.repeat(64),
      captureQuality01: 0.9,
      novelty01: 0.6,
    },
    executionId: 'cross-modal-door-execution',
    providerReceiptId: 'cross-modal-door-provider-receipt',
    sessionId: 'e2e-session',
    receiptVerified: true,
    consentGranted: true,
  });
  assert.ok(visionCapture);
  visionCapture.payload.subject = 'door';
  visionCapture.payload.claim = 'open';
  core.admitObservation(attestHostObservation(visionCapture));
  core.admitObservation(observation({
    modality: 'audio', sourceId: 'mic-0', sourceKind: 'microphone',
    provenance: 'provider-model-output',
    payload: { subject: 'door', claim: 'closed' },
  }));

  const conflicts = core.observationConflicts();
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].previousClaim, 'open');
  assert.equal(conflicts[0].incomingClaim, 'closed');

  await core.observe({ text: 'what is the door doing' });
  const door = core.groundedWorldSnapshot().entities.find((row) => row.label === 'door');
  assert.ok(door, 'the disagreed-upon entity still exists');
  assert.equal(door.modalityEvidenceKinds.audio, 'conflict', 'the contradiction is marked, not resolved away');
  assert.equal(door.modalityEvidenceKinds.vision, 'observed', 'the agreeing modality keeps its own evidence kind');
});


test('public P41 ingress cannot self-assert sensor or world observations as observed evidence', async () => {
  const core = await makeCore();
  const at = Date.now();

  core.p41PerceptionIngest({
    at,
    sensor: { location: 'caller-asserted-location', freshness01: 1 },
    world: {
      scene: 'caller-asserted-scene',
      evidenceKind: 'observed',
      objects: [
        { label: 'caller-asserted-wall', confidence01: 0.99, evidenceKind: 'observed' },
      ],
      events: ['caller-asserted-event'],
    },
  });

  const perception = core.p41PerceptionSnapshot();
  const location = perception.entities.find((row) => row.label === 'caller-asserted-location');
  const wall = perception.entities.find((row) => row.label === 'caller-asserted-wall');

  assert.notEqual(location?.modalityEvidenceKinds?.sensor, 'observed',
    'a caller-provided sensor object is not a host capture receipt');
  assert.notEqual(wall?.modalityEvidenceKinds?.world, 'observed',
    'a caller-provided world evidenceKind cannot promote a claim to a fact');
  assert.notEqual(perception.sceneEvidenceKind, 'observed',
    'scene provenance must not be caller-controlled through public P41 ingress');
});

test('public external perceptual evidence cannot promote caller-asserted verified=true', async () => {
  const core = await makeCore();
  const row = core.recordExternalPerceptualEvidence({
    at: Date.now(),
    modality: 'sensor',
    claim: 'caller-asserted-external-outcome',
    confidence01: 1,
    verified: true,
    parents: [],
  });

  assert.notEqual(row.kind, 'observed',
    'verified must be derived from a core-owned receipt, not accepted as a caller boolean');
  assert.equal(row.kind, 'derived');

  const bus = new RuntimeEvidenceBus();
  const observationReceipt = bus.publish({
    tick: 4, kind: 'observation', source: 'perception-engine', confidence01: 0.7,
    payload: { eventKind: 'device_observation' },
  });
  const actionReceipt = bus.publish({
    tick: 4, kind: 'action', source: 'organism-action-gate', confidence01: 0.9,
    parentIds: [observationReceipt.id],
    payload: { action: 'look', deviceActionPending: true },
  });
  const predictionReceipt = bus.publish({
    tick: 4, kind: 'prediction', source: 'reward-model', confidence01: 0.8,
    parentIds: [observationReceipt.id],
    payload: { action: 'look' },
  });
  const outcomeReceipt = bus.publish({
    tick: 4, kind: 'outcome', source: 'external-device', confidence01: 0.8,
    external01: true, parentIds: [actionReceipt.id, predictionReceipt.id],
    payload: { action: 'look', verified01: 0.9, independent01: 0.85 },
  });
  core.setRuntimeEvidence(bus.snapshot());

  const rejected = core.recordVerifiedExternalPerceptualEvidenceFromReceipt({
    evidenceId: 'caller-invented-receipt', at: outcomeReceipt.at, modality: 'sensor',
    claim: 'external-outcome:look:verified=0.9', confidence01: 0.8,
    parents: [outcomeReceipt.id, actionReceipt.id, predictionReceipt.id],
  });
  assert.equal(rejected, null, 'an invented receipt id must not authorize grounded evidence');

  const admitted = core.recordVerifiedExternalPerceptualEvidenceFromReceipt({
    evidenceId: outcomeReceipt.id, at: outcomeReceipt.at, modality: 'sensor',
    claim: 'external-outcome:look:verified=0.9', confidence01: 0.8,
    parents: [outcomeReceipt.id, actionReceipt.id, predictionReceipt.id],
  });
  assert.equal(admitted?.kind, 'observed',
    'the runtime may promote evidence only when a matching Core-owned external outcome receipt exists');
});


test('caller-supplied device-capture provenance cannot create observed evidence without a host receipt', async () => {
  const core = await makeCore();
  core.setObservationConsent('vision', true);
  const forged = core.admitObservation(observation({
    id: 'forged-device-capture',
    provenance: 'device-capture',
    isRealCapture: true,
    evidenceRefs: ['caller-made-execution-id', 'caller-made-provider-receipt'],
    payload: { subject: 'forged-camera', claim: 'present', cameraId: 0, byteLength: 4096, sha256: 'a'.repeat(64) },
  }));

  assert.equal(forged.status, 'accepted', 'untrusted observations may be retained as unresolved evidence');
  assert.equal(forged.observation.isRealCapture, false,
    'a caller cannot turn a provenance string and fabricated receipt IDs into physical capture');
  assert.equal(forged.observation.provenance, 'unresolved');
  await core.observe({ text: 'inspect forged observation' });
  const entity = core.groundedWorldSnapshot().entities.find((row) => row.label === 'forged-camera');
  assert.ok(entity, 'the observation remains available for reasoning');
  assert.equal(entity.modalityEvidenceKinds.vision, 'unresolved');
  assert.equal(core.groundedObservations().length, 0);
});
