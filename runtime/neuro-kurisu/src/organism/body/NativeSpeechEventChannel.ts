export type NativeSpeechProviderPhaseV1 =
  | 'command-requested'
  | 'process-spawned'
  | 'process-exited'
  | 'process-error'
  | 'interrupt-requested'
  | 'interrupt-unconfirmed';

export interface NativeSpeechProviderEventV1 {
  protocol: 'nk1.native-speech-provider-event';
  version: 1;
  eventId: string;
  operationId: string;
  sequence: number;
  provider: 'termux-tts-speak';
  monotonicTimeMs: number;
  phase: NativeSpeechProviderPhaseV1;
  playbackVerified: false;
  exitCode?: number | null;
  signal?: string | null;
  errorCode?: string;
  reason?: string;
}

export interface NativeSpeechProviderEventInput {
  phase: NativeSpeechProviderPhaseV1;
  exitCode?: number | null;
  signal?: string | null;
  errorCode?: string;
  reason?: string;
}

export interface NativeSpeechEventChannel {
  publish(operationId: string, input: NativeSpeechProviderEventInput): NativeSpeechProviderEventV1 | null;
  subscribe(listener: (event: NativeSpeechProviderEventV1) => void): () => void;
}

/**
 * Process-local provider telemetry only. These events describe Termux command/process
 * transitions; they are deliberately NOT SpeechLifecycleEventV1 playback events.
 * In particular, process spawn/exit never proves that Android audio started or ended.
 */
export function createNativeSpeechEventChannel(
  now: () => number = () => globalThis.performance.now(),
): NativeSpeechEventChannel {
  const listeners = new Set<(event: NativeSpeechProviderEventV1) => void>();
  const sequences = new Map<string, number>();
  let eventCounter = 0;

  return {
    publish(operationIdInput, input) {
      const operationId = String(operationIdInput ?? '').trim().slice(0, 140);
      if (!operationId || !input || typeof input.phase !== 'string') return null;
      const monotonicTimeMs = Number(now());
      if (!Number.isFinite(monotonicTimeMs) || monotonicTimeMs < 0) return null;
      const sequence = (sequences.get(operationId) ?? 0) + 1;
      sequences.set(operationId, sequence);
      // Keep this diagnostic channel bounded even if callers generate unbounded IDs.
      if (sequences.size > 256) sequences.delete(sequences.keys().next().value as string);
      eventCounter += 1;
      const event: NativeSpeechProviderEventV1 = Object.freeze({
        protocol: 'nk1.native-speech-provider-event',
        version: 1,
        eventId: `native-speech-${eventCounter}`,
        operationId,
        sequence,
        provider: 'termux-tts-speak',
        monotonicTimeMs,
        phase: input.phase,
        playbackVerified: false,
        ...(input.exitCode !== undefined ? { exitCode: input.exitCode } : {}),
        ...(input.signal !== undefined ? { signal: input.signal } : {}),
        ...(input.errorCode ? { errorCode: String(input.errorCode).slice(0, 64) } : {}),
        ...(input.reason ? { reason: String(input.reason).replace(/[\\r\\n\\t]+/g, ' ').slice(0, 160) } : {}),
      });
      for (const listener of [...listeners]) {
        try { listener(event); } catch { /* observers must never affect speech execution */ }
      }
      return event;
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('native-speech-listener-required');
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export const nativeSpeechEventChannel = createNativeSpeechEventChannel();
