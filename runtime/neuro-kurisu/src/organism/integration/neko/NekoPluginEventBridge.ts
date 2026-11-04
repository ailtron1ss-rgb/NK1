import { types as nodeUtilTypes } from 'node:util';
import { sha256Stable } from '../../core/StableSerialization.ts';
import type { CognitiveEventFabric } from '../../system/CognitiveEventFabric.ts';
import type {
  ExternalObservation,
  ExternalObservationChannel,
  ExternalObserverFabric,
} from '../../system/ExternalObserverFabric.ts';

export type NekoPluginEventChannel = Extract<
  ExternalObservationChannel,
  'http' | 'camera' | 'audio' | 'device' | 'sensor' | 'tool'
>;

export interface NekoPluginEventPolicy {
  channel: NekoPluginEventChannel;
  /** Plugin observations are deliberately capped below the verifier's 0.72 threshold. */
  confidenceCap01: number;
  requirePostcondition?: boolean;
}

export interface NekoPluginEventRequest {
  protocol: string;
  connectionId: string;
  requestId: string;
  pluginId: string;
  eventType: string;
  eventId: string;
  payload: Readonly<Record<string, unknown>>;
}

export interface NekoPluginEventBridgeResult {
  accepted: boolean;
  replayed?: boolean;
  errorCode?: string;
  observationId?: string;
}

export interface NekoPluginEventPolicyContext extends NekoPluginEventRequest {
  readonly channel: NekoPluginEventChannel;
  readonly claimKey: string;
  readonly facts: readonly string[];
  readonly observedPostcondition?: string;
  readonly payloadHash: string;
}

export interface NekoPluginEventBridgePort {
  handle(request: NekoPluginEventRequest): Promise<NekoPluginEventBridgeResult>;
}

export interface NekoPluginEventBridgeOptions {
  observer: Pick<ExternalObserverFabric, 'registerSource' | 'observe' | 'snapshot'>;
  eventFabric: Pick<CognitiveEventFabric, 'append' | 'recent'>;
  /** Exact event names enabled by the host. No wildcard or default event policy exists. */
  allowedEvents: Readonly<Record<string, NekoPluginEventPolicy>>;
  /** Host-owned policy is mandatory and runs before either evidence store is mutated. */
  authorize: (context: NekoPluginEventPolicyContext) => boolean | Promise<boolean>;
  /** The current NK1 cognitive tick; plugin-supplied ticks are never accepted. */
  getTick: () => number;
  now?: () => number;
  maxPayloadBytes?: number;
}

const EVENT_NAME = /^[a-z][a-z0-9._-]{0,63}$/i;
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,79}$/i;
const CHANNELS = new Set<NekoPluginEventChannel>(['http', 'camera', 'audio', 'device', 'sensor', 'tool']);
const ALLOWED_PAYLOAD_KEYS = new Set(['claimKey', 'facts', 'observedPostcondition']);
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function ownDataRecord(value: unknown, maxKeys = 16): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || nodeUtilTypes.isProxy(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length > maxKeys) return null;
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      if (typeof key !== 'string' || FORBIDDEN_KEYS.has(key)) return null;
      const descriptor = descriptors[key];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function boundedString(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeFacts(value: unknown): string[] | null {
  if (value === undefined) return [];
  try {
    if (!Array.isArray(value) || nodeUtilTypes.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > 12) return null;
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length !== length + 1) return null;
    const facts: string[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) return null;
      const fact = boundedString(descriptor.value, 160);
      if (!fact) return null;
      facts.push(fact);
    }
    return facts;
  } catch {
    return null;
  }
}

function normalizePayload(value: unknown, maxBytes: number): {
  ok: true;
  claimKey: string;
  facts: string[];
  observedPostcondition?: string;
  payload: Record<string, unknown>;
} | { ok: false } {
  const raw = ownDataRecord(value, 8);
  if (!raw || Object.keys(raw).some(key => !ALLOWED_PAYLOAD_KEYS.has(key))) return { ok: false };
  const claimKey = boundedString(raw.claimKey, 96);
  const facts = normalizeFacts(raw.facts);
  const observedPostcondition = raw.observedPostcondition === undefined
    ? undefined
    : boundedString(raw.observedPostcondition, 320);
  if (!claimKey || !facts || (raw.observedPostcondition !== undefined && !observedPostcondition) ||
      (!facts.length && !observedPostcondition)) return { ok: false };
  const payload: Record<string, unknown> = {
    claimKey,
    facts,
    ...(observedPostcondition ? { observedPostcondition } : {}),
  };
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > maxBytes) return { ok: false };
  Object.freeze(facts);
  Object.freeze(payload);
  return { ok: true, claimKey, facts, observedPostcondition, payload };
}

function validPolicy(value: unknown): NekoPluginEventPolicy | null {
  const raw = ownDataRecord(value, 4);
  if (!raw || Object.keys(raw).some(key => !['channel', 'confidenceCap01', 'requirePostcondition'].includes(key))) return null;
  if (typeof raw.channel !== 'string' || !CHANNELS.has(raw.channel as NekoPluginEventChannel)) return null;
  if (typeof raw.confidenceCap01 !== 'number' || !Number.isFinite(raw.confidenceCap01) ||
      raw.confidenceCap01 < 0.01 || raw.confidenceCap01 > 0.70) return null;
  if (raw.requirePostcondition !== undefined && typeof raw.requirePostcondition !== 'boolean') return null;
  return Object.freeze({
    channel: raw.channel as NekoPluginEventChannel,
    confidenceCap01: raw.confidenceCap01,
    ...(raw.requirePostcondition === true ? { requirePostcondition: true } : {}),
  });
}

const rejected = (errorCode: string): NekoPluginEventBridgeResult => ({ accepted: false, errorCode });

export class NekoPluginEventBridge implements NekoPluginEventBridgePort {
  private readonly observer: NekoPluginEventBridgeOptions['observer'];
  private readonly eventFabric: NekoPluginEventBridgeOptions['eventFabric'];
  private readonly allowedEvents = new Map<string, NekoPluginEventPolicy>();
  private readonly authorize: NekoPluginEventBridgeOptions['authorize'];
  private readonly getTick: () => number;
  private readonly now: () => number;
  private readonly maxPayloadBytes: number;

  constructor(options: NekoPluginEventBridgeOptions) {
    if (!options?.observer || typeof options.observer.observe !== 'function' ||
        typeof options.observer.registerSource !== 'function' || typeof options.observer.snapshot !== 'function') {
      throw new Error('neko-plugin-event-observer-required');
    }
    if (!options.eventFabric || typeof options.eventFabric.append !== 'function' ||
        typeof options.eventFabric.recent !== 'function') throw new Error('neko-plugin-event-fabric-required');
    if (typeof options.authorize !== 'function') throw new Error('neko-plugin-event-host-policy-required');
    if (typeof options.getTick !== 'function') throw new Error('neko-plugin-event-host-tick-required');
    const entries = ownDataRecord(options.allowedEvents, 128);
    if (!entries || Object.keys(entries).length === 0) throw new Error('neko-plugin-event-allowlist-required');
    for (const [eventType, rawPolicy] of Object.entries(entries)) {
      if (!EVENT_NAME.test(eventType)) throw new Error('neko-plugin-event-name-invalid');
      const policy = validPolicy(rawPolicy);
      if (!policy) throw new Error('neko-plugin-event-policy-invalid');
      this.allowedEvents.set(eventType, policy);
    }
    this.observer = options.observer;
    this.eventFabric = options.eventFabric;
    this.authorize = options.authorize;
    this.getTick = options.getTick;
    this.now = options.now ?? Date.now;
    this.maxPayloadBytes = options.maxPayloadBytes ?? 4096;
    if (!Number.isSafeInteger(this.maxPayloadBytes) || this.maxPayloadBytes < 256 || this.maxPayloadBytes > 16_384) {
      throw new Error('neko-plugin-event-invalid-payload-limit');
    }
  }

  async handle(rawRequest: NekoPluginEventRequest): Promise<NekoPluginEventBridgeResult> {
    const raw = ownDataRecord(rawRequest, 12);
    if (!raw || Object.keys(raw).some(key =>
      !['protocol', 'connectionId', 'requestId', 'pluginId', 'eventType', 'eventId', 'payload'].includes(key))) {
      return rejected('invalid-event-request');
    }
    const protocol = boundedString(raw.protocol, 32);
    const connectionId = boundedString(raw.connectionId, 128);
    const requestId = boundedString(raw.requestId, 128);
    const pluginId = boundedString(raw.pluginId, 80);
    const eventType = boundedString(raw.eventType, 64);
    const eventId = boundedString(raw.eventId, 160);
    if (!protocol || !connectionId || !requestId || !pluginId || !SAFE_ID.test(pluginId) ||
        !eventType || !EVENT_NAME.test(eventType) || !eventId) return rejected('invalid-event-request');

    const policy = this.allowedEvents.get(eventType);
    if (!policy) return rejected('event-not-allowlisted');
    const normalized = normalizePayload(raw.payload, this.maxPayloadBytes);
    if (!normalized.ok) return rejected('invalid-event-payload');
    if (policy.requirePostcondition && !normalized.observedPostcondition) return rejected('event-postcondition-required');

    const pluginKey = sha256Stable(pluginId).slice(0, 24);
    const claimKey = `neko-plugin:${pluginKey}:${eventType}:${normalized.claimKey}`.slice(0, 180);
    const payloadHash = sha256Stable({
      eventType,
      claimKey,
      facts: normalized.facts,
      observedPostcondition: normalized.observedPostcondition ?? null,
    });
    const eventDigest = sha256Stable({ protocol, connectionId, pluginId, eventId });
    const receivedEventId = `neko-plugin-event:${eventDigest}:received`;
    const observationEventId = `neko-plugin-event:${eventDigest}:observation`;
    const sourceId = `neko.${pluginKey}.${sha256Stable(eventType).slice(0, 12)}`;
    const source = `neko-plugin:${pluginId}`;

    const context: NekoPluginEventPolicyContext = Object.freeze({
      protocol, connectionId, requestId, pluginId, eventType, eventId,
      channel: policy.channel, claimKey, facts: normalized.facts,
      ...(normalized.observedPostcondition ? { observedPostcondition: normalized.observedPostcondition } : {}),
      payloadHash,
      payload: normalized.payload,
    });
    let allowed = false;
    try { allowed = await this.authorize(context) === true; } catch { allowed = false; }
    if (!allowed) return rejected('event-policy-denied');

    try {
      const priorReceived = this.eventFabric.recent(256).find(event => event.id === receivedEventId);
      let tick: number;
      let observedAt: number;
      let replayed = false;
      if (priorReceived) {
        if (priorReceived.stage !== 'external-evidence' || priorReceived.source !== source ||
            priorReceived.payload.payloadHash !== payloadHash || priorReceived.payload.eventType !== eventType) {
          return rejected('event-idempotency-conflict');
        }
        tick = priorReceived.tick;
        observedAt = priorReceived.at;
        replayed = true;
      } else {
        const currentTick = this.getTick();
        const currentTime = this.now();
        if (!Number.isSafeInteger(currentTick) || currentTick < 0 ||
            !Number.isFinite(currentTime) || currentTime < 0) return rejected('host-event-clock-invalid');
        tick = currentTick;
        observedAt = currentTime;
        this.eventFabric.append({
          id: receivedEventId, tick, at: observedAt, stage: 'external-evidence',
          source, external: true, confidence01: policy.confidenceCap01,
          payload: { eventType, payloadHash, phase: 'received' },
        });
      }

      this.observer.registerSource({
        id: sourceId, sourceClass: 'external-api', channel: policy.channel,
        independenceKey: `neko-plugin:${pluginId}`, reliability01: policy.confidenceCap01,
      });
      const observation: ExternalObservation = this.observer.observe({
        sourceId, sourceClass: 'external-api', channel: policy.channel,
        claimKey, facts: normalized.facts,
        ...(normalized.observedPostcondition ? { observedPostcondition: normalized.observedPostcondition } : {}),
        confidence01: policy.confidenceCap01, observedAt, tick,
        independenceKey: `neko-plugin:${pluginId}`,
        tool: `neko-plugin:${eventType}`,
        metadata: { transport: 'neko-plugin', eventType, payloadHash, externallySupplied: true, verified: false },
        payload: normalized.payload,
      });

      const priorObservation = this.eventFabric.recent(256).find(event => event.id === observationEventId);
      if (priorObservation) {
        if (priorObservation.stage !== 'external-evidence' || priorObservation.source !== source ||
            priorObservation.payload.payloadHash !== payloadHash ||
            priorObservation.payload.observationId !== observation.id) return rejected('event-idempotency-conflict');
      } else {
        this.eventFabric.append({
          id: observationEventId, tick, at: observedAt, stage: 'external-evidence',
          source, parentIds: [receivedEventId], external: true, confidence01: policy.confidenceCap01,
          payload: { eventType, payloadHash, observationId: observation.id, phase: 'observation-recorded' },
        });
      }
      return { accepted: true, replayed, observationId: observation.id };
    } catch {
      return rejected('event-evidence-write-failed');
    }
  }
}
