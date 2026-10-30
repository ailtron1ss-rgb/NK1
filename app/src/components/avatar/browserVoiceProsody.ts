import type { EmotionLabel } from "@/organism/types";

export interface BrowserVoiceProsodyInput {
  emotion: EmotionLabel;
  valence: number;
  arousal: number;
  dominance: number;
  action: string;
  traits?: Record<string, number>;
}

export interface BrowserVoiceProsody {
  /** Web Speech pitch multiplier. */
  pitch: number;
  /** Web Speech speaking-rate multiplier. */
  rate: number;
  /** Web Speech volume in [0, 1]. */
  volume: number;
  /** Short audit trail for UI diagnostics and regression tests. */
  reasons: string[];
}

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Number.isFinite(value) ? value : low));

/**
 * Convert the canonical organism appraisal into conservative browser TTS
 * prosody. This shapes delivery only; it does not change text, emotion labels,
 * cognition, user-facing truth claims, or the server/Termux voice plan.
 */
export function deriveBrowserVoiceProsody(input: BrowserVoiceProsodyInput): BrowserVoiceProsody {
  const valence = clamp(input.valence, 0, 1);
  const arousal = clamp(input.arousal, 0, 1);
  const dominance = clamp(input.dominance, 0, 1);
  const traits = input.traits ?? {};
  const warmth = clamp(traits.warmth ?? 0.5, 0, 1);
  const composure = clamp(traits.composure ?? 0.5, 0, 1);
  const sarcasm = clamp(traits.sarcasm ?? 0.5, 0, 1);
  const reasons: string[] = [];

  let pitch = 1;
  let rate = 0.96;
  let volume = 0.92;

  switch (input.emotion) {
    case "joy":
      pitch += 0.035;
      rate += 0.035;
      volume += 0.025;
      reasons.push("affect-joy");
      break;
    case "curiosity":
      pitch += 0.018;
      rate += 0.008;
      reasons.push("affect-curiosity");
      break;
    case "anxiety":
      pitch -= 0.015;
      rate -= 0.035;
      volume -= 0.035;
      reasons.push("affect-anxiety-regulation");
      break;
    case "sadness":
      pitch -= 0.03;
      rate -= 0.055;
      volume -= 0.035;
      reasons.push("affect-sadness");
      break;
    case "frustration":
    case "anger":
      // Strong negative arousal should not make speech louder or faster.
      pitch -= 0.02;
      rate -= 0.015;
      volume -= 0.06;
      reasons.push("affect-deescalation");
      break;
    case "protective":
      pitch += 0.005;
      rate -= 0.012;
      volume -= 0.015;
      reasons.push("affect-protective");
      break;
    case "calm":
    default:
      reasons.push("affect-neutral");
      break;
  }

  if (valence >= 0.7) {
    pitch += 0.012;
    volume += 0.012;
    reasons.push("positive-valence");
  } else if (valence <= 0.3) {
    rate -= 0.018;
    volume -= 0.018;
    reasons.push("negative-valence");
  }

  if (arousal >= 0.78) {
    if (input.emotion === "anger" || input.emotion === "frustration" || input.emotion === "anxiety") {
      rate -= 0.02;
      volume -= 0.025;
      reasons.push("high-negative-arousal-regulation");
    } else {
      rate += 0.012;
      reasons.push("high-arousal");
    }
  } else if (arousal <= 0.2) {
    rate -= 0.018;
    volume -= 0.012;
    reasons.push("low-arousal");
  }

  if (input.action === "explore") {
    rate += 0.012;
    reasons.push("exploration");
  } else if (input.action === "verify" || input.action === "reflect") {
    rate -= 0.018;
    reasons.push("deliberation");
  } else if (input.action === "rest") {
    rate -= 0.035;
    volume -= 0.025;
    reasons.push("rest");
  }

  pitch += (warmth - 0.5) * 0.025;
  pitch += (sarcasm - 0.5) * 0.008;
  rate += (composure - 0.5) * 0.018;
  volume += (dominance - 0.5) * 0.012;

  return {
    pitch: clamp(pitch, 0.82, 1.18),
    rate: clamp(rate, 0.78, 1.15),
    volume: clamp(volume, 0.5, 0.98),
    reasons,
  };
}
