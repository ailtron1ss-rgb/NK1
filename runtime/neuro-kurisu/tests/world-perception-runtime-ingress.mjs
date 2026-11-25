import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const dir = await mkdtemp(path.join(os.tmpdir(), 'nk1-world-perception-ingress-'));
const runtime = new OrganismRuntime({
  stateFile: path.join(dir, 'organism.json'),
  worldStateFile: path.join(dir, 'world.json'),
  enableLanguage: false,
  autoRun: false,
});

try {
  await runtime.init();
  runtime.core.setObservationConsent('device', true);
  const originalPlanActivePerception = runtime.core.b365PlanActivePerception.bind(runtime.core);
  runtime.core.b365PlanActivePerception = (input) => ({
    ...originalPlanActivePerception(input),
    requestedSensors: ['battery', 'thermal', 'motion', 'light', 'proximity', 'network'],
  });
  const originalSampleActive = runtime.embodiment.sampleActive.bind(runtime.embodiment);
  runtime.embodiment.sampleActive = async (requestedSensors, force) => {
    const sampled = await originalSampleActive(requestedSensors, force);
    return {
      ...sampled,
      telemetry: {
        ...sampled.telemetry,
        battery01: 0.72,
        batteryTemperatureC: 34,
        thermalPressure01: 0.28,
        networkOnline: true,
        ambientLight01: 0.63,
        proximity01: 0.2,
        motion01: 0.74,
        sampledAt: Math.max(Date.now(), sampled.telemetry.sampledAt + 1),
        source: 'android-termux',
        staleMs: 0,
      },
    };
  };
  const before = runtime.core.perceptionSnapshot();
  await runtime.step('world perception runtime ingress smoke test', { deliberate: false });
  const androidIntake = runtime.core.observationIntakeSummary();
  assert.equal(androidIntake.admitted, 1, 'one fresh consented Android sample enters the canonical observation gate');
  assert.ok(runtime.core.groundedWorldSnapshot().entities.some(row =>
    row.label === 'android-device-telemetry' && row.modalityEvidenceKinds.device === 'observed',
  ), 'the same sample reaches the persistent grounded world model as device evidence');
  const after = runtime.core.perceptionSnapshot();
  assert.equal(after.eventCount, before.eventCount + 1, 'one core observation must produce exactly one canonical perception event');
  assert.ok(after.lastEvent && after.lastEvent.kind !== 'quiet', 'the real runtime sample must produce one non-quiet canonical perception event');
  const evidence = runtime.evidenceBus.snapshot();
  const event = evidence.recent.find(item =>
    item.source === 'perception-engine'
    && item.kind === 'observation'
    && item.payload?.eventId === after.lastEvent?.id
  );

  assert.ok(event, 'a real runtime step must publish the PerceptionEngine event to RuntimeEvidenceBus');
  assert.equal(typeof event.payload.eventId, 'string');
  assert.ok(event.payload.eventId.length > 0);
  assert.equal(event.payload.eventSource, after.lastEvent?.source);
  assert.equal(event.payload.eventKind, after.lastEvent?.kind);
  assert.equal(event.payload.owner, 'OrganismCore');
  assert.equal(event.payload.eventId, after.lastEvent?.id, 'runtime evidence must reference the exact canonical Core event');
  assert.equal(evidence.recent.filter(item => item.source === 'perception-engine' && item.payload?.eventId === after.lastEvent?.id).length, 1, 'the same observation must not be double-published');
  assert.ok(Number.isFinite(event.confidence01) && event.confidence01 >= 0 && event.confidence01 <= 1);
  assert.ok(Array.isArray(event.payload.evidence));

  console.log('WORLD_PERCEPTION_RUNTIME_INGRESS=PASS');
} finally {
  await runtime.stop?.();
  await rm(dir, { recursive: true, force: true });
}


import { buildAndroidTelemetryObservation } from '../src/organism/body/AndroidTelemetryObservationAdapter.ts';

const androidTelemetry = (overrides = {}) => ({
  battery01: 0.72,
  batteryTemperatureC: 34,
  thermalPressure01: 0.28,
  cpuLoad01: 0.31,
  ramPressure01: 0.42,
  networkOnline: true,
  screenInteractive: true,
  ambientLight01: 0.63,
  proximity01: 0.2,
  motion01: 0.74,
  charging: false,
  sampledAt: 2000,
  source: 'android-termux',
  staleMs: 0,
  ...overrides,
});

const androidInput = (overrides = {}) => ({
  telemetry: androidTelemetry(),
  previousSampledAt: 1000,
  requestedSensors: ['battery', 'thermal', 'motion', 'light', 'proximity', 'network'],
  consentGranted: true,
  sessionId: 'android-test-session',
  ...overrides,
});

assert.deepEqual(
  buildAndroidTelemetryObservation(androidInput()),
  {
    id: 'android-telemetry:2000',
    sourceId: 'android-termux-primary',
    sourceKind: 'android-telemetry',
    modality: 'device',
    capturedAt: 2000,
    confidence01: 0.85,
    reliability01: 0.65,
    sessionId: 'android-test-session',
    provenance: 'host-interface',
    payload: {
      subject: 'android-device-telemetry',
      claim: 'battery=0.72;temperatureC=34;thermal=0.28;motion=0.74;light=0.63;proximity=0.2;network=online',
      battery01: 0.72,
      batteryTemperatureC: 34,
      thermalPressure01: 0.28,
      motion01: 0.74,
      ambientLight01: 0.63,
      proximity01: 0.2,
      networkOnline: true,
    },
  },
  'a fresh consented Android sample must become a bounded device observation',
);

for (const override of [
  { consentGranted: false },
  { telemetry: androidTelemetry({ source: 'simulated' }) },
  { telemetry: androidTelemetry({ source: 'node-host' }) },
  { telemetry: androidTelemetry({ staleMs: 1 }) },
  { telemetry: androidTelemetry({ sampledAt: 1000 }) },
  { requestedSensors: [] },
]) {
  assert.equal(buildAndroidTelemetryObservation(androidInput(override)), null,
    'non-consented, simulated, stale, repeated and unrequested samples must not enter grounded world state');
}

runtime.core.setObservationConsent('device', true);
const admittedAndroidSample = runtime.core.admitObservation(buildAndroidTelemetryObservation(androidInput()), { now: 2000 });
assert.equal(admittedAndroidSample.status, 'accepted');
assert.equal(admittedAndroidSample.observation?.isRealCapture, true);
const groundedAndroidDevice = runtime.core.groundedWorldSnapshot().entities.find(
  row => row.label === 'android-device-telemetry',
);
assert.equal(groundedAndroidDevice?.modalityEvidenceKinds.device, 'observed',
  'Android host telemetry must reach GroundedWorldState only through the consented canonical gate');

console.log('ANDROID_TELEMETRY_OBSERVATION_ADAPTER=PASS');
