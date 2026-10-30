import type { NativeSpeechProviderEventV1 } from './NativeSpeechEventChannel.ts';

export interface NativeSpeechRuntimeSource {
  subscribeNativeSpeechEvents(listener: (event: NativeSpeechProviderEventV1) => void): () => void;
}

export interface NativeSpeechHostEnvelopeV1 {
  type: 'nk1.native_speech_provider_event';
  protocol: 'nk1.native-speech-host-envelope';
  version: 1;
  event: NativeSpeechProviderEventV1;
}

export type NativeSpeechHostPublisher = (envelope: NativeSpeechHostEnvelopeV1) => void;

const MAX_TRACKED_EVENTS = 512;
const MAX_TRACKED_OPERATIONS = 256;

/**
 * Host-side transport seam for native TTS provider telemetry.
 *
 * This router forwards only validated provider-process events. It never maps
 * process-spawn/process-exit to playback started/ended and never creates
 * SpeechLifecycleEventV1 events. The publisher owns the final host/UI transport.
 */
export function connectNativeSpeechHostRouter(
  runtime: NativeSpeechRuntimeSource,
  publish: NativeSpeechHostPublisher,
): () => void {
  if (!runtime || typeof runtime.subscribeNativeSpeechEvents !== 'function') {
    throw new TypeError('native-speech-runtime-source-required');
  }
  if (typeof publish !== 'function') throw new TypeError('native-speech-host-publisher-required');

  const seenEventIds = new Set<string>();
  const operationSequences = new Map<string, number>();
  const operationTimes = new Map<string, number>();
  let disposed = false;

  const unsubscribe = runtime.subscribeNativeSpeechEvents((event) => {
    if (disposed || !isNativeSpeechProviderEvent(event)) return;
    if (seenEventIds.has(event.eventId)) return;
    const previousSequence = operationSequences.get(event.operationId) ?? 0;
    const previousTime = operationTimes.get(event.operationId) ?? 0;
    if (event.sequence <= previousSequence || event.monotonicTimeMs < previousTime) return;

    seenEventIds.add(event.eventId);
    operationSequences.set(event.operationId, event.sequence);
    operationTimes.set(event.operationId, event.monotonicTimeMs);
    if (seenEventIds.size > MAX_TRACKED_EVENTS) {
      const oldest = seenEventIds.values().next().value as string | undefined;
      if (oldest) seenEventIds.delete(oldest);
    }
    if (operationSequences.size > MAX_TRACKED_OPERATIONS) {
      const oldest = operationSequences.keys().next().value as string | undefined;
      if (oldest) {
        operationSequences.delete(oldest);
        operationTimes.delete(oldest);
      }
    }

    try {
      publish({
        type: 'nk1.native_speech_provider_event',
        protocol: 'nk1.native-speech-host-envelope',
        version: 1,
        event,
      });
    } catch {
      // Transport observers must not interfere with native TTS execution.
    }
  });

  return () => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    seenEventIds.clear();
    operationSequences.clear();
    operationTimes.clear();
  };
}

function isNativeSpeechProviderEvent(value: unknown): value is NativeSpeechProviderEventV1 {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<NativeSpeechProviderEventV1>;
  return event.protocol === 'nk1.native-speech-provider-event'
    && event.version === 1
    && typeof event.eventId === 'string' && event.eventId.length > 0 && event.eventId.length <= 180
    && typeof event.operationId === 'string' && event.operationId.length > 0 && event.operationId.length <= 140
    && Number.isSafeInteger(event.sequence) && Number(event.sequence) > 0
    && event.provider === 'termux-tts-speak'
    && Number.isFinite(event.monotonicTimeMs) && Number(event.monotonicTimeMs) >= 0
    && ['command-requested', 'process-spawned', 'process-exited', 'process-error', 'interrupt-requested', 'interrupt-unconfirmed'].includes(String(event.phase))
    && event.playbackVerified === false;
}
