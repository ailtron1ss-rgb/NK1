export interface AffectiveArmPostureInput {
  baseLeft: number;
  baseRight: number;
  armOpenness: number;
  shoulderTension: number;
  gestureAmplitude: number;
  stillness: number;
  dominance: number;
}
export interface AffectiveArmPosture {
  left: number;
  right: number;
}
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));

/**
 * Applies continuous affective modulation to a motor planner's existing arm targets.
 * It deliberately receives no emotion label and cannot choose a gesture or animation.
 * The motor planner owns the semantic action; affect changes its amplitude, openness,
 * guardedness and settling behaviour. This avoids brittle "anger => fixed pose" rules.
 */
export function deriveAffectiveArmPosture(input: AffectiveArmPostureInput): AffectiveArmPosture {
  const openness = (clamp(input.armOpenness, 0, 1) - 0.5) * 0.16;
  const tension = clamp(input.shoulderTension, 0, 1);
  const gesture = clamp(input.gestureAmplitude, 0, 1);
  const stillness = clamp(input.stillness, 0, 1);
  const dominance = clamp(input.dominance, 0, 1);
  const activity = 1 - stillness * 0.72;
  const amplitude = 0.82 + gesture * 0.36;
  const asymmetry = (dominance - 0.5) * gesture * 0.045;
  const guardedBias = tension * 0.055;
  const left = (clamp(input.baseLeft, -0.85, 0.85) - openness + guardedBias + asymmetry) * amplitude * activity;
  const right = (clamp(input.baseRight, -0.85, 0.85) + openness - guardedBias - asymmetry) * amplitude * activity;
  return { left: clamp(left, -0.85, 0.85), right: clamp(right, -0.85, 0.85) };
}
