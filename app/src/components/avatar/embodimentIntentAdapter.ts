import {
  resolveDepthRigPose,
  type DepthRigDefinition,
  type DepthRigPose,
} from "./depthRig.ts";

/**
 * Minimal structural view of the already-versioned EmbodimentIntent v1
 * envelope. The protocol remains the single semantic owner; this adapter
 * only translates its bounded body fields into the 2.5D rig coordinate space.
 */
export interface EmbodimentIntentV1Body {
  type: "kurisu_embodiment_intent";
  protocolVersion: 1;
  expressionIntensity: number;
  gaze: { x: number; y: number; driven: boolean };
  body: {
    headTilt: number;
    gesture: boolean;
    motionGroup: "Idle" | "TapHead" | "TapBody" | "Special";
    motionIndex: number;
  };
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));

/**
 * Convert the v1 Live2D/body intent into a bounded depth-rig pose.
 * Head tilt is radians in v1 and becomes a normalized roll input; gaze is
 * normalized. Existing motion-group semantics choose a coarse gesture only.
 * Fine joint trajectories remain the motor controller's responsibility.
 */
export function resolveDepthRigPoseFromEmbodimentIntent(
  rig: DepthRigDefinition,
  intent: EmbodimentIntentV1Body,
): DepthRigPose {
  if (!intent || intent.type !== "kurisu_embodiment_intent" || intent.protocolVersion !== 1
    || !intent.gaze || !intent.body
    || ![intent.expressionIntensity, intent.gaze.x, intent.gaze.y, intent.body.headTilt, intent.body.motionIndex].every(Number.isFinite)
    || typeof intent.body.gesture !== "boolean"
    || !["Idle", "TapHead", "TapBody", "Special"].includes(intent.body.motionGroup)) {
    throw new Error("Invalid EmbodimentIntent v1 body payload.");
  }

  const gesture = !intent.body.gesture ? "none"
    : intent.body.motionGroup === "TapHead" ? "think"
      : intent.body.motionGroup === "TapBody" ? "explain-left"
        : intent.body.motionGroup === "Special" ? "shrug" : "none";

  return resolveDepthRigPose(rig, {
    headYaw: intent.gaze.driven ? intent.gaze.x : 0,
    headPitch: intent.gaze.driven ? intent.gaze.y : 0,
    headRoll: clamp(intent.body.headTilt / 0.15, -1, 1),
    torsoYaw: 0,
    torsoLean: 0,
    breath: 0,
    gesture,
    gestureIntensity: intent.body.gesture ? clamp(intent.expressionIntensity, 0, 1) : 0,
  });
}
