import type { AxisCalibration, ArmSide, VrmArmBoneMap } from "./vrmHumanoidRigAdapter";

export interface VrmRigCalibrationProfile {
  readonly schemaVersion: 1;
  readonly modelFingerprint: string;
  readonly coordinateFrameId: string;
  readonly calibrationMethod: "manual-measured" | "validated-import";
  readonly left: AxisCalibration & { readonly shoulderBoneName: string; readonly elbowBoneName: string };
  readonly right: AxisCalibration & { readonly shoulderBoneName: string; readonly elbowBoneName: string };
}

export interface VrmRigCalibrationContext {
  readonly modelFingerprint: string;
  readonly coordinateFrameId: string;
  readonly left: VrmArmBoneMap | null;
  readonly right: VrmArmBoneMap | null;
}

export type VrmRigCalibrationResult =
  | { readonly accepted: true; readonly profile: VrmRigCalibrationProfile }
  | { readonly accepted: false; readonly reason: "invalid-profile" | "unsupported-schema" | "model-fingerprint-mismatch" | "coordinate-frame-mismatch" | "left-rig-mismatch" | "right-rig-mismatch" | "invalid-calibration" };

const axes = new Set(["x", "y", "z"]);
const finite = (values: readonly number[]) => values.every(Number.isFinite);

function validArmIdentity(value: unknown): value is AxisCalibration & { shoulderBoneName: string; elbowBoneName: string } {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return typeof c.shoulderBoneName === "string" && c.shoulderBoneName.trim().length > 0
    && typeof c.elbowBoneName === "string" && c.elbowBoneName.trim().length > 0
    && axes.has(String(c.shoulderAxis)) && axes.has(String(c.elbowAxis))
    && (c.shoulderSign === 1 || c.shoulderSign === -1)
    && (c.elbowSign === 1 || c.elbowSign === -1);
}

function validArmCalibration(value: unknown): value is AxisCalibration & { shoulderBoneName: string; elbowBoneName: string } {
  if (!validArmIdentity(value)) return false;
  const c = value as unknown as Record<string, unknown>;
  const numeric = [c.shoulderOffsetRad, c.elbowOffsetRad, c.shoulderMinRad, c.shoulderMaxRad, c.elbowMinRad, c.elbowMaxRad] as number[];
  const limit = Math.PI * 2;
  return finite(numeric)
    && numeric.every((n) => Math.abs(n) <= limit)
    && (c.shoulderMinRad as number) <= (c.shoulderMaxRad as number)
    && (c.elbowMinRad as number) <= (c.elbowMaxRad as number);
}

/** Validate an explicit per-model profile against the exact loaded model, frame and resolved bone identities. */
export function validateVrmRigCalibrationProfile(
  profile: unknown,
  context: VrmRigCalibrationContext,
): VrmRigCalibrationResult {
  if (!profile || typeof profile !== "object") return { accepted: false, reason: "invalid-profile" };
  const p = profile as Record<string, unknown>;
  if (p.schemaVersion !== 1) return { accepted: false, reason: "unsupported-schema" };
  if (typeof p.modelFingerprint !== "string" || !p.modelFingerprint || typeof p.coordinateFrameId !== "string" || !p.coordinateFrameId
    || (p.calibrationMethod !== "manual-measured" && p.calibrationMethod !== "validated-import")
    || !validArmIdentity(p.left) || !validArmIdentity(p.right)) {
    return { accepted: false, reason: "invalid-profile" };
  }
  if (!validArmCalibration(p.left) || !validArmCalibration(p.right)) return { accepted: false, reason: "invalid-calibration" };
  if (p.modelFingerprint !== context.modelFingerprint) return { accepted: false, reason: "model-fingerprint-mismatch" };
  if (p.coordinateFrameId !== context.coordinateFrameId) return { accepted: false, reason: "coordinate-frame-mismatch" };
  if (!context.left || context.left.shoulder.name !== p.left.shoulderBoneName || context.left.elbow.name !== p.left.elbowBoneName) {
    return { accepted: false, reason: "left-rig-mismatch" };
  }
  if (!context.right || context.right.shoulder.name !== p.right.shoulderBoneName || context.right.elbow.name !== p.right.elbowBoneName) {
    return { accepted: false, reason: "right-rig-mismatch" };
  }
  const freezeArm = (arm: VrmRigCalibrationProfile["left"]) => Object.freeze({ ...arm });
  const frozen = Object.freeze({
    schemaVersion: 1 as const,
    modelFingerprint: p.modelFingerprint,
    coordinateFrameId: p.coordinateFrameId,
    calibrationMethod: p.calibrationMethod,
    left: freezeArm(p.left as VrmRigCalibrationProfile["left"]),
    right: freezeArm(p.right as VrmRigCalibrationProfile["right"]),
  });
  return { accepted: true, profile: frozen };
}

export function getVrmArmCalibration(profile: VrmRigCalibrationProfile, side: ArmSide): AxisCalibration {
  const { shoulderBoneName: _shoulder, elbowBoneName: _elbow, ...calibration } = profile[side];
  return calibration;
}


/** Parse and validate an imported JSON profile against the currently loaded rig. */
export function parseVrmRigCalibrationProfileJson(
  json: string,
  context: VrmRigCalibrationContext,
): VrmRigCalibrationResult {
  if (typeof json !== "string" || json.length === 0 || json.length > 32_768) {
    return { accepted: false, reason: "invalid-profile" };
  }
  try {
    return validateVrmRigCalibrationProfile(JSON.parse(json) as unknown, context);
  } catch {
    return { accepted: false, reason: "invalid-profile" };
  }
}

/** Export only a profile that still matches the loaded model and resolved bilateral rig. */
export function serializeVrmRigCalibrationProfileJson(
  profile: VrmRigCalibrationProfile,
  context: VrmRigCalibrationContext,
): string | null {
  const result = validateVrmRigCalibrationProfile(profile, context);
  if (!result.accepted) return null;
  const p = result.profile;
  return JSON.stringify({
    schemaVersion: p.schemaVersion,
    modelFingerprint: p.modelFingerprint,
    coordinateFrameId: p.coordinateFrameId,
    calibrationMethod: p.calibrationMethod,
    left: { ...p.left },
    right: { ...p.right },
  }, null, 2);
}

export interface VrmArmCalibrationMeasurement {
  readonly shoulderAxis: "x" | "y" | "z";
  readonly elbowAxis: "x" | "y" | "z";
  readonly shoulderSign: 1 | -1;
  readonly elbowSign: 1 | -1;
  readonly bindShoulder: Readonly<{ x: number; y: number; z: number }>;
  readonly bindElbow: Readonly<{ x: number; y: number; z: number }>;
  readonly observedShoulder: Readonly<{ x: number; y: number; z: number }>;
  readonly observedElbow: Readonly<{ x: number; y: number; z: number }>;
  /** Known fixture angles applied during the measured reference pose, in radians. */
  readonly referenceShoulderAngleRad: number;
  readonly referenceElbowAngleRad: number;
  /** Joint limits measured or verified for this exact model, in radians. */
  readonly shoulderMinRad: number;
  readonly shoulderMaxRad: number;
  readonly elbowMinRad: number;
  readonly elbowMaxRad: number;
}

export type VrmArmCalibrationMeasurementResult =
  | { readonly accepted: true; readonly calibration: AxisCalibration }
  | { readonly accepted: false; readonly reason: "invalid-measurement" | "insufficient-reference-motion" | "off-axis-motion" | "reference-outside-joint-limits" };

/**
 * Derive per-axis offsets from a bind pose and a known-angle reference fixture.
 * The fixture angle must be independently known; this function does not infer it
 * from an animation clip or pretend that arbitrary pose samples are ground truth.
 */
export function calibrateVrmArmFromMeasurement(
  measurement: VrmArmCalibrationMeasurement,
  offAxisToleranceRad = 0.12,
): VrmArmCalibrationMeasurementResult {
  const vectors = [measurement?.bindShoulder, measurement?.bindElbow, measurement?.observedShoulder, measurement?.observedElbow];
  if (!measurement || !vectors.every((v) => v && [v.x, v.y, v.z].every(Number.isFinite))
    || !axes.has(measurement.shoulderAxis) || !axes.has(measurement.elbowAxis)
    || (measurement.shoulderSign !== 1 && measurement.shoulderSign !== -1)
    || (measurement.elbowSign !== 1 && measurement.elbowSign !== -1)
    || !finite([measurement.referenceShoulderAngleRad, measurement.referenceElbowAngleRad,
      measurement.shoulderMinRad, measurement.shoulderMaxRad, measurement.elbowMinRad, measurement.elbowMaxRad, offAxisToleranceRad])
    || offAxisToleranceRad < 0 || offAxisToleranceRad > 0.5
    || measurement.shoulderMinRad > measurement.shoulderMaxRad || measurement.elbowMinRad > measurement.elbowMaxRad
    || [measurement.shoulderMinRad, measurement.shoulderMaxRad, measurement.elbowMinRad, measurement.elbowMaxRad].some((n) => Math.abs(n) > Math.PI * 2)
    || Math.abs(measurement.referenceShoulderAngleRad) > Math.PI * 2 || Math.abs(measurement.referenceElbowAngleRad) > Math.PI * 2) {
    return { accepted: false, reason: "invalid-measurement" };
  }
  if (Math.abs(measurement.referenceShoulderAngleRad) < 0.1 || Math.abs(measurement.referenceElbowAngleRad) < 0.1) {
    return { accepted: false, reason: "insufficient-reference-motion" };
  }
  const offAxis = (before: Readonly<{ x: number; y: number; z: number }>, after: Readonly<{ x: number; y: number; z: number }>, axis: "x" | "y" | "z") =>
    (["x", "y", "z"] as const).filter((candidate) => candidate !== axis)
      .some((candidate) => Math.abs(after[candidate] - before[candidate]) > offAxisToleranceRad);
  if (offAxis(measurement.bindShoulder, measurement.observedShoulder, measurement.shoulderAxis)
    || offAxis(measurement.bindElbow, measurement.observedElbow, measurement.elbowAxis)) {
    return { accepted: false, reason: "off-axis-motion" };
  }
  const shoulderDelta = measurement.observedShoulder[measurement.shoulderAxis] - measurement.bindShoulder[measurement.shoulderAxis];
  const elbowDelta = measurement.observedElbow[measurement.elbowAxis] - measurement.bindElbow[measurement.elbowAxis];
  const shoulderOffsetRad = shoulderDelta - measurement.referenceShoulderAngleRad * measurement.shoulderSign;
  const elbowOffsetRad = elbowDelta - measurement.referenceElbowAngleRad * measurement.elbowSign;
  const shoulderMeasured = measurement.bindShoulder[measurement.shoulderAxis] + shoulderDelta;
  const elbowMeasured = measurement.bindElbow[measurement.elbowAxis] + elbowDelta;
  if (shoulderMeasured < measurement.shoulderMinRad || shoulderMeasured > measurement.shoulderMaxRad
    || elbowMeasured < measurement.elbowMinRad || elbowMeasured > measurement.elbowMaxRad) {
    return { accepted: false, reason: "reference-outside-joint-limits" };
  }
  const calibration: AxisCalibration = Object.freeze({
    shoulderAxis: measurement.shoulderAxis, elbowAxis: measurement.elbowAxis,
    shoulderSign: measurement.shoulderSign, elbowSign: measurement.elbowSign,
    shoulderOffsetRad, elbowOffsetRad,
    shoulderMinRad: measurement.shoulderMinRad, shoulderMaxRad: measurement.shoulderMaxRad,
    elbowMinRad: measurement.elbowMinRad, elbowMaxRad: measurement.elbowMaxRad,
  });
  if (!validArmCalibration({ ...calibration, shoulderBoneName: "measured", elbowBoneName: "measured" })) {
    return { accepted: false, reason: "invalid-measurement" };
  }
  return { accepted: true, calibration };
}

/** Build a profile only from explicit left/right measured fixture captures and the exact loaded rig. */
export function createMeasuredVrmRigCalibrationProfile(
  context: VrmRigCalibrationContext,
  measurements: Readonly<{ left: VrmArmCalibrationMeasurement; right: VrmArmCalibrationMeasurement }>,
): VrmRigCalibrationResult {
  if (!context?.left || !context?.right || !context.modelFingerprint || !context.coordinateFrameId) {
    return { accepted: false, reason: "invalid-profile" };
  }
  const left = calibrateVrmArmFromMeasurement(measurements.left);
  const right = calibrateVrmArmFromMeasurement(measurements.right);
  if (!left.accepted || !right.accepted) return { accepted: false, reason: "invalid-calibration" };
  const profile = {
    schemaVersion: 1 as const,
    modelFingerprint: context.modelFingerprint,
    coordinateFrameId: context.coordinateFrameId,
    calibrationMethod: "manual-measured" as const,
    left: { ...left.calibration, shoulderBoneName: context.left.shoulder.name ?? "", elbowBoneName: context.left.elbow.name ?? "" },
    right: { ...right.calibration, shoulderBoneName: context.right.shoulder.name ?? "", elbowBoneName: context.right.elbow.name ?? "" },
  };
  return validateVrmRigCalibrationProfile(profile, context);
}

