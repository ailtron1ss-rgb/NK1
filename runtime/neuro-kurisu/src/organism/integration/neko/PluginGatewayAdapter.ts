import { types as nodeUtilTypes } from 'node:util';

export type NekoPluginAction = 'tool_call' | 'resource_read' | 'event_push';

export interface NekoPluginToolDescriptor {
  id: string;
  capability: string;
  destructive: boolean;
  permissionClass?: string;
}

export interface NekoPluginActionGatewayResult {
  ok: boolean;
  verified?: boolean;
  result?: unknown;
  outcomeClass?: string;
}

export interface NekoPluginActionGateway {
  listTools(): NekoPluginToolDescriptor[];
  executeTool(
    id: string,
    input: Record<string, unknown>,
    reason?: string,
    options?: {
      idempotencyKey?: string;
      approvalId?: string;
      autonomous: false;
      decisionId?: never;
    },
  ): Promise<NekoPluginActionGatewayResult>;
}

export interface NekoPluginGatewayPolicyContext {
  readonly protocol: string;
  readonly connectionId: string;
  readonly requestId: string;
  readonly action: Exclude<NekoPluginAction, 'event_push'>;
  readonly pluginId: string;
  readonly toolId: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly idempotencyKey?: string;
  readonly approvalId?: string;
}

export interface PluginGatewayAdapterOptions {
  gateway: NekoPluginActionGateway;
  /** Host-owned policy. Missing policy is a construction error, never allow-all. */
  authorize: (request: NekoPluginGatewayPolicyContext, tool: NekoPluginToolDescriptor) => boolean | Promise<boolean>;
  /** Protocols are explicitly enabled by the host; the adapter has no permissive default. */
  allowedProtocols: readonly string[];
  maxPayloadBytes?: number;
  maxResultBytes?: number;
  maxDepth?: number;
  maxProperties?: number;
}

export interface PluginGatewayAdapterResponse {
  success: boolean;
  errorCode?: string;
  message?: string;
  data?: unknown;
  metadata?: {
    verified: boolean;
    outcomeClass: string;
    resultOmitted?: boolean;
  };
}

const ACTIONS = new Set<NekoPluginAction>(['tool_call', 'resource_read', 'event_push']);
const SAFE_OUTCOME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,79}$/i;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const REQUEST_KEYS = new Set([
  'protocol', 'connectionId', 'requestId', 'action', 'pluginId', 'toolId', 'params',
  'idempotencyKey', 'approvalId',
  // Explicitly ignored compatibility fields; neither can confer host authority.
  'decisionId', 'autonomous',
]);

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
      if (typeof key !== 'string' || FORBIDDEN_KEYS.has(key)) return null;
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

/** Converts only inert JSON-compatible data; never calls user getters or toJSON hooks. */
function cloneSafeJson(
  value: unknown,
  maxDepth: number,
  maxProperties: number,
): { ok: true; value: unknown } | { ok: false } {
  const active = new Set<object>();
  let propertyCount = 0;

  const visit = (input: unknown, depth: number): unknown | typeof INVALID => {
    if (depth > maxDepth) return INVALID;
    if (input === null || typeof input === 'string' || typeof input === 'boolean') return input;
    if (typeof input === 'number') return Number.isFinite(input) ? input : INVALID;
    if (typeof input !== 'object' || nodeUtilTypes.isProxy(input)) return INVALID;
    if (active.has(input)) return INVALID;
    active.add(input);
    try {
      if (Array.isArray(input)) {
        if (Object.getPrototypeOf(input) !== Array.prototype) return INVALID;
        const descriptors = Object.getOwnPropertyDescriptors(input);
        const length = descriptors.length?.value;
        if (!Number.isSafeInteger(length) || length < 0 || length > maxProperties) return INVALID;
        const keys = Reflect.ownKeys(descriptors);
        if (keys.length !== length + 1) return INVALID;
        const result: unknown[] = [];
        for (let index = 0; index < length; index += 1) {
          const descriptor = descriptors[String(index)];
          if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
              descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) return INVALID;
          propertyCount += 1;
          if (propertyCount > maxProperties) return INVALID;
          const child = visit(descriptor.value, depth + 1);
          if (child === INVALID) return INVALID;
          result.push(child);
        }
        return result;
      }
      const prototype = Object.getPrototypeOf(input);
      if (prototype !== Object.prototype && prototype !== null) return INVALID;
      const descriptors = Object.getOwnPropertyDescriptors(input);
      const keys = Reflect.ownKeys(descriptors);
      if (keys.length > maxProperties) return INVALID;
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        if (typeof key !== 'string' || FORBIDDEN_KEYS.has(key)) return INVALID;
        const descriptor = descriptors[key];
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
            descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) return INVALID;
        propertyCount += 1;
        if (propertyCount > maxProperties) return INVALID;
        const child = visit(descriptor.value, depth + 1);
        if (child === INVALID) return INVALID;
        result[key] = child;
      }
      return result;
    } catch {
      return INVALID;
    } finally {
      active.delete(input);
    }
  };

  const cloned = visit(value, 0);
  return cloned === INVALID ? { ok: false } : { ok: true, value: cloned };
}

const INVALID = Symbol('invalid-json-value');
const isBoundedString = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const byteLength = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), 'utf8');
function freezeJson(value: unknown): void {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return;
  for (const child of Object.values(value as Record<string, unknown>)) freezeJson(child);
  Object.freeze(value);
}
const error = (errorCode: string, message: string): PluginGatewayAdapterResponse => ({
  success: false,
  errorCode,
  message,
});

export class PluginGatewayAdapter {
  private readonly gateway: NekoPluginActionGateway;
  private readonly authorize: PluginGatewayAdapterOptions['authorize'];
  private readonly allowedProtocols: ReadonlySet<string>;
  private readonly maxPayloadBytes: number;
  private readonly maxResultBytes: number;
  private readonly maxDepth: number;
  private readonly maxProperties: number;

  constructor(options: PluginGatewayAdapterOptions) {
    if (!options || !options.gateway || typeof options.gateway.listTools !== 'function' ||
        typeof options.gateway.executeTool !== 'function') throw new Error('plugin-gateway-action-gateway-required');
    if (typeof options.authorize !== 'function') throw new Error('plugin-gateway-host-policy-required');
    if (!Array.isArray(options.allowedProtocols) || options.allowedProtocols.length === 0 ||
        options.allowedProtocols.some(protocol => !isBoundedString(protocol, 32))) {
      throw new Error('plugin-gateway-explicit-protocol-allowlist-required');
    }
    this.gateway = options.gateway;
    this.authorize = options.authorize;
    this.allowedProtocols = new Set(options.allowedProtocols.map(protocol => protocol.toLowerCase()));
    this.maxPayloadBytes = this.boundedOption(options.maxPayloadBytes, 65_536, 64, 2_097_152);
    this.maxResultBytes = this.boundedOption(options.maxResultBytes, 65_536, 64, 2_097_152);
    this.maxDepth = this.boundedOption(options.maxDepth, 8, 1, 16);
    this.maxProperties = this.boundedOption(options.maxProperties, 256, 1, 2_048);
  }

  private boundedOption(value: number | undefined, fallback: number, min: number, max: number): number {
    if (value === undefined) return fallback;
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error('plugin-gateway-invalid-limit');
    return value;
  }

  async handle(rawRequest: unknown): Promise<PluginGatewayAdapterResponse> {
    const raw = ownDataObject(rawRequest, 24);
    if (!raw || Object.keys(raw).some(key => !REQUEST_KEYS.has(key))) return error('invalid-request', 'request-shape-invalid');

    const protocol = isBoundedString(raw.protocol, 32) ? raw.protocol.toLowerCase() : '';
    if (!protocol) return error('invalid-request', 'request-protocol-invalid');
    if (!this.allowedProtocols.has(protocol)) return error('unsupported-protocol', 'protocol-not-enabled-by-host');

    if (!isBoundedString(raw.connectionId, 128) || !isBoundedString(raw.requestId, 128) ||
        !isBoundedString(raw.pluginId, 80) || !SAFE_ID.test(raw.pluginId) ||
        !isBoundedString(raw.toolId, 128) || !SAFE_ID.test(raw.toolId) ||
        typeof raw.action !== 'string' || !ACTIONS.has(raw.action as NekoPluginAction)) {
      return error('invalid-request', 'request-fields-invalid');
    }
    const action = raw.action as NekoPluginAction;
    if (action === 'event_push') return error('unsupported-action', 'event-push-requires-a-host-event-bus-adapter');
    if (!raw.toolId.startsWith(`${raw.pluginId}.`)) return error('tool-not-available', 'tool-outside-plugin-namespace');

    const params = cloneSafeJson(raw.params, this.maxDepth, this.maxProperties);
    if (!params.ok || params.value === null || typeof params.value !== 'object' || Array.isArray(params.value)) {
      return error('invalid-request', 'tool-params-must-be-inert-object');
    }
    let payloadBytes: number;
    try { payloadBytes = byteLength(params.value); } catch { return error('invalid-request', 'tool-params-not-serializable'); }
    if (payloadBytes > this.maxPayloadBytes) return error('invalid-request', 'tool-params-exceed-size-limit');
    freezeJson(params.value);

    const idempotencyKey = raw.idempotencyKey === undefined ? undefined :
      (isBoundedString(raw.idempotencyKey, 160) ? raw.idempotencyKey : null);
    const approvalId = raw.approvalId === undefined ? undefined :
      (isBoundedString(raw.approvalId, 200) ? raw.approvalId : null);
    if (idempotencyKey === null || approvalId === null) return error('invalid-request', 'request-credential-invalid');

    let tools: NekoPluginToolDescriptor[];
    try { tools = this.gateway.listTools(); } catch { return error('gateway-unavailable', 'action-gateway-tool-list-failed'); }
    const tool = Array.isArray(tools) ? tools.find(candidate => candidate && candidate.id === raw.toolId) : undefined;
    if (!tool || tool.id !== raw.toolId || !isBoundedString(tool.capability, 128)) {
      return error('tool-not-available', 'registered-tool-not-found');
    }
    if (action === 'resource_read' &&
        (tool.destructive !== false || !/(?:\.read|:read)$/i.test(tool.capability))) {
      return error('read-route-denied', 'resource-read-requires-nondestructive-read-capability');
    }

    const context: NekoPluginGatewayPolicyContext = Object.freeze({
      protocol,
      connectionId: raw.connectionId,
      requestId: raw.requestId,
      action,
      pluginId: raw.pluginId,
      toolId: raw.toolId,
      params: params.value as Record<string, unknown>,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      ...(approvalId ? { approvalId } : {}),
    });

    let allowed = false;
    try { allowed = await this.authorize(context, tool) === true; } catch { allowed = false; }
    if (!allowed) return error('policy-denied', 'host-policy-denied-plugin-request');

    let execution: NekoPluginActionGatewayResult;
    try {
      execution = await this.gateway.executeTool(
        tool.id,
        context.params as Record<string, unknown>,
        `neko-plugin:${context.pluginId}:${context.requestId}`,
        {
          ...(context.idempotencyKey ? { idempotencyKey: context.idempotencyKey } : {}),
          ...(context.approvalId ? { approvalId: context.approvalId } : {}),
          autonomous: false,
        },
      );
    } catch {
      return error('gateway-execution-failed', 'action-gateway-execution-threw');
    }
    if (!execution || typeof execution.ok !== 'boolean') return error('gateway-response-invalid', 'action-gateway-returned-invalid-result');

    const metadata: NonNullable<PluginGatewayAdapterResponse['metadata']> = {
      verified: execution.verified === true,
      outcomeClass: typeof execution.outcomeClass === 'string' && SAFE_OUTCOME.test(execution.outcomeClass)
        ? execution.outcomeClass
        : 'unknown',
    };
    if (!execution.ok) return { success: false, errorCode: 'tool-execution-rejected', message: 'action-gateway-did-not-accept-operation', metadata };

    const result = cloneSafeJson(execution.result, this.maxDepth, this.maxProperties);
    if (!result.ok) {
      metadata.resultOmitted = true;
      return { success: true, metadata };
    }
    let resultBytes: number;
    try { resultBytes = byteLength(result.value); } catch { resultBytes = Number.POSITIVE_INFINITY; }
    if (resultBytes > this.maxResultBytes) {
      metadata.resultOmitted = true;
      return { success: true, metadata };
    }
    return { success: true, data: result.value, metadata };
  }
}
