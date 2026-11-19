import assert from 'node:assert/strict';
import { PluginGatewayAdapter } from '../src/organism/integration/neko/PluginGatewayAdapter.ts';

const baseRequest = (overrides = {}) => ({
  protocol: 'mcp',
  connectionId: 'conn-1',
  requestId: 'request-1',
  action: 'tool_call',
  pluginId: 'notes',
  toolId: 'notes.search',
  params: { query: 'NK1 memory' },
  idempotencyKey: 'notes:conn-1:request-1',
  approvalId: 'approval-bound-to-this-request',
  decisionId: 'external-must-not-be-trusted',
  autonomous: true,
  ...overrides,
});

function makeGateway(overrides = {}) {
  const calls = [];
  const gateway = {
    listTools() {
      return overrides.tools ?? [
        { id: 'notes.search', capability: 'notes.read', destructive: false, permissionClass: 'none' },
        { id: 'notes.delete', capability: 'notes.write', destructive: true, permissionClass: 'filesystem' },
        { id: 'calendar.read', capability: 'calendar.read', destructive: false, permissionClass: 'none' },
      ];
    },
    async executeTool(id, params, reason, options) {
      calls.push({ id, params, reason, options });
      return overrides.execution ?? {
        ok: true,
        verified: true,
        executionId: 'private-execution-id',
        tool: id,
        capability: 'notes.read',
        result: { rows: 2, query: params.query },
        audit: {},
        verification: {},
        outcomeClass: 'executed-verified',
      };
    },
  };
  return { gateway, calls };
}

// Authorization is deny-by-default and must run before ActionGateway execution.
{
  const { gateway, calls } = makeGateway();
  const adapter = new PluginGatewayAdapter({
    gateway,
    authorize: async () => false,
    allowedProtocols: ['mcp'],
  });
  const result = await adapter.handle(baseRequest());
  assert.equal(result.success, false);
  assert.equal(result.errorCode, 'policy-denied');
  assert.equal(calls.length, 0, 'denied plugin request must never reach the action executor');
}

// Authorized calls are still delegated to NK1 ActionGateway; external autonomy/decision claims are ignored.
{
  const { gateway, calls } = makeGateway();
  const adapter = new PluginGatewayAdapter({
    gateway,
    authorize: async (request, tool) => request.pluginId === 'notes' && tool.capability === 'notes.read',
    allowedProtocols: ['mcp'],
  });
  const result = await adapter.handle(baseRequest());
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { rows: 2, query: 'NK1 memory' });
  assert.equal(result.metadata.verified, true);
  assert.equal(result.metadata.outcomeClass, 'executed-verified');
  assert.equal('executionId' in result.metadata, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, 'notes.search');
  assert.deepEqual(calls[0].params, { query: 'NK1 memory' });
  assert.equal(Object.isFrozen(calls[0].params), true);
  assert.equal(calls[0].options.autonomous, false);
  assert.equal(calls[0].options.decisionId, undefined);
  assert.equal(calls[0].options.idempotencyKey, 'notes:conn-1:request-1');
  assert.equal(calls[0].options.approvalId, 'approval-bound-to-this-request');
}

// A plugin cannot invoke tools owned by another plugin, even when its policy callback is permissive.
{
  const { gateway, calls } = makeGateway();
  let policyCalls = 0;
  const adapter = new PluginGatewayAdapter({
    gateway,
    authorize: async () => { policyCalls++; return true; },
    allowedProtocols: ['mcp'],
  });
  const result = await adapter.handle(baseRequest({ toolId: 'calendar.read' }));
  assert.equal(result.errorCode, 'tool-not-available');
  assert.equal(policyCalls, 0);
  assert.equal(calls.length, 0);
}

// Resource reads must target explicitly non-destructive read capabilities.
{
  const { gateway, calls } = makeGateway();
  const adapter = new PluginGatewayAdapter({ gateway, authorize: async () => true, allowedProtocols: ['mcp'] });
  const denied = await adapter.handle(baseRequest({ action: 'resource_read', toolId: 'notes.delete', params: {} }));
  assert.equal(denied.errorCode, 'read-route-denied');
  assert.equal(calls.length, 0);
  const accepted = await adapter.handle(baseRequest({ action: 'resource_read', params: {} }));
  assert.equal(accepted.success, true);
  assert.equal(calls.length, 1);
}

// Event pushes need a host event-bus adapter and are never silently converted to tool calls.
{
  const { gateway, calls } = makeGateway();
  const adapter = new PluginGatewayAdapter({ gateway, authorize: async () => true, allowedProtocols: ['mcp'] });
  const result = await adapter.handle(baseRequest({ action: 'event_push' }));
  assert.equal(result.errorCode, 'unsupported-action');
  assert.equal(calls.length, 0);
}

// Accessors and Proxy payloads fail closed without invoking attacker-controlled traps.
{
  const { gateway, calls } = makeGateway();
  let getterCalls = 0;
  const params = {};
  Object.defineProperty(params, 'query', { enumerable: true, get() { getterCalls++; return 'secret'; } });
  const adapter = new PluginGatewayAdapter({ gateway, authorize: async () => true, allowedProtocols: ['mcp'] });
  const accessorResult = await adapter.handle(baseRequest({ params }));
  assert.equal(accessorResult.errorCode, 'invalid-request');
  assert.equal(getterCalls, 0);
  let proxyCalls = 0;
  const proxy = new Proxy({ query: 'x' }, { getPrototypeOf() { proxyCalls++; throw new Error('proxy trap'); } });
  const proxyResult = await adapter.handle(baseRequest({ params: proxy }));
  assert.equal(proxyResult.errorCode, 'invalid-request');
  assert.equal(proxyCalls, 0);
  assert.equal(calls.length, 0);
}

// Oversized/deep payloads and untrusted protocols are rejected before policy or execution.
{
  const { gateway, calls } = makeGateway();
  let policyCalls = 0;
  const adapter = new PluginGatewayAdapter({ gateway, authorize: async () => { policyCalls++; return true; }, allowedProtocols: ['mcp'], maxPayloadBytes: 64 });
  const oversized = await adapter.handle(baseRequest({ params: { query: 'x'.repeat(100) } }));
  assert.equal(oversized.errorCode, 'invalid-request');
  const protocol = await adapter.handle(baseRequest({ protocol: 'shell' }));
  assert.equal(protocol.errorCode, 'unsupported-protocol');
  assert.equal(policyCalls, 0);
  assert.equal(calls.length, 0);
}

// Policy exceptions, cycles and exotic prototypes fail closed.
{
  const { gateway, calls } = makeGateway();
  const throwingPolicy = new PluginGatewayAdapter({ gateway, authorize: async () => { throw new Error('policy-crash'); }, allowedProtocols: ['mcp'] });
  const denied = await throwingPolicy.handle(baseRequest());
  assert.equal(denied.errorCode, 'policy-denied');
  const invalid = await throwingPolicy.handle(baseRequest({ params: { when: new Date() } }));
  assert.equal(invalid.errorCode, 'invalid-request');
  const cycle = {}; cycle.self = cycle;
  const cyclic = await throwingPolicy.handle(baseRequest({ params: cycle }));
  assert.equal(cyclic.errorCode, 'invalid-request');
  assert.equal(calls.length, 0);
}

// Unsafe provider results are omitted without falsifying the action's execution status.
{
  const unsafe = { ok: true, verified: false, executionId: 'private', tool: 'notes.search', capability: 'notes.read', result: {}, audit: {}, verification: {}, outcomeClass: 'executed-unverified' };
  Object.defineProperty(unsafe.result, 'token', { enumerable: true, get() { throw new Error('must-not-run'); } });
  const { gateway } = makeGateway({ execution: unsafe });
  const adapter = new PluginGatewayAdapter({ gateway, authorize: async () => true, allowedProtocols: ['mcp'] });
  const result = await adapter.handle(baseRequest());
  assert.equal(result.success, true);
  assert.equal(result.data, undefined);
  assert.equal(result.metadata.resultOmitted, true);
  assert.equal(result.metadata.verified, false);
}

console.log('NEKO_PLUGIN_GATEWAY_ADAPTER=PASS cases=9');
