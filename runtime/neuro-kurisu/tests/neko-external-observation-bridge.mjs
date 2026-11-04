import assert from 'node:assert/strict';
import { ExternalObserverFabric } from '../src/organism/system/ExternalObserverFabric.ts';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';
import { NekoExternalObservationBridge } from '../src/organism/integration/neko/NekoExternalObservationBridge.ts';

const baseEvent = (overrides = {}) => ({
  pluginId: 'calendar_helper',
  eventId: 'evt-0001',
  claimKey: 'calendar.reminder.created',
  summary: 'Reminder was scheduled for 10:30',
  facts: ['timezone=Europe/Amsterdam', 'schedule=10:30'],
  reportedAt: 1_800_000_000_000,
  ...overrides,
});
const makeBridge = (options = {}) => {
  const observers = options.observers ?? new ExternalObserverFabric();
  const events = options.events ?? new CognitiveEventFabric(256);
  const bridge = new NekoExternalObservationBridge({
    observers,
    events,
    now: () => 1_800_000_100_000,
    ...options,
  });
  return { bridge, observers, events };
};

// Events enter the external-observation lane only, with fixed host-assigned low trust.
{
  const { bridge, observers, events } = makeBridge();
  const result = bridge.ingest(baseEvent(), { tick: 42, receivedAt: 1_800_000_100_000 });
  assert.equal(result.accepted, true);
  assert.equal(result.replayed, false);
  assert.equal(result.confidence01, 0.25);
  assert.equal(result.sourceClass, 'unknown');
  assert.equal(result.stage, 'external-evidence');
  const observerState = observers.snapshot();
  assert.equal(observerState.observations.length, 1);
  const observation = observerState.observations[0];
  assert.equal(observation.sourceClass, 'unknown');
  assert.equal(observation.channel, 'tool');
  assert.equal(observation.independenceKey, 'neko-plugin-source:calendar_helper');
  assert.equal(observation.confidence01, 0.25);
  assert.equal(observation.claimKey, 'plugin:calendar_helper:calendar.reminder.created');
  const source = observerState.sources.find(item => item.id === 'neko-plugin.calendar_helper');
  assert.equal(source.reliability01, 0.25);
  const eventState = events.snapshot();
  const event = eventState.recent.find(item => item.id === result.eventNodeId);
  assert.ok(event);
  assert.equal(event.stage, 'external-evidence');
  assert.equal(event.external, true);
  assert.equal(event.confidence01, 0.25);
  assert.equal(event.source, 'neko-plugin-observation-bridge');
  assert.equal(event.payload.observationId, observation.id);
  assert.equal(eventState.recent.some(item => item.stage === 'memory' || item.stage === 'goal' || item.stage === 'self-update'), false);
  // Even an exact textual match cannot upgrade a plugin observation to verified truth.
  const assessment = observers.assess(observation.id, observation.observedPostcondition);
  assert.equal(assessment.assessment, 'match');
  assert.equal(assessment.verified, false);
}

// Exact replay is idempotent; reusing an event ID for different content is a conflict.
{
  const { bridge, observers, events } = makeBridge();
  const first = bridge.ingest(baseEvent(), { tick: 3, receivedAt: 1_800_000_100_000 });
  const before = { observations: observers.snapshot().totalObservations, events: events.snapshot().total };
  const replay = bridge.ingest(baseEvent(), { tick: 99, receivedAt: 1_800_000_200_000 });
  assert.equal(replay.accepted, true);
  assert.equal(replay.replayed, true);
  assert.equal(replay.observationId, first.observationId);
  assert.deepEqual({ observations: observers.snapshot().totalObservations, events: events.snapshot().total }, before);
  const conflict = bridge.ingest(baseEvent({ summary: 'Reminder was deleted' }), { tick: 99 });
  assert.deepEqual(conflict, { accepted: false, error: 'event-id-conflict' });
  assert.equal(bridge.snapshot().totalConflicts, 1);
  assert.deepEqual({ observations: observers.snapshot().totalObservations, events: events.snapshot().total }, before);
}

// The bounded receipt ledger survives a host snapshot/restore and prevents a duplicate after restart.
{
  const { bridge, observers, events } = makeBridge();
  const first = bridge.ingest(baseEvent(), { tick: 7, receivedAt: 1_800_000_100_000 });
  const persisted = bridge.snapshot();
  const restored = new NekoExternalObservationBridge({ observers, events, now: () => 1_800_000_300_000 });
  restored.restore(persisted);
  const replay = restored.ingest(baseEvent(), { tick: 8 });
  assert.equal(replay.accepted, true);
  assert.equal(replay.replayed, true);
  assert.equal(replay.eventNodeId, first.eventNodeId);
  assert.equal(observers.snapshot().totalObservations, 1);
  assert.equal(events.snapshot().total, 1);
}

// Plugin cannot set trust, provenance class, tick, or verification state in the payload.
{
  const { bridge, observers, events } = makeBridge();
  for (const extra of [
    { confidence01: 1 },
    { sourceClass: 'os' },
    { verified: true },
    { tick: 100000 },
    { independenceKey: 'independent-source-claimed-by-plugin' },
  ]) {
    const result = bridge.ingest(baseEvent(extra), { tick: 1 });
    assert.equal(result.accepted, false);
    assert.equal(result.error, 'invalid-event');
  }
  assert.equal(observers.snapshot().totalObservations, 0);
  assert.equal(events.snapshot().total, 0);
}

// Accessors and Proxy objects are rejected without invoking user-controlled getters/traps.
{
  const { bridge, observers, events } = makeBridge();
  let getterCalls = 0;
  const accessor = baseEvent();
  Object.defineProperty(accessor, 'summary', { enumerable: true, get() { getterCalls++; return 'forged'; } });
  assert.equal(bridge.ingest(accessor, { tick: 1 }).error, 'invalid-event');
  assert.equal(getterCalls, 0);
  let proxyCalls = 0;
  const proxy = new Proxy(baseEvent(), { getPrototypeOf() { proxyCalls++; throw new Error('proxy'); } });
  assert.equal(bridge.ingest(proxy, { tick: 1 }).error, 'invalid-event');
  assert.equal(proxyCalls, 0);
  assert.equal(observers.snapshot().totalObservations, 0);
  assert.equal(events.snapshot().total, 0);
}

// Payload lengths, facts count, sparse arrays and future/non-finite clocks are bounded.
{
  const { bridge, observers, events } = makeBridge();
  const badEvents = [
    baseEvent({ summary: 'x'.repeat(321) }),
    baseEvent({ facts: Array.from({ length: 9 }, (_, i) => `fact-${i}`) }),
    baseEvent({ facts: Object.assign(new Array(1), { 1: 'sparse' }) }),
    baseEvent({ reportedAt: Number.POSITIVE_INFINITY }),
    baseEvent({ pluginId: '../outside' }),
    baseEvent({ eventId: 'evt with spaces' }),
  ];
  for (const event of badEvents) assert.equal(bridge.ingest(event, { tick: 1 }).error, 'invalid-event');
  assert.equal(bridge.ingest(baseEvent(), { tick: -1 }).error, 'invalid-context');
  assert.equal(observers.snapshot().totalObservations, 0);
  assert.equal(events.snapshot().total, 0);
}

// A host-disabled observer source cannot be silently re-enabled by an incoming plugin event.
{
  const observers = new ExternalObserverFabric();
  observers.registerSource({
    id: 'neko-plugin.calendar_helper',
    sourceClass: 'unknown',
    channel: 'tool',
    reliability01: 0.25,
    enabled: false,
  });
  const events = new CognitiveEventFabric(256);
  const { bridge } = makeBridge({ observers, events });
  const result = bridge.ingest(baseEvent(), { tick: 1 });
  assert.deepEqual(result, { accepted: false, error: 'source-disabled' });
  assert.equal(observers.snapshot().sources[0].enabled, false);
  assert.equal(observers.snapshot().totalObservations, 0);
  assert.equal(events.snapshot().total, 0);
}

// Invalid bridge snapshots are dropped; receipt capacity is explicit and bounded.
{
  const { bridge } = makeBridge({ maxReceipts: 64 });
  bridge.restore({ version: 2, receipts: [{ eventKey: 'fake' }], totalAccepted: 99 });
  assert.equal(bridge.snapshot().receipts.length, 0);
  assert.equal(bridge.snapshot().totalAccepted, 0);
  assert.throws(() => new NekoExternalObservationBridge({
    observers: new ExternalObserverFabric(), events: new CognitiveEventFabric(), maxReceipts: 10,
  }), /invalid-receipt-capacity/);
}

console.log('NEKO_EXTERNAL_OBSERVATION_BRIDGE=PASS cases=8');
