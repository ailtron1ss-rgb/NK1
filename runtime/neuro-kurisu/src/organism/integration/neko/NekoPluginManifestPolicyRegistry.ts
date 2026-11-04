import { types as nodeUtilTypes } from 'node:util';

export type NekoPluginPolicyAction = 'tool_call' | 'resource_read';
export type NekoPluginPermissionClass =
  | 'none'
  | 'web'
  | 'device'
  | 'filesystem'
  | 'code'
  | 'system'
  | 'self-modification';

export interface NekoPluginRegisteredTool {
  id: string;
  capability: string;
  destructive: boolean;
  permissionClass?: string;
  requiresApproval?: boolean;
}

export interface NekoPluginManifestGateway {
  /** Must be the canonical ActionGateway listTools view, not plugin-supplied data. */
  listTools(): NekoPluginRegisteredTool[];
}

export interface NekoPluginManifestTool {
  id: string;
  capability: string;
  destructive: boolean;
  permissionClass: NekoPluginPermissionClass;
  requiresHostApproval: boolean;
  actions: NekoPluginPolicyAction[];
}

export interface NekoPluginAuthorizationManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  protocols: string[];
  tools: NekoPluginManifestTool[];
}

export interface NekoPluginManifestPolicyContext {
  protocol: string;
  connectionId: string;
  requestId: string;
  action: NekoPluginPolicyAction;
  pluginId: string;
  toolId: string;
  params: Readonly<Record<string, unknown>>;
  idempotencyKey?: string;
  approvalId?: string;
}

export interface NekoPluginManifestPolicySnapshot {
  version: 1;
  manifests: NekoPluginAuthorizationManifest[];
}

export type NekoPluginManifestRegistrationError =
  | 'invalid-manifest'
  | 'duplicate-plugin'
  | 'plugin-tool-namespace-mismatch'
  | 'registered-tool-not-found'
  | 'registered-tool-contract-mismatch'
  | 'invalid-resource-read-declaration'
  | 'invalid-approval-declaration'
  | 'gateway-unavailable';

export type NekoPluginManifestRegistrationResult =
  | { registered: true; pluginId: string; toolCount: number }
  | { registered: false; reason: NekoPluginManifestRegistrationError };

const MANIFEST_KEYS = new Set(['schemaVersion', 'id', 'name', 'version', 'enabled', 'protocols', 'tools']);
const TOOL_KEYS = new Set(['id', 'capability', 'destructive', 'permissionClass', 'requiresHostApproval', 'actions']);
const PLUGIN_ID = /^[a-z0-9][a-z0-9._-]{1,47}$/i;
const TOOL_ID = /^[a-z0-9][a-z0-9._-]{1,127}$/i;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?(?:\+[0-9a-z.-]+)?$/i;
const PROTOCOL = /^[a-z][a-z0-9._+-]{0,31}$/i;
const PERMISSIONS = new Set<NekoPluginPermissionClass>([
  'none', 'web', 'device', 'filesystem', 'code', 'system', 'self-modification',
]);
const ACTIONS = new Set<NekoPluginPolicyAction>(['tool_call', 'resource_read']);
const CONTROL = /[\u0000-\u001f\u007f]/;

function ownDataObject(value: unknown, maxProperties: number): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || nodeUtilTypes.isProxy(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length > maxProperties) return null;
    const output: Record<string, unknown> = {};
    for (const key of keys) {
      if (typeof key !== 'string' || key === '__proto__' || key === 'prototype' || key === 'constructor') return null;
      const descriptor = descriptors[key];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) return null;
      output[key] = descriptor.value;
    }
    return output;
  } catch {
    return null;
  }
}

function ownDenseArray(value: unknown, maxLength: number): unknown[] | null {
  try {
    if (!Array.isArray(value) || nodeUtilTypes.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > maxLength) return null;
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length !== length + 1) return null;
    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch {
    return null;
  }
}

function boundedString(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || CONTROL.test(value)) return null;
  const result = value.normalize('NFKC').trim();
  return result.length > 0 && result.length <= max ? result : null;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizeTool(
  raw: unknown,
  pluginId: string,
): { tool: NekoPluginManifestTool } | { reason: NekoPluginManifestRegistrationError } {
  const row = ownDataObject(raw, 12);
  if (!row || Object.keys(row).some(key => !TOOL_KEYS.has(key))) return { reason: 'invalid-manifest' };
  const id = boundedString(row.id, 128);
  const capability = boundedString(row.capability, 128);
  if (!id || !TOOL_ID.test(id) || !id.startsWith(`${pluginId}.`) || !capability ||
      typeof row.destructive !== 'boolean' || typeof row.requiresHostApproval !== 'boolean' ||
      typeof row.permissionClass !== 'string' || !PERMISSIONS.has(row.permissionClass as NekoPluginPermissionClass)) {
    return { reason: 'plugin-tool-namespace-mismatch' };
  }
  const actionRows = ownDenseArray(row.actions, 2);
  if (!actionRows || actionRows.length === 0 ||
      actionRows.some(action => typeof action !== 'string' || !ACTIONS.has(action as NekoPluginPolicyAction)) ||
      new Set(actionRows).size !== actionRows.length) return { reason: 'invalid-manifest' };
  const actions = actionRows as NekoPluginPolicyAction[];
  if (actions.includes('resource_read') &&
      (row.destructive !== false || !/(?:\.read|:read)$/i.test(capability))) {
    return { reason: 'invalid-resource-read-declaration' };
  }
  if (row.permissionClass !== 'none' && row.requiresHostApproval !== true) {
    return { reason: 'invalid-approval-declaration' };
  }
  return {
    tool: {
      id,
      capability,
      destructive: row.destructive,
      permissionClass: row.permissionClass as NekoPluginPermissionClass,
      requiresHostApproval: row.requiresHostApproval,
      actions: [...actions],
    },
  };
}

export class NekoPluginManifestPolicyRegistry {
  private readonly gateway: NekoPluginManifestGateway;
  private readonly manifests = new Map<string, NekoPluginAuthorizationManifest>();

  constructor(gateway: NekoPluginManifestGateway) {
    if (!gateway || typeof gateway.listTools !== 'function') throw new Error('neko-manifest-action-gateway-required');
    this.gateway = gateway;
  }

  register(rawManifest: unknown): NekoPluginManifestRegistrationResult {
    const normalized = this.normalizeManifest(rawManifest);
    if (!normalized.manifest) return { registered: false, reason: normalized.reason! };
    if (this.manifests.has(normalized.manifest.id)) return { registered: false, reason: 'duplicate-plugin' };
    this.manifests.set(normalized.manifest.id, deepFreeze(normalized.manifest));
    return { registered: true, pluginId: normalized.manifest.id, toolCount: normalized.manifest.tools.length };
  }

  replace(rawManifest: unknown): NekoPluginManifestRegistrationResult {
    const normalized = this.normalizeManifest(rawManifest);
    if (!normalized.manifest) return { registered: false, reason: normalized.reason! };
    this.manifests.set(normalized.manifest.id, deepFreeze(normalized.manifest));
    return { registered: true, pluginId: normalized.manifest.id, toolCount: normalized.manifest.tools.length };
  }

  setEnabled(pluginId: string, enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') return false;
    const id = boundedString(pluginId, 48)?.toLowerCase();
    const current = id ? this.manifests.get(id) : undefined;
    if (!current) return false;
    this.manifests.set(id!, deepFreeze({ ...current, enabled }));
    return true;
  }

  remove(pluginId: string): boolean {
    const id = boundedString(pluginId, 48)?.toLowerCase();
    return id ? this.manifests.delete(id) : false;
  }

  get(pluginId: string): NekoPluginAuthorizationManifest | null {
    const id = boundedString(pluginId, 48)?.toLowerCase();
    const manifest = id ? this.manifests.get(id) : undefined;
    return manifest ? structuredClone(manifest) : null;
  }

  list(): NekoPluginAuthorizationManifest[] {
    return [...this.manifests.values()].map(manifest => structuredClone(manifest));
  }

  snapshot(): NekoPluginManifestPolicySnapshot {
    return { version: 1, manifests: this.list() };
  }

  restore(raw: unknown): number {
    const row = ownDataObject(raw, 4);
    const manifests = row?.version === 1 ? ownDenseArray(row.manifests, 256) : null;
    this.manifests.clear();
    if (!manifests) return 0;
    for (const manifest of manifests) this.register(manifest);
    return this.manifests.size;
  }

  /** Signature-compatible with PluginGatewayAdapter's host authorization callback. */
  async authorize(
    request: NekoPluginManifestPolicyContext,
    suppliedTool: NekoPluginRegisteredTool,
  ): Promise<boolean> {
    const rawRequest = ownDataObject(request, 12);
    const rawTool = ownDataObject(suppliedTool, 12);
    if (!rawRequest || !rawTool ||
        Object.keys(rawRequest).some(key => !['protocol', 'connectionId', 'requestId', 'action', 'pluginId', 'toolId', 'params', 'idempotencyKey', 'approvalId'].includes(key))) return false;
    const pluginId = boundedString(rawRequest.pluginId, 48)?.toLowerCase();
    const protocol = boundedString(rawRequest.protocol, 32)?.toLowerCase();
    const toolId = boundedString(rawRequest.toolId, 128);
    if (!pluginId || !protocol || !toolId ||
        typeof rawRequest.action !== 'string' || !ACTIONS.has(rawRequest.action as NekoPluginPolicyAction)) return false;
    const action = rawRequest.action as NekoPluginPolicyAction;
    const manifest = this.manifests.get(pluginId);
    if (!manifest?.enabled || !manifest.protocols.includes(protocol)) return false;
    if (!toolId.startsWith(`${pluginId}.`) || toolId !== suppliedTool.id) return false;
    const declared = manifest.tools.find(tool => tool.id === toolId);
    if (!declared || !declared.actions.includes(action)) return false;
    if (action === 'resource_read' &&
        (declared.destructive || !/(?:\.read|:read)$/i.test(declared.capability))) return false;

    let liveTool: NekoPluginRegisteredTool | undefined;
    try {
      liveTool = this.gateway.listTools().find(tool => tool.id === toolId);
    } catch {
      return false;
    }
    if (!liveTool || !this.toolMatches(declared, liveTool) || !this.toolMatches(declared, rawTool as unknown as NekoPluginRegisteredTool)) return false;
    return true;
  }

  private toolMatches(declared: NekoPluginManifestTool, actual: NekoPluginRegisteredTool): boolean {
    const permissionClass = actual.permissionClass ?? 'none';
    const requiresApproval = actual.requiresApproval === true;
    return actual.id === declared.id &&
      actual.capability === declared.capability &&
      actual.destructive === declared.destructive &&
      permissionClass === declared.permissionClass &&
      requiresApproval === declared.requiresHostApproval;
  }

  private normalizeManifest(
    raw: unknown,
  ): { manifest: NekoPluginAuthorizationManifest } | { manifest: null; reason: NekoPluginManifestRegistrationError } {
    const row = ownDataObject(raw, 16);
    if (!row || Object.keys(row).some(key => !MANIFEST_KEYS.has(key)) ||
        row.schemaVersion !== 1 || typeof row.enabled !== 'boolean') {
      return { manifest: null, reason: 'invalid-manifest' };
    }
    const id = boundedString(row.id, 48)?.toLowerCase();
    const name = boundedString(row.name, 100);
    const version = boundedString(row.version, 64);
    if (!id || !PLUGIN_ID.test(id) || !name || !version || !VERSION.test(version)) {
      return { manifest: null, reason: 'invalid-manifest' };
    }
    const protocolRows = ownDenseArray(row.protocols, 8);
    const toolRows = ownDenseArray(row.tools, 64);
    if (!protocolRows || protocolRows.length === 0 || !toolRows || toolRows.length === 0) {
      return { manifest: null, reason: 'invalid-manifest' };
    }
    const protocols = protocolRows.map(value => typeof value === 'string' ? value.toLowerCase() : '');
    if (protocols.some(value => !PROTOCOL.test(value)) || new Set(protocols).size !== protocols.length) {
      return { manifest: null, reason: 'invalid-manifest' };
    }
    const tools: NekoPluginManifestTool[] = [];
    const seen = new Set<string>();
    for (const rowTool of toolRows) {
      const result = normalizeTool(rowTool, id);
      if (!('tool' in result)) {
        return { manifest: null, reason: result.reason };
      }
      if (seen.has(result.tool.id)) return { manifest: null, reason: 'invalid-manifest' };
      seen.add(result.tool.id);
      tools.push(result.tool);
    }
    let actualTools: NekoPluginRegisteredTool[];
    try {
      actualTools = this.gateway.listTools();
    } catch {
      return { manifest: null, reason: 'gateway-unavailable' };
    }
    if (!Array.isArray(actualTools)) return { manifest: null, reason: 'gateway-unavailable' };
    for (const declared of tools) {
      const actual = actualTools.find(tool => tool.id === declared.id);
      if (!actual) return { manifest: null, reason: 'registered-tool-not-found' };
      if (!this.toolMatches(declared, actual)) return { manifest: null, reason: 'registered-tool-contract-mismatch' };
    }
    return {
      manifest: {
        schemaVersion: 1,
        id,
        name,
        version,
        enabled: row.enabled,
        protocols: [...protocols],
        tools,
      },
    };
  }
}
