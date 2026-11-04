import assert from 'node:assert/strict';
import { NekoPluginManifestPolicyRegistry } from '../src/organism/integration/neko/NekoPluginManifestPolicyRegistry.ts';

const registeredTools = [
  { id: 'notes.search', capability: 'notes.read', destructive: false, permissionClass: 'none', requiresApproval: false },
  { id: 'notes.delete', capability: 'notes.write', destructive: true, permissionClass: 'filesystem', requiresApproval: true },
  { id: 'notes.export', capability: 'notes.export', destructive: false, permissionClass: 'web', requiresApproval: true },
];
const makeGateway = (options = {}) => ({
  listTools() {
    if (options.throwList) throw new Error('gateway-down');
    return options.tools ?? registeredTools;
  },
});
const manifest = (overrides = {}) => ({
  schemaVersion: 1,
  id: 'notes',
  name: 'Notes plugin',
  version: '1.2.0',
  enabled: true,
  protocols: ['mcp'],
  tools: [
    {
      id: 'notes.search',
      capability: 'notes.read',
      destructive: false,
      permissionClass: 'none',
      requiresHostApproval: false,
      actions: ['tool_call', 'resource_read'],
    },
    {
      id: 'notes.delete',
      capability: 'notes.write',
      destructive: true,
      permissionClass: 'filesystem',
      requiresHostApproval: true,
      actions: ['tool_call'],
    },
  ],
  ...overrides,
});
const context = (overrides = {}) => ({
  protocol: 'mcp',
  connectionId: 'conn-1',
  requestId: 'req-1',
  action: 'tool_call',
  pluginId: 'notes',
  toolId: 'notes.search',
  params: { query: 'x' },
  ...overrides,
});
const makeRegistry = (options = {}) => new NekoPluginManifestPolicyRegistry(makeGateway(options));

// Exact registered tools are bound to the manifest; read + tool_call policies are explicit.
{
  const gateway = makeGateway();
  const registry = new NekoPluginManifestPolicyRegistry(gateway);
  assert.deepEqual(registry.register(manifest()), { registered: true, pluginId: 'notes', toolCount: 2 });
  const search = registeredTools[0];
  assert.equal(await registry.authorize(context(), search), true);
  const callback = registry.asAuthorizer();
  assert.equal(await callback(context(), search), true, 'the injected callback must retain its registry instance');
  assert.equal(await registry.authorize(context({ action: 'resource_read' }), search), true);
  assert.equal(await registry.authorize(context({ action: 'resource_read', toolId: 'notes.delete' }), registeredTools[1]), false);
  assert.equal(await registry.authorize(context({ toolId: 'notes.delete' }), registeredTools[1]), true);
}

// Disabled plugins, unlisted protocols, actions and tools are denied.
{
  const registry = makeRegistry();
  assert.equal(registry.register(manifest()).registered, true);
  assert.equal(await registry.authorize(context({ protocol: 'shell' }), registeredTools[0]), false);
  assert.equal(await registry.authorize(context({ toolId: 'notes.export' }), registeredTools[2]), false);
  assert.equal(await registry.authorize(context({ action: 'resource_read', toolId: 'notes.delete' }), registeredTools[1]), false);
  registry.setEnabled('notes', false);
  assert.equal(await registry.authorize(context(), registeredTools[0]), false);
  registry.setEnabled('notes', true);
  assert.equal(await registry.authorize(context(), registeredTools[0]), true);
}

// Registration checks tool identity, capability, destructive bit and real permission class.
{
  for (const altered of [
    { capability: 'notes.admin' },
    { destructive: true },
    { permissionClass: 'system', requiresHostApproval: true },
    { requiresHostApproval: true },
  ]) {
    const invalid = manifest();
    invalid.tools = invalid.tools.map((tool, index) => index === 0
      ? { ...tool, ...altered, actions: ['tool_call'] }
      : tool);
    const registry = makeRegistry();
    assert.deepEqual(registry.register(invalid), { registered: false, reason: 'registered-tool-contract-mismatch' });
  }
}

// Manifest cannot downscope approval on privileged tools or label a destructive writer as a read.
{
  const missingApproval = manifest();
  missingApproval.tools[1] = { ...missingApproval.tools[1], requiresHostApproval: false };
  assert.deepEqual(makeRegistry().register(missingApproval), { registered: false, reason: 'invalid-approval-declaration' });
  const badRead = manifest();
  badRead.tools[1] = { ...badRead.tools[1], actions: ['tool_call', 'resource_read'] };
  assert.deepEqual(makeRegistry().register(badRead), { registered: false, reason: 'invalid-resource-read-declaration' });
}

// Plugin namespace and duplicate declarations are rejected.
{
  const foreign = manifest();
  foreign.tools[0] = { ...foreign.tools[0], id: 'calendar.read' };
  assert.deepEqual(makeRegistry().register(foreign), { registered: false, reason: 'plugin-tool-namespace-mismatch' });
  const duplicate = manifest();
  duplicate.tools[1] = { ...duplicate.tools[1], id: 'notes.search' };
  assert.deepEqual(makeRegistry().register(duplicate), { registered: false, reason: 'invalid-manifest' });
  const registry = makeRegistry();
  assert.equal(registry.register(manifest()).registered, true);
  assert.deepEqual(registry.register(manifest()), { registered: false, reason: 'duplicate-plugin' });
}

// Live ActionGateway drift invalidates existing authorization without mutating a manifest.
{
  const mutableTools = structuredClone(registeredTools);
  const registry = new NekoPluginManifestPolicyRegistry(makeGateway({ tools: mutableTools }));
  assert.equal(registry.register(manifest()).registered, true);
  mutableTools[0].capability = 'notes.write';
  assert.equal(await registry.authorize(context(), mutableTools[0]), false);
  mutableTools[0].capability = 'notes.read';
  assert.equal(await registry.authorize(context(), mutableTools[0]), true);
}

// Policy compares the adapter-provided descriptor against the canonical registry as well.
{
  const registry = makeRegistry();
  registry.register(manifest());
  assert.equal(await registry.authorize(context(), { ...registeredTools[0], permissionClass: 'system' }), false);
  assert.equal(await registry.authorize(context(), { ...registeredTools[0], requiresApproval: true }), false);
}

// Registry lifecycle is explicit, and returned manifests cannot mutate stored policy.
{
  const registry = makeRegistry();
  assert.equal(registry.register(manifest()).registered, true);
  const exposed = registry.get('notes');
  exposed.tools[0].actions.push('resource_write');
  assert.equal(await registry.authorize(context({ action: 'resource_read' }), registeredTools[0]), true);
  const changed = manifest({ enabled: false, protocols: ['mcp', 'https'] });
  assert.deepEqual(registry.replace(changed), { registered: true, pluginId: 'notes', toolCount: 2 });
  assert.equal(await registry.authorize(context(), registeredTools[0]), false);
  assert.equal(registry.remove('notes'), true);
  assert.equal(registry.get('notes'), null);
}

// Snapshots restore only validated exact manifests and preserve disabled state.
{
  const registry = makeRegistry();
  registry.register(manifest());
  registry.setEnabled('notes', false);
  const snapshot = registry.snapshot();
  const restored = makeRegistry();
  assert.equal(restored.restore(snapshot), 1);
  assert.equal(await restored.authorize(context(), registeredTools[0]), false);
  assert.equal(restored.restore({ version: 2, manifests: snapshot.manifests }), 0);
  assert.equal(restored.list().length, 0);
}

// Restore is all-or-nothing: a valid prefix must not survive a malformed later entry.
{
  const registry = makeRegistry();
  assert.equal(registry.register(manifest()).registered, true);
  const invalidLaterEntry = manifest({ id: 'calendar' });
  const malformedSnapshot = { version: 1, manifests: [manifest(), invalidLaterEntry] };

  assert.equal(registry.restore(malformedSnapshot), 0,
    'one invalid manifest must reject the entire snapshot instead of restoring a valid prefix');
  assert.equal(registry.list().length, 0,
    'a failed restore must leave no partially restored plugin permissions');
  assert.equal(await registry.authorize(context(), registeredTools[0]), false,
    'partially restored policy must never authorize a plugin request');

  const duplicateSnapshot = { version: 1, manifests: [manifest(), manifest()] };
  assert.equal(registry.restore(duplicateSnapshot), 0,
    'duplicate plugin identifiers must reject the entire snapshot');
  assert.equal(registry.list().length, 0,
    'duplicate snapshot entries must not leave the first duplicate active');
}

// Malformed objects cannot execute getters or Proxy traps; dynamic code fields are not in schema.
{
  const registry = makeRegistry();
  let getterCalls = 0;
  const bad = manifest();
  Object.defineProperty(bad, 'entrypoint', { enumerable: true, get() { getterCalls++; return './run.js'; } });
  assert.deepEqual(registry.register(bad), { registered: false, reason: 'invalid-manifest' });
  assert.equal(getterCalls, 0);
  let proxyCalls = 0;
  const proxy = new Proxy(manifest(), { getPrototypeOf() { proxyCalls++; throw new Error('proxy'); } });
  assert.deepEqual(registry.register(proxy), { registered: false, reason: 'invalid-manifest' });
  assert.equal(proxyCalls, 0);
  assert.equal(registry.register(manifest({ entrypoint: './run.js' })).registered, false);
  assert.equal(registry.register(manifest({ protocols: ['mcp', 'mcp'] })).registered, false);
  assert.equal(registry.register(manifest({ tools: new Array(1) })).registered, false);
}

// Bind a real NK1 ActionGateway descriptor, including its inferred permission metadata.
{
  const { ActionGateway } = await import('../src/organism/system/ActionGateway.ts');
  const gateway = new ActionGateway();
  gateway.registerTool({
    id: 'notes.search',
    capability: 'notes.read',
    destructive: false,
    execute: async input => ({ echoed: input.query }),
  });
  const registry = new NekoPluginManifestPolicyRegistry(gateway);
  const realManifest = manifest({
    tools: [manifest().tools[0]],
  });
  assert.deepEqual(registry.register(realManifest), { registered: true, pluginId: 'notes', toolCount: 1 });
  const descriptor = gateway.listTools().find(tool => tool.id === 'notes.search');
  assert.ok(descriptor);
  assert.equal(descriptor.permissionClass, 'none');
  assert.equal(descriptor.requiresApproval, false);
  assert.equal(await registry.authorize(context(), descriptor), true);
  const execution = await gateway.executeTool('notes.search', { query: 'integration' }, 'manifest-policy-integration');
  assert.equal(execution.ok, true);
  assert.deepEqual(execution.result, { echoed: 'integration' });
}

// Live gateway failures deny registration and runtime authorization.
{
  const registry = makeRegistry({ throwList: true });
  assert.deepEqual(registry.register(manifest()), { registered: false, reason: 'gateway-unavailable' });
  const normal = makeRegistry();
  normal.register(manifest());
  const unavailable = new NekoPluginManifestPolicyRegistry({ listTools() { throw new Error('down'); } });
  unavailable.restore(normal.snapshot());
  assert.equal(await unavailable.authorize(context(), registeredTools[0]), false);
}

console.log('NEKO_PLUGIN_MANIFEST_POLICY=PASS cases=11');
