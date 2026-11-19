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

/**
 * Snapshot only plain own data properties. Accessors are rejected without invocation;
 * Proxy reflection traps are caught at the boundary and converted to invalid input.
 */
function snapshotDataRecord(value: unknown, maxKeys: number): Record<string, unknown> | null {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length > maxKeys) return null;
    const snapshot: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      if (typeof key !== "string") return null;
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) return null;
      snapshot[key] = descriptor.value;
    }
    return snapshot;
  } catch {
    return null;
  }
}

/** Copy a dense, ordinary array without reading accessor-backed elements. */
function snapshotDataArray(value: unknown, maxLength: number): unknown[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value) as unknown as Record<string, PropertyDescriptor>;
    const lengthDescriptor = descriptors["length"];
    const length = lengthDescriptor?.value;
    if (!lengthDescriptor || !("value" in lengthDescriptor) || !Number.isSafeInteger(length)
      || length < 0 || length > maxLength || Reflect.ownKeys(descriptors).length !== length + 1) return null;
    const snapshot: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) return null;
      snapshot.push(descriptor.value);
    }
    return snapshot;
  } catch {
    return null;
  }
}

function snapshotMotorFrame(value: unknown): MotorFrameSample | null {
  const frame = snapshotDataRecord(value, 16);
  if (!frame) return null;
  const rawJoints = snapshotDataRecord(frame.joints, 128);
  const reached = snapshotDataArray(frame.reachedJointIds, 128);
  const blocked = snapshotDataArray(frame.blockedJointIds, 128);
  if (!rawJoints || !reached || !blocked) return null;

  const joints: Record<string, MotorFrameJointSample> = Object.create(null);
  for (const [id, rawJoint] of Object.entries(rawJoints)) {
    const joint = snapshotDataRecord(rawJoint, 8);
    if (!joint) return null;
    joints[id] = joint as unknown as MotorFrameJointSample;
  }
  return {
    ...frame,
    joints,
    reachedJointIds: reached as string[],
    blockedJointIds: blocked as string[],
  } as unknown as MotorFrameSample;
}

function snapshotMappingProfile(value: unknown): MotorFrameMappingProfile | null {
  const profile = snapshotDataRecord(value, 4);
  if (!profile) return null;
  const rawMappings = snapshotDataArray(profile.mappings, 128);
  if (!rawMappings) return null;
  const mappings: MotorJointChannelCalibration[] = [];
  for (const rawMapping of rawMappings) {
    const mapping = snapshotDataRecord(rawMapping, 8);
    if (!mapping) return null;
    mappings.push(mapping as unknown as MotorJointChannelCalibration);
  }
  return { ...profile, mappings } as unknown as MotorFrameMappingProfile;
}

const validJointIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length <= 128
    && value.every((id) => typeof id === "string" && /^[a-z][a-z0-9._-]{0,63}$/i.test(id))
    && new Set(value).size === value.length;

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
      || mapping.scale === 0 || mapping.min < -1 || mapping.max > 1
      || mapping.min > mapping.max) return false;
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
    || typeof frame.reason !== "string" || frame.reason.length > 256
    || !validJointIdList(frame.reachedJointIds) || !validJointIdList(frame.blockedJointIds)
    || !frame.joints || typeof frame.joints !== "object"
    || Array.isArray(frame.joints) || Object.keys(frame.joints).length > 128) return false;
  const jointIds = new Set(Object.keys(frame.joints));
  for (const [id, joint] of Object.entries(frame.joints)) {
    if (!/^[a-z][a-z0-9._-]{0,63}$/i.test(id) || !joint || joint.id !== id
      || typeof joint.available !== "boolean"
      || ![joint.angleRad, joint.targetAngleRad, joint.velocityRadPerSec, joint.accelerationRadPerSec2].every(Number.isFinite)) return false;
  }

  // Status lists are references into this exact frame, not free-form diagnostics.
  // Reject dangling references and contradictory reached+blocked state before any pose is emitted.
  const reached = new Set(frame.reachedJointIds);
  for (const jointId of reached) {
    if (!jointIds.has(jointId) || frame.blockedJointIds.includes(jointId)) return false;
  }
  for (const jointId of frame.blockedJointIds) {
    if (!jointIds.has(jointId)) return false;
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
  const safeFrame = snapshotMotorFrame(frame);
  if (!safeFrame || !validFrame(safeFrame)) return rejected("invalid-motor-frame");
  const safeProfile = snapshotMappingProfile(profile);
  if (!safeProfile || !validProfile(safeProfile)) return rejected("invalid-motor-mapping-profile");
  if (safeFrame.phase === "rejected" || safeFrame.phase === "expired") return rejected("motor-frame-not-executable");

  const safeOptions = snapshotDataRecord(options, 3);
  if (!safeOptions) return rejected("invalid-motor-frame-options");
  let previous: MotorFrameCursor | null = null;
  if (safeOptions.previous !== undefined && safeOptions.previous !== null) {
    const cursor = snapshotDataRecord(safeOptions.previous, 2);
    if (!cursor || !Number.isSafeInteger(cursor.tick) || (cursor.tick as number) < 0
      || !Number.isFinite(cursor.atMs) || (cursor.atMs as number) < 0) {
      return rejected("invalid-motor-frame-cursor");
    }
    previous = cursor as unknown as MotorFrameCursor;
  }
  if (previous && (safeFrame.tick <= previous.tick || safeFrame.atMs < previous.atMs)) {
    return rejected("stale-or-rewound-motor-frame");
  }
  if (safeOptions.nowMs !== undefined || safeOptions.maxAgeMs !== undefined) {
    if (!Number.isFinite(safeOptions.nowMs) || !Number.isFinite(safeOptions.maxAgeMs)
      || (safeOptions.maxAgeMs as number) < 0 || (safeOptions.nowMs as number) < safeFrame.atMs
      || (safeOptions.nowMs as number) - safeFrame.atMs > (safeOptions.maxAgeMs as number)) {
      return rejected("stale-motor-frame");
    }
  }

  const pose: Partial<Record<BodyChannel, number>> = {};
  const mappedJointIds: string[] = [];
  const unavailableJointIds: string[] = [];
  const unmappedJointIds: string[] = [];
  const byJoint = new Map(safeProfile.mappings.map((mapping) => [mapping.jointId, mapping]));
  for (const [jointId, joint] of Object.entries(safeFrame.joints)) {
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
    cursor: { tick: safeFrame.tick, atMs: safeFrame.atMs },
    pose, mappedJointIds, unavailableJointIds, unmappedJointIds,
    rendererPoseVerified: false,
  };
}
