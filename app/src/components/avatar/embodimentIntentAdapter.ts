import {
  orderDepthRigNodes,
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


/** Renderer-neutral joint sample emitted by the NK1 motor controller. */
export interface MotorJointFrameV1 {
  id: string;
  angleRad: number;
  targetAngleRad: number;
  velocityRadPerSec: number;
  available: boolean;
}
export interface MotorFrameV1 {
  version: 1;
  goalId: string | null;
  phase: "idle" | "moving" | "holding" | "rejected" | "expired";
  joints: Record<string, MotorJointFrameV1>;
}
export interface DepthRigJointBinding {
  nodeId: string;
  jointId: string;
  /** Motor angle corresponding to the artwork node's authored rest pose. */
  restAngleRad?: number;
  /** Optional sign/magnitude calibration; defaults to radians -> degrees. */
  degreesPerRadian?: number;
  /** Hard safety envelope for one bound node. Defaults to 45 degrees. */
  maxAbsDegrees?: number;
}

/**
 * Apply a motor-controller frame to explicitly bound rig nodes. The mapping is
 * data-driven because a motor skeleton and an artwork hierarchy are different
 * coordinate systems; IDs are never guessed from names. Only active goals move
 * the puppet, unavailable/missing joints are ignored, and every delta is bounded.
 */
export function resolveDepthRigPoseFromMotorFrame(
  rig: DepthRigDefinition,
  frame: MotorFrameV1,
  bindings: readonly DepthRigJointBinding[],
): DepthRigPose {
  if (!frame || frame.version !== 1 || !frame.joints || typeof frame.joints !== "object" || Array.isArray(frame.joints)
    || !["idle", "moving", "holding", "rejected", "expired"].includes(frame.phase)
    || !Array.isArray(bindings)) {
    throw new Error("Invalid motor frame v1 payload.");
  }
  const nodes = new Set(orderDepthRigNodes(rig).map((node) => node.id));
  const seenNodes = new Set<string>();
  const deltas: Record<string, { rotation: number }> = {};
  if (frame.goalId === null || frame.phase === "idle" || frame.phase === "rejected" || frame.phase === "expired") {
    return { rigId: rig.id, deltas };
  }
  for (const binding of bindings) {
    if (!binding || !nodes.has(binding.nodeId) || seenNodes.has(binding.nodeId)
      || typeof binding.jointId !== "string" || !binding.jointId.trim()) {
      throw new Error("Invalid or duplicate depth-rig joint binding.");
    }
    seenNodes.add(binding.nodeId);
    const rest = binding.restAngleRad ?? 0;
    const degreesPerRadian = binding.degreesPerRadian ?? (180 / Math.PI);
    const maxAbs = binding.maxAbsDegrees ?? 45;
    if (![rest, degreesPerRadian, maxAbs].every(Number.isFinite) || degreesPerRadian === 0 || maxAbs <= 0 || maxAbs > 90) {
      throw new Error("Invalid depth-rig joint calibration.");
    }
    const joint = frame.joints[binding.jointId];
    if (!joint || joint.id !== binding.jointId || joint.available !== true || !Number.isFinite(joint.targetAngleRad)) continue;
    const delta = clamp((joint.targetAngleRad - rest) * degreesPerRadian, -maxAbs, maxAbs);
    deltas[binding.nodeId] = { rotation: delta };
  }
  return { rigId: rig.id, deltas };
}
