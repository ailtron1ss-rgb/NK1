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

test('a consented real capture reaches the grounded world model', async () => {
  const core = await makeCore();
  core.setObservationConsent('vision', true);
  const admitted = core.admitObservation(observation({ payload: { subject: 'desk', claim: 'present' } }));
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
  assert.ok(entity.sourceIds.includes('cam-0'), 'the producing source is retained on the entity');
  assert.equal(core.observationIntakeSummary().admitted, 1);
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
  core.admitObservation(observation({ modality: 'vision', sourceId: 'cam-0', payload: { subject: 'door', claim: 'open' } }));
  core.admitObservation(observation({ modality: 'audio', sourceId: 'mic-0', sourceKind: 'microphone', payload: { subject: 'door', claim: 'closed' } }));

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
