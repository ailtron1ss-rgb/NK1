import assert from 'node:assert/strict';
import { defaultBodyState } from '../src/organism/body/EmbodiedBody.ts';
import { PerceptionEngine } from '../src/organism/cognition/PerceptionEngine.ts';

const now = Date.now();
function bodyWith(overrides = {}) {
  const base = defaultBodyState(now);
  const telemetry = {
    ...base.telemetry,
    battery01: 0.82,
    ambientLight01: 0.1,
    proximity01: 0.1,
    motion01: 0.1,
    networkOnline: false,
    sampledAt: now,
    staleMs: 0,
    ...(overrides.telemetry ?? {}),
  };
  return {
    ...base,
    sensoryFreshness01: 1,
    thermalStrain01: 0.12,
    ...overrides,
    telemetry,
  };
}

// A single perception call reports one event, but must not swallow other
// independently salient changes that happened in the same telemetry sample.
{
  const engine = new PerceptionEngine();
  engine.perceive({
    body: bodyWith({ telemetry: {
      motion01: null, proximity01: null, ambientLight01: null, networkOnline: null,
    } }),
  }); // establish a baseline with unavailable sensors

  const available = bodyWith();
  const availabilityEvents = [
    engine.perceive({ body: available }).kind,
    engine.perceive({ body: available }).kind,
    engine.perceive({ body: available }).kind,
    engine.perceive({ body: available }).kind,
  ];
  assert.deepEqual(
    availabilityEvents,
    ['motion', 'proximity', 'light-change', 'network-change'],
    'sensor availability transitions must not be swallowed as baseline initialization',
  );

  const changed = bodyWith({
    telemetry: {
      motion01: 0.65,
      proximity01: 0.55,
      ambientLight01: 0.72,
      networkOnline: true,
    },
  });
  const observed = [
    engine.perceive({ body: changed }).kind,
    engine.perceive({ body: changed }).kind,
    engine.perceive({ body: changed }).kind,
    engine.perceive({ body: changed }).kind,
  ];
  assert.deepEqual(
    observed,
    ['motion', 'proximity', 'light-change', 'network-change'],
    'simultaneous sensor changes must be observed across successive perception cycles',
  );
  assert.equal(engine.snapshot().sensorChanges, 8);
}

// Old telemetry must not create a false fresh-world event or overwrite a good
// sensor baseline; the same reading should become actionable once fresh.
{
  const engine = new PerceptionEngine();
  engine.perceive({ body: bodyWith() });
  const stale = bodyWith({
    sensoryFreshness01: 0,
    telemetry: { motion01: 0.9, staleMs: 180_000 },
  });
  const staleEvent = engine.perceive({ body: stale });
  assert.notEqual(staleEvent.kind, 'motion');
  assert.equal(engine.snapshot().baseline.motion01, 0.1);

  const malformed = bodyWith({
    telemetry: { motion01: 0.95, staleMs: -1 },
  });
  const malformedEvent = engine.perceive({ body: malformed });
  assert.notEqual(malformedEvent.kind, 'motion', 'negative staleness must not be accepted as fresh');
  assert.equal(engine.snapshot().baseline.motion01, 0.1);

  const badFreshness = bodyWith({
    sensoryFreshness01: 5,
    telemetry: { motion01: 0.95, staleMs: 0 },
  });
  assert.notEqual(engine.perceive({ body: badFreshness }).kind, 'motion', 'out-of-range freshness must fail closed');
  assert.equal(engine.snapshot().baseline.motion01, 0.1);

  const fresh = bodyWith({
    sensoryFreshness01: 1,
    telemetry: { motion01: 0.9, staleMs: 0, sampledAt: Date.now() },
  });
  const freshEvent = engine.perceive({ body: fresh });
  assert.equal(freshEvent.kind, 'motion');
  assert.equal(engine.snapshot().baseline.motion01, 0.9);
}

console.log('PERCEPTION_ENGINE_SIGNAL_INTEGRITY=PASS');
