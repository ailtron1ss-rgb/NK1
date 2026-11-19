import assert from 'node:assert/strict';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { PluginGatewayAdapter } from '../src/organism/integration/neko/PluginGatewayAdapter.ts';

const gateway = new ActionGateway();
gateway.registerTool({
  id: 'notes.search',
  capability: 'notes.read',
  destructive: false,
  execute: async input => ({ echoed: input.query }),
});
const adapter = new PluginGatewayAdapter({
  gateway,
  authorize: async (request, tool) => request.pluginId === 'notes' && tool.capability === 'notes.read',
  allowedProtocols: ['mcp'],
});
const result = await adapter.handle({
  protocol: 'mcp',
  connectionId: 'real-gateway-connection',
  requestId: 'real-gateway-request',
  action: 'tool_call',
  pluginId: 'notes',
  toolId: 'notes.search',
  params: { query: 'real-gateway' },
});
assert.equal(result.success, true);
assert.deepEqual(result.data, { echoed: 'real-gateway' });
assert.equal(result.metadata?.outcomeClass === 'unknown', false);
console.log('NEKO_PLUGIN_GATEWAY_REAL_ACTION_GATEWAY=PASS');
