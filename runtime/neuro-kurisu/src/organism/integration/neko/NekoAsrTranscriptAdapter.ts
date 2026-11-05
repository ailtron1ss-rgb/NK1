import { createHash, randomUUID } from 'node:crypto';
import { types as nodeUtilTypes } from 'node:util';
import type { NekoPcm16FrameV1, VoiceTurnToken } from './NekoAudioStreamContract.ts';

export interface NekoAsrCaptureRequest {
  readonly sessionId: string;
  readonly signal: AbortSignal;
}
export interface NekoAsrCancelRequest {
  readonly sessionId: string;
  readonly reason: string;
}
export interface NekoAsrCancelResponse {
  requested: boolean;
  verified: boolean;
  reason?: string;
}

export interface NekoAsrStreamCaptureRequest {
  readonly sessionId: string;
  readonly turnId: string;
  readonly token: VoiceTurnToken;
  readonly frames: AsyncIterable<NekoPcm16FrameV1>;
  readonly signal: AbortSignal;
}

export interface NekoAsrStreamProviderRequest extends NekoAsrStreamCaptureRequest {}

/** Host-owned port implemented by an N.E.K.O. ASR sidecar or a local ASR host. */
export interface NekoAsrProviderPort {
  readonly providerId: string;
  isAvailable(): boolean | Promise<boolean>;
  /** Resolves only when the provider has produced a complete transcript envelope. */
  captureFinal(request: NekoAsrCaptureRequest): Promise<unknown | null>;
  /** Optional stream-capable ASR seam. It must resolve only with a final transcript envelope. */
  transcribeStream?(request: NekoAsrStreamProviderRequest): Promise<unknown | null>;
  /** verified=true is allowed only after independent confirmation that capture stopped. */
  cancelSession?(request: NekoAsrCancelRequest): Promise<NekoAsrCancelResponse>;
}

export type NekoAsrCaptureResult =
  | { status: 'accepted'; sessionId: string; eventId: string; turnId: string; provider: string; transcript: string; confidence01?: number; language?: string }
  | { status: 'replayed'; sessionId: string; eventId: string }
  | { status: 'rejected'; reason: 'session-already-active' | 'provider-unavailable' | 'invalid-envelope' | 'session-mismatch' | 'turn-mismatch' | 'provider-mismatch' | 'not-final' | 'not-user' | 'empty-transcript' | 'transcript-too-large' | 'invalid-confidence' | 'low-confidence' | 'event-id-conflict' | 'stream-not-supported' | 'invalid-stream-request' }
  | { status: 'cancelled'; sessionId: string }
  | { status: 'error'; reason: string };

export type NekoAsrInterruptResult =
  | { status: 'verified'; sessionId: string }
  | { status: 'unverified'; sessionId: string; reason: string }
  | { status: 'unavailable'; reason: 'no-active-session' | 'provider-cancel-unsupported' };

interface ActiveCapture {
  sessionId: string;
  controller: AbortController;
  cancelled: boolean;
}
interface NormalizedTranscript {
  eventId: string;
  sessionId: string;
  turnId: string;
  provider: string;
  transcript: string;
  confidence01?: number;
  language?: string;
}

const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/i;
const ALLOWED_KEYS = new Set([
  'protocol', 'version', 'eventId', 'sessionId', 'turnId', 'provider',
  'speakerRole', 'phase', 'transcript', 'confidence01', 'language',
]);
const MAX_TRANSCRIPT_CHARS = 4_000;
const MAX_TRANSCRIPT_BYTES = 16_384;

function ownDataRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || nodeUtilTypes.isProxy(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length > ALLOWED_KEYS.size) return null;
    const output: Record<string, unknown> = {};
    for (const key of keys) {
      if (typeof key !== 'string' || !ALLOWED_KEYS.has(key)) return null;
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
function safeId(value: unknown, max = 160): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && SAFE_ID.test(value);
}
function normalizeTranscript(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .replace(/[\u0000-\u001f\u007f-\u009f]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!normalized) return '';
  if (normalized.length > MAX_TRANSCRIPT_CHARS || Buffer.byteLength(normalized, 'utf8') > MAX_TRANSCRIPT_BYTES) return null;
  return normalized;
}
function normalizeEnvelope(
  value: unknown,
  sessionId: string,
  providerId: string,
  minConfidence01: number,
  expectedTurnId?: string,
): { ok: true; value: NormalizedTranscript } | { ok: false; reason: 'invalid-envelope' | 'session-mismatch' | 'turn-mismatch' | 'provider-mismatch' | 'not-final' | 'not-user' | 'empty-transcript' | 'transcript-too-large' | 'invalid-confidence' | 'low-confidence' } {
  const raw = ownDataRecord(value);
  if (!raw || raw.protocol !== 'neko.asr.transcript' || raw.version !== 1 ||
      Object.keys(raw).some(key => !ALLOWED_KEYS.has(key))) return { ok: false, reason: 'invalid-envelope' };
  if (!safeId(raw.eventId) || !safeId(raw.sessionId) || !safeId(raw.turnId)) return { ok: false, reason: 'invalid-envelope' };
  if (raw.sessionId !== sessionId) return { ok: false, reason: 'session-mismatch' };
  if (expectedTurnId !== undefined && raw.turnId !== expectedTurnId) return { ok: false, reason: 'turn-mismatch' };
  if (raw.provider !== providerId) return { ok: false, reason: 'provider-mismatch' };
  if (raw.phase !== 'final') return { ok: false, reason: 'not-final' };
  if (raw.speakerRole !== 'user') return { ok: false, reason: 'not-user' };
  const transcript = normalizeTranscript(raw.transcript);
  if (transcript === null) return { ok: false, reason: 'transcript-too-large' };
  if (!transcript) return { ok: false, reason: 'empty-transcript' };
  let confidence01: number | undefined;
  if (raw.confidence01 !== undefined) {
    if (typeof raw.confidence01 !== 'number' || !Number.isFinite(raw.confidence01) || raw.confidence01 < 0 || raw.confidence01 > 1) {
      return { ok: false, reason: 'invalid-confidence' };
    }
    confidence01 = raw.confidence01;
  }
  if (minConfidence01 > 0 && (confidence01 === undefined || confidence01 < minConfidence01)) {
    return { ok: false, reason: 'low-confidence' };
  }
  let language: string | undefined;
  if (raw.language !== undefined) {
    if (typeof raw.language !== 'string' || raw.language.length > 35 || !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(raw.language)) {
      return { ok: false, reason: 'invalid-envelope' };
    }
    language = raw.language;
  }
  return {
    ok: true,
    value: {
      eventId: raw.eventId as string,
      sessionId: raw.sessionId as string,
      turnId: raw.turnId as string,
      provider: providerId,
      transcript,
      ...(confidence01 !== undefined ? { confidence01 } : {}),
      ...(language ? { language } : {}),
    },
  };
}

/**
 * Adapts one host-owned N.E.K.O. ASR provider into NK1's final-user-transcript boundary.
 * Partial hypotheses, assistant speech, unbound sessions and replay conflicts never leave this adapter.
 */
export class NekoAsrTranscriptAdapter {
  private readonly provider: NekoAsrProviderPort;
  private readonly minConfidence01: number;
  private readonly replayCapacity: number;
  private readonly delivered = new Map<string, string>();
  private active: ActiveCapture | null = null;

  constructor(provider: NekoAsrProviderPort, options: { minConfidence01?: number; replayCapacity?: number } = {}) {
    if (!provider || !safeId(provider.providerId, 64) || typeof provider.isAvailable !== 'function' || typeof provider.captureFinal !== 'function') {
      throw new TypeError('neko-asr-provider-port-required');
    }
    const minimum = options.minConfidence01 ?? 0;
    const capacity = options.replayCapacity ?? 512;
    if (!Number.isFinite(minimum) || minimum < 0 || minimum > 1) throw new RangeError('neko-asr-min-confidence-invalid');
    if (!Number.isSafeInteger(capacity) || capacity < 8 || capacity > 4096) throw new RangeError('neko-asr-replay-capacity-invalid');
    this.provider = provider;
    this.minConfidence01 = minimum;
    this.replayCapacity = capacity;
  }

  get providerId(): string { return this.provider.providerId; }
  get activeSessionId(): string | null { return this.active?.sessionId ?? null; }
  get isListening(): boolean { return this.active !== null; }

  async isAvailable(): Promise<boolean> {
    try { return await this.provider.isAvailable() === true; }
    catch { return false; }
  }

  async captureFinal(): Promise<NekoAsrCaptureResult> {
    if (this.active) return { status: 'rejected', reason: 'session-already-active' };
    if (!(await this.isAvailable())) return { status: 'rejected', reason: 'provider-unavailable' };
    // Availability may be asynchronous. Recheck after the await so concurrent callers
    // cannot both pass the initial idle check and start parallel microphone sessions.
    if (this.active) return { status: 'rejected', reason: 'session-already-active' };
    const active: ActiveCapture = {
      sessionId: 'nk1-asr-' + randomUUID(),
      controller: new AbortController(),
      cancelled: false,
    };
    this.active = active;
    try {
      let raw: unknown | null;
      try {
        raw = await this.provider.captureFinal({ sessionId: active.sessionId, signal: active.controller.signal });
      } catch (error) {
        if (active.cancelled || active.controller.signal.aborted) return { status: 'cancelled', sessionId: active.sessionId };
        return { status: 'error', reason: String((error as Error)?.message ?? error).replace(/[\r\n\t]+/gu, ' ').slice(0, 160) || 'provider-capture-failed' };
      }
      if (active.cancelled || active.controller.signal.aborted || this.active !== active) {
        return { status: 'cancelled', sessionId: active.sessionId };
      }
      if (raw === null) return { status: 'rejected', reason: 'empty-transcript' };
      const normalized = normalizeEnvelope(raw, active.sessionId, this.provider.providerId, this.minConfidence01);
      if (!normalized.ok) return { status: 'rejected', reason: normalized.reason };
      const item = normalized.value;
      const digest = createHash('sha256')
        .update(JSON.stringify({ provider: item.provider, turnId: item.turnId, transcript: item.transcript }))
        .digest('hex');
      const previous = this.delivered.get(item.eventId);
      if (previous !== undefined) {
        if (previous !== digest) return { status: 'rejected', reason: 'event-id-conflict' };
        return { status: 'replayed', sessionId: item.sessionId, eventId: item.eventId };
      }
      this.delivered.set(item.eventId, digest);
      while (this.delivered.size > this.replayCapacity) {
        const oldest = this.delivered.keys().next().value as string | undefined;
        if (oldest) this.delivered.delete(oldest);
        else break;
      }
      return { status: 'accepted', ...item };
    } finally {
      if (this.active === active) this.active = null;
    }
  }

  /**
   * Sends one host-owned PCM stream through the same final-transcript admission,
   * provenance, replay and cancellation boundary as the one-shot capture path.
   */
  async captureFinalFromStream(request: NekoAsrStreamCaptureRequest): Promise<NekoAsrCaptureResult> {
    const token = request?.token;
    const tokenIsPlain = token !== null && typeof token === 'object' &&
      !Array.isArray(token) && !nodeUtilTypes.isProxy(token) &&
      (Object.getPrototypeOf(token) === Object.prototype || Object.getPrototypeOf(token) === null);
    const tokenValid = tokenIsPlain &&
      Number.isSafeInteger(token.sessionEpoch) && token.sessionEpoch >= 0 &&
      safeId(token.connectionId, 160) &&
      Number.isSafeInteger(token.leaseGeneration) && token.leaseGeneration >= 0 &&
      Number.isSafeInteger(token.routeGeneration) && token.routeGeneration >= 0 &&
      Number.isSafeInteger(token.audioGeneration) && token.audioGeneration >= 0 &&
      token.turnId === request.turnId;
    const framesValid = request?.frames !== null && request?.frames !== undefined &&
      typeof request.frames[Symbol.asyncIterator] === 'function';
    const signalValid = request?.signal !== null && request?.signal !== undefined &&
      typeof request.signal.addEventListener === 'function' &&
      typeof request.signal.aborted === 'boolean';
    if (!safeId(request?.sessionId) || !safeId(request?.turnId) || !tokenValid || !framesValid || !signalValid) {
      return { status: 'rejected', reason: 'invalid-stream-request' };
    }
    const transcribeStream = this.provider.transcribeStream;
    if (typeof transcribeStream !== 'function') return { status: 'rejected', reason: 'stream-not-supported' };
    if (request.signal.aborted) return { status: 'cancelled', sessionId: request.sessionId };
    if (this.active) return { status: 'rejected', reason: 'session-already-active' };
    if (!(await this.isAvailable())) return { status: 'rejected', reason: 'provider-unavailable' };
    // isAvailable() may yield. A concurrent one-shot or streaming request may
    // have reserved the provider slot while this request was awaiting it.
    if (this.active) return { status: 'rejected', reason: 'session-already-active' };
    if (request.signal.aborted) return { status: 'cancelled', sessionId: request.sessionId };

    const active: ActiveCapture = {
      sessionId: request.sessionId,
      controller: new AbortController(),
      cancelled: false,
    };
    const abortFromHost = () => {
      active.cancelled = true;
      if (!active.controller.signal.aborted) {
        active.controller.abort(request.signal.reason ?? 'host-stream-aborted');
      }
    };
    request.signal.addEventListener('abort', abortFromHost, { once: true });
    this.active = active;
    try {
      let raw: unknown | null;
      try {
        raw = await transcribeStream.call(this.provider, {
          sessionId: request.sessionId,
          turnId: request.turnId,
          token: request.token,
          frames: request.frames,
          signal: active.controller.signal,
        });
      } catch (error) {
        if (active.cancelled || active.controller.signal.aborted || request.signal.aborted) {
          return { status: 'cancelled', sessionId: active.sessionId };
        }
        return {
          status: 'error',
          reason: String((error as Error)?.message ?? error).replace(/[\\r\\n\\t]+/gu, ' ').slice(0, 160) || 'provider-stream-failed',
        };
      }
      if (active.cancelled || active.controller.signal.aborted || request.signal.aborted || this.active !== active) {
        return { status: 'cancelled', sessionId: active.sessionId };
      }
      if (raw === null) return { status: 'rejected', reason: 'empty-transcript' };
      const normalized = normalizeEnvelope(raw, active.sessionId, this.provider.providerId, this.minConfidence01, request.turnId);
      if (!normalized.ok) return { status: 'rejected', reason: normalized.reason };
      const item = normalized.value;
      const digest = createHash('sha256')
        .update(JSON.stringify({ provider: item.provider, turnId: item.turnId, transcript: item.transcript }))
        .digest('hex');
      const previous = this.delivered.get(item.eventId);
      if (previous !== undefined) {
        if (previous !== digest) return { status: 'rejected', reason: 'event-id-conflict' };
        return { status: 'replayed', sessionId: item.sessionId, eventId: item.eventId };
      }
      this.delivered.set(item.eventId, digest);
      while (this.delivered.size > this.replayCapacity) {
        const oldest = this.delivered.keys().next().value as string | undefined;
        if (oldest) this.delivered.delete(oldest);
        else break;
      }
      return { status: 'accepted', ...item };
    } finally {
      request.signal.removeEventListener('abort', abortFromHost);
      if (this.active === active) this.active = null;
    }
  }

  async interrupt(reason = 'manual'): Promise<NekoAsrInterruptResult> {
    const active = this.active;
    if (!active) return { status: 'unavailable', reason: 'no-active-session' };
    const cancel = this.provider.cancelSession;
    if (typeof cancel !== 'function') return { status: 'unavailable', reason: 'provider-cancel-unsupported' };
    const cleanReason = String(reason ?? 'manual').replace(/[\r\n\t]+/gu, ' ').slice(0, 120) || 'manual';
    active.cancelled = true;
    active.controller.abort(cleanReason);
    try {
      const result = await cancel.call(this.provider, { sessionId: active.sessionId, reason: cleanReason });
      if (result?.requested === true && result?.verified === true) {
        if (this.active === active) this.active = null;
        return { status: 'verified', sessionId: active.sessionId };
      }
      const detail = typeof result?.reason === 'string' ? result.reason.slice(0, 120) : 'provider-cancel-not-verified';
      return { status: 'unverified', sessionId: active.sessionId, reason: detail };
    } catch (error) {
      return {
        status: 'unverified',
        sessionId: active.sessionId,
        reason: String((error as Error)?.message ?? error).replace(/[\r\n\t]+/gu, ' ').slice(0, 120) || 'provider-cancel-failed',
      };
    }
  }
}