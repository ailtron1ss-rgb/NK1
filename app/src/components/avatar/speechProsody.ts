export type SpeechProsodyEmotion = "curiosity" | "calm" | "joy" | "anxiety" | "frustration" | "sadness" | "anger" | "protective";

export interface SpeechProsodyInput {
  emotion: SpeechProsodyEmotion;
  valence: number;
  arousal: number;
  dominance: number;
  emphasis?: number;
}

export interface SpeechProsodyProfile {
  /** Browser SpeechSynthesis controls; bounded for cross-device stability. */
  rate: number;
  pitch: number;
  volume: number;
  /** Relative pause multiplier for future chunked/streaming speech providers. */
  pauseScale: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const BASE: Record<SpeechProsodyEmotion, { rate: number; pitch: number; volume: number; pause: number }> = {
  curiosity: { rate: 0.98, pitch: 1.035, volume: 0.91, pause: 1.08 },
  calm: { rate: 0.93, pitch: 0.99, volume: 0.86, pause: 1.16 },
  joy: { rate: 1.055, pitch: 1.065, volume: 0.96, pause: 0.88 },
  anxiety: { rate: 1.015, pitch: 1.035, volume: 0.88, pause: 0.94 },
  frustration: { rate: 0.985, pitch: 0.94, volume: 0.97, pause: 1.02 },
  sadness: { rate: 0.875, pitch: 0.925, volume: 0.79, pause: 1.28 },
  anger: { rate: 1.025, pitch: 0.91, volume: 1, pause: 0.91 },
  protective: { rate: 0.955, pitch: 1.005, volume: 0.95, pause: 1.12 },
};

/**
 * Translate the canonical appraisal into conservative speech-prosody controls.
 * This affects only the current utterance; it does not infer emotion or own voice
 * identity. pauseScale is provider-neutral metadata for chunked speech adapters.
 */
export function deriveSpeechProsody(input: SpeechProsodyInput): SpeechProsodyProfile {
  // Own-key lookup rejects inherited keys such as "constructor" and "__proto__".
  const emotion = Object.hasOwn(BASE, input.emotion) ? input.emotion : "calm";
  const base = BASE[emotion];
  const valence = clamp(input.valence, 0, 1);
  const arousal = clamp(input.arousal, 0, 1);
  const dominance = clamp(input.dominance, 0, 1);
  const emphasis = clamp(input.emphasis ?? 0.35, 0, 1);

  return {
    rate: clamp(base.rate + (arousal - 0.45) * 0.12 + emphasis * 0.035, 0.82, 1.16),
    pitch: clamp(base.pitch + (arousal - 0.45) * 0.075 + (valence - 0.5) * 0.035 + (dominance - 0.5) * 0.018, 0.86, 1.14),
    volume: clamp(base.volume + (arousal - 0.45) * 0.055 + emphasis * 0.035 + (dominance - 0.5) * 0.025, 0.72, 1),
    pauseScale: clamp(base.pause - (arousal - 0.45) * 0.24 + (0.5 - dominance) * 0.08, 0.72, 1.42),
  };
}
