export type PlanarTwoBoneIKInput = {
  targetX: number;
  targetY: number;
  upperLength: number;
  lowerLength: number;
  bendDirection?: -1 | 1;
  minReachRatio?: number;
};
export type PlanarTwoBoneIKResult = {
  shoulderRotation: number;
  elbowRotation: number;
  reachableDistance: number;
  requestedDistance: number;
  reachError: number;
  clamped: boolean;
};
const finite = (value: number | undefined, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * Stable planar 2-bone IK for a shoulder/elbow chain.
 * Angles are local Z rotations for a rig whose bind-pose arm points down (-Y).
 * The target is expressed in shoulder-local coordinates; no world-space assumptions.
 */
export function solvePlanarTwoBoneIK(input: PlanarTwoBoneIKInput): PlanarTwoBoneIKResult {
  const upper = clamp(finite(input.upperLength, 0.32), 0.001, 10);
  const lower = clamp(finite(input.lowerLength, 0.30), 0.001, 10);
  const x = finite(input.targetX);
  const y = finite(input.targetY, -(upper + lower) * 0.7);
  const direction = input.bendDirection === -1 ? -1 : 1;
  const minRatio = clamp(finite(input.minReachRatio, 0.025), 0.001, 0.25);
  const requested = Math.hypot(x, y);
  const minReach = Math.abs(upper - lower) + Math.min(upper, lower) * minRatio;
  const maxReach = upper + lower - Math.min(upper, lower) * minRatio;
  const distance = clamp(requested || minReach, minReach, maxReach);
  const targetAngle = Math.atan2(y, x);
  const cosine = clamp((distance * distance - upper * upper - lower * lower) / (2 * upper * lower), -1, 1);
  const interior = Math.acos(cosine);
  const elbow = direction * (Math.PI - interior);
  const shoulder = targetAngle - Math.atan2(lower * Math.sin(elbow), upper + lower * Math.cos(elbow));
  return {
    shoulderRotation: finite(shoulder + Math.PI / 2),
    // Nested shoulder and elbow groups compose local Z rotations additively.
    // Preserve the signed IK joint angle so forward kinematics reaches the requested target.
    elbowRotation: finite(elbow),
    reachableDistance: distance,
    requestedDistance: requested,
    reachError: Math.abs(requested - distance),
    clamped: Math.abs(requested - distance) > 1e-7,
  };
}
