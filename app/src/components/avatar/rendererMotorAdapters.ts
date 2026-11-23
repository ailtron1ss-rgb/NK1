import type { AvatarMotorIntentPlan } from "./motorIntent.ts";
import type { EmotionLabel } from "@/organism/types";

export interface VrmArmIntentFrame {
  emotion: EmotionLabel;
  speaking: boolean;
  awake: boolean;
  cognitiveLoad: number;
  socialNeed: number;
  guardedness: number;
}

export interface VrmArmIntent {
  leftArmIntent: number;
  rightArmIntent: number;
}

export function resolveVrmArmIntent(_plan: AvatarMotorIntentPlan, _frame: VrmArmIntentFrame): VrmArmIntent {
  return { leftArmIntent: 0, rightArmIntent: 0 };
}
