export type BrowserSpeechWatchdogPhase = "queued" | "speaking";

const QUEUED_WATCHDOG_MS = 20_000;
const MIN_SPEAKING_WATCHDOG_MS = 30_000;
const MAX_SPEAKING_WATCHDOG_MS = 10 * 60_000;

/**
 * Returns a conservative upper bound for a browser utterance watchdog.
 * This is a liveness guard, not an audio-duration measurement or playback receipt.
 */
export function browserSpeechWatchdogMs(
  text: string,
  rate: number,
  phase: BrowserSpeechWatchdogPhase,
): number {
  if (phase === "queued") return QUEUED_WATCHDOG_MS;
  const safeRate = Number.isFinite(rate) ? Math.max(0.5, Math.min(2, rate)) : 1;
  const visibleLength = Array.from(String(text ?? "").trim()).length;
  const estimatedMs = (visibleLength / (8 * safeRate)) * 1_000 * 1.8 + 12_000;
  return Math.max(MIN_SPEAKING_WATCHDOG_MS, Math.min(MAX_SPEAKING_WATCHDOG_MS, Math.ceil(estimatedMs)));
}
