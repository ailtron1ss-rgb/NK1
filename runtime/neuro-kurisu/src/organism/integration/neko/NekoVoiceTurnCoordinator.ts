import { types as nodeUtilTypes } from 'node:util';
import {
  NekoPcm16FrameSequenceGuard,
  type NekoPcm16FrameV1,
  type VoiceTurnToken,
} from './NekoAudioStreamContract.ts';
import {
  NekoBoundedAudioFrameChannel,
  NekoPcm16RingBuffer,
  type NekoBoundedAudioFrameChannelOptions,
  type NekoPcm16RingBufferOptions,
} from './NekoAudioFrameBuffer.ts';
import type {
  NekoAsrCaptureResult,
  NekoAsrStreamCaptureRequest,
} from './NekoAsrTranscriptAdapter.ts';

export type NekoVoiceTurnBoundaryMode = 'provider' | 'smart-turn' | 'host-manual';
export type NekoVoiceActivityEvent = 'none' | 'speech_started' | 'speech_resumed' | 'candidate_pause';
export type NekoTurnBoundaryStatus = 'OK' | 'UNAVAILABLE' | 'ERROR' | 'STALE';
export type NekoTurnBoundaryDecision = 'INCOMPLETE' | 'COMPLETE';

export interface NekoAudioInputOpenRequest {
  /** Opaque host-issued microphone grant. The input host is responsible for validating it. */
  readonly authorization: unknown;
  readonly token: VoiceTurnToken;
  readonly signal: AbortSignal;
}

export interface NekoAudioInputCloseResult {
  readonly requested: boolean;
  readonly verified: boolean;
  readonly reason?: string;
}

export interface NekoAudioInputSession {
  readonly sessionId: string;
  readonly turnId: string;
  readonly token: VoiceTurnToken;
  readonly frames: AsyncIterable<unknown>;
  close?(reason: string): Promise<NekoAudioInputCloseResult | void> | NekoAudioInputCloseResult | void;
}

export interface NekoAudioInputPort {
  openSession(request: NekoAudioInputOpenRequest): Promise<NekoAudioInputSession>;
}

export interface NekoVoiceActivityRequest {
  readonly token: VoiceTurnToken;
  readonly activitySeq: number;
  readonly signal: AbortSignal;
}

export interface NekoVoiceActivityPort {
  /** VAD may report activity hints only; it cannot finalize a user turn. */
  observe(frame: NekoPcm16FrameV1, request: NekoVoiceActivityRequest): NekoVoiceActivityEvent | Promise<NekoVoiceActivityEvent>;
}

export interface NekoTurnBoundaryEvaluationRequest {
  readonly frames: readonly NekoPcm16FrameV1[];
  readonly token: VoiceTurnToken;
  readonly generation: number;
  readonly activitySeq: number;
  readonly signal: AbortSignal;
}

export interface NekoTurnBoundaryEvaluation {
  readonly status: NekoTurnBoundaryStatus;
  readonly decision: NekoTurnBoundaryDecision;
  readonly generation: number;
  readonly activitySeq: number;
  readonly reason?: string;
}

export interface NekoTurnBoundaryPort {
  evaluate(request: NekoTurnBoundaryEvaluationRequest): Promise<NekoTurnBoundaryEvaluation>;
}

export interface NekoStreamingAsrPort {
  captureFinalFromStream(request: NekoAsrStreamCaptureRequest): Promise<NekoAsrCaptureResult>;
  interrupt?(reason?: string): Promise<unknown>;
}

export interface NekoVoiceTurnCoordinatorOptions {
  readonly audioInput: NekoAudioInputPort;
  readonly asrAdapter: NekoStreamingAsrPort;
  readonly voiceActivity?: NekoVoiceActivityPort;
  readonly turnBoundary?: NekoTurnBoundaryPort;
  readonly boundaryMode: NekoVoiceTurnBoundaryMode;
  readonly channel?: NekoBoundedAudioFrameChannelOptions;
  readonly ringBuffer?: NekoPcm16RingBufferOptions;
}

export interface NekoVoiceTurnCaptureRequest {
  readonly authorization: unknown;
  readonly token: VoiceTurnToken;
  readonly signal?: AbortSignal;
}

export type NekoVoiceTurnResult =
  | {
      readonly status: 'accepted';
      readonly sessionId: string;
      readonly turnId: string;
      readonly transcript: Extract<NekoAsrCaptureResult, { status: 'accepted' }>;
      readonly activitySeq: number;
      readonly boundaryMode: NekoVoiceTurnBoundaryMode;
    }
  | { readonly status: 'rejected'; readonly reason: string }
  | { readonly status: 'cancelled'; readonly sessionId?: string }
  | { readonly status: 'error'; readonly reason: string };

interface ActiveVoiceTurn {
  readonly controller: AbortController;
  session?: NekoAudioInputSession;
  channel?: NekoBoundedAudioFrameChannel;
  cancelled: boolean;
  sessionId?: string;
  sessionClosed: boolean;
  sessionCloseVerified: boolean;
  sessionClosePromise?: Promise<boolean>;
}

/** One host input, one ordered pump, one bounded ASR reader, and one existing cognition ingress. */
export class NekoVoiceTurnCoordinator {
  private readonly audioInput: NekoAudioInputPort;
  private readonly asrAdapter: NekoStreamingAsrPort;
  private readonly voiceActivity?: NekoVoiceActivityPort;
  private readonly turnBoundary?: NekoTurnBoundaryPort;
  private readonly boundaryMode: NekoVoiceTurnBoundaryMode;
  private readonly channelOptions?: NekoBoundedAudioFrameChannelOptions;
  private readonly ringOptions?: NekoPcm16RingBufferOptions;
  private active: ActiveVoiceTurn | null = null;

  constructor(options: NekoVoiceTurnCoordinatorOptions) {
    if (!options?.audioInput || typeof options.audioInput.openSession !== 'function') {
      throw new TypeError('neko-audio-input-port-required');
    }
    if (!options.asrAdapter || typeof options.asrAdapter.captureFinalFromStream !== 'function') {
      throw new TypeError('neko-streaming-asr-adapter-required');
    }
    if (!['provider', 'smart-turn', 'host-manual'].includes(options.boundaryMode)) {
      throw new TypeError('neko-voice-boundary-mode-invalid');
    }
    if (options.boundaryMode === 'smart-turn' &&
        (!options.voiceActivity || typeof options.voiceActivity.observe !== 'function' ||
         !options.turnBoundary || typeof options.turnBoundary.evaluate !== 'function')) {
      throw new TypeError('neko-smart-turn-ports-required');
    }
    this.audioInput = options.audioInput;
    this.asrAdapter = options.asrAdapter;
    this.voiceActivity = options.voiceActivity;
    this.turnBoundary = options.turnBoundary;
    this.boundaryMode = options.boundaryMode;
    this.channelOptions = options.channel;
    this.ringOptions = options.ringBuffer;
  }

  get isCapturing(): boolean { return this.active !== null; }
  get activeSessionId(): string | null { return this.active?.sessionId ?? null; }

  async captureFinal(request: NekoVoiceTurnCaptureRequest): Promise<NekoVoiceTurnResult> {
    if (this.active) return { status: 'rejected', reason: 'capture-already-active' };
    if (request?.authorization === null || request?.authorization === undefined) {
      return { status: 'rejected', reason: 'capture-authorization-required' };
    }
    if (!this.validToken(request.token)) return { status: 'rejected', reason: 'voice-turn-token-invalid' };

    const controller = new AbortController();
    const active: ActiveVoiceTurn = { controller, cancelled: false, sessionClosed: false, sessionCloseVerified: false };
    const abortFromHost = () => {
      active.cancelled = true;
      if (!controller.signal.aborted) controller.abort(request.signal?.reason ?? 'host-capture-aborted');
      active.channel?.invalidate('capture-cancelled');
    };
    request.signal?.addEventListener('abort', abortFromHost, { once: true });
    this.active = active;

    let session: NekoAudioInputSession | undefined;
    let channel: NekoBoundedAudioFrameChannel | undefined;
    let activitySeq = 0;
    try {
      if (request.signal?.aborted) {
        abortFromHost();
        return { status: 'cancelled' };
      }
      try {
        session = await this.audioInput.openSession({
          authorization: request.authorization,
          token: request.token,
          signal: controller.signal,
        });
      } catch (error) {
        if (active.cancelled || controller.signal.aborted) return { status: 'cancelled' };
        return { status: 'error', reason: this.cleanError(error, 'audio-session-open-failed') };
      }
      // Validate the input-host session before reading or retaining any of its fields.
      if (!this.validSession(session, request.token)) {
        if (!controller.signal.aborted) controller.abort('audio-session-identity-invalid');
        return { status: 'error', reason: 'audio-session-identity-invalid' };
      }
      active.session = session;
      active.sessionId = session.sessionId;
      if (active.cancelled || controller.signal.aborted) {
        await this.closeActiveSession(active, 'capture-cancelled');
        return { status: 'cancelled', sessionId: session.sessionId };
      }

      channel = new NekoBoundedAudioFrameChannel(this.channelOptions);
      active.channel = channel;
      const ring = new NekoPcm16RingBuffer(this.ringOptions);
      const sequence = new NekoPcm16FrameSequenceGuard({
        sessionId: session.sessionId,
        turnId: session.turnId,
        token: request.token,
      });

      const asrRequest: NekoAsrStreamCaptureRequest = {
        sessionId: session.sessionId,
        turnId: session.turnId,
        token: request.token,
        frames: channel,
        signal: controller.signal,
      };
      const asrPromise = this.asrAdapter.captureFinalFromStream(asrRequest)
        .then(value => ({ kind: 'asr' as const, value }))
        .catch(error => ({ kind: 'asr-error' as const, error }));
      const pumpPromise = this.pump({
        active,
        session,
        channel,
        ring,
        sequence,
        token: request.token,
        generation: request.token.audioGeneration,
        signal: controller.signal,
        onActivitySeq(value) { activitySeq = value; },
      });

      const first = await Promise.race([
        asrPromise,
        pumpPromise.then(value => ({ kind: 'pump' as const, value })),
      ]);

      let asrResult: NekoAsrCaptureResult;
      if (first.kind === 'asr') {
        asrResult = first.value;
        if (!controller.signal.aborted) controller.abort('asr-final-received');
        channel.close();
        await this.closeActiveSession(active, 'asr-final-received');
        await pumpPromise;
      } else if (first.kind === 'asr-error') {
        if (!controller.signal.aborted) controller.abort('asr-provider-failed');
        channel.invalidate('asr-provider-failed');
        await this.closeActiveSession(active, 'asr-provider-failed');
        await pumpPromise;
        return { status: 'error', reason: this.cleanError(first.error, 'asr-provider-failed') };
      } else {
        if (first.value.status === 'error') {
          if (!controller.signal.aborted) controller.abort(first.value.reason);
          channel.invalidate(first.value.reason);
          await this.closeActiveSession(active, first.value.reason);
          await asrPromise;
          return { status: 'error', reason: first.value.reason };
        }
        if (first.value.status === 'cancelled' || active.cancelled || controller.signal.aborted) {
          channel.invalidate('capture-cancelled');
          await this.closeActiveSession(active, 'capture-cancelled');
          await asrPromise;
          return { status: 'cancelled', sessionId: session.sessionId };
        }
        // Source end or a verified semantic boundary closes ASR input normally.
        channel.close();
        const final = await asrPromise;
        if (final.kind === 'asr-error') {
          return { status: 'error', reason: this.cleanError(final.error, 'asr-provider-failed') };
        }
        asrResult = final.value;
        await this.closeActiveSession(active, first.value.reason);
      }

      return this.mapAsrResult(asrResult, session.sessionId, session.turnId, activitySeq);
    } catch (error) {
      if (!controller.signal.aborted) controller.abort('voice-turn-failed');
      channel?.invalidate('voice-turn-failed');
      if (session) await this.closeActiveSession(active, 'voice-turn-failed');
      return { status: 'error', reason: this.cleanError(error, 'voice-turn-failed') };
    } finally {
      request.signal?.removeEventListener('abort', abortFromHost);
      if (this.active === active) this.active = null;
    }
  }

  async cancel(reason = 'manual'): Promise<boolean> {
    const active = this.active;
    if (!active) return false;
    const cleanReason = String(reason ?? 'manual').replace(/[\\r\\n\\t]+/gu, ' ').slice(0, 120) || 'manual';

    // Ask the provider to cancel before aborting the adapter's host signal. The
    // provider cancel receipt must be observed while the provider session is active.
    let asrStopVerified = false;
    try {
      const result = await this.asrAdapter.interrupt?.(cleanReason);
      asrStopVerified = Boolean(result && typeof result === 'object' &&
        (result as { status?: unknown }).status === 'verified');
    } catch { /* Cancellation remains unverified when the provider cannot confirm it. */ }

    active.cancelled = true;
    if (!active.controller.signal.aborted) active.controller.abort(cleanReason);
    active.channel?.invalidate('capture-cancelled');
    const audioStopVerified = await this.closeActiveSession(active, cleanReason);
    return audioStopVerified && asrStopVerified;
  }

  private async pump(input: {
    active: ActiveVoiceTurn;
    session: NekoAudioInputSession;
    channel: NekoBoundedAudioFrameChannel;
    ring: NekoPcm16RingBuffer;
    sequence: NekoPcm16FrameSequenceGuard;
    token: VoiceTurnToken;
    generation: number;
    signal: AbortSignal;
    onActivitySeq(value: number): void;
  }): Promise<{ status: 'closed'; reason: string } | { status: 'error'; reason: string } | { status: 'cancelled'; reason: string }> {
    try {
      for await (const raw of input.session.frames) {
        if (input.signal.aborted || input.active.cancelled) {
          return { status: 'cancelled', reason: 'capture-cancelled' };
        }
        const ordered = input.sequence.accept(raw);
        if (ordered.status === 'replayed') continue;
        if (ordered.status === 'invalidated') {
          const normalizedReason = this.sequenceReason(ordered.reason);
          input.channel.invalidate(normalizedReason);
          return { status: 'error', reason: normalizedReason };
        }
        const frame = ordered.frame;
        input.ring.append(frame);

        let activity: NekoVoiceActivityEvent = 'none';
        if (this.voiceActivity) {
          activity = await this.voiceActivity.observe(frame, {
            token: input.token,
            activitySeq: input.sequence.expectedSequence,
            signal: input.signal,
          });
        }
        if (!['none', 'speech_started', 'speech_resumed', 'candidate_pause'].includes(activity)) {
          input.channel.invalidate('invalid-vad-event');
          return { status: 'error', reason: 'invalid-vad-event' };
        }
        const nextActivitySeq = input.sequence.expectedSequence;
        input.onActivitySeq(nextActivitySeq);

        const queued = input.channel.push(frame);
        if (queued.status === 'invalidated') {
          return { status: 'error', reason: queued.reason };
        }
        if (queued.status === 'backpressure') {
          const capacity = await input.channel.waitForCapacity(input.signal);
          if (!capacity) return { status: input.signal.aborted ? 'cancelled' : 'error', reason: 'audio-backpressure-aborted' };
        }

        if (this.boundaryMode === 'smart-turn' && activity === 'candidate_pause') {
          const evaluation = await this.turnBoundary!.evaluate({
            frames: input.ring.snapshot(),
            token: input.token,
            generation: input.generation,
            activitySeq: nextActivitySeq,
            signal: input.signal,
          });
          if (evaluation.status !== 'OK') {
            const reason = evaluation.reason || ('turn-boundary-' + evaluation.status.toLowerCase());
            return { status: 'error', reason: 'turn-boundary-' + evaluation.status.toLowerCase() + ':' + reason };
          }
          if (evaluation.generation !== input.generation || evaluation.activitySeq !== nextActivitySeq) {
            return { status: 'error', reason: 'turn-boundary-stale:evaluation-identity-mismatch' };
          }
          if (evaluation.decision === 'COMPLETE') {
            input.channel.close();
            return { status: 'closed', reason: 'smart-turn-complete' };
          }
          if (evaluation.decision !== 'INCOMPLETE') {
            return { status: 'error', reason: 'turn-boundary-invalid-decision' };
          }
        }
      }
      input.channel.close();
      return { status: 'closed', reason: 'audio-source-ended' };
    } catch (error) {
      if (input.signal.aborted || input.active.cancelled) return { status: 'cancelled', reason: 'capture-cancelled' };
      return { status: 'error', reason: this.cleanError(error, 'audio-stream-failed') };
    }
  }

  private mapAsrResult(
    result: NekoAsrCaptureResult,
    sessionId: string,
    turnId: string,
    activitySeq: number,
  ): NekoVoiceTurnResult {
    if (result.status === 'accepted') {
      return {
        status: 'accepted',
        sessionId,
        turnId,
        transcript: result,
        activitySeq,
        boundaryMode: this.boundaryMode,
      };
    }
    if (result.status === 'cancelled') return { status: 'cancelled', sessionId };
    if (result.status === 'rejected') return { status: 'rejected', reason: 'asr-' + result.reason };
    if (result.status === 'replayed') return { status: 'rejected', reason: 'asr-replayed-final' };
    return { status: 'error', reason: 'asr-' + result.reason };
  }

  private validToken(value: unknown): value is VoiceTurnToken {
    try {
      if (value === null || typeof value !== 'object' || Array.isArray(value) || nodeUtilTypes.isProxy(value)) return false;
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) return false;
      const allowed = ['sessionEpoch','connectionId','leaseGeneration','routeGeneration','audioGeneration','turnId'];
      const keys = Reflect.ownKeys(value);
      if (keys.length !== allowed.length || keys.some(key => typeof key !== 'string' || !allowed.includes(key))) return false;
      const fields: Record<string, unknown> = Object.create(null);
      for (const key of allowed) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return false;
        fields[key] = descriptor.value;
      }
      return Number.isSafeInteger(fields.sessionEpoch) && Number(fields.sessionEpoch) >= 0 &&
        typeof fields.connectionId === 'string' && /^[a-z0-9][a-z0-9._:-]{0,159}$/i.test(fields.connectionId) &&
        Number.isSafeInteger(fields.leaseGeneration) && Number(fields.leaseGeneration) >= 0 &&
        Number.isSafeInteger(fields.routeGeneration) && Number(fields.routeGeneration) >= 0 &&
        Number.isSafeInteger(fields.audioGeneration) && Number(fields.audioGeneration) >= 0 &&
        typeof fields.turnId === 'string' && fields.turnId.length > 0 && fields.turnId.length <= 160 &&
        /^[a-z0-9][a-z0-9._:-]{0,159}$/i.test(fields.turnId);
    } catch { return false; }
  }

  private validSession(session: NekoAudioInputSession, token: VoiceTurnToken): boolean {
    try {
      // Never invoke Proxy traps or accessor-backed fields from an input host.
      if (!session || typeof session !== 'object' || Array.isArray(session) || nodeUtilTypes.isProxy(session)) return false;
      const prototype = Object.getPrototypeOf(session);
      if (prototype !== Object.prototype && prototype !== null) return false;
      const allowed = ['sessionId','turnId','token','frames','close'];
      const keys = Reflect.ownKeys(session);
      if (keys.some(key => typeof key !== 'string' || !allowed.includes(key))) return false;
      const read = (key: string): unknown => {
        const descriptor = Object.getOwnPropertyDescriptor(session, key);
        if (!descriptor) return undefined;
        if (!('value' in descriptor) || !descriptor.enumerable) throw new TypeError('audio-session-accessor-rejected');
        return descriptor.value;
      };
      const sessionId = read('sessionId');
      const turnId = read('turnId');
      const candidateToken = read('token');
      const frames = read('frames');
      const close = read('close');
      if (keys.length < 4 || typeof sessionId !== 'string' ||
          !/^[a-z0-9][a-z0-9._:-]{0,159}$/i.test(sessionId) ||
          turnId !== token.turnId || !this.validToken(candidateToken) ||
          frames === null || typeof frames !== 'object' || nodeUtilTypes.isProxy(frames) ||
          (close !== undefined && typeof close !== 'function')) return false;
      // Find the async-iterator method through data descriptors only. This keeps
      // a hostile frame iterable from running a getter during host-session validation.
      let cursor: object | null = frames;
      let iteratorAvailable = false;
      while (cursor !== null) {
        if (nodeUtilTypes.isProxy(cursor)) return false;
        const iteratorDescriptor = Object.getOwnPropertyDescriptor(cursor, Symbol.asyncIterator);
        if (iteratorDescriptor) {
          iteratorAvailable = 'value' in iteratorDescriptor && typeof iteratorDescriptor.value === 'function';
          break;
        }
        cursor = Object.getPrototypeOf(cursor);
      }
      if (!iteratorAvailable) return false;
      return candidateToken.sessionEpoch === token.sessionEpoch &&
        candidateToken.connectionId === token.connectionId &&
        candidateToken.leaseGeneration === token.leaseGeneration &&
        candidateToken.routeGeneration === token.routeGeneration &&
        candidateToken.audioGeneration === token.audioGeneration &&
        candidateToken.turnId === token.turnId;
    } catch { return false; }
  }

  private sequenceReason(reason: string): string {
    if (reason === 'sequence-gap') return 'audio-sequence-gap';
    if (reason === 'sequence-conflict' || reason === 'replay-outside-window') return 'audio-sequence-conflict';
    if (reason === 'capture-timestamp-regression') return 'audio-timestamp-regression';
    if (reason === 'stale-or-mismatched-voice-turn-token') return 'audio-turn-token-mismatch';
    return 'audio-frame-invalid:' + reason;
  }

  private cleanError(error: unknown, fallback: string): string {
    const value = String((error as Error)?.message ?? error ?? fallback)
      .replace(/[\r\n\t]+/gu, ' ')
      .slice(0, 160);
    return value || fallback;
  }

  private closeActiveSession(active: ActiveVoiceTurn, reason: string): Promise<boolean> {
    if (!active.session) return Promise.resolve(false);
    if (active.sessionClosePromise) return active.sessionClosePromise;
    if (active.sessionClosed) return Promise.resolve(active.sessionCloseVerified);
    active.sessionClosed = true;
    active.sessionClosePromise = (async () => {
      try {
        const result = await active.session!.close?.(reason);
        active.sessionCloseVerified = Boolean(result && result.requested === true && result.verified === true);
        return active.sessionCloseVerified;
      } catch {
        active.sessionCloseVerified = false;
        return false;
      }
    })();
    return active.sessionClosePromise;
  }
}
