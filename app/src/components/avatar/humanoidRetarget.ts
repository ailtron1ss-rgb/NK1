/**
 * Deterministic, data-only humanoid motion retargeting primitives.
 *
 * This module operates on local-space transforms; it deliberately does not
 * own THREE objects, animation mixers, IK, or contact simulation. If world-rest
 * orientations are supplied, it calibrates source-local axes into target-local
 * axes before transferring motion. Without them, local axes are assumed equal.
 */
export type HumanoidRole = string;
export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];

export interface HumanoidRigProfileInput {
  roleToNode: ReadonlyMap<HumanoidRole, number>;
  restLocalRotation: ReadonlyMap<HumanoidRole, Quat>;
  /** World-space rest orientation in a shared coordinate frame, after matrix-world update. */
  restWorldRotation?: ReadonlyMap<HumanoidRole, Quat>;
  boneLength?: ReadonlyMap<HumanoidRole, number>;
  height: number;
}

export interface HumanoidRetargetProfile {
  sharedRoles: readonly HumanoidRole[];
  missingTargetRoles: readonly HumanoidRole[];
  heightScale: number;
  boneLengthScale: ReadonlyMap<HumanoidRole, number>;
  sourceNodeByRole: ReadonlyMap<HumanoidRole, number>;
  targetNodeByRole: ReadonlyMap<HumanoidRole, number>;
  sourceRestLocalRotation: ReadonlyMap<HumanoidRole, Quat>;
  targetRestLocalRotation: ReadonlyMap<HumanoidRole, Quat>;
  /** Maps source-local vectors into target-local axes for each calibrated role. */
  sourceToTargetAxisBasis: ReadonlyMap<HumanoidRole, Quat>;
  /** Roles using the equal-local-axes fallback because world rest data was absent. */
  uncalibratedAxisRoles: readonly HumanoidRole[];
}

export interface RetargetOptions {
  /** Maximum applied local rotation delta in radians. Defaults to pi. */
  maxRotationRadians?: number;
  /** Maximum root translation magnitude after height scaling. Defaults to 1. */
  maxRootTranslation?: number;
  /** Reject roles without world-rest axis calibration instead of assuming equal local axes. */
  requireAxisCalibration?: boolean;
}

const finite = (value: number, fallback = 0): number =>
  Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, finite(value, min)));

export function normalizeQuaternion(value: Quat): Quat {
  const x = finite(value[0]), y = finite(value[1]), z = finite(value[2]), w = finite(value[3], 1);
  const length = Math.hypot(x, y, z, w);
  if (length < 1e-8) return [0, 0, 0, 1];
  return [x / length, y / length, z / length, w / length];
}

export function multiplyQuaternion(aValue: Quat, bValue: Quat): Quat {
  const [ax, ay, az, aw] = normalizeQuaternion(aValue);
  const [bx, by, bz, bw] = normalizeQuaternion(bValue);
  return normalizeQuaternion([
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]);
}

export function inverseQuaternion(value: Quat): Quat {
  const [x, y, z, w] = normalizeQuaternion(value);
  return [-x, -y, -z, w];
}

function clampQuaternionDelta(deltaValue: Quat, maxRadians: number): Quat {
  const normalized = normalizeQuaternion(deltaValue);
  // q and -q encode the same rotation; choose the shortest-arc hemisphere.
  const delta: Quat = normalized[3] < 0
    ? [-normalized[0], -normalized[1], -normalized[2], -normalized[3]]
    : normalized;
  const angle = 2 * Math.acos(clamp(delta[3], 0, 1));
  const limit = clamp(maxRadians, 0, Math.PI);
  if (angle <= limit || angle < 1e-8) return delta;
  const sinHalf = Math.sqrt(Math.max(0, 1 - delta[3] * delta[3]));
  if (sinHalf < 1e-8) return [0, 0, 0, 1];
  const scale = Math.sin(limit / 2) / sinHalf;
  return normalizeQuaternion([delta[0] * scale, delta[1] * scale, delta[2] * scale, Math.cos(limit / 2)]);
}

/**
 * Build a source/target mapping. Axis basis is inverse(targetWorldRest) *
 * sourceWorldRest: it maps a source-local vector into target-local coordinates.
 */
export function buildHumanoidRetargetProfile(
  source: HumanoidRigProfileInput,
  target: HumanoidRigProfileInput,
): HumanoidRetargetProfile {
  const sourceRoles = new Set(source.roleToNode.keys());
  const targetRoles = new Set(target.roleToNode.keys());
  const sharedRoles: string[] = [];
  const missingTargetRoles: string[] = [];
  const uncalibratedAxisRoles: string[] = [];
  const sourceNodeByRole = new Map<string, number>();
  const targetNodeByRole = new Map<string, number>();
  const sourceRestLocalRotation = new Map<string, Quat>();
  const targetRestLocalRotation = new Map<string, Quat>();
  const sourceToTargetAxisBasis = new Map<string, Quat>();
  const boneLengthScale = new Map<string, number>();

  for (const role of sourceRoles) {
    if (!targetRoles.has(role)) {
      missingTargetRoles.push(role);
      continue;
    }
    const sourceNode = source.roleToNode.get(role);
    const targetNode = target.roleToNode.get(role);
    const sourceRest = source.restLocalRotation.get(role);
    const targetRest = target.restLocalRotation.get(role);
    if (!Number.isSafeInteger(sourceNode) || !Number.isSafeInteger(targetNode) || !sourceRest || !targetRest) {
      missingTargetRoles.push(role);
      continue;
    }
    sharedRoles.push(role);
    sourceNodeByRole.set(role, sourceNode as number);
    targetNodeByRole.set(role, targetNode as number);
    sourceRestLocalRotation.set(role, normalizeQuaternion(sourceRest));
    targetRestLocalRotation.set(role, normalizeQuaternion(targetRest));

    const sourceWorld = source.restWorldRotation?.get(role);
    const targetWorld = target.restWorldRotation?.get(role);
    if (sourceWorld && targetWorld) {
      // World rest frames must describe both rigs in the same external basis.
      sourceToTargetAxisBasis.set(
        role,
        multiplyQuaternion(inverseQuaternion(targetWorld), sourceWorld),
      );
    } else {
      uncalibratedAxisRoles.push(role);
    }

    const sourceLength = finite(source.boneLength?.get(role) ?? 0);
    const targetLength = finite(target.boneLength?.get(role) ?? 0);
    if (sourceLength > 1e-5 && targetLength > 1e-5) {
      boneLengthScale.set(role, clamp(targetLength / sourceLength, 0.25, 4));
    }
  }

  const sourceHeight = finite(source.height);
  const targetHeight = finite(target.height);
  const heightScale = sourceHeight > 1e-5 && targetHeight > 1e-5
    ? clamp(targetHeight / sourceHeight, 0.25, 4)
    : 1;

  return {
    sharedRoles: sharedRoles.sort(),
    missingTargetRoles: missingTargetRoles.sort(),
    heightScale,
    boneLengthScale,
    sourceNodeByRole,
    targetNodeByRole,
    sourceRestLocalRotation,
    targetRestLocalRotation,
    sourceToTargetAxisBasis,
    uncalibratedAxisRoles: uncalibratedAxisRoles.sort(),
  };
}

/**
 * Transfer source local rotations as rest-relative deltas. When axis calibration
 * exists, conjugate the source delta into target-local coordinates. Strict mode
 * skips roles without calibration rather than silently assuming matching axes.
 */
export function retargetLocalRotations(
  profile: HumanoidRetargetProfile,
  sourcePoseLocalRotation: ReadonlyMap<HumanoidRole, Quat>,
  options: RetargetOptions = {},
): Map<HumanoidRole, Quat> {
  const maxRadians = clamp(options.maxRotationRadians ?? Math.PI, 0, Math.PI);
  const result = new Map<string, Quat>();
  for (const role of profile.sharedRoles) {
    const sourceRest = profile.sourceRestLocalRotation.get(role);
    const targetRest = profile.targetRestLocalRotation.get(role);
    const sourcePose = sourcePoseLocalRotation.get(role);
    if (!sourceRest || !targetRest || !sourcePose) continue;
    const basis = profile.sourceToTargetAxisBasis.get(role);
    if (!basis && options.requireAxisCalibration) continue;
    const sourceDelta = multiplyQuaternion(inverseQuaternion(sourceRest), sourcePose);
    const targetDelta = basis
      ? multiplyQuaternion(multiplyQuaternion(basis, sourceDelta), inverseQuaternion(basis))
      : sourceDelta;
    result.set(role, multiplyQuaternion(targetRest, clampQuaternionDelta(targetDelta, maxRadians)));
  }
  return result;
}

/** Scale root displacement by avatar height and cap it to prevent runaway travel. */
export function retargetRootTranslation(
  translation: Vec3,
  profile: HumanoidRetargetProfile,
  maxMagnitude = 1,
): Vec3 {
  const scaled: [number, number, number] = [
    finite(translation[0]) * profile.heightScale,
    finite(translation[1]) * profile.heightScale,
    finite(translation[2]) * profile.heightScale,
  ];
  const magnitude = Math.hypot(...scaled);
  const limit = clamp(maxMagnitude, 0, 100);
  if (magnitude <= limit || magnitude < 1e-8) return scaled;
  const factor = limit / magnitude;
  return [scaled[0] * factor, scaled[1] * factor, scaled[2] * factor];
}
