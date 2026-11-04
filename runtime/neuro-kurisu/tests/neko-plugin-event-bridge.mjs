import assert from 'node:assert/strict';
import { PluginGatewayAdapter } from '../src/organism/integration/neko/PluginGatewayAdapter.ts';
import { NekoPluginEventBridge } from '../src/organism/integration/neko/NekoPluginEventBridge.ts';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';
import { ExternalObserverFabric } from '../src/organism/system/ExternalObserverFabric.ts';

const baseRequest = (overrides = {}) => ({
  protocol: 'mcp',
  connectionId: 'conn-1',
  requestId: 'request-1',
  action: 'event_push',
  pluginId: 'avatar',
  toolId: 'avatar.screen.observed',
  params: {
    claimKey: 'window-state',
    facts: ['IDE window visible'],
    observedPostcondition: 'active=true',
  },
  eventId: 'frame-0001',
  idempotencyKey: 'avatar:conn-1:frame-0001',
  ...overrides,
});

function makeRig({ authorize = async () => true, capacity = 512 } = {}) {
  const observer = new ExternalObserverFabric();
  const eventFabric = new CognitiveEventFabric(capacity);
  let tick = 41;
  let now = 1_800_000_000_000;
  let listToolsCalls = 0;
  let executeCalls = 0;
  let authorizationCalls = 0;
  const bridge = new NekoPluginEventBridge({
    observer,
    eventFabric,
    allowedEvents: {
      'screen.observed': {
        channel: 'camera',
        confidenceCap01: 0.68,
        requirePostcondition: true,
      },
    },
    authorize: async context => {
      authorizationCalls += 1;
      return authorize(context);
    },
    getTick: () => tick,
    now: () => now,
  });
  const gateway = {
    listTools() {
      listToolsCalls += 1;
      return [];
    },
    async executeTool() {
      executeCalls += 1;
      return { ok: true, verified: true, result: {} };
    },
  };
  const adapter = new PluginGatewayAdapter({
    gateway,
    authorize: async () => true,
    allowedProtocols: ['mcp'],
    eventBridge: bridge,
  });
  return {
    adapter,
    bridge,
    observer,
    eventFabric,
    setClock(nextTick, nextNow) { tick = nextTick; now = nextNow; },
    get calls() { return { listToolsCalls, executeCalls, authorizationCalls }; },
  };
}

// A configured host bridge receives event_push; events never enter the tool executor.
{
  const calls = [];
  const adapter = new PluginGatewayAdapter({
    gateway: {
      listTools() { throw new Error('event ingress must not list tools'); },
      async executeTool() { throw new Error('event ingress must not execute tools'); },
    },
    authorize: async () => true,
    allowedProtocols: ['mcp'],
    eventBridge: {
      async handle(request) {
        calls.push(request);
        return { accepted: true, replayed: false, observationId: 'obs:host-owned' };
      },
    },
  });
  const request = baseRequest();
  const result = await adapter.handle(request);
  assert.equal(result.success, true);
  assert.equal(result.metadata?.verified, false, 'event acceptance is not proof of the external claim');
  assert.equal(result.metadata?.outcomeClass, 'external-evidence-recorded');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    protocol: 'mcp',
    connectionId: 'conn-1',
    requestId: 'request-1',
    pluginId: 'avatar',
    eventType: 'screen.observed',
    eventId: 'frame-0001',
    payload: request.params,
  });
}

// N.E.K.O. events are projected to NK1's existing observer and causal fabric as untrusted evidence.
{
  const rig = makeRig();
  const request = baseRequest();
  const first = await rig.adapter.handle(request);
  assert.equal(first.success, true);
  assert.equal(first.metadata?.verified, false);
  assert.equal(first.metadata?.outcomeClass, 'external-evidence-recorded');

  const observerState = rig.observer.snapshot();
  assert.equal(observerState.observations.length, 1);
  assert.equal(observerState.assessments.length, 0, 'an incoming event must not self-verify');
  assert.equal(observerState.observations[0].sourceClass, 'external-api');
  assert.equal(observerState.observations[0].channel, 'camera');
  assert.ok(observerState.observations[0].claimKey.startsWith('neko-plugin:'));
  assert.ok(observerState.observations[0].confidence01 <= 0.70);
  assert.ok(observerState.sources[0].reliability01 <= 0.70);

  const causal = rig.eventFabric.snapshot();
  assert.equal(causal.total, 2);
  assert.equal(causal.recent.length, 2);
  assert.ok(causal.recent.every(event => event.stage === 'external-evidence' && event.external));
  const observationNode = causal.recent.find(event => event.payload.phase === 'observation-recorded');
  const receivedNode = causal.recent.find(event => event.payload.phase === 'received');
  assert.ok(observationNode);
  assert.ok(receivedNode);
  assert.deepEqual(observationNode.parentIds, [receivedNode.id]);
  assert.equal(observationNode.payload.observationId, observerState.observations[0].id);
  assert.equal('facts' in observationNode.payload, false, 'raw plugin payload is not copied into the causal ledger');
  assert.equal(rig.calls.listToolsCalls, 0);
  assert.equal(rig.calls.executeCalls, 0);
}

// Same event ID and payload replay the original observation and causal IDs, even on a later tick.
{
  const rig = makeRig();
  const request = baseRequest();
  const first = await rig.adapter.handle(request);
  const before = {
    observer: rig.observer.snapshot().observations[0].id,
    causalTotal: rig.eventFabric.snapshot().total,
  };
  rig.setClock(99, 1_800_000_030_000);
  const replay = await rig.adapter.handle(request);
  assert.equal(replay.success, true);
  assert.equal(replay.metadata?.replayed, true);
  assert.equal(rig.observer.snapshot().observations.length, 1);
  assert.equal(rig.observer.snapshot().observations[0].id, before.observer);
  assert.equal(rig.eventFabric.snapshot().total, before.causalTotal);
  assert.equal(rig.calls.authorizationCalls, 2, 'host policy is rechecked on every delivery attempt');
}

// Exact CEF lookup keeps idempotency safe beyond the short recent-event window.
{
  const rig = makeRig();
  const request = baseRequest();
  await rig.adapter.handle(request);
  for (let index = 0; index < 270; index += 1) {
    rig.eventFabric.append({
      id: `unrelated-event-${index}`,
      tick: index,
      stage: 'external-evidence',
      source: 'test-noise',
      external: true,
      confidence01: 0.1,
      payload: { index },
    });
  }
  const before = rig.eventFabric.snapshot().total;
  rig.setClock(120, 1_800_000_120_000);
  const replay = await rig.adapter.handle(request);
  assert.equal(replay.success, true);
  assert.equal(replay.metadata?.replayed, true);
  assert.equal(rig.eventFabric.snapshot().total, before);
  assert.equal(rig.observer.snapshot().observations.length, 1);
}

// If the causal event is aged out first, the retained observer receipt remains an idempotency anchor.
{
  const rig = makeRig({ capacity: 128 });
  const request = baseRequest();
  await rig.adapter.handle(request);
  const receivedId = rig.eventFabric.recent(2).find(event => event.payload.phase === 'received')?.id;
  assert.ok(receivedId);
  for (let index = 0; index < 130; index += 1) {
    rig.eventFabric.append({
      id: `evicting-event-${index}`,
      tick: index,
      stage: 'external-evidence',
      source: 'test-noise',
      external: true,
      confidence01: 0.1,
      payload: { index },
    });
  }
  assert.equal(rig.eventFabric.findById(receivedId), undefined, 'the causal buffer has evicted the first receipt');
  const before = rig.eventFabric.snapshot().total;
  rig.setClock(121, 1_800_000_121_000);
  const replay = await rig.adapter.handle(request);
  assert.equal(replay.success, true, JSON.stringify({ replay, observer: rig.observer.snapshot().observations.map(row => ({ id: row.id, claimKey: row.claimKey, sourceId: row.sourceId, payloadHash: row.payloadHash, metadata: row.metadata })) }));
  assert.equal(replay.metadata?.replayed, true);
  assert.equal(rig.eventFabric.snapshot().total, before);
  assert.equal(rig.observer.snapshot().observations.length, 1);
}

// Reusing an event ID for different contents is a conflict, never a silent overwrite.
{
  const rig = makeRig();
  await rig.adapter.handle(baseRequest());
  const before = rig.eventFabric.snapshot().total;
  const conflict = await rig.adapter.handle(baseRequest({
    params: {
      claimKey: 'window-state',
      facts: ['different screen content'],
      observedPostcondition: 'active=false',
    },
  }));
  assert.equal(conflict.success, false);
  assert.equal(conflict.errorCode, 'event-idempotency-conflict');
  assert.equal(rig.observer.snapshot().observations.length, 1);
  assert.equal(rig.eventFabric.snapshot().total, before);
}

// Host policy denial happens before either canonical evidence store is mutated.
{
  const rig = makeRig({ authorize: async () => false });
  const denied = await rig.adapter.handle(baseRequest());
  assert.equal(denied.success, false);
  assert.equal(denied.errorCode, 'event-policy-denied');
  assert.equal(rig.observer.snapshot().observations.length, 0);
  assert.equal(rig.eventFabric.snapshot().total, 0);
}

// A persisted disabled source remains disabled; ingress cannot reactivate it or append a receipt.
{
  const rig = makeRig();
  await rig.adapter.handle(baseRequest());
  const existing = rig.observer.snapshot().sources[0];
  rig.observer.registerSource({
    id: existing.id,
    sourceClass: existing.sourceClass,
    channel: existing.channel,
    independenceKey: existing.independenceKey,
    reliability01: existing.reliability01,
    enabled: false,
  });
  const beforeTotal = rig.eventFabric.snapshot().total;
  const denied = await rig.adapter.handle(baseRequest({
    eventId: 'disabled-source-event',
    idempotencyKey: 'avatar:conn-1:disabled-source-event',
  }));
  assert.equal(denied.success, false);
  assert.equal(denied.errorCode, 'event-source-disabled');
  assert.equal(rig.eventFabric.snapshot().total, beforeTotal);
  assert.equal(rig.observer.snapshot().observations.length, 1);
}

// The event type is an exact host allowlist; unknown events do not reach either store.
{
  const rig = makeRig();
  const denied = await rig.adapter.handle(baseRequest({ toolId: 'avatar.screen.raw-frame' }));
  assert.equal(denied.success, false);
  assert.equal(denied.errorCode, 'event-not-allowlisted');
  assert.equal(rig.observer.snapshot().observations.length, 0);
  assert.equal(rig.eventFabric.snapshot().total, 0);
}

// Only the minimal normalized evidence shape is accepted; plugins cannot inject trust or control fields.
{
  const rig = makeRig();
  const denied = await rig.adapter.handle(baseRequest({
    eventId: 'frame-with-forbidden-fields',
    params: {
      claimKey: 'window-state',
      facts: ['IDE visible'],
      observedPostcondition: 'active=true',
      verified: true,
      confidence01: 1,
    },
  }));
  assert.equal(denied.success, false);
  assert.equal(denied.errorCode, 'invalid-event-payload');
  assert.equal(rig.observer.snapshot().observations.length, 0);
  assert.equal(rig.eventFabric.snapshot().total, 0);
}

// An accessor-backed payload is rejected without invoking its getter.
{
  const rig = makeRig();
  let getterCalls = 0;
  const params = { claimKey: 'window-state', facts: ['IDE visible'], observedPostcondition: 'active=true' };
  Object.defineProperty(params, 'verified', {
    enumerable: true,
    get() { getterCalls += 1; return true; },
  });
  const denied = await rig.adapter.handle(baseRequest({ params, eventId: 'frame-accessor' }));
  assert.equal(denied.success, false);
  assert.equal(denied.errorCode, 'invalid-request');
  assert.equal(getterCalls, 0);
  assert.equal(rig.observer.snapshot().observations.length, 0);
}

// Event-specific policy must remain below the NK1 verification trust boundary.
{
  const observer = new ExternalObserverFabric();
  const eventFabric = new CognitiveEventFabric();
  assert.throws(() => new NekoPluginEventBridge({
    observer,
    eventFabric,
    allowedEvents: { 'screen.observed': { channel: 'camera', confidenceCap01: 0.72 } },
    authorize: async () => true,
    getTick: () => 1,
  }), /neko-plugin-event-policy-invalid/);
}

// No bridge means event_push remains disabled; tool approval credentials cannot authorize event ingress.
{
  const rig = makeRig();
  const disabled = new PluginGatewayAdapter({
    gateway: { listTools: () => [], executeTool: async () => ({ ok: true }) },
    authorize: async () => true,
    allowedProtocols: ['mcp'],
  });
  const noBridge = await disabled.handle(baseRequest({ eventId: 'no-bridge' }));
  assert.equal(noBridge.success, false);
  assert.equal(noBridge.errorCode, 'unsupported-action');

  const approved = await rig.adapter.handle(baseRequest({
    eventId: 'approval-not-transferable',
    approvalId: 'tool-approval-token',
  }));
  assert.equal(approved.success, false);
  assert.equal(approved.errorCode, 'invalid-request');
  assert.equal(rig.observer.snapshot().observations.length, 0);
}

// The plugin namespace and the protocol allowlist still apply before the host bridge.
{
  const rig = makeRig();
  const wrongProtocol = await rig.adapter.handle(baseRequest({ protocol: 'shell', eventId: 'wrong-protocol' }));
  assert.equal(wrongProtocol.success, false);
  assert.equal(wrongProtocol.errorCode, 'unsupported-protocol');

  const foreignNamespace = await rig.adapter.handle(baseRequest({
    pluginId: 'other-plugin',
    toolId: 'avatar.screen.observed',
    eventId: 'foreign-namespace',
  }));
  assert.equal(foreignNamespace.success, false);
  assert.equal(foreignNamespace.errorCode, 'tool-not-available');
  assert.equal(rig.observer.snapshot().observations.length, 0);
}

console.log('NEKO_PLUGIN_EVENT_BRIDGE=PASS cases=13');
