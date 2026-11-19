import {
  validateNekoPcm16Frame,
  type NekoPcm16FrameV1,
} from './NekoAudioStreamContract.ts';

const FRAME_DURATION_MS = 20;
const DEFAULT_MAX_PENDING_FRAMES = 128;
const DEFAULT_MAX_PENDING_AUDIO_MS = 1000;
const DEFAULT_BACKPRESSURE_AUDIO_MS = 800;
const DEFAULT_RING_DURATION_MS = 8000;

export type NekoAudioFramePushResult =
  | { readonly status: 'accepted' }
  | { readonly status: 'backpressure'; readonly pendingAudioMs: number }
  | { readonly status: 'invalidated'; readonly reason: string };

export interface NekoBoundedAudioFrameChannelOptions {
  readonly maxPendingFrames?: number;
  readonly maxPendingAudioMs?: number;
  readonly backpressureAudioMs?: number;
}

interface ReadWaiter {
  resolve(value: IteratorResult<NekoPcm16FrameV1>): void;
  reject(reason: Error): void;
}

interface CapacityWaiter {
  resolve(value: boolean): void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

/**
 * Single-reader, bounded PCM fan-out leg for one streaming ASR provider.
 * A push at the high-water mark is accepted and asks the source to pause;
 * exceeding either hard bound invalidates the complete voice turn.
 */
export class NekoBoundedAudioFrameChannel implements AsyncIterable<NekoPcm16FrameV1> {
  private readonly pending: NekoPcm16FrameV1[] = [];
  private readonly readWaiters: ReadWaiter[] = [];
  private readonly capacityWaiters = new Set<CapacityWaiter>();
  private readonly maxPendingFrames: number;
  private readonly maxPendingAudioMs: number;
  private readonly backpressureAudioMs: number;
  private state: 'open' | 'closed' | 'invalidated' = 'open';
  private invalidationReason: string | null = null;
  private readerClaimed = false;

  constructor(options: NekoBoundedAudioFrameChannelOptions = {}) {
    const maxPendingFrames = options.maxPendingFrames ?? DEFAULT_MAX_PENDING_FRAMES;
    const maxPendingAudioMs = options.maxPendingAudioMs ?? DEFAULT_MAX_PENDING_AUDIO_MS;
    const backpressureAudioMs = options.backpressureAudioMs ?? Math.min(DEFAULT_BACKPRESSURE_AUDIO_MS, maxPendingAudioMs);
    if (!Number.isSafeInteger(maxPendingFrames) || maxPendingFrames < 1 || maxPendingFrames > DEFAULT_MAX_PENDING_FRAMES) {
      throw new RangeError('neko-audio-channel-frame-bound-invalid');
    }
    if (!Number.isSafeInteger(maxPendingAudioMs) || maxPendingAudioMs < FRAME_DURATION_MS ||
        maxPendingAudioMs > DEFAULT_MAX_PENDING_AUDIO_MS || maxPendingAudioMs % FRAME_DURATION_MS !== 0) {
      throw new RangeError('neko-audio-channel-duration-bound-invalid');
    }
    if (!Number.isSafeInteger(backpressureAudioMs) || backpressureAudioMs < FRAME_DURATION_MS ||
        backpressureAudioMs > maxPendingAudioMs || backpressureAudioMs % FRAME_DURATION_MS !== 0) {
      throw new RangeError('neko-audio-channel-backpressure-bound-invalid');
    }
    this.maxPendingFrames = maxPendingFrames;
    this.maxPendingAudioMs = maxPendingAudioMs;
    this.backpressureAudioMs = backpressureAudioMs;
  }

  get pendingFrameCount(): number { return this.pending.length; }
  get pendingAudioMs(): number { return this.pending.length * FRAME_DURATION_MS; }
  get isClosed(): boolean { return this.state === 'closed'; }
  get isInvalidated(): boolean { return this.state === 'invalidated'; }
  get reason(): string | null { return this.invalidationReason; }

  push(value: unknown): NekoAudioFramePushResult {
    if (this.state !== 'open') {
      return { status: 'invalidated', reason: this.invalidationReason ?? 'audio-channel-closed' };
    }
    const validation = validateNekoPcm16Frame(value);
    if (validation.status !== 'accepted') return this.invalidate('invalid-audio-frame');

    const waiter = this.readWaiters.shift();
    if (waiter) {
      waiter.resolve({ done: false, value: validation.frame });
      return { status: 'accepted' };
    }

    const exceedsFrames = this.pending.length + 1 > this.maxPendingFrames;
    const exceedsDuration = this.pendingAudioMs + FRAME_DURATION_MS > this.maxPendingAudioMs;
    if (exceedsFrames || exceedsDuration) return this.invalidate('queue-overflow');

    this.pending.push(validation.frame);
    if (this.pendingAudioMs >= this.backpressureAudioMs) {
      return { status: 'backpressure', pendingAudioMs: this.pendingAudioMs };
    }
    return { status: 'accepted' };
  }

  /** Resolves true when the consumer has drained below the high-water mark. */
  waitForCapacity(signal?: AbortSignal): Promise<boolean> {
    if (this.state !== 'open') return Promise.resolve(false);
    if (signal?.aborted) return Promise.resolve(false);
    if (this.pendingAudioMs < this.backpressureAudioMs && this.pending.length < this.maxPendingFrames) {
      return Promise.resolve(true);
    }
    return new Promise(resolve => {
      const waiter: CapacityWaiter = { resolve, ...(signal ? { signal } : {}) };
      if (signal) {
        waiter.onAbort = () => {
          this.capacityWaiters.delete(waiter);
          resolve(false);
        };
        signal.addEventListener('abort', waiter.onAbort, { once: true });
      }
      this.capacityWaiters.add(waiter);
    });
  }

  close(): void {
    if (this.state !== 'open') return;
    this.state = 'closed';
    for (const waiter of this.readWaiters.splice(0)) waiter.resolve({ done: true, value: undefined });
    this.resolveCapacityWaiters(false);
  }

  invalidate(reason = 'audio-channel-invalidated'): NekoAudioFramePushResult {
    if (this.state === 'invalidated') {
      return { status: 'invalidated', reason: this.invalidationReason ?? reason };
    }
    if (this.state === 'closed') return { status: 'invalidated', reason: 'audio-channel-closed' };
    this.state = 'invalidated';
    this.invalidationReason = String(reason).replace(/[\r\n\t]+/gu, ' ').slice(0, 120) || 'audio-channel-invalidated';
    this.pending.length = 0;
    const error = new Error(this.invalidationReason);
    for (const waiter of this.readWaiters.splice(0)) waiter.reject(error);
    this.resolveCapacityWaiters(false);
    return { status: 'invalidated', reason: this.invalidationReason };
  }

  clear(): void {
    this.pending.length = 0;
    this.notifyCapacityWaiters();
  }

  [Symbol.asyncIterator](): AsyncIterator<NekoPcm16FrameV1> {
    if (this.readerClaimed) throw new Error('neko-audio-channel-single-reader-only');
    this.readerClaimed = true;
    return {
      next: (): Promise<IteratorResult<NekoPcm16FrameV1>> => {
        const frame = this.pending.shift();
        if (frame) {
          this.notifyCapacityWaiters();
          return Promise.resolve({ done: false, value: frame });
        }
        if (this.state === 'invalidated') return Promise.reject(new Error(this.invalidationReason ?? 'audio-channel-invalidated'));
        if (this.state === 'closed') return Promise.resolve({ done: true, value: undefined });
        return new Promise((resolve, reject) => this.readWaiters.push({ resolve, reject }));
      },
      return: async (): Promise<IteratorResult<NekoPcm16FrameV1>> => {
        this.close();
        return { done: true, value: undefined };
      },
    };
  }

  private notifyCapacityWaiters(): void {
    if (this.pendingAudioMs >= this.backpressureAudioMs || this.pending.length >= this.maxPendingFrames) return;
    this.resolveCapacityWaiters(true);
  }

  private resolveCapacityWaiters(value: boolean): void {
    for (const waiter of this.capacityWaiters) {
      if (waiter.signal && waiter.onAbort) waiter.signal.removeEventListener('abort', waiter.onAbort);
      waiter.resolve(value);
    }
    this.capacityWaiters.clear();
  }
}

export interface NekoPcm16RingBufferOptions {
  readonly maxDurationMs?: number;
}

/** Rolling semantic-context buffer; unlike the ASR delivery queue, old context is evicted. */
export class NekoPcm16RingBuffer {
  private readonly frames: NekoPcm16FrameV1[] = [];
  private readonly maxFrames: number;

  constructor(options: NekoPcm16RingBufferOptions = {}) {
    const maxDurationMs = options.maxDurationMs ?? DEFAULT_RING_DURATION_MS;
    if (!Number.isSafeInteger(maxDurationMs) || maxDurationMs < FRAME_DURATION_MS ||
        maxDurationMs > DEFAULT_RING_DURATION_MS || maxDurationMs % FRAME_DURATION_MS !== 0) {
      throw new RangeError('neko-audio-ring-duration-invalid');
    }
    this.maxFrames = maxDurationMs / FRAME_DURATION_MS;
  }

  get length(): number { return this.frames.length; }
  get durationMs(): number { return this.frames.length * FRAME_DURATION_MS; }

  append(value: unknown): number {
    const validation = validateNekoPcm16Frame(value);
    if (validation.status !== 'accepted') throw new TypeError(validation.reason);
    this.frames.push(validation.frame);
    while (this.frames.length > this.maxFrames) this.frames.shift();
    return this.frames.length;
  }

  snapshot(): NekoPcm16FrameV1[] {
    return this.frames.map(frame => ({
      ...frame,
      token: { ...frame.token },
      samples: new Uint8Array(frame.samples),
    }));
  }

  clear(): void { this.frames.length = 0; }
}
