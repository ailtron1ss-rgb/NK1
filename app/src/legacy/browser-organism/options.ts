import { ACTIONS, type ActionKind, type OptionKind } from "./types";
import { clamp01, sampleCategorical, softmax } from "./math";

/** Option-critic: temporally extended options with learned values and termination. */
export class OptionCritic {
  values: Record<OptionKind, number> = {
    respond: 0.1,
    explore: 0.15,
    verify: 0.12,
    rest: 0.05,
    reflect: 0.08,
    wait: 0.02,
  };
  beta: Record<OptionKind, number> = {
    respond: 0.35,
    explore: 0.22,
    verify: 0.3,
    rest: 0.4,
    reflect: 0.28,
    wait: 0.5,
  };
  current: OptionKind = "wait";
  stepsInOption = 0;
  maxSteps = 8;

  select(drive: Record<OptionKind, number>, temperature = 0.85): OptionKind {
    const logits = ACTIONS.map((a) => this.values[a] * 1.4 + (drive[a] ?? 0));
    const probs = softmax(logits, temperature);
    const idx = sampleCategorical(probs, Math.random);
    this.current = ACTIONS[idx];
    this.stepsInOption = 0;
    return this.current;
  }

  maybeTerminate(advantage: number): boolean {
    this.stepsInOption += 1;
    const b = this.beta[this.current];
    const p = clamp01(b + (advantage < 0 ? 0.2 : -0.08));
    if (this.stepsInOption >= this.maxSteps) return true;
    return Math.random() < p;
  }

  learn(option: OptionKind, ret: number, terminated: boolean) {
    const v = this.values[option];
    const adv = ret - v;
    this.values[option] = v + 0.08 * adv;
    const targetBeta = adv < 0 ? 0.55 : 0.18;
    this.beta[option] = clamp01(this.beta[option] * 0.9 + targetBeta * 0.1);
    if (terminated) this.stepsInOption = 0;
  }
}

export function driveFromState(input: {
  social: boolean;
  energy: number;
  uncertainty: number;
  novelty: number;
  sleepPressure: number;
  socialNeed: number;
  emotionTendency: ActionKind;
}): Record<OptionKind, number> {
  return {
    respond: (input.social ? 1.1 : 0) + input.socialNeed * 0.6,
    explore: input.novelty * 0.8 + (1 - input.energy) * -0.2,
    verify: input.uncertainty * 0.9,
    rest: input.sleepPressure * 0.9 + (1 - input.energy) * 0.7,
    reflect: input.uncertainty * 0.35 + (input.emotionTendency === "reflect" ? 0.4 : 0),
    wait: input.social ? -0.4 : 0.15,
  };
}
