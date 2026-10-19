import type { ActionKind, Needs } from "./types";
import { clamp01, lerp } from "./math";

export function defaultNeeds(): Needs {
  return {
    energy: 0.72,
    cognitiveLoad: 0.22,
    uncertainty: 0.4,
    socialNeed: 0.35,
    novelty: 0.45,
    identityCoherence: 0.92,
    goalPressure: 0.2,
    sleepPressure: 0.12,
  };
}

export function stepNeeds(
  n: Needs,
  input: {
    action: ActionKind;
    predictionError: number;
    social: boolean;
    innerReward: number;
    awake: boolean;
    dt: number;
  },
): Needs {
  const next = { ...n };
  const burn =
    input.action === "respond"
      ? 0.012
      : input.action === "explore"
        ? 0.01
        : input.action === "verify"
          ? 0.011
          : input.action === "reflect"
            ? 0.008
            : input.action === "rest"
              ? -0.028
              : 0.004;
  next.energy = clamp01(next.energy - burn * input.dt + (input.awake ? 0 : 0.04));
  next.cognitiveLoad = clamp01(
    lerp(next.cognitiveLoad, input.action === "rest" ? 0.12 : next.cognitiveLoad + input.predictionError * 0.18, 0.25),
  );
  next.uncertainty = clamp01(
    lerp(next.uncertainty, input.predictionError * 0.7 + (input.action === "verify" ? -0.12 : 0.02), 0.2),
  );
  next.socialNeed = clamp01(next.socialNeed + (input.social ? -0.18 : 0.006 * input.dt));
  next.novelty = clamp01(lerp(next.novelty, input.predictionError * 0.85 + Math.abs(input.innerReward) * 0.2, 0.18));
  next.sleepPressure = clamp01(
    next.sleepPressure + (input.awake ? 0.0035 * input.dt : -0.08) + (1 - next.energy) * 0.004,
  );
  next.goalPressure = clamp01(lerp(next.goalPressure, next.uncertainty * 0.4 + next.socialNeed * 0.3, 0.12));
  return next;
}

export function homeostaticPressure(n: Needs): number {
  const energyErr = Math.abs(n.energy - 0.72);
  return clamp01(energyErr * 0.35 + n.cognitiveLoad * 0.2 + n.sleepPressure * 0.25 + n.uncertainty * 0.2);
}
