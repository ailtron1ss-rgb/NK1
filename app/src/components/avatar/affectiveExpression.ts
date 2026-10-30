export type AffectiveExpressionLabel =
  | "curiosity" | "calm" | "joy" | "anxiety"
  | "frustration" | "sadness" | "anger" | "protective";

export interface AffectiveExpressionInput {
  emotion: AffectiveExpressionLabel;
  valence: number;
  arousal: number;
  dominance: number;
}

export interface AffectiveExpressionProfile {
  /** Existing Live2D expression identifiers; intentionally adapter-owned. */
  expression: "thinking" | "neutral" | "happy" | "sad" | "angry" | "focused";
  expressionIntensity: number;
  gazeX: number;
  gazeY: number;
  headTilt: number;
  gestureDrive: number;
  voiceEmphasis: number;
}

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Number.isFinite(value) ? value : low));

const EXPRESSION: Record<AffectiveExpressionLabel, AffectiveExpressionProfile["expression"]> = {
  curiosity: "thinking",
  calm: "neutral",
  joy: "happy",
  anxiety: "sad",
  frustration: "angry",
  sadness: "sad",
  anger: "angry",
  protective: "focused",
};

const EMOTION_BIAS: Record<AffectiveExpressionLabel, {
  gazeX: number;
  gazeY: number;
  headTilt: number;
  gesture: number;
}> = {
  curiosity: { gazeX: 0.11, gazeY: -0.035, headTilt: -0.035, gesture: 0.12 },
  calm: { gazeX: 0, gazeY: 0.005, headTilt: 0, gesture: 0 },
  joy: { gazeX: 0.025, gazeY: -0.015, headTilt: 0.012, gesture: 0.16 },
  anxiety: { gazeX: -0.055, gazeY: 0.035, headTilt: -0.012, gesture: 0.08 },
  frustration: { gazeX: 0.025, gazeY: -0.015, headTilt: 0.025, gesture: 0.11 },
  sadness: { gazeX: -0.035, gazeY: 0.075, headTilt: 0.035, gesture: -0.04 },
  anger: { gazeX: 0.045, gazeY: -0.025, headTilt: 0.018, gesture: 0.12 },
  protective: { gazeX: 0.015, gazeY: -0.035, headTilt: -0.012, gesture: 0.07 },
};

/**
 * Converts the organism's canonical affect appraisal into bounded expressive
 * controls. This is an adapter, not an emotion engine: it does not infer or
 * mutate emotion, choose goals, or start an animation clip.
 *
 * The output is intentionally semantic and renderer-neutral except for the
 * expression key, which is mapped to identifiers already supported by Live2D.
 * 2.5D/3D adapters can consume the continuous channels without inheriting
 * Live2D's expression naming scheme.
 */
export function deriveAffectiveExpression(
  input: AffectiveExpressionInput,
): AffectiveExpressionProfile {
  const emotion = input.emotion in EXPRESSION ? input.emotion : "calm";
  const valence = clamp(input.valence, 0, 1);
  const arousal = clamp(input.arousal, 0, 1);
  const dominance = clamp(input.dominance, 0, 1);
  const bias = EMOTION_BIAS[emotion];
  const valenceDistance = Math.abs(valence - 0.5) * 2;
  const lowControl = 1 - dominance;

  const expressionIntensity = clamp(
    0.16 + arousal * 0.54 + valenceDistance * 0.18 + lowControl * 0.08,
    0.12,
    0.92,
  );
  const gazeX = clamp(
    bias.gazeX + (valence - 0.5) * 0.075 + (dominance - 0.5) * 0.025,
    -0.4,
    0.4,
  );
  const gazeY = clamp(
    bias.gazeY + (0.5 - arousal) * 0.035 + (0.5 - dominance) * 0.018,
    -0.25,
    0.25,
  );
  const headTilt = clamp(
    bias.headTilt + (0.5 - dominance) * 0.045 + (0.5 - valence) * 0.018,
    -0.15,
    0.15,
  );
  const gestureDrive = clamp(
    arousal * 0.38 + valenceDistance * 0.16 + lowControl * 0.10 + bias.gesture,
    0,
    1,
  );
  const voiceEmphasis = clamp(
    arousal * 0.52 + valenceDistance * 0.12 + bias.gesture * 0.22,
    0,
    0.85,
  );

  return {
    expression: EXPRESSION[emotion],
    expressionIntensity,
    gazeX,
    gazeY,
    headTilt,
    gestureDrive,
    voiceEmphasis,
  };
}
