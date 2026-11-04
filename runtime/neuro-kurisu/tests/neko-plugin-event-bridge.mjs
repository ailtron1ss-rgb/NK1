import assert from 'node:assert/strict';
import { PluginGatewayAdapter } from '../src/organism/integration/neko/PluginGatewayAdapter.ts';

const bridgeCalls = [];
const eventBridge = {
  async handle(request) {
    bridgeCalls.push(request);
    return { accepted: true, replayed: false, observationId: 'obs:host-owned' };
  },
};
let listToolsCalls = 0;
let executeCalls = 0;
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
  eventBridge,
});

const request = {
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
  idempotencyKey: 'avatar:conn-1:request-1',
};

const result = await adapter.handle(request);
assert.equal(result.success, true, 'an explicitly configured host bridge must receive an allowlisted event push');
assert.equal(result.metadata?.verified, false, 'recording an external event is not proof that its claim is true');
assert.equal(result.metadata?.outcomeClass, 'external-evidence-recorded');
assert.equal(bridgeCalls.length, 1);
assert.deepEqual(bridgeCalls[0], {
  protocol: 'mcp',
  connectionId: 'conn-1',
  requestId: 'request-1',
  pluginId: 'avatar',
  eventType: 'screen.observed',
  eventId: 'avatar:conn-1:request-1',
  payload: request.params,
});
assert.equal(listToolsCalls, 0, 'event ingress must not discover or execute a plugin tool');
assert.equal(executeCalls, 0, 'event ingress must not invoke the action executor');

const disabled = new PluginGatewayAdapter({
  gateway,
  authorize: async () => true,
  allowedProtocols: ['mcp'],
});
const denied = await disabled.handle(request);
assert.equal(denied.success, false);
assert.equal(denied.errorCode, 'unsupported-action', 'event ingress stays disabled unless the host wires its bridge');
assert.equal(bridgeCalls.length, 1);

console.log('NEKO_PLUGIN_EVENT_BRIDGE=PASS cases=1');
