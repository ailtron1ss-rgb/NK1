import type { ActionKind, EmotionLabel, EmotionState } from "./types";
import { clamp01 } from "./math";

const LABELS: EmotionLabel[] = [
  "curiosity",
  "calm",
  "joy",
  "anxiety",
  "frustration",
  "sadness",
  "anger",
  "protective",
];

export function defaultEmotion(): EmotionState {
  return {
    label: "calm",
    valence: 0.52,
    arousal: 0.22,
    dominance: 0.55,
    tendency: "wait",
    cause: "baseline",
  };
}

/** Appraisal-based emotion: time-bound control signal, not a mood lamp. */
export function appraise(input: {
  goalPressure: number;
  goalCongruence: number;
  novelty: number;
  uncertainty: number;
  predictionError: number;
  homeostaticPressure: number;
  energy: number;
  social: boolean;
  success: number;
}): EmotionState {
  const relevance = Math.max(input.goalPressure, input.predictionError, input.homeostaticPressure);
  const controllability = clamp01(1 - input.uncertainty);
  const arousal = clamp01(
    relevance * 0.22 + input.novelty * 0.2 + input.uncertainty * 0.2 + input.predictionError * 0.18 + input.homeostaticPressure * 0.2,
  );
  const valence = clamp01(
    0.5 +
      (input.goalCongruence - 0.5) * 0.46 +
      controllability * 0.1 -
      input.uncertainty * 0.16 +
      (input.success - 0.5) * 0.42,
  );
  const stress = clamp01(
    (1 - controllability) * 0.3 + input.uncertainty * 0.2 + input.predictionError * 0.24 + input.homeostaticPressure * 0.26,
  );
  const dominance = clamp01(controllability * 0.62 + input.success * 0.2 + 0.18);

  let label: EmotionLabel = "calm";
  let tendency: ActionKind = "wait";
  if (stress > 0.72 && controllability < 0.4) {
    label = "anxiety";
    tendency = "verify";
  } else if (stress > 0.58 && controllability > 0.55) {
    label = "protective";
    tendency = "reflect";
  } else if (input.predictionError > 0.62 && controllability < 0.45) {
    label = "frustration";
    tendency = "reflect";
  } else if (input.social && valence < 0.38) {
    label = "sadness";
    tendency = "wait";
  } else if (input.social && valence > 0.66) {
    label = "joy";
    tendency = "respond";
  } else if (input.novelty > 0.64 && input.uncertainty > 0.35) {
    label = "curiosity";
    tendency = "explore";
  } else if (valence < 0.34 && dominance > 0.65) {
    label = "anger";
    tendency = "verify";
  } else if (input.energy < 0.28) {
    label = "calm";
    tendency = "rest";
  }

  return {
    label,
    valence,
    arousal,
    dominance,
    tendency,
    cause: input.social ? "social" : input.predictionError > 0.5 ? "prediction-error" : "interoception",
  };
}

export function isEmotion(x: string): x is EmotionLabel {
  return (LABELS as string[]).includes(x);
}
