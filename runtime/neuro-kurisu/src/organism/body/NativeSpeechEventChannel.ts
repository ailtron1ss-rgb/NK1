import { types as nodeUtilTypes } from 'node:util';

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

const MAX_PENDING_NATIVE_SPEECH_EVENTS = 1024;
const NATIVE_SPEECH_PROVIDER_PHASES = new Set<NativeSpeechProviderPhaseV1>([
  'command-requested',
  'process-spawned',
  'process-exited',
  'process-error',
  'interrupt-requested',
  'interrupt-unconfirmed',
]);
const NATIVE_SPEECH_INPUT_KEYS = new Set(['phase', 'exitCode', 'signal', 'errorCode', 'reason']);
const isProxy = (value: unknown): boolean => nodeUtilTypes.isProxy(value);

/** Inspect only own data properties; this is a process-telemetry trust boundary. */
function readNativeSpeechProviderInput(value: unknown): NativeSpeechProviderEventInput | null {
  if (value === null || typeof value !== 'object' || isProxy(value) || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;

  const keys = Reflect.ownKeys(value);
  if (keys.length > NATIVE_SPEECH_INPUT_KEYS.size) return null;
  const data: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    if (typeof key !== 'string' || !NATIVE_SPEECH_INPUT_KEYS.has(key)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || descriptor.get || descriptor.set || !descriptor.enumerable) return null;
    data[key] = descriptor.value;
  }

  if (typeof data.phase !== 'string' || !NATIVE_SPEECH_PROVIDER_PHASES.has(data.phase as NativeSpeechProviderPhaseV1)) return null;
  const exitCode = data.exitCode;
  if (exitCode !== undefined && exitCode !== null
    && (typeof exitCode !== 'number' || !Number.isSafeInteger(exitCode) || exitCode < 0 || exitCode > 255)) return null;
  if (data.signal !== undefined && data.signal !== null
    && (typeof data.signal !== 'string' || data.signal.length > 64)) return null;
  if (data.errorCode !== undefined
    && (typeof data.errorCode !== 'string' || data.errorCode.length > 1024)) return null;
  if (data.reason !== undefined
    && (typeof data.reason !== 'string' || data.reason.length > 4096)) return null;

  return data as NativeSpeechProviderEventInput;
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
  const lastTimes = new Map<string, number>();
  const pending: NativeSpeechProviderEventV1[] = [];
  let dispatching = false;
  let pendingHead = 0;
  let eventCounter = 0;

  return {
    publish(operationIdInput, input) {
      if (typeof operationIdInput !== 'string') return null;
      const operationId = operationIdInput.trim().slice(0, 140);
      if (!operationId) return null;
      const safeInput = readNativeSpeechProviderInput(input);
      if (!safeInput) return null;
      // Reentrant observers can publish while a dispatch is in progress. Refuse
      // excess work before mutating sequence/time state so memory remains bounded.
      if (pending.length - pendingHead >= MAX_PENDING_NATIVE_SPEECH_EVENTS) return null;
      const clockSample = now();
      if (!Number.isFinite(clockSample) || clockSample < 0) return null;
      // Defend the wire contract against an injected/reset clock moving backwards.
      const monotonicTimeMs = Math.max(clockSample, lastTimes.get(operationId) ?? 0);
      lastTimes.set(operationId, monotonicTimeMs);
      const sequence = (sequences.get(operationId) ?? 0) + 1;
      sequences.set(operationId, sequence);
      // Keep this diagnostic channel bounded even if callers generate unbounded IDs.
      if (sequences.size > 256) {
        const oldestOperationId = sequences.keys().next().value as string;
        sequences.delete(oldestOperationId);
        lastTimes.delete(oldestOperationId);
      }
      eventCounter += 1;
      const event: NativeSpeechProviderEventV1 = Object.freeze({
        protocol: 'nk1.native-speech-provider-event',
        version: 1,
        eventId: `native-speech-${eventCounter}`,
        operationId,
        sequence,
        provider: 'termux-tts-speak',
        monotonicTimeMs,
        phase: safeInput.phase,
        playbackVerified: false,
        ...(safeInput.exitCode !== undefined ? { exitCode: safeInput.exitCode } : {}),
        ...(safeInput.signal !== undefined ? { signal: safeInput.signal } : {}),
        ...(safeInput.errorCode ? { errorCode: safeInput.errorCode.slice(0, 64) } : {}),
        ...(safeInput.reason ? { reason: safeInput.reason.replace(/[\r\n\t]+/g, ' ').slice(0, 160) } : {}),
      });
      pending.push(event);
      // Queue reentrant publications so every observer sees the same total order.
      if (!dispatching) {
        dispatching = true;
        try {
          while (pendingHead < pending.length) {
            const next = pending[pendingHead++];
            if (!next) continue;
            for (const listener of [...listeners]) {
              try { listener(next); } catch { /* observers must never affect speech execution */ }
            }
          }
        } finally {
          pending.length = 0;
          pendingHead = 0;
          dispatching = false;
        }
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
