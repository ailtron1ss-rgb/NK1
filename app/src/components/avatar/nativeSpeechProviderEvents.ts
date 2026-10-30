export const NATIVE_SPEECH_HOST_EVENT = "nk1.native_speech_provider_event" as const;
export const NATIVE_SPEECH_HOST_PROTOCOL = "nk1.native-speech-host-envelope" as const;

export type NativeSpeechProviderPhase =
  | "command-requested"
  | "process-spawned"
  | "process-exited"
  | "process-error"
  | "interrupt-requested"
  | "interrupt-unconfirmed";

export interface NativeSpeechProviderEvent {
  protocol: "nk1.native-speech-provider-event";
  version: 1;
  eventId: string;
  operationId: string;
  sequence: number;
  provider: "termux-tts-speak";
  monotonicTimeMs: number;
  phase: NativeSpeechProviderPhase;
  playbackVerified: false;
  exitCode?: number | null;
  signal?: string | null;
  errorCode?: string;
  reason?: string;
}

export interface NativeSpeechHostEnvelope {
  type: typeof NATIVE_SPEECH_HOST_EVENT;
  protocol: typeof NATIVE_SPEECH_HOST_PROTOCOL;
  version: 1;
  event: NativeSpeechProviderEvent;
}

export type NativeSpeechProviderConnection = "connecting" | "connected" | "reconnecting" | "closed";

export interface NativeSpeechProviderEventSource {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  close(): void;
  onopen: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
}

export interface NativeSpeechProviderStreamOptions {
  url: string;
  withCredentials?: boolean;
  createEventSource?: (url: string, init?: EventSourceInit) => NativeSpeechProviderEventSource;
  onEvent: (event: NativeSpeechProviderEvent) => void;
  onConnection?: (state: NativeSpeechProviderConnection) => void;
}

const PHASES = new Set<NativeSpeechProviderPhase>([
  "command-requested",
  "process-spawned",
  "process-exited",
  "process-error",
  "interrupt-requested",
  "interrupt-unconfirmed",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function boundedString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

export function parseNativeSpeechHostEnvelope(value: unknown): NativeSpeechHostEnvelope | null {
  if (!isRecord(value)
    || value.type !== NATIVE_SPEECH_HOST_EVENT
    || value.protocol !== NATIVE_SPEECH_HOST_PROTOCOL
    || value.version !== 1
    || !isRecord(value.event)) return null;

  const event = value.event;
  if (event.protocol !== "nk1.native-speech-provider-event"
    || event.version !== 1
    || !boundedString(event.eventId, 180)
    || !boundedString(event.operationId, 140)
    || !Number.isSafeInteger(event.sequence) || Number(event.sequence) <= 0
    || event.provider !== "termux-tts-speak"
    || typeof event.monotonicTimeMs !== "number" || !Number.isFinite(event.monotonicTimeMs) || event.monotonicTimeMs < 0
    || typeof event.phase !== "string" || !PHASES.has(event.phase as NativeSpeechProviderPhase)
    || event.playbackVerified !== false) return null;

  if (event.exitCode !== undefined && event.exitCode !== null
    && (typeof event.exitCode !== "number" || !Number.isSafeInteger(event.exitCode))) return null;
  if (event.signal !== undefined && event.signal !== null && !boundedString(event.signal, 48)) return null;
  if (event.errorCode !== undefined && !boundedString(event.errorCode, 64)) return null;
  if (event.reason !== undefined && (typeof event.reason !== "string" || event.reason.length > 160)) return null;

  return value as unknown as NativeSpeechHostEnvelope;
}

/** Reject duplicate, stale and non-monotonic provider telemetry. */
export class NativeSpeechProviderEventTracker {
  private readonly seen = new Set<string>();
  private readonly operations = new Map<string, { sequence: number; monotonicTimeMs: number }>();

  accept(value: unknown): NativeSpeechProviderEvent | null {
    const envelope = parseNativeSpeechHostEnvelope(value);
    if (!envelope) return null;
    const event = envelope.event;
    if (this.seen.has(event.eventId)) return null;

    const previous = this.operations.get(event.operationId);
    if (previous && (event.sequence <= previous.sequence || event.monotonicTimeMs < previous.monotonicTimeMs)) return null;

    this.seen.add(event.eventId);
    this.operations.delete(event.operationId);
    this.operations.set(event.operationId, {
      sequence: event.sequence,
      monotonicTimeMs: event.monotonicTimeMs,
    });

    if (this.seen.size > 512) {
      const oldest = this.seen.values().next().value as string | undefined;
      if (oldest) this.seen.delete(oldest);
    }
    if (this.operations.size > 256) {
      const oldest = this.operations.keys().next().value as string | undefined;
      if (oldest) this.operations.delete(oldest);
    }
    return event;
  }
}

/**
 * Subscribe to the API event stream. Provider process events deliberately do not
 * change browser speech state or visemes.
 */
export function connectNativeSpeechProviderEvents(options: NativeSpeechProviderStreamOptions): () => void {
  if (!options.url || typeof options.onEvent !== "function") return () => {};
  const factory = options.createEventSource
    ?? ((url, init) => new EventSource(url, init) as unknown as NativeSpeechProviderEventSource);
  const source = factory(options.url, { withCredentials: options.withCredentials ?? true });
  const tracker = new NativeSpeechProviderEventTracker();
  let disposed = false;

  const onNativeEvent: EventListener = (raw) => {
    if (disposed || !isRecord(raw) || typeof raw.data !== "string" || raw.data.length > 16_384) return;
    let decoded: unknown;
    try { decoded = JSON.parse(raw.data) as unknown; } catch { return; }
    const event = tracker.accept(decoded);
    if (event) options.onEvent(event);
  };

  source.addEventListener(NATIVE_SPEECH_HOST_EVENT, onNativeEvent);
  source.onopen = () => { if (!disposed) options.onConnection?.("connected"); };
  source.onerror = () => { if (!disposed) options.onConnection?.("reconnecting"); };
  options.onConnection?.("connecting");

  return () => {
    if (disposed) return;
    disposed = true;
    source.removeEventListener(NATIVE_SPEECH_HOST_EVENT, onNativeEvent);
    source.onopen = null;
    source.onerror = null;
    source.close();
    options.onConnection?.("closed");
  };
}

export function describeNativeSpeechProviderStatus(event: NativeSpeechProviderEvent | null): string {
  if (!event) return "события нативного TTS пока не поступали";
  switch (event.phase) {
    case "command-requested": return "команда Termux отправлена; звук ещё не подтверждён";
    case "process-spawned": return "процесс Termux запущен; звук ещё не подтверждён";
    case "process-exited": return "процесс Termux завершился; факт слышимого воспроизведения не подтверждён";
    case "process-error": return "ошибка процесса Termux" + (event.errorCode ? ": " + event.errorCode : "");
    case "interrupt-requested": return "запрошено прерывание Termux; остановка звука не подтверждена";
    case "interrupt-unconfirmed": return "прерывание Termux не подтверждено";
  }
}
