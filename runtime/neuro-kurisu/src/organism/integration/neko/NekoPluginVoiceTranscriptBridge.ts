import { types as nodeUtilTypes } from 'node:util';
import { sha256Stable } from '../../core/StableSerialization.ts';

export interface NekoPluginVoiceTranscriptInput {
  sessionId: string;
  turnId: string;
  characterName: string;
  provider: string;
  speakerRole: 'user' | 'assistant';
  final: boolean;
  transcript: string;
}

export interface NekoPluginVoiceTranscriptObservedEvent {
  event_type: 'voice_transcript_observed';
  event_id: string;
  lanlan_name: string;
  transcript: string;
  metadata: Readonly<{
    session_id: string;
    turn_id: string;
    provider: string;
    voice_source: 'user_asr_final';
  }>;
}

export interface NekoPluginVoiceTranscriptConsentContext {
  readonly sessionId: string;
  readonly turnId: string;
  readonly characterName: string;
  readonly targetPluginIds: readonly string[];
}

export interface NekoPluginVoiceTranscriptBridgeOptions {
  /** Must be explicitly true; otherwise transcript observation is disabled. */
  enabled?: boolean;
  /** A non-empty, host-controlled subscriber allowlist. */
  targetPluginIds: readonly string[];
  /** Explicit per-session consent check. Exceptions and non-true results deny publication. */
  hasConsent: (context: NekoPluginVoiceTranscriptConsentContext) => boolean;
  /** Synchronous best-effort enqueue. It must not await plugin handlers or return plugin actions. */
  enqueueToPlugins: (
    pluginIds: readonly string[],
    event: NekoPluginVoiceTranscriptObservedEvent,
  ) => boolean;
  maxTranscriptChars?: number;
  maxTranscriptBytes?: number;
  replayCapacity?: number;
}

export type NekoPluginVoiceTranscriptBridgeResult =
  | { accepted: true; eventId: string; replayed?: true }
  | {
      accepted: false;
      reason:
        | 'disabled'
        | 'invalid-input'
        | 'not-user-final'
        | 'empty-transcript'
        | 'transcript-too-large'
        | 'no-subscribers'
        | 'consent-denied'
        | 'event-id-conflict'
        | 'enqueue-rejected';
    };

const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/i;
const ALLOWED_INPUT_KEYS = new Set([
  'sessionId', 'turnId', 'characterName', 'provider', 'speakerRole', 'final', 'transcript',
]);
const rejected = (reason: Extract<NekoPluginVoiceTranscriptBridgeResult, { accepted: false }>['reason'])
  : NekoPluginVoiceTranscriptBridgeResult => ({ accepted: false, reason });

function ownDataRecord(value: unknown, maxKeys: number): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || nodeUtilTypes.isProxy(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length > maxKeys) return null;
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      if (typeof key !== 'string' || key === '__proto__' || key === 'prototype' || key === 'constructor') return null;
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

/** Read a small host allowlist without invoking array accessors or Proxy traps. */
function ownDenseArray(value: unknown, maxLength: number): unknown[] | null {
  try {
    if (!Array.isArray(value) || nodeUtilTypes.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    const lengthDescriptor = descriptors.length;
    const length = lengthDescriptor?.value;
    if (!Number.isSafeInteger(length) || length < 1 || length > maxLength || keys.length !== length + 1) return null;
    const output: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) return null;
      output.push(descriptor.value);
    }
    return output;
  } catch {
    return null;
  }
}

function boundedId(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) return null;
  const normalized = value.trim();
  return normalized && SAFE_ID.test(normalized) ? normalized : null;
}

function normalizeTranscript(value: unknown, maxChars: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .replace(/[\u0000-\u001f\u007f-\u009f]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!normalized) return '';
  if (normalized.length > maxChars) return null;
  return normalized;
}

/**
 * Outbound-only adapter for N.E.K.O.'s voice_transcript_observed event.
 *
 * It intentionally does not implement the older arbitrated voice_transcript
 * request: plugins are observers, not authorities over NK1's active turn.
 * Raw transcripts are never written to NK1 memory or cognitive evidence stores.
 */
export class NekoPluginVoiceTranscriptBridge {
  private readonly enabled: boolean;
  private readonly targetPluginIds: readonly string[];
  private readonly hasConsent: NekoPluginVoiceTranscriptBridgeOptions['hasConsent'];
  private readonly enqueueToPlugins: NekoPluginVoiceTranscriptBridgeOptions['enqueueToPlugins'];
  private readonly maxTranscriptChars: number;
  private readonly maxTranscriptBytes: number;
  private readonly replayCapacity: number;
  /** Stores only a digest, never transcript content. */
  private readonly delivered = new Map<string, string>();

  constructor(options: NekoPluginVoiceTranscriptBridgeOptions) {
    if (!options || typeof options.hasConsent !== 'function') {
      throw new Error('neko-plugin-voice-consent-check-required');
    }
    if (typeof options.enqueueToPlugins !== 'function') {
      throw new Error('neko-plugin-voice-enqueue-required');
    }
    const rawTargets = ownDenseArray(options.targetPluginIds, 32);
    if (!rawTargets) throw new Error('neko-plugin-voice-subscriber-allowlist-required');
    const targets: string[] = [];
    for (const value of rawTargets) {
      const pluginId = boundedId(value, 80);
      if (!pluginId || targets.includes(pluginId)) throw new Error('neko-plugin-voice-subscriber-id-invalid');
      targets.push(pluginId);
    }
    this.enabled = options.enabled === true;
    this.targetPluginIds = Object.freeze(targets);
    this.hasConsent = options.hasConsent;
    this.enqueueToPlugins = options.enqueueToPlugins;
    this.maxTranscriptChars = this.boundedInteger(options.maxTranscriptChars, 4096, 1, 16_384);
    this.maxTranscriptBytes = this.boundedInteger(options.maxTranscriptBytes, 16_384, 128, 65_536);
    this.replayCapacity = this.boundedInteger(options.replayCapacity, 512, 8, 4096);
  }

  private boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
    if (value === undefined) return fallback;
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new Error('neko-plugin-voice-invalid-limit');
    }
    return value;
  }

  publishFinal(rawInput: unknown): NekoPluginVoiceTranscriptBridgeResult {
    if (!this.enabled) return rejected('disabled');

    const raw = ownDataRecord(rawInput, 12);
    if (!raw || Object.keys(raw).some(key => !ALLOWED_INPUT_KEYS.has(key))) return rejected('invalid-input');

    const sessionId = boundedId(raw.sessionId, 128);
    const turnId = boundedId(raw.turnId, 128);
    const characterName = boundedId(raw.characterName, 80);
    const provider = boundedId(raw.provider, 64);
    if (!sessionId || !turnId || !characterName || !provider ||
        typeof raw.final !== 'boolean' || typeof raw.speakerRole !== 'string') {
      return rejected('invalid-input');
    }
    if (raw.final !== true || raw.speakerRole !== 'user') return rejected('not-user-final');

    const transcript = normalizeTranscript(raw.transcript, this.maxTranscriptChars);
    if (transcript === null) return rejected('transcript-too-large');
    if (!transcript) return rejected('empty-transcript');
    if (Buffer.byteLength(transcript, 'utf8') > this.maxTranscriptBytes) return rejected('transcript-too-large');

    const consentContext: NekoPluginVoiceTranscriptConsentContext = Object.freeze({
      sessionId,
      turnId,
      characterName,
      targetPluginIds: this.targetPluginIds,
    });
    let consented = false;
    try {
      consented = this.hasConsent(consentContext) === true;
    } catch {
      consented = false;
    }
    if (!consented) return rejected('consent-denied');
    if (!this.targetPluginIds.length) return rejected('no-subscribers');

    const eventId = 'neko-voice:' + sha256Stable({ sessionId, turnId, characterName }).slice(0, 48);
    const payloadDigest = sha256Stable({ transcript, provider, targetPluginIds: this.targetPluginIds });
    const priorDigest = this.delivered.get(eventId);
    if (priorDigest !== undefined) {
      if (priorDigest !== payloadDigest) return rejected('event-id-conflict');
      return { accepted: true, eventId, replayed: true };
    }

    const metadata = Object.freeze({
      session_id: sessionId,
      turn_id: turnId,
      provider,
      voice_source: 'user_asr_final' as const,
    });
    const event: NekoPluginVoiceTranscriptObservedEvent = Object.freeze({
      event_type: 'voice_transcript_observed',
      event_id: eventId,
      lanlan_name: characterName,
      transcript,
      metadata,
    });

    let enqueued = false;
    try {
      enqueued = this.enqueueToPlugins(this.targetPluginIds, event) === true;
    } catch {
      enqueued = false;
    }
    if (!enqueued) return rejected('enqueue-rejected');

    this.delivered.set(eventId, payloadDigest);
    while (this.delivered.size > this.replayCapacity) {
      const oldest = this.delivered.keys().next().value as string | undefined;
      if (!oldest) break;
      this.delivered.delete(oldest);
    }
    return { accepted: true, eventId };
  }

  diagnostics(): Readonly<{ enabled: boolean; subscribers: number; replayEntries: number }> {
    return Object.freeze({
      enabled: this.enabled,
      subscribers: this.targetPluginIds.length,
      replayEntries: this.delivered.size,
    });
  }
}
