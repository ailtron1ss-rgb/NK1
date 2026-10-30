/**
 * NK1 canonical body-motor foundation.
 *
 * Renderer-independent motor primitives shared by Live2D/depth-rig/VRM adapters.
 * This module deliberately does not animate assets or claim a body action succeeded:
 * it produces bounded targets that a renderer/physics backend must execute and verify.
 */

export type Vec3 = readonly [number, number, number];
export type JointLimits = Readonly<{ min: number; max: number; maxSpeed: number }>;
export type JointLimitMap = Readonly<Record<string, JointLimits>>;
export type JointPose = Readonly<Record<string, number>>;

export interface MotorProposal {
  source: string;
  priority: number;
  weight?: number;
  joints: JointPose;
}

export interface MotorResolution {
  pose: Record<string, number>;
  owners: Record<string, string[]>;
  rejected: Array<{ source: string; joint: string; reason: string }>;
}

export interface TwoBoneIKResult {
  elbow: Vec3;
  target: Vec3;
  requestedTarget: Vec3;
  reachable: boolean;
  reachRatio: number;
  distance: number;
  clampedDistance: number;
}

const finite = (n: number, fallback = 0): number => Number.isFinite(n) ? n : fallback;
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (a: Vec3): number => Math.sqrt(dot(a, a));
const normalize = (a: Vec3, fallback: Vec3 = [0, 1, 0]): Vec3 => {
  const magnitude = length(a);
  return magnitude > 1e-8 ? mul(a, 1 / magnitude) : fallback;
};
const isVec3 = (v: Vec3): boolean => v.every(Number.isFinite);

/**
 * Solve a two-segment limb in 3D using a pole vector to choose the bend plane.
 * Unreachable targets are projected onto the reachable annulus; no NaN/Infinity
 * can escape, including zero-distance and collinear-pole degeneracies.
 */
export function solveTwoBoneIK(
  root: Vec3,
  requestedTarget: Vec3,
  pole: Vec3,
  upperLength: number,
  lowerLength: number,
): TwoBoneIKResult {
  const safeRoot: Vec3 = isVec3(root) ? root : [0, 0, 0];
  const safeTarget: Vec3 = isVec3(requestedTarget) ? requestedTarget : safeRoot;
  const safePole: Vec3 = isVec3(pole) ? pole : add(safeRoot, [0, 0, 1]);
  const upper = Math.max(1e-4, Math.abs(finite(upperLength, 1)));
  const lower = Math.max(1e-4, Math.abs(finite(lowerLength, 1)));
  const delta = sub(safeTarget, safeRoot);
  const requestedDistance = length(delta);
  const direction = normalize(delta, [0, -1, 0]);
  const minReach = Math.abs(upper - lower) + 1e-5;
  const maxReach = Math.max(minReach, upper + lower - 1e-5);
  const clampedDistance = clamp(requestedDistance, minReach, maxReach);
  const target = add(safeRoot, mul(direction, clampedDistance));

  const poleVector = sub(safePole, safeRoot);
  const poleProjected = sub(poleVector, mul(direction, dot(poleVector, direction)));
  let bendDirection = normalize(poleProjected, normalize(cross(direction, [0, 0, 1]), [1, 0, 0]));
  if (Math.abs(dot(bendDirection, direction)) > 0.999) {
    bendDirection = normalize(cross(direction, [0, 1, 0]), [0, 0, 1]);
  }

  const along = clamp(
    (upper * upper - lower * lower + clampedDistance * clampedDistance) / (2 * clampedDistance),
    0,
    upper,
  );
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  const elbow = add(add(safeRoot, mul(direction, along)), mul(bendDirection, height));
  const reachable = requestedDistance >= minReach && requestedDistance <= maxReach;

  return {
    elbow,
    target,
    requestedTarget: safeTarget,
    reachable,
    reachRatio: requestedDistance > 1e-8 ? clampedDistance / requestedDistance : 0,
    distance: requestedDistance,
    clampedDistance,
  };
}

/**
 * Resolve competing motor proposals per joint. Highest priority wins; proposals at
 * that priority blend by bounded weight. Unknown joints and malformed values fail closed.
 */
export function resolveMotorProposals(
  proposals: readonly MotorProposal[],
  limits: JointLimitMap,
): MotorResolution {
  const pose: Record<string, number> = {};
  const owners: Record<string, string[]> = {};
  const rejected: MotorResolution["rejected"] = [];
  const joints = [...new Set(proposals.flatMap((proposal) => Object.keys(proposal.joints ?? {})))].sort();

  for (const joint of joints) {
    const limit = limits[joint];
    if (!limit || !Number.isFinite(limit.min) || !Number.isFinite(limit.max) || limit.min > limit.max) {
      for (const proposal of proposals) {
        if (Object.hasOwn(proposal.joints ?? {}, joint)) rejected.push({ source: proposal.source, joint, reason: "joint-not-supported" });
      }
      continue;
    }

    const candidates = proposals.flatMap((proposal) => {
      if (!Object.hasOwn(proposal.joints ?? {}, joint)) return [];
      const value = proposal.joints[joint];
      if (!Number.isFinite(value) || !Number.isFinite(proposal.priority)) {
        rejected.push({ source: proposal.source, joint, reason: "non-finite-target-or-priority" });
        return [];
      }
      return [{
        source: String(proposal.source || "unknown").slice(0, 96),
        priority: clamp(proposal.priority, 0, 100),
        weight: clamp(finite(proposal.weight, 1), 0, 1),
        value: clamp(value, limit.min, limit.max),
      }];
    }).filter((candidate) => candidate.weight > 0);

    if (!candidates.length) continue;
    const priority = Math.max(...candidates.map((candidate) => candidate.priority));
    const winners = candidates.filter((candidate) => candidate.priority === priority);
    const totalWeight = winners.reduce((sum, candidate) => sum + candidate.weight, 0);
    pose[joint] = winners.reduce((sum, candidate) => sum + candidate.value * candidate.weight, 0) / totalWeight;
    owners[joint] = winners.map((candidate) => candidate.source);
  }

  return { pose, owners, rejected };
}

/** Move a current pose toward targets with per-joint speed and hard position limits. */
export function advanceJointPose(
  current: JointPose,
  target: JointPose,
  limits: JointLimitMap,
  deltaSeconds: number,
): Record<string, number> {
  const dt = clamp(finite(deltaSeconds), 0, 0.1);
  const next: Record<string, number> = { ...current };
  for (const [joint, requested] of Object.entries(target)) {
    const limit = limits[joint];
    if (!limit || !Number.isFinite(requested)) continue;
    const from = clamp(finite(current[joint] ?? 0, 0), limit.min, limit.max);
    const to = clamp(requested, limit.min, limit.max);
    const maxStep = Math.max(0, finite(limit.maxSpeed)) * dt;
    next[joint] = from + clamp(to - from, -maxStep, maxStep);
  }
  return next;
}

/** Capability negotiation prevents a renderer from pretending to execute unsupported channels. */
export interface BodyCapabilities {
  joints: readonly string[];
  expressions: readonly string[];
  supportsIk: boolean;
  supportsWorldInteraction: boolean;
  supportsClothingLayers: boolean;
}

export function filterPoseForCapabilities(pose: JointPose, capabilities: BodyCapabilities): {
  supported: Record<string, number>;
  unsupported: string[];
} {
  const allowed = new Set(capabilities.joints);
  const supported: Record<string, number> = {};
  const unsupported: string[] = [];
  for (const [joint, value] of Object.entries(pose)) {
    if (!Number.isFinite(value)) {
      unsupported.push(joint);
    } else if (allowed.has(joint)) {
      supported[joint] = value;
    } else {
      unsupported.push(joint);
    }
  }
  return { supported, unsupported: unsupported.sort() };
}
