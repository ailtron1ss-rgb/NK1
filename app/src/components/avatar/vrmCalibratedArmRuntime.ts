import {
  applyVrmArmPose,
  captureVrmArmBindPose,
  computeVrmArmPose,
  type VrmArmBindPose,
  type VrmArmChainMap,
  type VrmArmPose,
  type ArmSide,
} from "./vrmHumanoidRigAdapter";
import { solvePlanarArmIK } from "./planarArmIK";
import {
  getVrmArmCalibration,
  validateVrmRigCalibrationProfile,
  type VrmRigCalibrationContext,
  type VrmRigCalibrationProfile,
} from "./vrmRigCalibrationProfile";

export interface VrmArmPoint3 { x: number; y: number; z: number; }
export interface VrmArmRuntimeBinding {
  readonly side: ArmSide;
  readonly map: VrmArmChainMap;
  readonly bindPose: VrmArmBindPose;
  readonly coordinateFrameId: string;
  readonly shoulder: Readonly<{ x: number; y: number }>;
  readonly upperArmLengthM: number;
  readonly forearmLengthM: number;
}
export type VrmArmRuntimeBindingResult =
  | { accepted: true; binding: VrmArmRuntimeBinding }
  | { accepted: false; reason: "invalid-coordinate-frame" | "invalid-bind-pose" | "invalid-segment-length" | "off-plane-rig" };
export type VrmArmGestureAction = "respond" | "explore" | "verify" | "reflect" | "wait" | "rest";
export interface VrmArmGestureState {
  readonly action: VrmArmGestureAction;
  readonly emotion: string;
  readonly speaking: boolean;
  readonly awake: boolean;
  readonly uncertainty: number;
  readonly cognitiveLoad: number;
}
export type VrmArmGestureResult =
  | { accepted: true; pose: VrmArmPose; target: Readonly<{ x: number; y: number }>; reachRatio: number }
  | { accepted: false; reason: string };

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const distance = (a: VrmArmPoint3, b: VrmArmPoint3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * Prepare a per-model arm runtime binding from measured positions in the exact
 * avatar-root coordinate frame. Segment lengths are kept in source-model metres,
 * not renderer-scaled world units.
 */
export function prepareVrmArmRuntimeBinding(
  side: ArmSide,
  map: VrmArmChainMap,
  points: Readonly<{ shoulder: VrmArmPoint3; elbow: VrmArmPoint3; hand: VrmArmPoint3 }>,
  coordinateFrameId: string,
): VrmArmRuntimeBindingResult {
  if (typeof coordinateFrameId !== "string" || !/^[a-z0-9][a-z0-9._:-]{1,127}$/i.test(coordinateFrameId)) {
    return { accepted: false, reason: "invalid-coordinate-frame" };
  }
  if (!map?.shoulder?.rotation || !map?.elbow?.rotation || !map?.hand?.rotation
    || !map.shoulder.name || !map.elbow.name || !map.hand.name
    || ![points?.shoulder, points?.elbow, points?.hand].every((p) => p && [p.x, p.y, p.z].every(finite))) {
    return { accepted: false, reason: "invalid-bind-pose" };
  }
  const upperArmLengthM = distance(points.shoulder, points.elbow);
  const forearmLengthM = distance(points.elbow, points.hand);
  if (!finite(upperArmLengthM) || !finite(forearmLengthM)
    || upperArmLengthM < 0.04 || upperArmLengthM > 1.2
    || forearmLengthM < 0.04 || forearmLengthM > 1.2) {
    return { accepted: false, reason: "invalid-segment-length" };
  }
  const upperDz = Math.abs(points.shoulder.z - points.elbow.z);
  const forearmDz = Math.abs(points.elbow.z - points.hand.z);
  if (upperDz > Math.max(0.12, upperArmLengthM * 0.35)
    || forearmDz > Math.max(0.12, forearmLengthM * 0.35)) {
    return { accepted: false, reason: "off-plane-rig" };
  }
  const bindPose = captureVrmArmBindPose(map);
  if (!bindPose) return { accepted: false, reason: "invalid-bind-pose" };
  return {
    accepted: true,
    binding: Object.freeze({
      side,
      map,
      bindPose,
      coordinateFrameId,
      shoulder: Object.freeze({ x: points.shoulder.x, y: points.shoulder.y }),
      upperArmLengthM,
      forearmLengthM,
    }),
  };
}

function gestureTarget(
  binding: VrmArmRuntimeBinding,
  state: VrmArmGestureState,
): Readonly<{ x: number; y: number }> | null {
  if (!state.awake || state.action === "wait" || state.action === "rest") return null;
  const reach = binding.upperArmLengthM + binding.forearmLengthM;
  const inward = binding.side === "right" ? -1 : 1;
  if (state.emotion === "anger" || state.emotion === "frustration") {
    return {
      x: binding.shoulder.x + inward * Math.min(0.20, reach * 0.42),
      y: binding.shoulder.y + Math.min(0.045, reach * 0.10),
    };
  }
  if (state.action === "respond" && state.speaking && binding.side === "right") {
    return {
      x: binding.shoulder.x - Math.min(0.17, reach * 0.34),
      y: binding.shoulder.y + Math.min(0.10, reach * 0.20),
    };
  }
  if (state.action === "explore" && binding.side === "left") {
    return {
      x: binding.shoulder.x - Math.min(0.22, reach * 0.43),
      y: binding.shoulder.y + Math.min(0.08, reach * 0.16),
    };
  }
  if ((state.action === "verify" || state.action === "reflect") && binding.side === "right") {
    return {
      x: binding.shoulder.x - Math.min(0.12, reach * 0.24),
      y: binding.shoulder.y + Math.min(0.24, reach * 0.44),
    };
  }
  return null;
}

/**
 * Convert a small, explicit semantic gesture set into calibrated two-link IK.
 * No target means no guessed movement. Low-confidence or mismatched profiles
 * fail closed; all returned rotations are absolute from the captured bind pose.
 */
export function solveCalibratedVrmArmGesture(
  binding: VrmArmRuntimeBinding,
  profile: VrmRigCalibrationProfile,
  context: VrmRigCalibrationContext,
  state: VrmArmGestureState,
): VrmArmGestureResult {
  const target = gestureTarget(binding, state);
  if (!target) return { accepted: false, reason: "no-calibrated-gesture-requested" };
  const validation = validateVrmRigCalibrationProfile(profile, context);
  if (!validation.accepted) return { accepted: false, reason: validation.reason };
  const sideMap = context[binding.side];
  if (!sideMap || sideMap.shoulder.name !== binding.map.shoulder.name || sideMap.elbow.name !== binding.map.elbow.name) {
    return { accepted: false, reason: "runtime-binding-does-not-match-profile-context" };
  }
  const calibration = getVrmArmCalibration(validation.profile, binding.side);
  const confidence01 = clamp(0.92 - clamp(state.uncertainty, 0, 1) * 0.12
    - clamp(state.cognitiveLoad, 0, 1) * 0.10, 0.65, 0.95);
  const solution = solvePlanarArmIK({
    shoulder: binding.shoulder,
    target,
    upperArmLength: binding.upperArmLengthM,
    forearmLength: binding.forearmLengthM,
    frameId: binding.coordinateFrameId,
    targetFrameId: validation.profile.coordinateFrameId,
    confidence01,
    shoulderLimit: { min: calibration.shoulderMinRad, max: calibration.shoulderMaxRad },
    elbowLimit: { min: calibration.elbowMinRad, max: calibration.elbowMaxRad },
  });
  if (!solution.accepted) return { accepted: false, reason: solution.reason };
  const pose = computeVrmArmPose(binding.map, solution, calibration, binding.bindPose);
  if (!pose) return { accepted: false, reason: "calibrated-vrm-pose-rejected" };
  return { accepted: true, pose, target, reachRatio: solution.reachRatio };
}

export function applyCalibratedVrmArmGesture(
  binding: VrmArmRuntimeBinding,
  profile: VrmRigCalibrationProfile,
  context: VrmRigCalibrationContext,
  state: VrmArmGestureState,
  weight = 0.72,
): VrmArmGestureResult {
  const result = solveCalibratedVrmArmGesture(binding, profile, context, state);
  if (!result.accepted) return result;
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) return { accepted: false, reason: "invalid-pose-blend-weight" };
  if (!applyVrmArmPose(binding.map, result.pose, weight)) return { accepted: false, reason: "calibrated-vrm-pose-application-failed" };
  return result;
}

