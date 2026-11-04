import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { NekoPluginGatewayRuntime } from '../src/organism/integration/neko/NekoPluginGatewayRuntime.ts';

const manifest = (overrides = {}) => ({
  schemaVersion: 1,
  id: 'notes',
  name: 'Notes plugin',
  version: '1.0.0',
  enabled: true,
  protocols: ['mcp'],
  tools: [{
    id: 'notes.search',
    capability: 'notes.read',
    destructive: false,
    permissionClass: 'none',
    requiresHostApproval: false,
    actions: ['tool_call', 'resource_read'],
  }],
  ...overrides,
});

const request = (overrides = {}) => ({
  protocol: 'mcp',
  connectionId: 'composition-connection',
  requestId: 'composition-request',
  action: 'tool_call',
  pluginId: 'notes',
  toolId: 'notes.search',
  params: { query: 'NK1 integration' },
  ...overrides,
});

function makeRuntime(options = {}) {
  const gateway = new ActionGateway();
  const calls = [];
  gateway.registerTool({
    id: 'notes.search',
    capability: 'notes.read',
    destructive: false,
    execute: async input => {
      calls.push(structuredClone(input));
      return { echoed: input.query };
    },
  });
  const runtime = new NekoPluginGatewayRuntime({
    gateway,
    allowedProtocols: options.allowedProtocols ?? ['mcp'],
  });
  return { runtime, gateway, calls };
}

// The composition root must require an explicit host protocol allowlist.
{
  const gateway = new ActionGateway();
  assert.throws(
    () => new NekoPluginGatewayRuntime({ gateway, allowedProtocols: [] }),
    /plugin-gateway-explicit-protocol-allowlist-required/,
  );
}

// No manifest means deny; the request must not reach ActionGateway.
{
  const { runtime, calls } = makeRuntime();
  const result = await runtime.handle(request());
  assert.equal(result.success, false);
  assert.equal(result.errorCode, 'policy-denied');
  assert.equal(calls.length, 0);
}

// A manifest is bound to the real ActionGateway descriptor and enables a valid read.
{
  const { runtime, calls } = makeRuntime();
  assert.deepEqual(runtime.registerManifest(manifest()), {
    registered: true,
    pluginId: 'notes',
    toolCount: 1,
  });
  const result = await runtime.handle(request());
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { echoed: 'NK1 integration' });
  assert.equal(result.metadata.verified, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { query: 'NK1 integration' });
}

// Host-level protocol allowlisting remains authoritative even when a manifest declares a protocol.
{
  const { runtime, calls } = makeRuntime();
  runtime.registerManifest(manifest({ protocols: ['mcp', 'https'] }));
  const result = await runtime.handle(request({ protocol: 'https' }));
  assert.equal(result.success, false);
  assert.equal(result.errorCode, 'unsupported-protocol');
  assert.equal(calls.length, 0);
}

// Manifest enabled state is checked for each request; disabling a plugin takes effect immediately.
{
  const { runtime, calls } = makeRuntime();
  runtime.registerManifest(manifest());
  assert.equal(runtime.setPluginEnabled('notes', false), true);
  const denied = await runtime.handle(request());
  assert.equal(denied.errorCode, 'policy-denied');
  assert.equal(calls.length, 0);
  assert.equal(runtime.setPluginEnabled('notes', true), true);
  const accepted = await runtime.handle(request({ requestId: 'composition-request-2' }));
  assert.equal(accepted.success, true);
  assert.equal(calls.length, 1);
}

// A restored disabled manifest stays disabled; restore never promotes plugin authority.
{
  const first = makeRuntime().runtime;
  first.registerManifest(manifest());
  first.setPluginEnabled('notes', false);
  const snapshot = first.snapshotPolicy();
  const second = makeRuntime().runtime;
  assert.equal(second.restorePolicy(snapshot), 1);
  const result = await second.handle(request());
  assert.equal(result.errorCode, 'policy-denied');
}

// Event pushes remain unsupported until a separate host-owned event-bus adapter is introduced.
{
  const { runtime, calls } = makeRuntime();
  runtime.registerManifest(manifest());
  const result = await runtime.handle(request({ action: 'event_push' }));
  assert.equal(result.success, false);
  assert.equal(result.errorCode, 'unsupported-action');
  assert.equal(calls.length, 0);
}

console.log('NEKO_PLUGIN_RUNTIME_COMPOSITION=PASS cases=7');
