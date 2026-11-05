import { createHash } from 'node:crypto';
import { types as nodeUtilTypes } from 'node:util';

export interface VoiceIngressToken {
  readonly sessionEpoch: number;
  readonly connectionId: string;
  readonly leaseGeneration: number;
  readonly routeGeneration: number;
  readonly audioGeneration: number;
}

export interface VoiceTurnToken extends VoiceIngressToken {
  readonly turnId: string;
}

export interface NekoPcm16FrameV1 {
  readonly protocol: 'neko.audio.pcm16';
  readonly version: 1;
  readonly sessionId: string;
  readonly turnId: string;
  readonly token: VoiceTurnToken;
  readonly sequence: number;
  readonly capturedAtMs: number;
  readonly sampleRateHz: 16000;
  readonly channels: 1;
  readonly encoding: 's16le';
  /** A defensive copy containing exactly 20ms / 320 samples / 640 bytes. */
  readonly samples: Uint8Array;
}

export type NekoPcm16FrameValidation =
  | { readonly status: 'accepted'; readonly frame: NekoPcm16FrameV1 }
  | { readonly status: 'rejected'; readonly reason: string };

export type NekoPcm16FrameSequenceResult =
  | { readonly status: 'accepted'; readonly frame: NekoPcm16FrameV1 }
  | { readonly status: 'replayed'; readonly sequence: number }
  | { readonly status: 'invalidated'; readonly reason: string };

const FRAME_BYTES = 640;
const TOKEN_KEYS = new Set([
  'sessionEpoch', 'connectionId', 'leaseGeneration',
  'routeGeneration', 'audioGeneration', 'turnId',
]);
const FRAME_KEYS = new Set([
  'protocol', 'version', 'sessionId', 'turnId', 'token',
  'sequence', 'capturedAtMs', 'sampleRateHz', 'channels',
  'encoding', 'samples',
]);
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/i;

function ownDataRecord(value: unknown, allowedKeys: Set<string>): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || nodeUtilTypes.isProxy(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length !== allowedKeys.size && keys.some(key => typeof key !== 'string' || !allowedKeys.has(key))) {
      // Optional exact-shape checks are performed by the required-field validator below.
      if (keys.some(key => typeof key !== 'string' || !allowedKeys.has(key))) return null;
    }
    const output: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      if (typeof key !== 'string' || !allowedKeys.has(key)) return null;
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

function safeId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value);
}

function validGeneration(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function normalizeToken(value: unknown): VoiceTurnToken | null {
  const raw = ownDataRecord(value, TOKEN_KEYS);
  if (!raw || Object.keys(raw).length !== TOKEN_KEYS.size ||
      !validGeneration(raw.sessionEpoch) ||
      typeof raw.connectionId !== 'string' || !safeId(raw.connectionId) ||
      !validGeneration(raw.leaseGeneration) ||
      !validGeneration(raw.routeGeneration) ||
      !validGeneration(raw.audioGeneration) ||
      !safeId(raw.turnId)) return null;
  return Object.freeze({
    sessionEpoch: raw.sessionEpoch as number,
    connectionId: raw.connectionId,
    leaseGeneration: raw.leaseGeneration as number,
    routeGeneration: raw.routeGeneration as number,
    audioGeneration: raw.audioGeneration as number,
    turnId: raw.turnId,
  });
}

export function validateNekoPcm16Frame(value: unknown): NekoPcm16FrameValidation {
  const raw = ownDataRecord(value, FRAME_KEYS);
  if (!raw || Object.keys(raw).length !== FRAME_KEYS.size) return { status: 'rejected', reason: 'invalid-frame-envelope' };
  if (raw.protocol !== 'neko.audio.pcm16' || raw.version !== 1) return { status: 'rejected', reason: 'unsupported-audio-protocol' };
  if (!safeId(raw.sessionId) || !safeId(raw.turnId)) return { status: 'rejected', reason: 'invalid-session-or-turn-id' };
  if (!Number.isSafeInteger(raw.sequence) || (raw.sequence as number) < 0) return { status: 'rejected', reason: 'invalid-frame-sequence' };
  if (typeof raw.capturedAtMs !== 'number' || !Number.isFinite(raw.capturedAtMs) || raw.capturedAtMs < 0) {
    return { status: 'rejected', reason: 'invalid-capture-timestamp' };
  }
  if (raw.sampleRateHz !== 16000 || raw.channels !== 1 || raw.encoding !== 's16le') {
    return { status: 'rejected', reason: 'unsupported-pcm-format' };
  }
  if (!(raw.samples instanceof Uint8Array) || nodeUtilTypes.isProxy(raw.samples) || raw.samples.byteLength !== FRAME_BYTES) {
    return { status: 'rejected', reason: 'invalid-pcm-frame-size' };
  }
  const token = normalizeToken(raw.token);
  if (!token || token.turnId !== raw.turnId) return { status: 'rejected', reason: 'invalid-voice-turn-token' };
  const samples = new Uint8Array(raw.samples);
  const frame: NekoPcm16FrameV1 = Object.freeze({
    protocol: 'neko.audio.pcm16',
    version: 1,
    sessionId: raw.sessionId,
    turnId: raw.turnId,
    token,
    sequence: raw.sequence as number,
    capturedAtMs: raw.capturedAtMs,
    sampleRateHz: 16000,
    channels: 1,
    encoding: 's16le',
    samples,
  });
  return { status: 'accepted', frame };
}

export interface NekoPcm16FrameSequenceGuardOptions {
  readonly sessionId: string;
  readonly turnId: string;
  readonly token: VoiceTurnToken;
  readonly replayCapacity?: number;
}

/** Enforces one session's monotonically increasing frame stream and bounded replay memory. */
export class NekoPcm16FrameSequenceGuard {
  private readonly sessionId: string;
  private readonly turnId: string;
  private readonly token: VoiceTurnToken;
  private readonly replayCapacity: number;
  private readonly digests = new Map<number, string>();
  private nextSequence = 0;
  private lastCapturedAtMs = -1;
  private invalidatedReason: string | null = null;

  constructor(options: NekoPcm16FrameSequenceGuardOptions) {
    const token = normalizeToken(options?.token);
    if (!safeId(options?.sessionId) || !safeId(options?.turnId) || !token || token.turnId !== options.turnId) {
      throw new TypeError('neko-audio-sequence-guard-options-invalid');
    }
    const capacity = options.replayCapacity ?? 128;
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 512) throw new RangeError('neko-audio-replay-capacity-invalid');
    this.sessionId = options.sessionId;
    this.turnId = options.turnId;
    this.token = token;
    this.replayCapacity = capacity;
  }

  get isInvalidated(): boolean { return this.invalidatedReason !== null; }
  get expectedSequence(): number { return this.nextSequence; }

  accept(value: unknown): NekoPcm16FrameSequenceResult {
    if (this.invalidatedReason) return { status: 'invalidated', reason: this.invalidatedReason };
    const validation = validateNekoPcm16Frame(value);
    if (validation.status !== 'accepted') return this.invalidate(validation.reason);
    const frame = validation.frame;
    if (frame.sessionId !== this.sessionId || frame.turnId !== this.turnId || !this.matchesToken(frame.token)) {
      return this.invalidate('stale-or-mismatched-voice-turn-token');
    }

    const digest = createHash('sha256')
      .update(JSON.stringify({
        sessionId: frame.sessionId,
        turnId: frame.turnId,
        token: frame.token,
        sequence: frame.sequence,
        capturedAtMs: frame.capturedAtMs,
      }))
      .update(frame.samples)
      .digest('hex');

    if (frame.sequence < this.nextSequence) {
      const previous = this.digests.get(frame.sequence);
      if (previous === digest) return { status: 'replayed', sequence: frame.sequence };
      return this.invalidate(previous === undefined ? 'replay-outside-window' : 'sequence-conflict');
    }
    if (frame.sequence > this.nextSequence) return this.invalidate('sequence-gap');
    if (frame.capturedAtMs < this.lastCapturedAtMs) return this.invalidate('capture-timestamp-regression');

    this.digests.set(frame.sequence, digest);
    while (this.digests.size > this.replayCapacity) {
      const oldest = this.digests.keys().next().value as number | undefined;
      if (oldest === undefined) break;
      this.digests.delete(oldest);
    }
    this.nextSequence += 1;
    this.lastCapturedAtMs = frame.capturedAtMs;
    return { status: 'accepted', frame };
  }

  private matchesToken(candidate: VoiceTurnToken): boolean {
    return candidate.sessionEpoch === this.token.sessionEpoch &&
      candidate.connectionId === this.token.connectionId &&
      candidate.leaseGeneration === this.token.leaseGeneration &&
      candidate.routeGeneration === this.token.routeGeneration &&
      candidate.audioGeneration === this.token.audioGeneration &&
      candidate.turnId === this.token.turnId;
  }

  private invalidate(reason: string): NekoPcm16FrameSequenceResult {
    this.invalidatedReason = reason;
    this.digests.clear();
    return { status: 'invalidated', reason };
  }
}
