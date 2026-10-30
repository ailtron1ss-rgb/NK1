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
