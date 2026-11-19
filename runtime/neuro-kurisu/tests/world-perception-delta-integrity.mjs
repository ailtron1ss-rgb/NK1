import assert from 'node:assert/strict';
import { PerceptionEngine } from '../src/organism/cognition/PerceptionEngine.ts';

function world(overrides = {}) {
  return {
    tick: 1,
    location: 'lab',
    energy: 0.7,
    attention: 0.6,
    uncertainty: 0.2,
    facts: ['door open', 'lamp on'],
    objects: [{ id: 'lamp-1', label: 'lamp', location: 'desk', value: 0.8, valueKnown: true, visible: true, visibilityKnown: true, collected: false, collectionKnown: true, evidenceKind: 'observed', sourceId: 'camera-1' }],
    events: ['entered room', 'light enabled'],
    ...overrides,
  };
}

// Same cardinality, different fact content must be perceived as a real change.
{
  const engine = new PerceptionEngine();
  assert.equal(engine.perceive({ world: world() }).kind, 'quiet', 'the first world sample establishes the baseline');
  const event = engine.perceive({ world: world({ facts: ['door closed', 'lamp on'], events: ['entered room', 'light disabled'] }) });
  assert.equal(event.kind, 'world-surprise');
  assert.match(event.detail, /world context changed/);
  assert.match(event.evidence.join('|'), /changedSections=.*facts/);
  assert.match(event.evidence.join('|'), /events/);
  assert.equal(engine.snapshot().worldChanges, 1);
}

// Object-state changes are noticed even if the object count does not change.
{
  const engine = new PerceptionEngine();
  engine.perceive({ world: world() });
  const event = engine.perceive({ world: world({ objects: [{ id: 'lamp-1', label: 'lamp', location: 'desk', value: 0.8, valueKnown: true, visible: false, visibilityKnown: true, collected: false, collectionKnown: true, evidenceKind: 'observed', sourceId: 'camera-1' }] }) });
  assert.equal(event.kind, 'world-surprise');
  assert.match(event.evidence.join('|'), /objects/);
}

// Reordering an unordered fact set should not create artificial novelty.
{
  const engine = new PerceptionEngine();
  engine.perceive({ world: world() });
  const event = engine.perceive({ world: world({ facts: ['lamp on', 'door open'] }) });
  assert.equal(event.kind, 'quiet');
  assert.equal(engine.snapshot().worldChanges, 0);
}

// Sustained low battery must not emit a resource pressure alarm on every tick.
{
  const engine = new PerceptionEngine();
  const b = {
    schemaVersion: 1, sleep: 'awake', awake: true,
    telemetry: {
      battery01: 0.1, batteryTemperatureC: null, thermalPressure01: 0.1,
      cpuLoad01: 0.1, ramPressure01: 0.1, networkOnline: false, screenInteractive: true,
      ambientLight01: 0.4, proximity01: 0.1, motion01: 0.1, charging: false,
      sampledAt: Date.now(), source: 'node-host', staleMs: 0,
    },
    lastExternalEventAt: Date.now(), lastUserActivityAt: Date.now(), wakeReason: null,
    bodyEnergy01: 0.5, thermalStrain01: 0.1, sensoryFreshness01: 1, cognitiveCapacity01: 0.7,
    circadian01: 0.5, ttsAvailable: false, sttAvailable: false, cameraAvailable: false, microphoneAvailable: false,
  };
  assert.equal(engine.perceive({ body: b }).kind, 'resource');
  const eventCount = engine.snapshot().eventCount;
  assert.equal(engine.perceive({ body: b }).kind, 'quiet');
  assert.equal(engine.snapshot().eventCount, eventCount + 1);
  assert.equal(engine.perceive({ body: { ...b, telemetry: { ...b.telemetry, battery01: 0.5, sampledAt: Date.now() } } }).kind, 'resource');
  assert.match(engine.snapshot().lastEvent.detail, /cleared/);
}

// Corrupt/future timestamps fail closed without replacing the known baseline.
{
  const engine = new PerceptionEngine();
  const now = Date.now();
  const base = {
    schemaVersion: 1, sleep: 'awake', awake: true,
    telemetry: {
      battery01: 0.8, batteryTemperatureC: null, thermalPressure01: 0.1,
      cpuLoad01: 0.1, ramPressure01: 0.1, networkOnline: false, screenInteractive: true,
      ambientLight01: 0.1, proximity01: 0.1, motion01: 0.1, charging: false,
      sampledAt: now, source: 'node-host', staleMs: 0,
    },
    lastExternalEventAt: now, lastUserActivityAt: now, wakeReason: null,
    bodyEnergy01: 0.5, thermalStrain01: 0.1, sensoryFreshness01: 1, cognitiveCapacity01: 0.7,
    circadian01: 0.5, ttsAvailable: false, sttAvailable: false, cameraAvailable: false, microphoneAvailable: false,
  };
  engine.perceive({ body: base });
  const baseline = engine.snapshot().baseline.motion01;
  const future = engine.perceive({ body: { ...base, telemetry: { ...base.telemetry, motion01: 0.9, sampledAt: now + 60_000 } } });
  assert.notEqual(future.kind, 'motion');
  assert.equal(engine.snapshot().baseline.motion01, baseline);
}

console.log('WORLD_PERCEPTION_DELTA_INTEGRITY=PASS');
