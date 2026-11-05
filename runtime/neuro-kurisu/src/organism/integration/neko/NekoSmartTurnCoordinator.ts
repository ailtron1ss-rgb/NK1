import { types as nodeUtilTypes } from 'node:util';

export const NEKO_SMART_TURN_SAMPLE_RATE_HZ = 16_000;
export const NEKO_SMART_TURN_MAX_CONTEXT_SECONDS = 8;

export type NekoSmartTurnActivityEvent =
  | 'speech-started'
  | 'speech-resumed'
  | 'candidate-pause';

export type NekoSmartTurnDecision = 'complete' | 'incomplete';
export type NekoSmartTurnCoordinatorState =
  | 'idle'
  | 'speech-active'
  | 'pause-candidate'
  | 'evaluating'
  | 'wait-continuation'
  | 'candidate-complete'
  | 'closed';

export interface NekoSmartTurnAudioFrameV1 {
  readonly sampleRateHz: number;
  readonly pcm16: Uint8Array;
}

export interface NekoSmartTurnPredictRequest {
  readonly sessionId: string;
  readonly generation: number;
  readonly activitySequence: number;
  readonly sampleRateHz: 16_000;
  readonly channels: 1;
  readonly encoding: 'pcm_s16le';
  /** A private bounded copy of the latest mono PCM16 audio context. */
  readonly audioPcm16: Uint8Array;
  readonly signal: AbortSignal;
}

/** Host-owned port. The host implements audio features and Smart Turn v3.2 inference. */
export interface NekoSmartTurnProviderPort {
  readonly modelId: string;
  readonly modelVersion: string;
  isAvailable(): boolean | Promise<boolean>;
  evaluate(request: NekoSmartTurnPredictRequest): Promise<unknown>;
}

export interface NekoSmartTurnCoordinatorConfig {
  readonly evaluationThreshold?: number;
  readonly minimumAudioMs?: number;
  readonly maximumAudioSeconds?: number;
}

interface EvaluationIdentity {
  readonly generation: number;
  readonly activitySequence: number;
  readonly requestSequence: number;
}

export type NekoSmartTurnEvaluationResult =
  | {
      readonly status: 'ok';
      readonly sessionId: string;
      readonly generation: number;
      readonly activitySequence: number;
      readonly requestSequence: number;
      readonly decision: NekoSmartTurnDecision;
      readonly probability01: number;
      readonly threshold: number;
      readonly modelId: string;
      readonly modelVersion: string;
      readonly audioSamples: number;
      readonly audioDurationMs: number;
    }
  | {
      readonly status: 'unavailable' | 'error' | 'stale' | 'superseded';
      readonly sessionId: string;
      readonly generation: number;
      readonly activitySequence: number;
      readonly requestSequence: number;
      readonly reason: string;
    };

const SAFE_SESSION_ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/i;
const SAFE_MODEL_REF = /^[a-z0-9][a-z0-9._:/@+-]{0,159}$/i;
const MODEL_OUTPUT_KEYS = new Set(['probability01']);

function boundedError(error: unknown): string {
  return String((error as Error)?.message ?? error)
    .replace(/[\\r\\n\\t]+/gu, ' ')
    .slice(0, 120) || 'smart-turn-provider-error';
}

function readProbability(value: unknown): number | null {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      nodeUtilTypes.isProxy(value)
    ) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length !== 1 || keys[0] !== 'probability01') return null;
    const descriptor = descriptors.probability01;
    if (
      !descriptor ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      !descriptor.enumerable
    ) return null;
    const probability = descriptor.value;
    if (
      typeof probability !== 'number' ||
      !Number.isFinite(probability) ||
      probability < 0 ||
      probability > 1
    ) return null;
    return probability;
  } catch {
    return null;
  }
}

/**
 * A bounded, host-inference coordinator for Smart Turn semantic endpointing.
 *
 * It classifies whether an audio pause sounds like the end of a thought. It
 * does not own ASR finalization, commit a transcript, interrupt capture, or
 * authorize a user-visible response. New speech, reset, and close invalidate
 * all in-flight results by generation/activity identity.
 */
export class NekoSmartTurnCoordinator {
  readonly sessionId: string;
  readonly config: {
    readonly evaluationThreshold: number;
    readonly minimumAudioMs: number;
    readonly maximumAudioSeconds: number;
  };

  private readonly provider: NekoSmartTurnProviderPort;
  private readonly capacityBytes: number;
  private chunks: Uint8Array[] = [];
  private byteCount = 0;
  private currentState: NekoSmartTurnCoordinatorState = 'idle';
  private currentGeneration = 1;
  private currentActivitySequence = 0;
  private currentRequestSequence = 0;
  private lastResult: NekoSmartTurnEvaluationResult | null = null;
  private inferenceTail: Promise<void> = Promise.resolve();
  private activeController: AbortController | null = null;

  constructor(
    sessionId: string,
    provider: NekoSmartTurnProviderPort,
    config: NekoSmartTurnCoordinatorConfig = {},
  ) {
    if (typeof sessionId !== 'string' || !SAFE_SESSION_ID.test(sessionId)) {
      throw new TypeError('neko-smart-turn-session-invalid');
    }
    if (
      !provider ||
      typeof provider.modelId !== 'string' ||
      !SAFE_MODEL_REF.test(provider.modelId) ||
      typeof provider.modelVersion !== 'string' ||
      !SAFE_MODEL_REF.test(provider.modelVersion) ||
      typeof provider.isAvailable !== 'function' ||
      typeof provider.evaluate !== 'function'
    ) {
      throw new TypeError('neko-smart-turn-provider-invalid');
    }
    const normalized = {
      evaluationThreshold: config.evaluationThreshold ?? 0.5,
      minimumAudioMs: config.minimumAudioMs ?? 200,
      maximumAudioSeconds: config.maximumAudioSeconds ?? NEKO_SMART_TURN_MAX_CONTEXT_SECONDS,
    };
    if (
      !Number.isFinite(normalized.evaluationThreshold) ||
      normalized.evaluationThreshold < 0 ||
      normalized.evaluationThreshold > 1 ||
      !Number.isSafeInteger(normalized.minimumAudioMs) ||
      normalized.minimumAudioMs <= 0 ||
      !Number.isSafeInteger(normalized.maximumAudioSeconds) ||
      normalized.maximumAudioSeconds < 1 ||
      normalized.maximumAudioSeconds > NEKO_SMART_TURN_MAX_CONTEXT_SECONDS ||
      normalized.minimumAudioMs > normalized.maximumAudioSeconds * 1000
    ) {
      throw new RangeError('neko-smart-turn-config-invalid');
    }
    this.sessionId = sessionId;
    this.provider = provider;
    this.config = Object.freeze(normalized);
    this.capacityBytes =
      normalized.maximumAudioSeconds * NEKO_SMART_TURN_SAMPLE_RATE_HZ * 2;
  }

  get generation(): number { return this.currentGeneration; }
  get activitySequence(): number { return this.currentActivitySequence; }
  get state(): NekoSmartTurnCoordinatorState { return this.currentState; }
  get latestEvaluation(): NekoSmartTurnEvaluationResult | null { return this.lastResult; }
  get audioSamples(): number { return this.byteCount / 2; }
  get audioDurationMs(): number { return this.audioSamples / 16; }

  pushAudioFrame(input: unknown): boolean {
    if (this.currentState === 'closed') return false;
    const frame = this.normalizeAudioFrame(input);
    if (!frame) throw new TypeError('invalid-smart-turn-audio-frame');
    const bytes = frame.pcm16.slice();
    if (bytes.byteLength >= this.capacityBytes) {
      this.chunks = [bytes.slice(bytes.byteLength - this.capacityBytes)];
      this.byteCount = this.capacityBytes;
      return true;
    }
    this.chunks.push(bytes);
    this.byteCount += bytes.byteLength;
    let overflow = this.byteCount - this.capacityBytes;
    while (overflow > 0 && this.chunks.length > 0) {
      const oldest = this.chunks[0]!;
      if (oldest.byteLength <= overflow) {
        this.chunks.shift();
        this.byteCount -= oldest.byteLength;
        overflow -= oldest.byteLength;
      } else {
        const trim = overflow + (overflow % 2);
        this.chunks[0] = oldest.slice(trim);
        this.byteCount -= trim;
        overflow = 0;
      }
    }
    return true;
  }

  notifySpeechActivity(event: NekoSmartTurnActivityEvent): void {
    if (this.currentState === 'closed') return;
    if (event === 'speech-started' || event === 'speech-resumed') {
      this.currentActivitySequence += 1;
      this.currentRequestSequence += 1;
      this.activeController?.abort('activity-resumed');
      this.activeController = null;
      this.lastResult = null;
      this.currentState = 'speech-active';
      return;
    }
    if (event === 'candidate-pause') {
      this.currentState = 'pause-candidate';
      return;
    }
    throw new TypeError('invalid-smart-turn-activity-event');
  }

  async evaluateSemanticEndpoint(): Promise<NekoSmartTurnEvaluationResult> {
    if (this.currentState === 'evaluating') {
      this.activeController?.abort('newer-evaluation-requested');
      this.activeController = null;
    }
    const identity: EvaluationIdentity = {
      generation: this.currentGeneration,
      activitySequence: this.currentActivitySequence,
      requestSequence: ++this.currentRequestSequence,
    };
    if (this.isClosed()) {
      return this.nonOk('stale', identity, 'coordinator-closed');
    }
    if (
      this.currentState !== 'pause-candidate' &&
      this.currentState !== 'evaluating' &&
      this.currentState !== 'wait-continuation'
    ) {
      return this.nonOk('unavailable', identity, 'no-pause-candidate');
    }

    let release!: () => void;
    const previous = this.inferenceTail;
    this.inferenceTail = new Promise<void>(resolve => { release = resolve; });
    let controller: AbortController | null = null;
    await previous;
    try {
      if (this.isClosed() || identity.generation !== this.currentGeneration) {
        return this.nonOk('stale', identity, 'generation-changed');
      }
      if (identity.activitySequence !== this.currentActivitySequence) {
        return this.nonOk('stale', identity, 'activity-resumed');
      }
      if (identity.requestSequence !== this.currentRequestSequence) {
        return this.nonOk('superseded', identity, 'newer-evaluation-requested');
      }
      if (
        this.currentState !== 'pause-candidate' &&
        this.currentState !== 'evaluating' &&
        this.currentState !== 'wait-continuation'
      ) {
        return this.nonOk('stale', identity, 'pause-candidate-ended');
      }

      const audioPcm16 = this.snapshotAudio();
      const audioSamples = audioPcm16.byteLength / 2;
      const audioDurationMs = audioSamples / 16;
      if (audioDurationMs < this.config.minimumAudioMs) {
        const result = this.nonOk('unavailable', identity, 'insufficient_audio');
        this.lastResult = result;
        return result;
      }

      this.currentState = 'evaluating';
      controller = new AbortController();
      this.activeController = controller;
      let available = false;
      try {
        available = await this.provider.isAvailable() === true;
      } catch {
        available = false;
      }
      if (!this.isCurrent(identity)) {
        if (this.isClosed() || identity.generation !== this.currentGeneration) {
          return this.nonOk('stale', identity, 'coordinator-closed');
        }
        if (identity.activitySequence !== this.currentActivitySequence) {
          return this.nonOk('stale', identity, 'activity-resumed');
        }
        return this.nonOk('superseded', identity, 'newer-evaluation-requested');
      }
      if (!available) {
        const result = this.nonOk('unavailable', identity, 'provider-unavailable');
        this.lastResult = result;
        this.currentState = 'pause-candidate';
        return result;
      }

      let raw: unknown;
      try {
        raw = await this.provider.evaluate({
          sessionId: this.sessionId,
          generation: identity.generation,
          activitySequence: identity.activitySequence,
          sampleRateHz: NEKO_SMART_TURN_SAMPLE_RATE_HZ,
          channels: 1,
          encoding: 'pcm_s16le',
          audioPcm16,
          signal: controller.signal,
        });
      } catch (error) {
        if (!this.isCurrent(identity)) {
          if (this.isClosed() || identity.generation !== this.currentGeneration) {
            return this.nonOk('stale', identity, 'coordinator-closed');
          }
          if (identity.activitySequence !== this.currentActivitySequence) {
            return this.nonOk('stale', identity, 'activity-resumed');
          }
          return this.nonOk('superseded', identity, 'newer-evaluation-requested');
        }
        const result = this.nonOk('error', identity, boundedError(error));
        this.lastResult = result;
        this.currentState = 'pause-candidate';
        return result;
      }

      if (!this.isCurrent(identity)) {
        if (this.isClosed() || identity.generation !== this.currentGeneration) {
          return this.nonOk('stale', identity, 'coordinator-closed');
        }
        if (identity.activitySequence !== this.currentActivitySequence) {
          return this.nonOk('stale', identity, 'activity-resumed');
        }
        return this.nonOk('superseded', identity, 'newer-evaluation-requested');
      }
      const probability01 = readProbability(raw);
      if (probability01 === null) {
        const result = this.nonOk('error', identity, 'invalid-smart-turn-probability');
        this.lastResult = result;
        this.currentState = 'pause-candidate';
        return result;
      }
      const decision: NekoSmartTurnDecision =
        probability01 >= this.config.evaluationThreshold ? 'complete' : 'incomplete';
      const result: NekoSmartTurnEvaluationResult = Object.freeze({
        status: 'ok',
        sessionId: this.sessionId,
        generation: identity.generation,
        activitySequence: identity.activitySequence,
        requestSequence: identity.requestSequence,
        decision,
        probability01,
        threshold: this.config.evaluationThreshold,
        modelId: this.provider.modelId,
        modelVersion: this.provider.modelVersion,
        audioSamples,
        audioDurationMs,
      });
      this.lastResult = result;
      this.currentState = decision === 'complete' ? 'candidate-complete' : 'wait-continuation';
      return result;
    } finally {
      if (controller && this.activeController === controller) this.activeController = null;
      release();
    }
  }

  reset(): void {
    if (this.currentState === 'closed') return;
    this.currentGeneration += 1;
    this.currentActivitySequence = 0;
    this.currentRequestSequence += 1;
    this.activeController?.abort('coordinator-reset');
    this.activeController = null;
    this.lastResult = null;
    this.currentState = 'idle';
    this.clearAudio();
  }

  close(): void {
    if (this.currentState === 'closed') return;
    this.currentGeneration += 1;
    this.currentRequestSequence += 1;
    this.activeController?.abort('coordinator-closed');
    this.activeController = null;
    this.lastResult = null;
    this.currentState = 'closed';
    this.clearAudio();
  }

  private normalizeAudioFrame(input: unknown): NekoSmartTurnAudioFrameV1 | null {
    try {
      if (
        input === null ||
        typeof input !== 'object' ||
        Array.isArray(input) ||
        nodeUtilTypes.isProxy(input)
      ) return null;
      const prototype = Object.getPrototypeOf(input);
      if (prototype !== Object.prototype && prototype !== null) return null;
      const descriptors = Object.getOwnPropertyDescriptors(input);
      const keys = Reflect.ownKeys(descriptors);
      if (
        keys.length !== 2 ||
        !Object.prototype.hasOwnProperty.call(descriptors, 'sampleRateHz') ||
        !Object.prototype.hasOwnProperty.call(descriptors, 'pcm16')
      ) return null;
      const rateDescriptor = descriptors.sampleRateHz;
      const audioDescriptor = descriptors.pcm16;
      if (
        !rateDescriptor ||
        !Object.prototype.hasOwnProperty.call(rateDescriptor, 'value') ||
        rateDescriptor.get !== undefined ||
        rateDescriptor.set !== undefined ||
        !rateDescriptor.enumerable ||
        !audioDescriptor ||
        !Object.prototype.hasOwnProperty.call(audioDescriptor, 'value') ||
        audioDescriptor.get !== undefined ||
        audioDescriptor.set !== undefined ||
        !audioDescriptor.enumerable
      ) return null;
      const sampleRateHz = rateDescriptor.value;
      const pcm16 = audioDescriptor.value;
      if (
        sampleRateHz !== NEKO_SMART_TURN_SAMPLE_RATE_HZ ||
        !(pcm16 instanceof Uint8Array) ||
        nodeUtilTypes.isProxy(pcm16) ||
        pcm16.byteLength === 0 ||
        pcm16.byteLength % 2 !== 0 ||
        pcm16.byteLength > NEKO_SMART_TURN_SAMPLE_RATE_HZ * 2
      ) return null;
      return { sampleRateHz: NEKO_SMART_TURN_SAMPLE_RATE_HZ, pcm16 };
    } catch {
      return null;
    }
  }

  private snapshotAudio(): Uint8Array {
    const output = new Uint8Array(this.byteCount);
    let offset = 0;
    for (const chunk of this.chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return output;
  }

  private clearAudio(): void {
    this.chunks = [];
    this.byteCount = 0;
  }

  private isClosed(): boolean {
    return this.currentState === 'closed';
  }

  private isCurrent(identity: EvaluationIdentity): boolean {
    return (
      !this.isClosed() &&
      identity.generation === this.currentGeneration &&
      identity.activitySequence === this.currentActivitySequence &&
      identity.requestSequence === this.currentRequestSequence
    );
  }

  private nonOk(
    status: 'unavailable' | 'error' | 'stale' | 'superseded',
    identity: EvaluationIdentity,
    reason: string,
  ): NekoSmartTurnEvaluationResult {
    return Object.freeze({
      status,
      sessionId: this.sessionId,
      generation: identity.generation,
      activitySequence: identity.activitySequence,
      requestSequence: identity.requestSequence,
      reason: String(reason).slice(0, 120),
    });
  }
}
