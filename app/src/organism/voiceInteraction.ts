export interface VoiceTranscriptResult {
  text: string | null;
  reason: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[\r\n\t\u0000-\u001f]+/g, " ").trim().slice(0, 240);
  return clean || null;
}

/** Decode the transcript-only response without treating missing or malformed data as success. */
export function parseVoiceListenResponse(value: unknown): VoiceTranscriptResult {
  if (!isRecord(value)) {
    return { text: null, reason: "Microphone access was not approved or no transcript was returned." };
  }

  const text = typeof value.text === "string" ? value.text.replace(/\u0000/g, "").trim().slice(0, 4000) : "";
  if (text) return { text, reason: null };

  const voice = isRecord(value.voice) ? value.voice : null;
  const state = voice && isRecord(voice.state) ? voice.state : null;
  const providerReason = cleanReason(state?.lastError);
  const responseReason = cleanReason(value.error);
  return {
    text: null,
    reason: providerReason ?? responseReason ?? "No speech was recognized. Check microphone permission and try again.",
  };
}

/** Read only an explicit boolean from the runtime voice status response. */
export function readRuntimeListening(value: unknown): boolean | null {
  if (!isRecord(value) || !isRecord(value.voice) || !isRecord(value.voice.state)) return null;
  return typeof value.voice.state.listening === "boolean" ? value.voice.state.listening : null;
}
