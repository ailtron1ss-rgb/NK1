/**
 * Explicitly calibrated bridge from organism motor frames to semantic body pose.
 *
 * This is a transport/mapping boundary only: it consumes measured joint angles,
 * never target angles, and does not claim that any renderer applied or displayed
 * the pose. A renderer adapter must still perform its own readback verification.
 */
import type { BodyChannel } from "./embodimentSwitch.ts";

export interface MotorFrameJointSample {
  id: string;
  angleRad: number;
  targetAngleRad: number;
  velocityRadPerSec: number;
  accelerationRadPerSec2: number;
  available: boolean;
}

export interface MotorFrameSample {
  version: 1;
  tick: number;
  atMs: number;
  goalId: string | null;
  action: string;
  phase: "idle" | "moving" | "holding" | "rejected" | "expired";
  joints: Record<string, MotorFrameJointSample>;
  reachedJointIds: string[];
  blockedJointIds: string[];
  completion01: number;
  reason: string;
}

export interface MotorJointChannelCalibration {
  jointId: string;
  channel: BodyChannel;
  /** Converts source radians into the semantic channel's calibrated unit. */
  scale: number;
  offset: number;
  min: number;
  max: number;
}

export interface MotorFrameMappingProfile {
  schemaVersion: 1;
  calibrationId: string;
  mappings: readonly MotorJointChannelCalibration[];
}

export interface MotorFrameCursor {
  tick: number;
  atMs: number;
}

export interface MotorFrameMappingOptions {
  nowMs?: number;
  maxAgeMs?: number;
  previous?: MotorFrameCursor | null;
}

export interface MotorFrameMappingResult {
  accepted: boolean;
  reason: string;
  cursor: MotorFrameCursor | null;
  pose: Partial<Record<BodyChannel, number>>;
  mappedJointIds: string[];
  unavailableJointIds: string[];
  unmappedJointIds: string[];
  /** Always false: mapping is not renderer presentation evidence. */
  rendererPoseVerified: false;
}

const CHANNELS = new Set<BodyChannel>([
  "headYaw", "headPitch", "headRoll", "torsoYaw", "torsoPitch",
  "leftShoulder", "leftElbow", "leftWrist", "rightShoulder", "rightElbow", "rightWrist",
  "leftHip", "leftKnee", "leftAnkle", "rightHip", "rightKnee", "rightAnkle",
  "leftHand", "rightHand", "leftFingers", "rightFingers", "gazeX", "gazeY", "breath", "rootYaw",
]);

const rejected = (reason: string): MotorFrameMappingResult => ({
  accepted: false, reason, cursor: null, pose: {}, mappedJointIds: [],
  unavailableJointIds: [], unmappedJointIds: [], rendererPoseVerified: false,
});

function validProfile(profile: MotorFrameMappingProfile): boolean {
  if (!profile || profile.schemaVersion !== 1 || typeof profile.calibrationId !== "string"
    || !profile.calibrationId.trim() || profile.calibrationId.length > 128
    || !Array.isArray(profile.mappings) || profile.mappings.length > 128) return false;
  const joints = new Set<string>();
  const channels = new Set<BodyChannel>();
  for (const mapping of profile.mappings) {
    if (!mapping || typeof mapping.jointId !== "string"
      || !/^[a-z][a-z0-9._-]{0,63}$/i.test(mapping.jointId)
      || !CHANNELS.has(mapping.channel) || joints.has(mapping.jointId) || channels.has(mapping.channel)
      || ![mapping.scale, mapping.offset, mapping.min, mapping.max].every(Number.isFinite)
      || mapping.scale === 0 || mapping.min > mapping.max) return false;
    joints.add(mapping.jointId);
    channels.add(mapping.channel);
  }
  return true;
}

function validFrame(frame: MotorFrameSample): boolean {
  if (!frame || frame.version !== 1 || !Number.isSafeInteger(frame.tick) || frame.tick < 0
    || !Number.isFinite(frame.atMs) || frame.atMs < 0
    || !(frame.goalId === null || (typeof frame.goalId === "string" && frame.goalId.length <= 128))
    || typeof frame.action !== "string" || frame.action.length > 160
    || !["idle", "moving", "holding", "rejected", "expired"].includes(frame.phase)
    || !Number.isFinite(frame.completion01) || frame.completion01 < 0 || frame.completion01 > 1
    || typeof frame.reason !== "string" || !frame.joints || typeof frame.joints !== "object"
    || Array.isArray(frame.joints) || Object.keys(frame.joints).length > 128) return false;
  for (const [id, joint] of Object.entries(frame.joints)) {
    if (!/^[a-z][a-z0-9._-]{0,63}$/i.test(id) || !joint || joint.id !== id
      || typeof joint.available !== "boolean"
      || ![joint.angleRad, joint.targetAngleRad, joint.velocityRadPerSec, joint.accelerationRadPerSec2].every(Number.isFinite)) return false;
  }
  return true;
}

/**
 * Convert one fresh, monotonic motor frame through an explicit calibration map.
 * The caller owns cursor persistence and must not treat this as visual evidence.
 */
export function mapMotorFrameToSemanticPose(
  frame: MotorFrameSample,
  profile: MotorFrameMappingProfile,
  options: MotorFrameMappingOptions = {},
): MotorFrameMappingResult {
  if (!validFrame(frame)) return rejected("invalid-motor-frame");
  if (!validProfile(profile)) return rejected("invalid-motor-mapping-profile");
  if (frame.phase === "rejected" || frame.phase === "expired") return rejected("motor-frame-not-executable");
  if (options.previous && (!Number.isSafeInteger(options.previous.tick) || !Number.isFinite(options.previous.atMs))) {
    return rejected("invalid-motor-frame-cursor");
  }
  if (options.previous && (frame.tick <= options.previous.tick || frame.atMs < options.previous.atMs)) {
    return rejected("stale-or-rewound-motor-frame");
  }
  if (options.nowMs !== undefined || options.maxAgeMs !== undefined) {
    if (!Number.isFinite(options.nowMs) || !Number.isFinite(options.maxAgeMs)
      || (options.maxAgeMs as number) < 0 || (options.nowMs as number) < frame.atMs
      || (options.nowMs as number) - frame.atMs > (options.maxAgeMs as number)) {
      return rejected("stale-motor-frame");
    }
  }

  const pose: Partial<Record<BodyChannel, number>> = {};
  const mappedJointIds: string[] = [];
  const unavailableJointIds: string[] = [];
  const unmappedJointIds: string[] = [];
  const byJoint = new Map(profile.mappings.map((mapping) => [mapping.jointId, mapping]));
  for (const [jointId, joint] of Object.entries(frame.joints)) {
    const mapping = byJoint.get(jointId);
    if (!mapping) { unmappedJointIds.push(jointId); continue; }
    if (!joint.available) { unavailableJointIds.push(jointId); continue; }
    // angleRad is the controller's current state; targetAngleRad is only intent.
    const calibrated = joint.angleRad * mapping.scale + mapping.offset;
    if (!Number.isFinite(calibrated)) return rejected("non-finite-calibrated-joint-angle");
    pose[mapping.channel] = Math.max(mapping.min, Math.min(mapping.max, calibrated));
    mappedJointIds.push(jointId);
  }
  return {
    accepted: true,
    reason: mappedJointIds.length ? "motor-frame-mapped" : "motor-frame-has-no-calibrated-joints",
    cursor: { tick: frame.tick, atMs: frame.atMs },
    pose, mappedJointIds, unavailableJointIds, unmappedJointIds,
    rendererPoseVerified: false,
  };
}
