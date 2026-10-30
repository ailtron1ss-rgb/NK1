import type { MutableEulerLike, VrmArmBoneMap, ArmSide, AxisCalibration } from "./vrmHumanoidRigAdapter";
import { calibrateVrmArmFromMeasurement, validateVrmRigCalibrationProfile, type VrmArmCalibrationMeasurement, type VrmRigCalibrationContext, type VrmRigCalibrationProfile, type VrmRigCalibrationResult } from "./vrmRigCalibrationProfile";

type Rotation = Readonly<{ x: number; y: number; z: number }>;
type ArmCapture = Readonly<{ shoulder: Rotation; elbow: Rotation }>;
type BilateralCapture = Readonly<{ left: ArmCapture; right: ArmCapture }>;

export interface VrmRigCalibrationSession {
  readonly schemaVersion: 1;
  readonly modelFingerprint: string;
  readonly coordinateFrameId: string;
  readonly modelName: string;
  readonly createdAt: string;
  readonly boneNames: Readonly<Record<ArmSide, Readonly<{ shoulder: string; elbow: string }>>>;
  readonly bindPose: BilateralCapture;
  readonly referencePose: BilateralCapture | null;
  readonly reference: Readonly<{ fixtureId: string; capturedAt: string; operatorNote: string }> | null;
}

export interface VrmArmCalibrationControls {
  readonly shoulderAxis: "x" | "y" | "z";
  readonly elbowAxis: "x" | "y" | "z";
  readonly shoulderSign: 1 | -1;
  readonly elbowSign: 1 | -1;
  readonly referenceShoulderAngleRad: number;
  readonly referenceElbowAngleRad: number;
  readonly shoulderMinRad: number;
  readonly shoulderMaxRad: number;
  readonly elbowMinRad: number;
  readonly elbowMaxRad: number;
}
export type VrmRigCalibrationSessionResult =
  | { readonly accepted: true; readonly session: VrmRigCalibrationSession }
  | { readonly accepted: false; readonly reason: "invalid-context" | "invalid-timestamp" | "rig-changed" | "invalid-fixture" | "reference-not-captured" | "invalid-measurement" | "invalid-calibration" };

const validRotation = (r: MutableEulerLike | undefined): r is MutableEulerLike =>
  !!r && [r.x, r.y, r.z].every(Number.isFinite);
const snapshot = (map: VrmArmBoneMap): ArmCapture | null => {
  if (!validRotation(map?.shoulder?.rotation) || !validRotation(map?.elbow?.rotation)) return null;
  return Object.freeze({
    shoulder: Object.freeze({ x: map.shoulder.rotation.x, y: map.shoulder.rotation.y, z: map.shoulder.rotation.z }),
    elbow: Object.freeze({ x: map.elbow.rotation.x, y: map.elbow.rotation.y, z: map.elbow.rotation.z }),
  });
};
const isoTime = (value: string) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

function matchesContext(session: VrmRigCalibrationSession, context: VrmRigCalibrationContext): boolean {
  if (session.modelFingerprint !== context.modelFingerprint || session.coordinateFrameId !== context.coordinateFrameId) return false;
  for (const side of ["left", "right"] as const) {
    const map = context[side], names = session.boneNames[side];
    if (!map || map.shoulder.name !== names.shoulder || map.elbow.name !== names.elbow) return false;
  }
  return true;
}

/** Start an immutable capture session from the exact loaded bilateral rig and its current bind pose. */
export function createVrmRigCalibrationSession(
  context: VrmRigCalibrationContext,
  modelName: string,
  createdAt = new Date().toISOString(),
): VrmRigCalibrationSessionResult {
  if (!context?.left || !context?.right || !context.modelFingerprint?.trim() || !context.coordinateFrameId?.trim()
    || !modelName?.trim()) return { accepted: false, reason: "invalid-context" };
  if (!isoTime(createdAt)) return { accepted: false, reason: "invalid-timestamp" };
  const left = snapshot(context.left), right = snapshot(context.right);
  if (!left || !right || !context.left.shoulder.name || !context.left.elbow.name || !context.right.shoulder.name || !context.right.elbow.name) {
    return { accepted: false, reason: "invalid-context" };
  }
  const session: VrmRigCalibrationSession = Object.freeze({
    schemaVersion: 1,
    modelFingerprint: context.modelFingerprint,
    coordinateFrameId: context.coordinateFrameId,
    modelName: modelName.trim().slice(0, 180),
    createdAt,
    boneNames: Object.freeze({
      left: Object.freeze({ shoulder: context.left.shoulder.name, elbow: context.left.elbow.name }),
      right: Object.freeze({ shoulder: context.right.shoulder.name, elbow: context.right.elbow.name }),
    }),
    bindPose: Object.freeze({ left, right }),
    referencePose: null,
    reference: null,
  });
  return { accepted: true, session };
}

/** Capture the manually posed reference state; fixture identity and timestamp become audit provenance. */
export function captureVrmRigReferencePose(
  session: VrmRigCalibrationSession,
  context: VrmRigCalibrationContext,
  fixtureId: string,
  capturedAt = new Date().toISOString(),
  operatorNote = "",
): VrmRigCalibrationSessionResult {
  if (!session || !matchesContext(session, context)) return { accepted: false, reason: "rig-changed" };
  if (!fixtureId?.trim() || fixtureId.trim().length > 120 || operatorNote.length > 500) return { accepted: false, reason: "invalid-fixture" };
  if (!isoTime(capturedAt) || capturedAt < session.createdAt) return { accepted: false, reason: "invalid-timestamp" };
  const left = snapshot(context.left!), right = snapshot(context.right!);
  if (!left || !right) return { accepted: false, reason: "invalid-context" };
  return {
    accepted: true,
    session: Object.freeze({
      ...session,
      referencePose: Object.freeze({ left, right }),
      reference: Object.freeze({ fixtureId: fixtureId.trim(), capturedAt, operatorNote: operatorNote.trim() }),
    }),
  };
}

function toMeasurement(bind: ArmCapture, observed: ArmCapture, controls: VrmArmCalibrationControls): VrmArmCalibrationMeasurement {
  return {
    shoulderAxis: controls.shoulderAxis, elbowAxis: controls.elbowAxis,
    shoulderSign: controls.shoulderSign, elbowSign: controls.elbowSign,
    bindShoulder: bind.shoulder, bindElbow: bind.elbow,
    observedShoulder: observed.shoulder, observedElbow: observed.elbow,
    referenceShoulderAngleRad: controls.referenceShoulderAngleRad,
    referenceElbowAngleRad: controls.referenceElbowAngleRad,
    shoulderMinRad: controls.shoulderMinRad, shoulderMaxRad: controls.shoulderMaxRad,
    elbowMinRad: controls.elbowMinRad, elbowMaxRad: controls.elbowMaxRad,
  };
}

/** Finalize only after a reference pose exists and both measured arms pass the same numeric calibration gate. */
export function finalizeVrmRigCalibrationSession(
  session: VrmRigCalibrationSession,
  context: VrmRigCalibrationContext,
  controls: Readonly<{ left: VrmArmCalibrationControls; right: VrmArmCalibrationControls }>,
): VrmRigCalibrationResult {
  if (!session?.referencePose || !session.reference) return { accepted: false, reason: "invalid-profile" };
  if (!matchesContext(session, context)) return { accepted: false, reason: "model-fingerprint-mismatch" };
  const left = calibrateVrmArmFromMeasurement(toMeasurement(session.bindPose.left, session.referencePose.left, controls.left));
  const right = calibrateVrmArmFromMeasurement(toMeasurement(session.bindPose.right, session.referencePose.right, controls.right));
  if (!left.accepted || !right.accepted) return { accepted: false, reason: "invalid-calibration" };
  const makeArm = (side: ArmSide, calibration: AxisCalibration) => ({
    ...calibration,
    shoulderBoneName: session.boneNames[side].shoulder,
    elbowBoneName: session.boneNames[side].elbow,
  });
  const candidate: VrmRigCalibrationProfile = {
    schemaVersion: 1,
    modelFingerprint: session.modelFingerprint,
    coordinateFrameId: session.coordinateFrameId,
    calibrationMethod: "manual-measured",
    left: makeArm("left", left.calibration),
    right: makeArm("right", right.calibration),
  };
  const validated = validateVrmRigCalibrationProfile(candidate, context);
  return validated.accepted ? validated : { accepted: false, reason: "invalid-calibration" };
}

/** JSON sidecar preserves capture provenance alongside the separately validated runtime profile. */
export function serializeVrmRigCalibrationSession(session: VrmRigCalibrationSession): string {
  return JSON.stringify(session, null, 2);
}
