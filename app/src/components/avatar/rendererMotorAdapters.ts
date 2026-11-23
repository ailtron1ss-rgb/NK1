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

const ARM_POSE: Record<AvatarMotorIntentPlan["action"], readonly [number, number]> = {
  rest: [0, 0],
  listen: [0, 0],
  reflect: [-0.1, 0.18],
  inspect: [-0.23, -0.45],
  explain: [0.08, -0.68],
  comfort: [-0.18, 0.12],
  respond: [-0.08, 0.1],
};

const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : 0;

/**
 * Translate the shared semantic plan into model-neutral normalized upper-arm
 * intent. The VRM runtime still checks whether the imported humanoid exposes
 * each target bone; this adapter never fabricates missing anatomy or IK.
 */
export function resolveVrmArmIntent(
  plan: AvatarMotorIntentPlan,
  frame: VrmArmIntentFrame,
): VrmArmIntent {
  if (plan.action === "rest" || plan.action === "listen") {
    return { leftArmIntent: 0, rightArmIntent: 0 };
  }

  const base = ARM_POSE[plan.action];
  const gestureScale = plan.gesture ? 1 : 0.35;
  let left = base[0] * gestureScale;
  let right = base[1] * gestureScale;

  // A confirmed spoken response uses the same open explaining gesture used by the
  // Live2D tap-body contract; pending/ended speech is already closed upstream.
  if (plan.action === "respond" && frame.speaking && plan.gesture) {
    left = -0.25;
    right = 0.42;
  }

  if (plan.gesture && (frame.emotion === "anger" || frame.emotion === "frustration")) {
    left = -0.64;
    right = 0.64;
  }

  const guardedness = clamp(frame.guardedness, 0, 1);
  const cognitiveLoad = clamp(frame.cognitiveLoad, 0, 1);
  const socialNeed = clamp(frame.socialNeed, 0, 1);
  left += guardedness * 0.08 - cognitiveLoad * 0.06;
  right -= guardedness * 0.08;

  if (socialNeed > 0.68 && frame.speaking) {
    left -= 0.08;
    right += 0.1;
  }

  const awakeScale = frame.awake ? 1 : 0.25;
  return {
    leftArmIntent: clamp(left * awakeScale, -0.85, 0.85),
    rightArmIntent: clamp(right * awakeScale, -0.85, 0.85),
  };
}
