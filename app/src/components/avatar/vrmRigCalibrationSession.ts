import type { MutableEulerLike, VrmArmBoneMap, ArmSide, AxisCalibration } from "./vrmHumanoidRigAdapter";
import { calibrateVrmArmFromMeasurement, validateVrmRigCalibrationProfile, type VrmArmCalibrationMeasurement, type VrmRigCalibrationContext, type VrmRigCalibrationProfile, type VrmRigCalibrationResult } from "./vrmRigCalibrationProfile.ts";

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

export interface VrmRigCalibrationBundle {
  readonly schemaVersion: 1;
  readonly profile: VrmRigCalibrationProfile;
  readonly session: VrmRigCalibrationSession;
}
export type VrmRigCalibrationBundleResult =
  | { readonly accepted: true; readonly bundle: VrmRigCalibrationBundle }
  | { readonly accepted: false; readonly reason: "invalid-bundle" | "invalid-session" | "invalid-profile" | "profile-session-mismatch" | "measurement-provenance-required" };

function validRotationSnapshot(raw: unknown): raw is Rotation {
  if (!raw || typeof raw !== "object") return false;
  const value = raw as Record<string, unknown>;
  return [value.x, value.y, value.z].every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= Math.PI * 2 + 1e-3);
}
function validArmCapture(raw: unknown): raw is ArmCapture {
  if (!raw || typeof raw !== "object") return false;
  const capture = raw as Record<string, unknown>;
  return validRotationSnapshot(capture.shoulder) && validRotationSnapshot(capture.elbow);
}

/** Validate a persisted measurement session against the exact currently loaded model and bilateral rig. */
export function validateVrmRigCalibrationSession(
  raw: unknown,
  context: VrmRigCalibrationContext,
): VrmRigCalibrationSessionResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { accepted: false, reason: "invalid-context" };
  const candidate = raw as Record<string, unknown>;
  if (candidate.schemaVersion !== 1 || typeof candidate.modelFingerprint !== "string"
    || typeof candidate.coordinateFrameId !== "string" || typeof candidate.modelName !== "string"
    || !candidate.modelName.trim() || candidate.modelName.length > 180
    || typeof candidate.createdAt !== "string" || !isoTime(candidate.createdAt)) {
    return { accepted: false, reason: "invalid-context" };
  }
  if (candidate.modelFingerprint !== context.modelFingerprint || candidate.coordinateFrameId !== context.coordinateFrameId) {
    return { accepted: false, reason: "rig-changed" };
  }
  const boneNames = candidate.boneNames as Record<string, unknown> | undefined;
  if (!boneNames || !context.left || !context.right) return { accepted: false, reason: "invalid-context" };
  const leftNames = boneNames.left as Record<string, unknown> | undefined;
  const rightNames = boneNames.right as Record<string, unknown> | undefined;
  if (!leftNames || !rightNames
    || leftNames.shoulder !== context.left.shoulder.name || leftNames.elbow !== context.left.elbow.name
    || rightNames.shoulder !== context.right.shoulder.name || rightNames.elbow !== context.right.elbow.name) {
    return { accepted: false, reason: "rig-changed" };
  }
  const bindPose = candidate.bindPose as Record<string, unknown> | undefined;
  const referencePose = candidate.referencePose as Record<string, unknown> | null | undefined;
  const reference = candidate.reference as Record<string, unknown> | null | undefined;
  if (!bindPose || !validArmCapture(bindPose.left) || !validArmCapture(bindPose.right)
    || !referencePose || !validArmCapture(referencePose.left) || !validArmCapture(referencePose.right)
    || !reference || typeof reference.fixtureId !== "string" || !reference.fixtureId.trim()
    || reference.fixtureId.length > 120 || typeof reference.capturedAt !== "string"
    || !isoTime(reference.capturedAt) || reference.capturedAt < candidate.createdAt
    || typeof reference.operatorNote !== "string" || reference.operatorNote.length > 500) {
    return { accepted: false, reason: "reference-not-captured" };
  }
  const freezeCapture = (capture: ArmCapture): ArmCapture => Object.freeze({
    shoulder: Object.freeze({ ...capture.shoulder }),
    elbow: Object.freeze({ ...capture.elbow }),
  });
  const session: VrmRigCalibrationSession = Object.freeze({
    schemaVersion: 1,
    modelFingerprint: candidate.modelFingerprint,
    coordinateFrameId: candidate.coordinateFrameId,
    modelName: candidate.modelName.trim(),
    createdAt: candidate.createdAt,
    boneNames: Object.freeze({
      left: Object.freeze({ shoulder: String(leftNames.shoulder), elbow: String(leftNames.elbow) }),
      right: Object.freeze({ shoulder: String(rightNames.shoulder), elbow: String(rightNames.elbow) }),
    }),
    bindPose: Object.freeze({
      left: freezeCapture(bindPose.left as ArmCapture),
      right: freezeCapture(bindPose.right as ArmCapture),
    }),
    referencePose: Object.freeze({
      left: freezeCapture(referencePose.left as ArmCapture),
      right: freezeCapture(referencePose.right as ArmCapture),
    }),
    reference: Object.freeze({
      fixtureId: reference.fixtureId.trim(),
      capturedAt: reference.capturedAt,
      operatorNote: reference.operatorNote.trim(),
    }),
  });
  return { accepted: true, session };
}

/** Parse a measurement + profile bundle; identity and measured-fixture provenance are both mandatory. */
export function parseVrmRigCalibrationBundleJson(
  json: string,
  context: VrmRigCalibrationContext,
): VrmRigCalibrationBundleResult {
  if (typeof json !== "string" || json.length === 0 || json.length > 65_536) {
    return { accepted: false, reason: "invalid-bundle" };
  }
  try {
    const raw: unknown = JSON.parse(json);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { accepted: false, reason: "invalid-bundle" };
    const value = raw as Record<string, unknown>;
    if (value.schemaVersion !== 1) return { accepted: false, reason: "invalid-bundle" };
    const sessionResult = validateVrmRigCalibrationSession(value.session, context);
    if (!sessionResult.accepted) return { accepted: false, reason: "invalid-session" };
    const profileResult = validateVrmRigCalibrationProfile(value.profile, context);
    if (!profileResult.accepted) return { accepted: false, reason: "invalid-profile" };
    if (profileResult.profile.calibrationMethod !== "manual-measured") {
      return { accepted: false, reason: "measurement-provenance-required" };
    }
    const profile = profileResult.profile, session = sessionResult.session;
    if (profile.modelFingerprint !== session.modelFingerprint
      || profile.coordinateFrameId !== session.coordinateFrameId
      || profile.left.shoulderBoneName !== session.boneNames.left.shoulder
      || profile.left.elbowBoneName !== session.boneNames.left.elbow
      || profile.right.shoulderBoneName !== session.boneNames.right.shoulder
      || profile.right.elbowBoneName !== session.boneNames.right.elbow) {
      return { accepted: false, reason: "profile-session-mismatch" };
    }
    return { accepted: true, bundle: Object.freeze({ schemaVersion: 1, profile, session }) };
  } catch {
    return { accepted: false, reason: "invalid-bundle" };
  }
}

/** Export a bundle only while both the measured session and profile still match the loaded model. */
export function serializeVrmRigCalibrationBundleJson(
  profile: VrmRigCalibrationProfile,
  session: VrmRigCalibrationSession,
  context: VrmRigCalibrationContext,
): string | null {
  const sessionResult = validateVrmRigCalibrationSession(session, context);
  const profileResult = validateVrmRigCalibrationProfile(profile, context);
  if (!sessionResult.accepted || !profileResult.accepted
    || profileResult.profile.calibrationMethod !== "manual-measured") return null;
  const parsed = parseVrmRigCalibrationBundleJson(JSON.stringify({
    schemaVersion: 1, profile: profileResult.profile, session: sessionResult.session,
  }), context);
  return parsed.accepted ? JSON.stringify({
    schemaVersion: 1,
    profile: parsed.bundle.profile,
    session: parsed.bundle.session,
  }, null, 2) : null;
}
