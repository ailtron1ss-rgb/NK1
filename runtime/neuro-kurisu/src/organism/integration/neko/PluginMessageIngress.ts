import { createHash } from 'node:crypto';
import { types as nodeUtilTypes } from 'node:util';

export type NekoMessageAiBehavior = 'respond' | 'read' | 'blind';
export type NekoMessageVisibility = 'chat' | 'hud';

export interface NekoPluginMessageIdentity {
  pluginId: string;
  messageId: string;
}

export interface NekoPluginMessageRuntimeOptions {
  deliberate: boolean;
  spontaneous: false;
  /** Suppresses immediate language generation while retaining cognitive ingestion. */
  suppressResponse: boolean;
  /** Plugin content is evidence, not a user-authored command or goal. */
  externalGoalPolicy: 'evidence-only';
  externalSource: {
    kind: 'neko-plugin';
    pluginId: string;
    messageId: string;
  };
}

export interface NekoPluginMessageRuntime {
  step(text: string, options: NekoPluginMessageRuntimeOptions): Promise<unknown>;
}

export interface NekoPluginMessagePresentation {
  pluginId: string;
  messageId: string;
  visibility: readonly NekoMessageVisibility[];
  text: string;
}

export interface NekoPluginMessagePolicyContext extends NekoPluginMessageIdentity {
  aiBehavior: NekoMessageAiBehavior;
  visibility: readonly NekoMessageVisibility[];
  textBytes: number;
}

export interface PluginMessageIngressOptions {
  /** Exact plugin IDs enabled by the host. Empty/missing allowlists are rejected. */
  allowedPlugins: readonly string[];
  /** Host-owned permission policy; plugin-provided fields never grant authority. */
  authorize: (context: NekoPluginMessagePolicyContext) => boolean | Promise<boolean>;
  runtime: NekoPluginMessageRuntime;
  /** Host presentation bridge for chat/HUD. It is independent of AI behavior. */
  present?: (message: NekoPluginMessagePresentation) => void | Promise<void>;
  maxTextBytes?: number;
  maxMetadataBytes?: number;
  maxRememberedMessages?: number;
}

export interface PluginMessageIngressResult {
  accepted: boolean;
  errorCode?: string;
  aiBehavior?: NekoMessageAiBehavior;
  visibility?: NekoMessageVisibility[];
  cognitiveProcessed?: boolean;
  presented?: boolean;
  replayed?: boolean;
}

export interface PluginMessageIngressReceipt {
  pluginId: string;
  messageId: string;
  fingerprint: string;
  result: PluginMessageIngressResult;
}

export interface PluginMessageIngressSnapshot {
  version: 1;
  /** Ordered oldest-to-newest; only completed attempts are included. */
  receipts: PluginMessageIngressReceipt[];
}

type NormalizedMessage = {
  pluginId: string;
  messageId: string;
  aiBehavior: NekoMessageAiBehavior;
  visibility: NekoMessageVisibility[];
  text: string;
  textBytes: number;
  fingerprint: string;
};

type CachedResult = {
  fingerprint: string;
  result: PluginMessageIngressResult;
};

const INVALID = Symbol('invalid-json');
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,79}$/i;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const TOP_LEVEL_KEYS = new Set([
  'type', 'schema', 'plugin_id', 'message_id', 'time', 'source', 'priority',
  'coalesce_key', 'visibility', 'ai_behavior', 'parts', 'metadata', 'target_lanlan',
  // The SDK currently synthesizes these v1 compatibility aliases on every v2 wire envelope.
  // They are intentionally ignored; canonical v2 fields above remain authoritative.
  'message_type', 'content', 'binary_data', 'binary_url', 'mime', 'description',
  'unsafe', 'delivery', 'reply', 'fast_mode',
]);

function cloneInertJson(value: unknown, maxDepth: number, maxProperties: number):
  { ok: true; value: unknown } | { ok: false } {
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
        const descriptors = Object.getOwnPropertyDescriptors(input) as Record<string, PropertyDescriptor>;
        const length = descriptors.length?.value;
        if (!Number.isSafeInteger(length) || length < 0 || length > maxProperties) return INVALID;
        const keys = Reflect.ownKeys(descriptors);
        if (keys.length !== length + 1) return INVALID;
        const output: unknown[] = [];
        for (let index = 0; index < length; index += 1) {
          const descriptor = descriptors[String(index)];
          if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
              descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) return INVALID;
          propertyCount += 1;
          if (propertyCount > maxProperties) return INVALID;
          const child = visit(descriptor.value, depth + 1);
          if (child === INVALID) return INVALID;
          output.push(child);
        }
        return output;
      }
      const prototype = Object.getPrototypeOf(input);
      if (prototype !== Object.prototype && prototype !== null) return INVALID;
      const descriptors = Object.getOwnPropertyDescriptors(input);
      const keys = Reflect.ownKeys(descriptors);
      if (keys.length > maxProperties) return INVALID;
      const output: Record<string, unknown> = {};
      for (const key of keys) {
        if (typeof key !== 'string' || key === '__proto__' || key === 'prototype' || key === 'constructor') return INVALID;
        const descriptor = descriptors[key];
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
            descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) return INVALID;
        propertyCount += 1;
        if (propertyCount > maxProperties) return INVALID;
        const child = visit(descriptor.value, depth + 1);
        if (child === INVALID) return INVALID;
        output[key] = child;
      }
      return output;
    } catch {
      return INVALID;
    } finally {
      active.delete(input);
    }
  };

  const cloned = visit(value, 0);
  return cloned === INVALID ? { ok: false } : { ok: true, value: cloned };
}

function boundedOption(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error('neko-message-ingress-invalid-limit');
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value);
}

function isSafeText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !CONTROL_CHARS.test(value);
}

const reject = (errorCode: string): PluginMessageIngressResult => ({
  accepted: false,
  errorCode,
  replayed: false,
});

function restoreIngressResult(value: unknown): PluginMessageIngressResult | null {
  if (!isRecord(value) || typeof value.accepted !== 'boolean') return null;
  const allowed = new Set(['accepted', 'errorCode', 'aiBehavior', 'visibility', 'cognitiveProcessed', 'presented', 'replayed']);
  if (Object.keys(value).some(key => !allowed.has(key))) return null;
  const errorCode = value.errorCode;
  const aiBehavior = value.aiBehavior;
  const rawVisibility = value.visibility;
  const cognitiveProcessed = value.cognitiveProcessed;
  const presented = value.presented;
  const replayed = value.replayed;
  if (errorCode !== undefined && (typeof errorCode !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/i.test(errorCode))) return null;
  if (aiBehavior !== undefined && aiBehavior !== 'respond' && aiBehavior !== 'read' && aiBehavior !== 'blind') return null;
  if (rawVisibility !== undefined && (!Array.isArray(rawVisibility) || rawVisibility.length > 2 ||
      rawVisibility.some(item => item !== 'chat' && item !== 'hud') || new Set(rawVisibility).size !== rawVisibility.length)) return null;
  if (cognitiveProcessed !== undefined && typeof cognitiveProcessed !== 'boolean') return null;
  if (presented !== undefined && typeof presented !== 'boolean') return null;
  if (replayed !== undefined && typeof replayed !== 'boolean') return null;
  if (value.accepted && errorCode !== undefined) return null;
  return {
    accepted: value.accepted,
    ...(errorCode === undefined ? {} : { errorCode }),
    ...(aiBehavior === undefined ? {} : { aiBehavior }),
    ...(rawVisibility === undefined ? {} : { visibility: [...rawVisibility] as NekoMessageVisibility[] }),
    ...(cognitiveProcessed === undefined ? {} : { cognitiveProcessed }),
    ...(presented === undefined ? {} : { presented }),
    ...(replayed === undefined ? {} : { replayed }),
  };
}

export class PluginMessageIngress {
  private readonly allowedPlugins: ReadonlySet<string>;
  private readonly authorize: PluginMessageIngressOptions['authorize'];
  private readonly runtime: NekoPluginMessageRuntime;
  private readonly present?: PluginMessageIngressOptions['present'];
  private readonly maxTextBytes: number;
  private readonly maxMetadataBytes: number;
  private readonly maxRememberedMessages: number;
  private readonly completed = new Map<string, CachedResult>();
  private readonly inFlight = new Map<string, { fingerprint: string; promise: Promise<PluginMessageIngressResult> }>();

  constructor(options: PluginMessageIngressOptions) {
    if (!options || !Array.isArray(options.allowedPlugins) || options.allowedPlugins.length === 0 ||
        options.allowedPlugins.some(pluginId => !isSafeId(pluginId))) {
      throw new Error('neko-message-ingress-explicit-plugin-allowlist-required');
    }
    if (typeof options.authorize !== 'function') throw new Error('neko-message-ingress-host-policy-required');
    if (!options.runtime || typeof options.runtime.step !== 'function') throw new Error('neko-message-ingress-runtime-required');
    if (options.present !== undefined && typeof options.present !== 'function') throw new Error('neko-message-ingress-invalid-presenter');
    this.allowedPlugins = new Set(options.allowedPlugins);
    this.authorize = options.authorize;
    this.runtime = options.runtime;
    this.present = options.present;
    this.maxTextBytes = boundedOption(options.maxTextBytes, 16_384, 256, 65_536);
    this.maxMetadataBytes = boundedOption(options.maxMetadataBytes, 8_192, 256, 32_768);
    this.maxRememberedMessages = boundedOption(options.maxRememberedMessages, 256, 1, 4_096);
  }

  /** Export bounded completed receipts for the host's existing durable state store. */
  snapshot(): PluginMessageIngressSnapshot {
    return {
      version: 1,
      receipts: [...this.completed.entries()].map(([key, entry]) => {
        const separator = key.indexOf(':');
        return {
          pluginId: key.slice(0, separator),
          messageId: key.slice(separator + 1),
          fingerprint: entry.fingerprint,
          result: {
            ...entry.result,
            ...(entry.result.visibility === undefined ? {} : { visibility: [...entry.result.visibility] }),
          },
        };
      }),
    };
  }

  /**
   * Restore a host checkpoint before serving messages. Invalid snapshots clear the completed
   * cache and return zero. In-flight work is never serialized or replaced.
   */
  restore(raw: unknown): number {
    if (this.inFlight.size > 0) return 0;
    this.completed.clear();
    const cloned = cloneInertJson(raw, 8, 65_536);
    if (!cloned.ok || !isRecord(cloned.value) || Object.keys(cloned.value).length !== 2 ||
        cloned.value.version !== 1 || !Array.isArray(cloned.value.receipts) ||
        cloned.value.receipts.length > 4_096) return 0;

    const restored = new Map<string, CachedResult>();
    const conflicted = new Set<string>();
    for (const item of cloned.value.receipts) {
      if (!isRecord(item) || Object.keys(item).length !== 4 ||
          typeof item.pluginId !== 'string' || !isSafeId(item.pluginId) ||
          typeof item.messageId !== 'string' || !isSafeId(item.messageId) ||
          typeof item.fingerprint !== 'string' || !/^[a-f0-9]{64}$/i.test(item.fingerprint)) return 0;
      if (!this.allowedPlugins.has(item.pluginId)) continue;
      const result = restoreIngressResult(item.result);
      if (!result) return 0;
      const key = `${item.pluginId}:${item.messageId}`;
      const prior = restored.get(key);
      if (prior && prior.fingerprint !== item.fingerprint) {
        restored.delete(key);
        conflicted.add(key);
        continue;
      }
      if (!conflicted.has(key)) restored.set(key, { fingerprint: item.fingerprint, result });
    }
    const retained = [...restored.entries()].slice(-this.maxRememberedMessages);
    for (const [key, entry] of retained) this.completed.set(key, entry);
    return this.completed.size;
  }

  async handle(rawRequest: unknown): Promise<PluginMessageIngressResult> {
    const requestClone = cloneInertJson(rawRequest, 8, 256);
    if (!requestClone.ok || !isRecord(requestClone.value)) return reject('invalid-request');
    const request = requestClone.value;
    if (Object.keys(request).some(key => key !== 'identity' && key !== 'payload')) return reject('invalid-request');
    if (!isRecord(request.identity) || !isRecord(request.payload)) return reject('invalid-request');
    if (Object.keys(request.identity).some(key => key !== 'pluginId' && key !== 'messageId')) return reject('invalid-transport-identity');

    const identity = request.identity;
    const pluginId = identity.pluginId;
    const messageId = identity.messageId;
    if (!isSafeId(pluginId) || !isSafeId(messageId)) return reject('invalid-transport-identity');
    if (!this.allowedPlugins.has(pluginId)) return reject('plugin-not-allowed');

    const normalized = this.normalizePayload(pluginId, messageId, request.payload);
    if (!normalized.ok) return reject(normalized.errorCode);
    const message = normalized.message;
    if (message.visibility.length > 0 && !this.present) return reject('presentation-unavailable');

    const policyContext: NekoPluginMessagePolicyContext = Object.freeze({
      pluginId: message.pluginId,
      messageId: message.messageId,
      aiBehavior: message.aiBehavior,
      visibility: Object.freeze([...message.visibility]),
      textBytes: message.textBytes,
    });
    let permitted = false;
    try {
      permitted = await this.authorize(policyContext) === true;
    } catch {
      permitted = false;
    }
    if (!permitted) return reject('policy-denied');

    const key = `${pluginId}:${messageId}`;
    const prior = this.completed.get(key);
    if (prior) {
      if (prior.fingerprint !== message.fingerprint) return reject('message-id-conflict');
      this.completed.delete(key);
      this.completed.set(key, prior);
      return { ...prior.result, replayed: true };
    }
    const pending = this.inFlight.get(key);
    if (pending) {
      if (pending.fingerprint !== message.fingerprint) return reject('message-id-conflict');
      const result = await pending.promise;
      return { ...result, replayed: true };
    }

    const promise = this.process(message);
    this.inFlight.set(key, { fingerprint: message.fingerprint, promise });
    const result = await promise;
    this.inFlight.delete(key);
    // Cache terminal attempts after side effects begin, including partial failures, so a replay
    // cannot repeat cognition or presentation. This is deliberately process-local, not durable.
    this.remember(key, { fingerprint: message.fingerprint, result });
    return result;
  }

  private normalizePayload(pluginId: string, messageId: string, rawPayload: Record<string, unknown>):
    { ok: true; message: NormalizedMessage } | { ok: false; errorCode: string } {
    const cloned = cloneInertJson(rawPayload, 8, 256);
    if (!cloned.ok || !isRecord(cloned.value)) return { ok: false, errorCode: 'invalid-envelope' };
    const payload = cloned.value;
    if (Object.keys(payload).some(key => !TOP_LEVEL_KEYS.has(key))) return { ok: false, errorCode: 'invalid-envelope' };
    if (payload.type !== 'MESSAGE_PUSH' || payload.schema !== 'push_message.v2') {
      return { ok: false, errorCode: 'unsupported-schema' };
    }
    if (payload.plugin_id !== pluginId || payload.message_id !== messageId) {
      return { ok: false, errorCode: 'identity-mismatch' };
    }
    if (payload.target_lanlan !== undefined && payload.target_lanlan !== null && payload.target_lanlan !== '') {
      return { ok: false, errorCode: 'cross-persona-routing-denied' };
    }
    if (payload.metadata !== undefined) {
      const metadata = cloneInertJson(payload.metadata, 6, 128);
      if (!metadata.ok || !isRecord(metadata.value)) return { ok: false, errorCode: 'invalid-metadata' };
      if (Buffer.byteLength(JSON.stringify(metadata.value), 'utf8') > this.maxMetadataBytes) {
        return { ok: false, errorCode: 'metadata-too-large' };
      }
      if (metadata.value.target_lanlan !== undefined && metadata.value.target_lanlan !== null && metadata.value.target_lanlan !== '') {
        return { ok: false, errorCode: 'cross-persona-routing-denied' };
      }
    }

    const rawVisibility = payload.visibility === undefined ? [] : payload.visibility;
    if (!Array.isArray(rawVisibility) || rawVisibility.length > 2 ||
        rawVisibility.some(value => value !== 'chat' && value !== 'hud')) {
      return { ok: false, errorCode: 'invalid-visibility' };
    }
    const visibility = [...new Set(rawVisibility)] as NekoMessageVisibility[];
    const aiBehavior = (payload.ai_behavior === undefined ? 'respond' : payload.ai_behavior) as NekoMessageAiBehavior;
    if (aiBehavior !== 'respond' && aiBehavior !== 'read' && aiBehavior !== 'blind') {
      return { ok: false, errorCode: 'invalid-ai-behavior' };
    }
    if (!Array.isArray(payload.parts) || payload.parts.length < 1 || payload.parts.length > 8) {
      return { ok: false, errorCode: 'invalid-parts' };
    }
    const textParts: string[] = [];
    for (const part of payload.parts) {
      if (!isRecord(part) || part.type !== 'text') return { ok: false, errorCode: 'unsupported-part' };
      if (Object.keys(part).some(key => key !== 'type' && key !== 'text') || !isSafeText(part.text)) {
        return { ok: false, errorCode: 'invalid-text-part' };
      }
      textParts.push(part.text);
    }
    const text = textParts.join('\n');
    const textBytes = Buffer.byteLength(text, 'utf8');
    if (textBytes === 0 || textBytes > this.maxTextBytes) return { ok: false, errorCode: 'message-too-large' };
    const fingerprint = createHash('sha256').update(JSON.stringify({
      pluginId, messageId, aiBehavior, visibility, text,
    })).digest('hex');
    return { ok: true, message: { pluginId, messageId, aiBehavior, visibility, text, textBytes, fingerprint } };
  }

  private async process(message: NormalizedMessage): Promise<PluginMessageIngressResult> {
    let cognitiveProcessed = false;
    let presented = false;
    if (message.aiBehavior !== 'blind') {
      try {
        await this.runtime.step(message.text, {
          deliberate: message.aiBehavior === 'respond',
          spontaneous: false,
          suppressResponse: message.aiBehavior === 'read',
          externalGoalPolicy: 'evidence-only',
          externalSource: {
            kind: 'neko-plugin',
            pluginId: message.pluginId,
            messageId: message.messageId,
          },
        });
        cognitiveProcessed = true;
      } catch {
        return {
          accepted: false, errorCode: 'runtime-processing-failed', aiBehavior: message.aiBehavior,
          visibility: [...message.visibility], cognitiveProcessed: false, presented: false, replayed: false,
        };
      }
    }
    if (message.visibility.length > 0) {
      try {
        await this.present!({
          pluginId: message.pluginId,
          messageId: message.messageId,
          visibility: [...message.visibility],
          text: message.text,
        });
        presented = true;
      } catch {
        return {
          accepted: false, errorCode: 'presentation-failed', aiBehavior: message.aiBehavior,
          visibility: [...message.visibility], cognitiveProcessed, presented: false, replayed: false,
        };
      }
    }
    return {
      accepted: true,
      aiBehavior: message.aiBehavior,
      visibility: [...message.visibility],
      cognitiveProcessed,
      presented,
      replayed: false,
    };
  }

  private remember(key: string, entry: CachedResult): void {
    this.completed.set(key, entry);
    while (this.completed.size > this.maxRememberedMessages) {
      const oldest = this.completed.keys().next().value;
      if (oldest === undefined) break;
      this.completed.delete(oldest);
    }
  }
}
