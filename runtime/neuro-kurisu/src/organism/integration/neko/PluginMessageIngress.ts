import { createHash } from 'node:crypto';
import { createAuthenticatedRuntimeExternalPluginSource } from '../../core/RuntimeInputPolicy.ts';
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

export interface PluginMessageIngressReceiptStore {
  load(): Promise<unknown>;
  save(snapshot: PluginMessageIngressSnapshot): Promise<void>;
}

export interface PluginMessageIngressReceipt {
  pluginId: string;
  messageId: string;
  fingerprint: string;
  status: 'pending' | 'completed';
  result?: PluginMessageIngressResult;
}

export interface PluginMessageIngressSnapshot {
  version: 2;
  receipts: PluginMessageIngressReceipt[];
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
  /** Host-owned durable checkpoint; call initialize() before opening the transport. */
  receiptStore?: PluginMessageIngressReceiptStore;
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

type PendingReceipt = { pluginId: string; messageId: string; fingerprint: string };

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
  if ((value.accepted && errorCode !== undefined) || (!value.accepted && errorCode === undefined)) return null;
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
  private readonly receiptStore?: PluginMessageIngressReceiptStore;
  private initialized: boolean;
  private persistenceTail: Promise<void> = Promise.resolve();
  private initializePromise?: Promise<number>;
  private readonly completed = new Map<string, CachedResult>();
  private readonly pendingReceipts = new Map<string, PendingReceipt>();
  private readonly inFlight = new Map<string, { fingerprint: string; promise: Promise<PluginMessageIngressResult> }>();

  constructor(options: PluginMessageIngressOptions) {
    if (!options || !Array.isArray(options.allowedPlugins) || options.allowedPlugins.length === 0 ||
        options.allowedPlugins.some(pluginId => !isSafeId(pluginId))) {
      throw new Error('neko-message-ingress-explicit-plugin-allowlist-required');
    }
    if (typeof options.authorize !== 'function') throw new Error('neko-message-ingress-host-policy-required');
    if (!options.runtime || typeof options.runtime.step !== 'function') throw new Error('neko-message-ingress-runtime-required');
    if (options.present !== undefined && typeof options.present !== 'function') throw new Error('neko-message-ingress-invalid-presenter');
    if (options.receiptStore !== undefined &&
        (!options.receiptStore || typeof options.receiptStore.load !== 'function' || typeof options.receiptStore.save !== 'function')) {
      throw new Error('neko-message-ingress-invalid-receipt-store');
    }
    this.allowedPlugins = new Set(options.allowedPlugins);
    this.authorize = options.authorize;
    this.runtime = options.runtime;
    this.present = options.present;
    this.receiptStore = options.receiptStore;
    this.initialized = !this.receiptStore;
    this.maxTextBytes = boundedOption(options.maxTextBytes, 16_384, 256, 65_536);
    this.maxMetadataBytes = boundedOption(options.maxMetadataBytes, 8_192, 256, 32_768);
    this.maxRememberedMessages = boundedOption(options.maxRememberedMessages, 256, 1, 4_096);
  }

  /** Restore before transport ingress is opened. Invalid checkpoints fail closed. */
  async initialize(): Promise<number> {
    if (this.initialized) return this.completed.size + this.pendingReceipts.size;
    if (this.initializePromise) return this.initializePromise;
    const operation = (async () => {
      const raw = await this.receiptStore!.load();
      if (raw !== null && raw !== undefined) this.restore(raw);
      else { this.completed.clear(); this.pendingReceipts.clear(); }
      this.initialized = true;
      return this.completed.size + this.pendingReceipts.size;
    })();
    this.initializePromise = operation;
    try {
      return await operation;
    } finally {
      if (this.initializePromise === operation) this.initializePromise = undefined;
    }
  }

  /** Export a bounded checkpoint containing hashes and terminal receipts, never message text. */
  snapshot(): PluginMessageIngressSnapshot {
    const completed: PluginMessageIngressReceipt[] = [...this.completed.entries()].map(([key, entry]) => {
      const separator = key.indexOf(':');
      return {
        pluginId: key.slice(0, separator),
        messageId: key.slice(separator + 1),
        fingerprint: entry.fingerprint,
        status: 'completed',
        result: { ...entry.result, ...(entry.result.visibility === undefined ? {} : { visibility: [...entry.result.visibility] }) },
      };
    });
    const pending: PluginMessageIngressReceipt[] = [...this.pendingReceipts.values()].map(entry => ({
      pluginId: entry.pluginId, messageId: entry.messageId, fingerprint: entry.fingerprint, status: 'pending',
    }));
    return { version: 2, receipts: [...completed, ...pending] };
  }

  /** Restore v2 checkpoints and the earlier v1 completed-receipt format. */
  restore(raw: unknown): number {
    if (this.inFlight.size > 0) throw new Error('neko-message-ingress-restore-during-flight');
    const cloned = cloneInertJson(raw, 8, 65_536);
    if (!cloned.ok || !isRecord(cloned.value) || Object.keys(cloned.value).length !== 2 ||
        !Array.isArray(cloned.value.receipts) || (cloned.value.version !== 1 && cloned.value.version !== 2)) {
      throw new Error('neko-message-receipt-snapshot-invalid');
    }
    const version = cloned.value.version;
    const rows = cloned.value.receipts;
    if (rows.length > this.maxRememberedMessages) throw new Error('neko-message-receipt-snapshot-over-capacity');
    const restoredCompleted = new Map<string, CachedResult>();
    const restoredPending = new Map<string, PendingReceipt>();
    const seen = new Set<string>();
    for (const row of rows) {
      if (!isRecord(row) || !isSafeId(row.pluginId) || !isSafeId(row.messageId) ||
          typeof row.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(row.fingerprint)) {
        throw new Error('neko-message-receipt-row-invalid');
      }
      const keys = Object.keys(row).sort().join(',');
      const key = row.pluginId + ':' + row.messageId;
      if (seen.has(key)) throw new Error('neko-message-receipt-duplicate-identity');
      seen.add(key);
      if (version === 1) {
        if (keys !== 'fingerprint,messageId,pluginId,result') throw new Error('neko-message-receipt-v1-row-invalid');
        const result = restoreIngressResult(row.result);
        if (!result) throw new Error('neko-message-receipt-result-invalid');
        restoredCompleted.set(key, { fingerprint: row.fingerprint, result });
      } else if (row.status === 'pending') {
        if (keys !== 'fingerprint,messageId,pluginId,status') throw new Error('neko-message-receipt-pending-row-invalid');
        restoredPending.set(key, { pluginId: row.pluginId, messageId: row.messageId, fingerprint: row.fingerprint });
      } else if (row.status === 'completed') {
        if (keys !== 'fingerprint,messageId,pluginId,result,status') throw new Error('neko-message-receipt-completed-row-invalid');
        const result = restoreIngressResult(row.result);
        if (!result) throw new Error('neko-message-receipt-result-invalid');
        restoredCompleted.set(key, { fingerprint: row.fingerprint, result });
      } else {
        throw new Error('neko-message-receipt-status-invalid');
      }
    }
    this.completed.clear();
    this.pendingReceipts.clear();
    for (const [key, value] of restoredCompleted) this.completed.set(key, value);
    for (const [key, value] of restoredPending) this.pendingReceipts.set(key, value);
    this.initialized = true;
    return this.completed.size + this.pendingReceipts.size;
  }

  receiptDiagnostics() {
    return {
      persistent: Boolean(this.receiptStore), initialized: this.initialized, initializing: Boolean(this.initializePromise),
      completed: this.completed.size, pendingRecovery: this.pendingReceipts.size,
      inFlight: this.inFlight.size, capacity: this.maxRememberedMessages,
    };
  }

  private reservePersistentSlot(): boolean {
    while (this.completed.size + this.pendingReceipts.size >= this.maxRememberedMessages) {
      const oldestCompleted = this.completed.keys().next().value;
      if (oldestCompleted === undefined) return false;
      this.completed.delete(oldestCompleted);
    }
    return true;
  }

  private persistSnapshot(): Promise<void> {
    const store = this.receiptStore;
    if (!store) return Promise.resolve();
    const save = () => store.save(this.snapshot());
    const current = this.persistenceTail.then(save, save);
    this.persistenceTail = current.then(() => undefined, () => undefined);
    return current;
  }

  private async processAndRemember(key: string, message: NormalizedMessage): Promise<PluginMessageIngressResult> {
    if (!this.receiptStore) {
      let result: PluginMessageIngressResult;
      try { result = await this.process(message); }
      catch { result = reject('message-processing-failed'); }
      this.remember(key, { fingerprint: message.fingerprint, result });
      return result;
    }
    if (!this.reservePersistentSlot()) return reject('receipt-ledger-full');
    const pending: PendingReceipt = { pluginId: message.pluginId, messageId: message.messageId, fingerprint: message.fingerprint };
    this.pendingReceipts.set(key, pending);
    // No cognitive or presentation side effect starts until this pending receipt is durable.
    try { await this.persistSnapshot(); }
    catch { return reject('message-recovery-required'); }

    let result: PluginMessageIngressResult;
    try { result = await this.process(message); }
    catch { result = reject('message-processing-failed'); }
    this.pendingReceipts.delete(key);
    this.completed.set(key, { fingerprint: message.fingerprint, result });
    try { await this.persistSnapshot(); }
    catch {
      this.completed.delete(key);
      this.pendingReceipts.set(key, pending);
      return reject('message-recovery-required');
    }
    return result;
  }

  async handle(rawRequest: unknown): Promise<PluginMessageIngressResult> {
    if (this.receiptStore && !this.initialized) return reject('receipt-store-not-initialized');
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
      pluginId: message.pluginId, messageId: message.messageId, aiBehavior: message.aiBehavior,
      visibility: Object.freeze([...message.visibility]), textBytes: message.textBytes,
    });
    let permitted = false;
    try { permitted = await this.authorize(policyContext) === true; } catch { permitted = false; }
    if (!permitted) return reject('policy-denied');

    const key = `${pluginId}:${messageId}`;
    const prior = this.completed.get(key);
    if (prior) {
      if (prior.fingerprint !== message.fingerprint) return reject('message-id-conflict');
      this.completed.delete(key);
      this.completed.set(key, prior);
      return { ...prior.result, replayed: true };
    }
    const active = this.inFlight.get(key);
    if (active) {
      if (active.fingerprint !== message.fingerprint) return reject('message-id-conflict');
      return { ...(await active.promise), replayed: true };
    }
    const recovery = this.pendingReceipts.get(key);
    if (recovery) return recovery.fingerprint === message.fingerprint
      ? reject('message-recovery-required') : reject('message-id-conflict');

    const promise = this.processAndRemember(key, message);
    this.inFlight.set(key, { fingerprint: message.fingerprint, promise });
    try { return await promise; }
    finally { this.inFlight.delete(key); }
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
          externalSource: createAuthenticatedRuntimeExternalPluginSource(message.pluginId, message.messageId),
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
