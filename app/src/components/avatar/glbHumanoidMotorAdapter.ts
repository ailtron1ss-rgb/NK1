import {
  auditHumanoidRig,
  type HumanoidNodeLike,
  type HumanoidRigAudit,
  type HumanoidRole,
} from "./vrmHumanoidRigAudit.ts";
import type { BodyChannel } from "./embodimentSwitch.ts";

export interface GenericGlbMotorNode extends HumanoidNodeLike {
  readonly isBone: true;
  rotation: { x: number; y: number; z: number };
}

export interface GenericGlbHumanoidRig {
  readonly spine: GenericGlbMotorNode | null;
  readonly leftLowerArm: GenericGlbMotorNode | null;
  readonly rightLowerArm: GenericGlbMotorNode | null;
  readonly leftUpperLeg: GenericGlbMotorNode | null;
  readonly rightUpperLeg: GenericGlbMotorNode | null;
  readonly leftLowerLeg: GenericGlbMotorNode | null;
  readonly rightLowerLeg: GenericGlbMotorNode | null;
}

export interface GenericGlbMotorApplyResult {
  readonly applied: boolean;
  readonly appliedChannels: BodyChannel[];
  readonly unsupportedChannels: BodyChannel[];
  readonly controlledBones: string[];
}

const ROLE_BY_CHANNEL: Readonly<Record<string, { role: HumanoidRole; axis: "x" | "z"; limit: number; boneName: string }>> = Object.freeze({
  torsoPitch: { role: "spine", axis: "x", limit: 0.4, boneName: "spine" },
  leftElbow: { role: "leftLowerArm", axis: "z", limit: 1.4, boneName: "leftLowerArm" },
  rightElbow: { role: "rightLowerArm", axis: "z", limit: 1.4, boneName: "rightLowerArm" },
  leftHip: { role: "leftUpperLeg", axis: "z", limit: 0.8, boneName: "leftUpperLeg" },
  rightHip: { role: "rightUpperLeg", axis: "z", limit: 0.8, boneName: "rightUpperLeg" },
  leftKnee: { role: "leftLowerLeg", axis: "z", limit: 1.4, boneName: "leftLowerLeg" },
  rightKnee: { role: "rightLowerLeg", axis: "z", limit: 1.4, boneName: "rightLowerLeg" },
});

const isMotorNode = (value: HumanoidNodeLike | undefined): value is GenericGlbMotorNode => {
  if (!value || value.isBone !== true) return false;
  const candidate = value as unknown as { rotation?: Record<string, unknown> };
  const rotation = candidate.rotation;
  return Boolean(rotation)
    && ["x", "y", "z"].every((axis) => typeof rotation?.[axis] === "number" && Number.isFinite(rotation[axis]));
};

/**
 * Audit a generic GLB scene while retaining the exact Object3D/Bone references.
 * The returned rig is safe to actuate only when an actual Bone with mutable
 * local rotation survived the conservative name + hierarchy audit.
 */
export function auditGenericGlbHumanoidScene(root: {
  traverse?: (visitor: (node: HumanoidNodeLike) => void) => unknown;
}): HumanoidRigAudit {
  if (!root || typeof root.traverse !== "function") {
    throw new TypeError("generic-glb-scene-traverse-required");
  }
  const nodes: HumanoidNodeLike[] = [];
  root.traverse((node) => {
    if (node && typeof node === "object") nodes.push(node);
  });
  return auditHumanoidRig(nodes);
}

/** Resolve only audited, real Bone objects; wrappers and name-only nodes are rejected. */
export function resolveGenericGlbHumanoidRig(audit: HumanoidRigAudit): GenericGlbHumanoidRig {
  const resolve = (role: HumanoidRole): GenericGlbMotorNode | null => {
    const node = audit?.nodes?.[role];
    return isMotorNode(node) ? node : null;
  };
  return Object.freeze({
    spine: resolve("spine"),
    leftLowerArm: resolve("leftLowerArm"),
    rightLowerArm: resolve("rightLowerArm"),
    leftUpperLeg: resolve("leftUpperLeg"),
    rightUpperLeg: resolve("rightUpperLeg"),
    leftLowerLeg: resolve("leftLowerLeg"),
    rightLowerLeg: resolve("rightLowerLeg"),
  });
}

/**
 * Apply the generic GLB channels owned by NK1's full-body adapter.
 *
 * Values are normalized [-1, 1] inputs converted to bounded radians and added
 * to the current local rotation. Avatar3DStage resets to bind pose, advances any
 * GLB AnimationMixer clip, then calls this adapter once, so the motor is blended
 * over the clip rather than fighting it or accumulating across animation frames.
 * Channels without an audited Bone are reported as unsupported, never claimed.
 */
export function applyGenericGlbFullBodyChannels(
  rig: GenericGlbHumanoidRig,
  channels: Readonly<Partial<Record<BodyChannel, number>>>,
): GenericGlbMotorApplyResult {
  const appliedChannels: BodyChannel[] = [];
  const unsupportedChannels: BodyChannel[] = [];
  const controlledBones: string[] = [];

  for (const [channel, mapping] of Object.entries(ROLE_BY_CHANNEL) as [
    BodyChannel,
    (typeof ROLE_BY_CHANNEL)[string],
  ][]) {
    const raw = channels?.[channel];
    if (raw === undefined) continue;
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      unsupportedChannels.push(channel);
      continue;
    }
    const node = rig?.[mapping.role as keyof GenericGlbHumanoidRig] as GenericGlbMotorNode | null | undefined;
    if (!isMotorNode(node)) {
      unsupportedChannels.push(channel);
      continue;
    }
    const normalized = Math.max(-1, Math.min(1, raw));
    const delta = normalized * mapping.limit;
    node.rotation[mapping.axis] += delta;
    appliedChannels.push(channel);
    controlledBones.push(mapping.boneName);
  }

  return {
    applied: appliedChannels.length > 0,
    appliedChannels,
    unsupportedChannels,
    controlledBones,
  };
}
