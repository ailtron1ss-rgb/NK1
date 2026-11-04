import { types as nodeUtilTypes } from 'node:util';
import { sha256Stable } from '../../core/StableSerialization.ts';
import type {
  ExternalObserverFabric,
  ExternalObservation,
} from '../../system/ExternalObserverFabric.ts';
import type {
  CognitiveEventFabric,
  CognitiveEventNode,
} from '../../system/CognitiveEventFabric.ts';

export interface NekoExternalObservationEvent {
  pluginId: string;
  eventId: string;
  claimKey: string;
  summary: string;
  facts?: string[];
  /** Untrusted plugin clock, retained for diagnostics only; never used as observation time. */
  reportedAt?: number;
}

export interface NekoExternalObservationBridgeContext {
  /** Host-owned organism tick; never accepted from the plugin payload. */
  tick: number;
  /** Host receive time. The plugin's reportedAt is not authoritative. */
  receivedAt?: number;
}

export interface NekoExternalObservationReceipt {
  eventKey: string;
  eventFingerprint: string;
  observationId: string;
  eventNodeId: string;
  tick: number;
  receivedAt: number;
}

export interface NekoExternalObservationBridgeState {
  version: 1;
  receipts: NekoExternalObservationReceipt[];
  totalAccepted: number;
  totalConflicts: number;
  lastAcceptedAt: number;
}

export type NekoExternalObservationBridgeResult =
  | {
      accepted: true;
      replayed: boolean;
      observationId: string;
      eventNodeId: string;
      confidence01: 0.25;
      sourceClass: 'unknown';
      stage: 'external-evidence';
    }
  | {
      accepted: false;
      error:
        | 'invalid-event'
        | 'event-id-conflict'
        | 'event-history-incomplete'
        | 'invalid-context'
        | 'source-disabled'
        | 'observation-ingress-failed';
    };

export interface NekoExternalObservationBridgeOptions {
  observers: ExternalObserverFabric;
  events: CognitiveEventFabric;
  maxReceipts?: number;
  now?: () => number;
}

const INPUT_KEYS = new Set(['pluginId', 'eventId', 'claimKey', 'summary', 'facts', 'reportedAt']);
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const PLUGIN_ID = /^[a-z0-9][a-z0-9._-]{1,47}$/i;
const EVENT_ID = /^[a-z0-9][a-z0-9._:-]{0,79}$/i;
const CONTROL = /[\u0000-\u001f\u007f]/;
const MAX_FACTS = 8;
const PLUGIN_CONFIDENCE01 = 0.25;
const SOURCE = 'neko-plugin-observation-bridge';

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

function safeFacts(value: unknown): string[] | null {
  if (value === undefined) return [];
  try {
    if (!Array.isArray(value) || nodeUtilTypes.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_FACTS) return null;
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length !== length + 1) return null;
    const facts: string[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      const item = descriptor?.value;
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable ||
          typeof item !== 'string' || CONTROL.test(item)) return null;
      const normalized = item.normalize('NFKC').replace(/\s+/g, ' ').trim();
      if (!normalized || normalized.length > 160) return null;
      facts.push(normalized);
    }
    return facts;
  } catch {
    return null;
  }
}

function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || CONTROL.test(value)) return null;
  const normalized = value.normalize('NFKC').replace(/\s+/g, ' ').trim();
  return normalized.length > 0 && normalized.length <= max ? normalized : null;
}

function ownArrayValues(value: unknown, maxLength: number): unknown[] | null {
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

function cleanRestoreReceipt(value: unknown): NekoExternalObservationReceipt | null {
  const row = ownDataObject(value, 8);
  if (!row) return null;
  if (typeof row.eventKey !== 'string' || row.eventKey.length > 140 ||
      !/^[a-z0-9._:-]+$/i.test(row.eventKey)) return null;
  if (typeof row.eventFingerprint !== 'string' || !/^[a-f0-9]{64}$/i.test(row.eventFingerprint)) return null;
  if (typeof row.observationId !== 'string' || row.observationId.length > 180 ||
      typeof row.eventNodeId !== 'string' || row.eventNodeId.length > 180) return null;
  if (typeof row.tick !== 'number' || !Number.isSafeInteger(row.tick) || row.tick < 0 ||
      typeof row.receivedAt !== 'number' || !Number.isFinite(row.receivedAt) || row.receivedAt < 0) return null;
  return {
    eventKey: row.eventKey,
    eventFingerprint: row.eventFingerprint.toLowerCase(),
    observationId: row.observationId,
    eventNodeId: row.eventNodeId,
    tick: row.tick,
    receivedAt: row.receivedAt,
  };
}

export const defaultNekoExternalObservationBridgeState = (): NekoExternalObservationBridgeState => ({
  version: 1,
  receipts: [],
  totalAccepted: 0,
  totalConflicts: 0,
  lastAcceptedAt: 0,
});

/**
 * Ingress adapter for N.E.K.O.-originated events.
 *
 * Plugin output is recorded as low-confidence external evidence only. It does not
 * update beliefs, goals, memory, self state, tool receipts or postcondition status.
 * A separate trusted observer must corroborate any claim before it can be verified.
 */
export class NekoExternalObservationBridge {
  private readonly observers: ExternalObserverFabric;
  private readonly events: CognitiveEventFabric;
  private readonly now: () => number;
  private readonly maxReceipts: number;
  private state = defaultNekoExternalObservationBridgeState();

  constructor(options: NekoExternalObservationBridgeOptions) {
    if (!options?.observers || typeof options.observers.observe !== 'function' ||
        typeof options?.events?.append !== 'function' || typeof options.events.snapshot !== 'function') {
      throw new Error('neko-observation-bridge-canonical-fabrics-required');
    }
    this.observers = options.observers;
    this.events = options.events;
    this.now = options.now ?? Date.now;
    this.maxReceipts = options.maxReceipts ?? 512;
    if (!Number.isSafeInteger(this.maxReceipts) || this.maxReceipts < 64 || this.maxReceipts > 2048) {
      throw new Error('neko-observation-bridge-invalid-receipt-capacity');
    }
  }

  snapshot(): NekoExternalObservationBridgeState {
    return structuredClone(this.state);
  }

  restore(raw: unknown): void {
    const row = ownDataObject(raw, 8);
    const rawReceipts = row ? ownArrayValues(row.receipts, 4096) : null;
    if (!row || row.version !== 1 || !rawReceipts) {
      this.state = defaultNekoExternalObservationBridgeState();
      return;
    }
    const receipts: NekoExternalObservationReceipt[] = [];
    const byKey = new Map<string, NekoExternalObservationReceipt>();
    for (const item of rawReceipts.slice(-this.maxReceipts)) {
      const receipt = cleanRestoreReceipt(item);
      if (!receipt) continue;
      const prior = byKey.get(receipt.eventKey);
      if (prior && prior.eventFingerprint !== receipt.eventFingerprint) continue;
      if (!prior) {
        byKey.set(receipt.eventKey, receipt);
        receipts.push(receipt);
      }
    }
    this.state = {
      version: 1,
      receipts,
      totalAccepted: typeof row.totalAccepted === 'number' && Number.isSafeInteger(row.totalAccepted)
        ? Math.max(receipts.length, Math.max(0, row.totalAccepted)) : receipts.length,
      totalConflicts: typeof row.totalConflicts === 'number' && Number.isSafeInteger(row.totalConflicts)
        ? Math.max(0, row.totalConflicts) : 0,
      lastAcceptedAt: typeof row.lastAcceptedAt === 'number' && Number.isFinite(row.lastAcceptedAt)
        ? Math.max(0, row.lastAcceptedAt) : 0,
    };
  }

  ingest(rawEvent: unknown, context: NekoExternalObservationBridgeContext): NekoExternalObservationBridgeResult {
    const raw = ownDataObject(rawEvent, 12);
    if (!raw || Object.keys(raw).some(key => !INPUT_KEYS.has(key))) return { accepted: false, error: 'invalid-event' };
    if (!context || typeof context.tick !== 'number' || !Number.isSafeInteger(context.tick) || context.tick < 0) {
      return { accepted: false, error: 'invalid-context' };
    }
    const receivedAt = context.receivedAt === undefined ? this.now() : context.receivedAt;
    if (typeof receivedAt !== 'number' || !Number.isFinite(receivedAt) || receivedAt < 0) {
      return { accepted: false, error: 'invalid-context' };
    }

    const pluginId = boundedText(raw.pluginId, 48);
    const eventId = boundedText(raw.eventId, 80);
    const claimKey = boundedText(raw.claimKey, 120);
    const summary = boundedText(raw.summary, 320);
    if (!pluginId || !PLUGIN_ID.test(pluginId) || !eventId || !EVENT_ID.test(eventId) || !claimKey || !summary) {
      return { accepted: false, error: 'invalid-event' };
    }
    const facts = safeFacts(raw.facts);
    if (!facts) return { accepted: false, error: 'invalid-event' };
    const reportedAt = raw.reportedAt === undefined ? undefined : raw.reportedAt;
    if (reportedAt !== undefined && (typeof reportedAt !== 'number' || !Number.isFinite(reportedAt) || reportedAt < 0)) {
      return { accepted: false, error: 'invalid-event' };
    }

    const normalized = {
      pluginId,
      eventId,
      claimKey: claimKey.toLocaleLowerCase(),
      summary,
      facts,
      ...(reportedAt === undefined ? {} : { reportedAt }),
    };
    const eventKey = `${pluginId}:${eventId}`;
    const eventFingerprint = sha256Stable(normalized);
    const prior = this.state.receipts.find(receipt => receipt.eventKey === eventKey);
    if (prior) {
      if (prior.eventFingerprint !== eventFingerprint) {
        this.state.totalConflicts += 1;
        return { accepted: false, error: 'event-id-conflict' };
      }
      return {
        accepted: true, replayed: true,
        observationId: prior.observationId,
        eventNodeId: prior.eventNodeId,
        confidence01: PLUGIN_CONFIDENCE01,
        sourceClass: 'unknown',
        stage: 'external-evidence',
      };
    }

    const eventNodeId = `cef:neko:${pluginId}:${eventId}`;
    const existingNode = this.events.snapshot().recent.find(node => node.id === eventNodeId);
    if (existingNode) {
      if (existingNode.payload?.eventFingerprint !== eventFingerprint) {
        this.state.totalConflicts += 1;
        return { accepted: false, error: 'event-id-conflict' };
      }
      const observationId = typeof existingNode.payload?.observationId === 'string'
        ? existingNode.payload.observationId : '';
      const observationExists = this.observers.snapshot().observations.some(item => item.id === observationId);
      if (!observationId || !observationExists) return { accepted: false, error: 'event-history-incomplete' };
      this.remember({ eventKey, eventFingerprint, observationId, eventNodeId, tick: existingNode.tick, receivedAt: existingNode.at });
      return {
        accepted: true, replayed: true, observationId, eventNodeId,
        confidence01: PLUGIN_CONFIDENCE01, sourceClass: 'unknown', stage: 'external-evidence',
      };
    }

    try {
      const sourceId = `neko-plugin.${pluginId}`;
      const independenceKey = `neko-plugin-source:${pluginId}`;
      const existingSource = this.observers.snapshot().sources.find(source => source.id === sourceId);
      if (existingSource && !existingSource.enabled) return { accepted: false, error: 'source-disabled' };
      this.observers.registerSource({
        id: sourceId,
        sourceClass: 'unknown',
        channel: 'tool',
        independenceKey,
        reliability01: PLUGIN_CONFIDENCE01,
        // Never undo an explicit host disable during registration.
        enabled: existingSource?.enabled ?? true,
      });
      const observation: ExternalObservation = this.observers.observe({
        sourceId,
        sourceClass: 'unknown',
        channel: 'tool',
        independenceKey,
        claimKey: `plugin:${pluginId}:${normalized.claimKey}`,
        observedPostcondition: summary,
        facts: [summary, ...facts].slice(0, 9),
        confidence01: PLUGIN_CONFIDENCE01,
        observedAt: receivedAt,
        metadata: { adapter: 'NekoExternalObservationBridge', pluginId, eventId, reportedAt: reportedAt ?? null },
        payload: normalized,
      });
      const node: CognitiveEventNode = this.events.append({
        id: eventNodeId,
        tick: context.tick,
        at: receivedAt,
        stage: 'external-evidence',
        source: SOURCE,
        external: true,
        confidence01: PLUGIN_CONFIDENCE01,
        payload: {
          observationId: observation.id,
          pluginId,
          eventFingerprint,
          claimKey: `plugin:${pluginId}:${normalized.claimKey}`,
        },
      });
      this.remember({
        eventKey, eventFingerprint, observationId: observation.id,
        eventNodeId: node.id, tick: context.tick, receivedAt,
      });
      return {
        accepted: true,
        replayed: false,
        observationId: observation.id,
        eventNodeId: node.id,
        confidence01: PLUGIN_CONFIDENCE01,
        sourceClass: 'unknown',
        stage: 'external-evidence',
      };
    } catch {
      return { accepted: false, error: 'observation-ingress-failed' };
    }
  }

  private remember(receipt: NekoExternalObservationReceipt): void {
    this.state.receipts = [receipt, ...this.state.receipts.filter(row => row.eventKey !== receipt.eventKey)]
      .slice(0, this.maxReceipts);
    this.state.totalAccepted += 1;
    this.state.lastAcceptedAt = receipt.receivedAt;
  }
}
