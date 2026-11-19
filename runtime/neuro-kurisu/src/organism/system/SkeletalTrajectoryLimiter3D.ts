/**
 * NK1 renderer-neutral bounded 3D joint trajectory planner.
 *
 * `SkeletalKinematics3D` answers "where is the hand for this pose" and the IK
 * solvers answer "which pose reaches this target". Neither answers the question an
 * actuator must answer: "which intermediate poses may I command between now and the
 * target without exceeding this joint's velocity, acceleration and jerk budget".
 *
 * This module owns that. Each joint gets a time-parameterised quintic segment
 *
 *   p(tau) = c0 + c1*tau + c2*tau^2 + c3*tau^3 + c4*tau^4 + c5*tau^5,  tau = t / T
 *
 * fixed by six boundary conditions: the joint's measured position, velocity and
 * acceleration at plan start, and the target position with zero velocity and zero
 * acceleration at plan end. The duration T is the smallest value for which the
 * analytic velocity, acceleration and jerk stay inside the joint's limits.
 *
 * The plan is stored as plain data, so sampling is deterministic, independent of
 * frame cadence and resumable after a restore. No renderer, wall clock,
 * physics/contact solver or actuator is involved, and nothing here is evidence that
 * a body actually moved.
 */
import {
  validateSkeleton3D,
  type JointPose3D,
  type SkeletalJoint3D,
} from "./SkeletalKinematics3D.ts";

export interface JointMotionLimits3D {
  maxVelocityRadPerSec: number;
  maxAccelerationRadPerSec2: number;
  maxJerkRadPerSec3: number;
}

export interface TrajectoryJointState3D {
  positionRad: number;
  velocityRadPerSec: number;
  accelerationRadPerSec2: number;
}

export type TrajectoryState3D = Record<string, TrajectoryJointState3D>;

/** One analytic quintic segment, stored as plain data so it can be persisted. */
export interface JointTrajectorySegment3D {
  id: string;
  fromRad: number;
  toRad: number;
  startVelocityRadPerSec: number;
  startAccelerationRadPerSec2: number;
  durationSec: number;
  /** Coefficients of the normalised quintic p(tau), tau in [0, 1]. */
  coefficients: readonly [number, number, number, number, number, number];
  limits: JointMotionLimits3D;
  /** Peak magnitudes measured by sampling the segment inside its own limits. */
  peak: {
    velocityRadPerSec: number;
    accelerationRadPerSec2: number;
    jerkRadPerSec3: number;
  };
  /**
   * False when the segment reaches the target exactly but passes it on the way,
   * which only happens when replanning from an already-moving joint.
   */
  monotone: boolean;
}

export interface JointTrajectoryChain3D {
  id: string;
  /** One or two segments: a jerk-limited brake to rest, then the quintic to target. */
  segments: readonly JointTrajectorySegment3D[];
  toRad: number;
  durationSec: number;
}

export interface TrajectoryPlan3D {
  version: 1;
  elapsedSec: number;
  joints: Record<string, JointTrajectoryChain3D>;
  settled: boolean;
}

export interface SkeletalTrajectoryStepInput3D {
  joints: readonly SkeletalJoint3D[];
  state: TrajectoryState3D;
  targets: JointPose3D;
  dtSeconds: number;
  /** Global default limits; a joint's own `perJointLimits` entry wins field by field. */
  limits?: Partial<JointMotionLimits3D>;
  perJointLimits?: Record<string, Partial<JointMotionLimits3D>>;
  /** Continue a previous plan; a plan whose targets no longer match is replaced. */
  plan?: TrajectoryPlan3D | null;
  maxPlanDurationSec?: number;
  toleranceRad?: number;
}

export interface TrajectoryJointStep3D {
  id: string;
  positionRad: number;
  velocityRadPerSec: number;
  accelerationRadPerSec2: number;
  targetRad: number;
  settled: boolean;
  clampedAtLimit: boolean;
  limits: JointMotionLimits3D;
}

export interface SkeletalTrajectoryStepResult3D {
  state: TrajectoryState3D;
  joints: TrajectoryJointStep3D[];
  plan: TrajectoryPlan3D;
  dtSeconds: number;
  elapsedSec: number;
  settled: boolean;
  replanned: boolean;
  maxAbsJerkRadPerSec3: number;
  reason: "tracking" | "settled";
}

export interface SkeletalTrajectoryRunResult3D {
  state: TrajectoryState3D;
  plan: TrajectoryPlan3D | null;
  frames: number;
  settled: boolean;
  maxAbsJerkRadPerSec3: number;
  maxAbsVelocityRadPerSec: number;
  maxAbsAccelerationRadPerSec2: number;
  reason: "settled" | "frame-budget-exhausted";
}

/** Structurally identical to the app-side `MotorFrameJointSample` transport row. */
export interface MotorFrameJointSampleLike3D {
  id: string;
  angleRad: number;
  targetAngleRad: number;
  velocityRadPerSec: number;
  accelerationRadPerSec2: number;
  available: boolean;
}

const EPS = 1e-12;
const DEFAULT_LIMITS: JointMotionLimits3D = Object.freeze({
  maxVelocityRadPerSec: 3.5,
  maxAccelerationRadPerSec2: 14,
  maxJerkRadPerSec3: 90,
});
const MAX_FRAMES = 4096;
const MIN_DURATION_SEC = 1e-3;
const MAX_DURATION_SEC = 30;
const SAMPLES_PER_SEGMENT = 96;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function resolveLimits(
  jointId: string,
  global: Partial<JointMotionLimits3D> | undefined,
  perJoint: Record<string, Partial<JointMotionLimits3D>> | undefined,
): JointMotionLimits3D {
  const local = perJoint?.[jointId];
  const merged: JointMotionLimits3D = {
    maxVelocityRadPerSec: local?.maxVelocityRadPerSec ?? global?.maxVelocityRadPerSec ?? DEFAULT_LIMITS.maxVelocityRadPerSec,
    maxAccelerationRadPerSec2: local?.maxAccelerationRadPerSec2 ?? global?.maxAccelerationRadPerSec2 ?? DEFAULT_LIMITS.maxAccelerationRadPerSec2,
    maxJerkRadPerSec3: local?.maxJerkRadPerSec3 ?? global?.maxJerkRadPerSec3 ?? DEFAULT_LIMITS.maxJerkRadPerSec3,
  };
  if (!finite(merged.maxVelocityRadPerSec) || merged.maxVelocityRadPerSec <= 0 || merged.maxVelocityRadPerSec > 40
    || !finite(merged.maxAccelerationRadPerSec2) || merged.maxAccelerationRadPerSec2 <= 0 || merged.maxAccelerationRadPerSec2 > 400
    || !finite(merged.maxJerkRadPerSec3) || merged.maxJerkRadPerSec3 <= 0 || merged.maxJerkRadPerSec3 > 8000) {
    throw new Error("invalid-3d-trajectory-limits:" + jointId);
  }
  return merged;
}

/** Read-only validation for persisted or externally supplied trajectory state. */
export function validateTrajectoryState3D(
  joints: readonly SkeletalJoint3D[],
  state: unknown,
): TrajectoryState3D {
  validateSkeleton3D(joints);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("invalid-3d-trajectory-state");
  }
  const source = state as Record<string, unknown>;
  const ids = new Set(joints.map((joint) => joint.id));
  const out: TrajectoryState3D = Object.create(null);
  const keys = Object.keys(source);
  if (keys.length > 256) throw new Error("3d-trajectory-state-too-large");
  for (const id of keys) {
    if (!ids.has(id)) throw new Error("unknown-3d-trajectory-joint:" + id);
    const row = source[id];
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("invalid-3d-trajectory-row:" + id);
    const r = row as Record<string, unknown>;
    const positionRad = r.positionRad, velocityRadPerSec = r.velocityRadPerSec, accelerationRadPerSec2 = r.accelerationRadPerSec2;
    if (!finite(positionRad) || !finite(velocityRadPerSec) || !finite(accelerationRadPerSec2)) {
      throw new Error("non-finite-3d-trajectory-row:" + id);
    }
    out[id] = { positionRad, velocityRadPerSec, accelerationRadPerSec2 };
  }
  return out;
}

/** Build a rest state at each joint's rest angle (or zero) inside its own range. */
export function restTrajectoryState3D(joints: readonly SkeletalJoint3D[]): TrajectoryState3D {
  validateSkeleton3D(joints);
  const out: TrajectoryState3D = Object.create(null);
  for (const joint of joints) {
    out[joint.id] = {
      positionRad: clamp(joint.restAngleRad ?? 0, joint.minAngleRad, joint.maxAngleRad),
      velocityRadPerSec: 0,
      accelerationRadPerSec2: 0,
    };
  }
  return out;
}

function targetForJoint(joint: SkeletalJoint3D, targets: JointPose3D): number {
  const raw = targets[joint.id] ?? joint.restAngleRad ?? 0;
  if (!finite(raw)) throw new Error("non-finite-3d-trajectory-target:" + joint.id);
  return clamp(raw, joint.minAngleRad, joint.maxAngleRad);
}

/**
 * Quintic coefficients in the normalised variable tau matching p, v, a at tau=0
 * and p = to with v = a = 0 at tau=1.
 */
function quinticCoefficients(
  from: number,
  to: number,
  v0: number,
  a0: number,
  duration: number,
): [number, number, number, number, number, number] | null {
  const c0 = from;
  const c1 = v0 * duration;
  const c2 = 0.5 * a0 * duration * duration;
  const rhs3 = to - c0 - c1 - c2;
  const rhs4 = -(c1 + 2 * c2);
  const rhs5 = -(2 * c2);
  const m = [
    [1, 1, 1, rhs3],
    [3, 4, 5, rhs4],
    [6, 12, 20, rhs5],
  ];
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) return null;
    const swap = m[col]; m[col] = m[pivot]; m[pivot] = swap;
    const divisor = m[col][col];
    for (let k = col; k < 4; k++) m[col][k] /= divisor;
    for (let row = 0; row < 3; row++) {
      if (row === col) continue;
      const factor = m[row][col];
      for (let k = col; k < 4; k++) m[row][k] -= factor * m[col][k];
    }
  }
  return [c0, c1, c2, m[0][3], m[1][3], m[2][3]];
}

function evaluate(
  c: readonly [number, number, number, number, number, number],
  tau: number,
): { p: number; v: number; a: number; j: number } {
  const p = c[0] + tau * (c[1] + tau * (c[2] + tau * (c[3] + tau * (c[4] + tau * c[5]))));
  const d1 = c[1] + tau * (2 * c[2] + tau * (3 * c[3] + tau * (4 * c[4] + tau * 5 * c[5])));
  const d2 = 2 * c[2] + tau * (6 * c[3] + tau * (12 * c[4] + tau * 20 * c[5]));
  const d3 = 6 * c[3] + tau * (24 * c[4] + tau * 60 * c[5]);
  return { p, v: d1, a: d2, j: d3 };
}

interface SegmentAssessment {
  velocityRadPerSec: number;
  accelerationRadPerSec2: number;
  jerkRadPerSec3: number;
  monotone: boolean;
}

/** Sample the segment once and report peak magnitudes plus path monotonicity. */
function assessSegment(
  c: readonly [number, number, number, number, number, number],
  duration: number,
  from: number,
  to: number,
): SegmentAssessment {
  let peakV = 0, peakA = 0, peakJ = 0;
  const direction = Math.sign(to - from);
  let previous = from;
  let monotone = true;
  for (let index = 1; index <= SAMPLES_PER_SEGMENT; index++) {
    const raw = evaluate(c, index / SAMPLES_PER_SEGMENT);
    peakV = Math.max(peakV, Math.abs(raw.v / duration));
    peakA = Math.max(peakA, Math.abs(raw.a / (duration * duration)));
    peakJ = Math.max(peakJ, Math.abs(raw.j / (duration * duration * duration)));
    if (direction !== 0) {
      const step = raw.p - previous;
      if (Math.sign(step) === -direction && Math.abs(step) > 1e-9) monotone = false;
    }
    previous = raw.p;
  }
  return { velocityRadPerSec: peakV, accelerationRadPerSec2: peakA, jerkRadPerSec3: peakJ, monotone };
}

function buildSegment(
  joint: SkeletalJoint3D,
  from: number,
  to: number,
  v0: number,
  a0: number,
  limits: JointMotionLimits3D,
): JointTrajectorySegment3D {
  const still = Math.abs(to - from) < EPS && Math.abs(v0) < EPS && Math.abs(a0) < EPS;
  if (still) {
    return {
      id: joint.id, fromRad: from, toRad: to,
      startVelocityRadPerSec: v0, startAccelerationRadPerSec2: a0,
      durationSec: MIN_DURATION_SEC, coefficients: [from, 0, 0, 0, 0, 0],
      limits, peak: { velocityRadPerSec: 0, accelerationRadPerSec2: 0, jerkRadPerSec3: 0 },
      monotone: true,
    };
  }

  const build = (duration: number) => {
    const coefficients = quinticCoefficients(from, to, v0, a0, duration);
    if (!coefficients) return null;
    return { coefficients, assessment: assessSegment(coefficients, duration, from, to) };
  };
  const withinLimits = (assessment: SegmentAssessment) =>
    assessment.velocityRadPerSec <= limits.maxVelocityRadPerSec + 1e-9
    && assessment.accelerationRadPerSec2 <= limits.maxAccelerationRadPerSec2 + 1e-9
    && assessment.jerkRadPerSec3 <= limits.maxJerkRadPerSec3 + 1e-9;

  // Peaks decay as 1/T, 1/T^2 and 1/T^3, so a long enough segment always fits. If
  // even the longest candidate violates a limit, the request is unreachable.
  const longest = build(MAX_DURATION_SEC);
  if (!longest) throw new Error("3d-trajectory-plan-singular:" + joint.id);
  if (!withinLimits(longest.assessment)) throw new Error("3d-trajectory-limits-unreachable:" + joint.id);

  // Prefer the shortest duration that is both within limits and monotone. When the
  // joint starts from rest that is always achievable; from a moving state the
  // monotone constraint can be infeasible and limits alone are then accepted.
  const search = (requireMonotone: boolean): number | null => {
    let low = MIN_DURATION_SEC, high = MAX_DURATION_SEC;
    const feasible = (duration: number) => {
      const candidate = build(duration);
      if (!candidate) return false;
      return withinLimits(candidate.assessment) && (!requireMonotone || candidate.assessment.monotone);
    };
    if (!feasible(high)) return null;
    for (let iteration = 0; iteration < 40 && high - low > 1e-4; iteration++) {
      const mid = 0.5 * (low + high);
      if (feasible(mid)) high = mid; else low = mid;
    }
    return high;
  };

  const duration = search(true) ?? search(false);
  if (duration === null) throw new Error("3d-trajectory-limits-unreachable:" + joint.id);
  const chosen = build(duration);
  if (!chosen) throw new Error("3d-trajectory-plan-singular:" + joint.id);
  return {
    id: joint.id, fromRad: from, toRad: to,
    startVelocityRadPerSec: v0, startAccelerationRadPerSec2: a0,
    durationSec: duration, coefficients: chosen.coefficients, limits,
    peak: {
      velocityRadPerSec: chosen.assessment.velocityRadPerSec,
      accelerationRadPerSec2: chosen.assessment.accelerationRadPerSec2,
      jerkRadPerSec3: chosen.assessment.jerkRadPerSec3,
    },
    monotone: chosen.assessment.monotone,
  };
}

/**
 * Quartic brake to rest from a moving joint.
 *
 * With the end velocity and acceleration fixed at zero and only five of the six
 * boundary conditions pinned, the stopping position is not given — it follows from
 * the duration: p1 = p0 + v0*T/2 + a0*T^2/12 (the c5 = 0 quartic). That is what makes
 * a mid-flight replan solvable at all: a fixed-endpoint quintic cannot satisfy an
 * arbitrary (v0, a0) pair, because its initial-velocity term grows with T.
 *
 * Returns null when no duration in range both fits the limits and stops inside the
 * joint range.
 */
function brakeToRest(
  joint: SkeletalJoint3D,
  from: number,
  v0: number,
  a0: number,
  limits: JointMotionLimits3D,
): JointTrajectorySegment3D | null {
  const build = (duration: number) => {
    const c0 = from;
    const c1 = v0 * duration;
    const c2 = 0.5 * a0 * duration * duration;
    const c4 = (c1 + c2) / 2;
    const c3 = -c1 - (4 * c2) / 3;
    const to = c0 + c1 / 2 + c2 / 6;
    if (!Number.isFinite(to)) return null;
    if (to < joint.minAngleRad - 1e-9 || to > joint.maxAngleRad + 1e-9) return null;
    const coefficients: [number, number, number, number, number, number] = [c0, c1, c2, c3, c4, 0];
    const assessment = assessSegment(coefficients, duration, from, to);
    return { coefficients, assessment, to };
  };
  const withinLimits = (assessment: SegmentAssessment) =>
    assessment.velocityRadPerSec <= limits.maxVelocityRadPerSec + 1e-9
    && assessment.accelerationRadPerSec2 <= limits.maxAccelerationRadPerSec2 + 1e-9
    && assessment.jerkRadPerSec3 <= limits.maxJerkRadPerSec3 + 1e-9;

  // Shortest feasible duration wins: it keeps the overshoot of a mid-flight replan
  // as small as the limits allow.
  for (let duration = MIN_DURATION_SEC; duration <= MAX_DURATION_SEC; duration *= 1.08) {
    const candidate = build(duration);
    if (!candidate || !withinLimits(candidate.assessment)) continue;
    return {
      id: joint.id, fromRad: from, toRad: candidate.to,
      startVelocityRadPerSec: v0, startAccelerationRadPerSec2: a0,
      durationSec: duration, coefficients: candidate.coefficients, limits,
      peak: {
        velocityRadPerSec: candidate.assessment.velocityRadPerSec,
        accelerationRadPerSec2: candidate.assessment.accelerationRadPerSec2,
        jerkRadPerSec3: candidate.assessment.jerkRadPerSec3,
      },
      monotone: candidate.assessment.monotone,
    };
  }
  return null;
}

/**
 * Build the shortest honest chain for one joint.
 *
 * From rest, one quintic to the target always fits once the duration is long
 * enough. From a moving joint a single quintic can be infeasible: a large initial
 * velocity forces a wide excursion, and lengthening the segment makes that worse
 * because the initial-velocity term grows with T. In that case the chain first
 * brakes to rest at the jerk-limited stopping position and then moves from rest,
 * which is always solvable.
 */
function buildChain(
  joint: SkeletalJoint3D,
  from: number,
  to: number,
  v0: number,
  a0: number,
  limits: JointMotionLimits3D,
): JointTrajectoryChain3D {
  try {
    const segment = buildSegment(joint, from, to, v0, a0, limits);
    return { id: joint.id, segments: [segment], toRad: to, durationSec: segment.durationSec };
  } catch (error) {
    if (!(error instanceof Error) || !/limits-unreachable/.test(error.message)) throw error;
    if (Math.abs(v0) < EPS && Math.abs(a0) < EPS) throw error;
    const brake = brakeToRest(joint, from, v0, a0, limits);
    if (!brake) throw error;
    const approach = buildSegment(joint, brake.toRad, to, 0, 0, limits);
    return {
      id: joint.id,
      segments: [brake, approach],
      toRad: to,
      durationSec: brake.durationSec + approach.durationSec,
    };
  }
}

function planMatches(
  plan: TrajectoryPlan3D | null | undefined,
  joints: readonly SkeletalJoint3D[],
  targets: JointPose3D,
  tolerance: number,
): plan is TrajectoryPlan3D {
  if (!plan || plan.version !== 1 || !plan.joints || typeof plan.joints !== "object" || !finite(plan.elapsedSec)) return false;
  if (Object.keys(plan.joints).length !== joints.length) return false;
  for (const joint of joints) {
    const chain = plan.joints[joint.id];
    if (!chain || !Array.isArray(chain.segments) || chain.segments.length === 0) return false;
    if (!finite(chain.durationSec) || chain.durationSec <= 0) return false;
    if (Math.abs(chain.toRad - targetForJoint(joint, targets)) > tolerance) return false;
  }
  return true;
}

/**
 * Build a fresh plan from the measured state. This is a pure function of its
 * inputs; it neither reads a clock nor mutates the caller's objects.
 */
export function planSkeletalTrajectory3D(
  joints: readonly SkeletalJoint3D[],
  state: TrajectoryState3D,
  targets: JointPose3D,
  options: {
    limits?: Partial<JointMotionLimits3D>;
    perJointLimits?: Record<string, Partial<JointMotionLimits3D>>;
  } = {},
): TrajectoryPlan3D {
  validateSkeleton3D(joints);
  const safeState = validateTrajectoryState3D(joints, state);
  const chains: Record<string, JointTrajectoryChain3D> = Object.create(null);
  for (const joint of joints) {
    const limits = resolveLimits(joint.id, options.limits, options.perJointLimits);
    const current = safeState[joint.id] ?? {
      positionRad: clamp(joint.restAngleRad ?? 0, joint.minAngleRad, joint.maxAngleRad),
      velocityRadPerSec: 0, accelerationRadPerSec2: 0,
    };
    chains[joint.id] = buildChain(
      joint,
      clamp(current.positionRad, joint.minAngleRad, joint.maxAngleRad),
      targetForJoint(joint, targets),
      current.velocityRadPerSec,
      current.accelerationRadPerSec2,
      limits,
    );
  }
  const settled = Object.values(chains).every((chain) => chain.durationSec <= MIN_DURATION_SEC + EPS);
  return { version: 1, elapsedSec: 0, joints: chains, settled };
}

interface ChainSample3D {
  positionRad: number;
  velocityRadPerSec: number;
  accelerationRadPerSec2: number;
  clampedAtLimit: boolean;
}

/** Locate the active segment for a chain at a given elapsed time. */
function chainPosition(chain: JointTrajectoryChain3D, elapsedSec: number): {
  index: number; offsetSec: number; segment: JointTrajectorySegment3D | null;
} {
  let remaining = Math.max(0, elapsedSec);
  for (let index = 0; index < chain.segments.length; index++) {
    const segment = chain.segments[index];
    if (remaining < segment.durationSec) return { index, offsetSec: remaining, segment };
    remaining -= segment.durationSec;
  }
  return { index: chain.segments.length, offsetSec: 0, segment: null };
}

function sampleSegment(
  segment: JointTrajectorySegment3D,
  joint: SkeletalJoint3D,
  offsetSec: number,
): ChainSample3D {
  const target = clamp(segment.toRad, joint.minAngleRad, joint.maxAngleRad);
  if (offsetSec >= segment.durationSec) {
    return {
      positionRad: target, velocityRadPerSec: 0, accelerationRadPerSec2: 0,
      clampedAtLimit: target !== segment.toRad,
    };
  }
  const tau = Math.max(0, offsetSec / segment.durationSec);
  const raw = evaluate(segment.coefficients, tau);
  const positionRad = clamp(raw.p, joint.minAngleRad, joint.maxAngleRad);
  const clampedAtLimit = positionRad !== raw.p;
  return {
    positionRad,
    velocityRadPerSec: clampedAtLimit ? 0 : raw.v / segment.durationSec,
    accelerationRadPerSec2: clampedAtLimit ? 0 : raw.a / (segment.durationSec * segment.durationSec),
    clampedAtLimit,
  };
}

function sampleChain(
  chain: JointTrajectoryChain3D,
  joint: SkeletalJoint3D,
  elapsedSec: number,
): ChainSample3D {
  const { offsetSec, segment } = chainPosition(chain, elapsedSec);
  if (!segment) {
    const target = clamp(chain.toRad, joint.minAngleRad, joint.maxAngleRad);
    return {
      positionRad: target, velocityRadPerSec: 0, accelerationRadPerSec2: 0,
      clampedAtLimit: target !== chain.toRad,
    };
  }
  return sampleSegment(segment, joint, offsetSec);
}

/** Peak jerk magnitude a chain exhibits inside [fromSec, toSec]. */
function peakJerkInChainWindow(chain: JointTrajectoryChain3D, fromSec: number, toSec: number): number {
  let peak = 0;
  let cursor = Math.max(0, fromSec);
  while (cursor < toSec - 1e-12) {
    const { offsetSec, segment } = chainPosition(chain, cursor);
    if (!segment) break;
    const segmentEnd = cursor + (segment.durationSec - offsetSec);
    const windowEnd = Math.min(toSec, segmentEnd);
    const fromTau = Math.max(0, offsetSec / segment.durationSec);
    const toTau = Math.min(1, (offsetSec + (windowEnd - cursor)) / segment.durationSec);
    peak = Math.max(peak, peakJerkInWindow(segment, fromTau, toTau));
    cursor = windowEnd > cursor ? windowEnd : cursor + 1e-9;
  }
  return peak;
}

/** Largest analytic jerk magnitude the segment exhibits over [fromTau, toTau]. */
function peakJerkInWindow(segment: JointTrajectorySegment3D, fromTau: number, toTau: number): number {
  const samples = 32;
  let peak = 0;
  for (let index = 0; index <= samples; index++) {
    const tau = fromTau + ((toTau - fromTau) * index) / samples;
    peak = Math.max(peak, Math.abs(evaluate(segment.coefficients, tau).j / (segment.durationSec ** 3)));
  }
  return peak;
}

/**
 * Advance one bounded timestep. Sampling is analytic, so the result depends only
 * on the plan and the elapsed time, not on frame cadence.
 */
export function stepSkeletalTrajectory3D(
  input: SkeletalTrajectoryStepInput3D,
): SkeletalTrajectoryStepResult3D {
  const { joints, targets } = input;
  validateSkeleton3D(joints);
  const state = validateTrajectoryState3D(joints, input.state);
  const dt = input.dtSeconds;
  if (!finite(dt) || dt <= 0 || dt > 60) throw new Error("invalid-3d-trajectory-dt");
  const tolerance = input.toleranceRad ?? 1e-3;
  if (!finite(tolerance) || tolerance <= 0 || tolerance > 0.5) throw new Error("invalid-3d-trajectory-tolerance");
  const maxPlanDuration = input.maxPlanDurationSec ?? MAX_DURATION_SEC;
  if (!finite(maxPlanDuration) || maxPlanDuration < MIN_DURATION_SEC || maxPlanDuration > 600) {
    throw new Error("invalid-3d-trajectory-plan-duration");
  }

  const replanned = !planMatches(input.plan, joints, targets, tolerance);
  const plan = replanned
    ? planSkeletalTrajectory3D(joints, state, targets, {
        limits: input.limits,
        perJointLimits: input.perJointLimits,
      })
    : input.plan!;
  for (const chain of Object.values(plan.joints)) {
    if (chain.durationSec > maxPlanDuration) throw new Error("3d-trajectory-plan-too-long:" + chain.id);
  }

  const elapsedSec = plan.elapsedSec + dt;
  const nextState: TrajectoryState3D = Object.create(null);
  const rows: TrajectoryJointStep3D[] = [];
  let settled = true;
  let maxJerk = 0;

  for (const joint of joints) {
    const chain = plan.joints[joint.id];
    const sample = sampleChain(chain, joint, elapsedSec);
    if (elapsedSec < chain.durationSec) {
      maxJerk = Math.max(maxJerk, peakJerkInChainWindow(chain, plan.elapsedSec, elapsedSec));
    }
    const target = targetForJoint(joint, targets);
    const jointSettled = elapsedSec >= chain.durationSec
      && !sample.clampedAtLimit
      && Math.abs(sample.positionRad - target) <= tolerance;
    if (!jointSettled) settled = false;
    nextState[joint.id] = {
      positionRad: sample.positionRad,
      velocityRadPerSec: sample.velocityRadPerSec,
      accelerationRadPerSec2: sample.accelerationRadPerSec2,
    };
    rows.push({
      id: joint.id,
      positionRad: sample.positionRad,
      velocityRadPerSec: sample.velocityRadPerSec,
      accelerationRadPerSec2: sample.accelerationRadPerSec2,
      targetRad: target,
      settled: jointSettled,
      clampedAtLimit: sample.clampedAtLimit,
      limits: chain.segments[0].limits,
    });
  }

  return {
    state: nextState,
    joints: rows,
    plan: { version: 1, elapsedSec, joints: plan.joints, settled },
    dtSeconds: dt,
    elapsedSec,
    settled,
    replanned,
    maxAbsJerkRadPerSec3: maxJerk,
    reason: settled ? "settled" : "tracking",
  };
}

/** Drive the planner to rest at `targets`, bounded by a frame budget. */
export function runSkeletalTrajectory3D(
  joints: readonly SkeletalJoint3D[],
  startState: TrajectoryState3D,
  targets: JointPose3D,
  dtSeconds: number,
  options: {
    maxFrames?: number;
    limits?: Partial<JointMotionLimits3D>;
    perJointLimits?: Record<string, Partial<JointMotionLimits3D>>;
    toleranceRad?: number;
  } = {},
): SkeletalTrajectoryRunResult3D {
  const maxFrames = options.maxFrames ?? 512;
  if (!Number.isInteger(maxFrames) || maxFrames < 1 || maxFrames > MAX_FRAMES) throw new Error("invalid-3d-trajectory-frame-budget");
  let state = validateTrajectoryState3D(joints, startState);
  let plan: TrajectoryPlan3D | null = null;
  let maxJerk = 0, maxVelocity = 0, maxAcceleration = 0, frames = 0;
  for (; frames < maxFrames; frames++) {
    const result = stepSkeletalTrajectory3D({
      joints, state, targets, dtSeconds, plan,
      limits: options.limits,
      perJointLimits: options.perJointLimits,
      toleranceRad: options.toleranceRad,
    });
    state = result.state;
    plan = result.plan;
    maxJerk = Math.max(maxJerk, result.maxAbsJerkRadPerSec3);
    for (const row of result.joints) {
      maxVelocity = Math.max(maxVelocity, Math.abs(row.velocityRadPerSec));
      maxAcceleration = Math.max(maxAcceleration, Math.abs(row.accelerationRadPerSec2));
    }
    if (result.settled) {
      return {
        state, plan, frames: frames + 1, settled: true,
        maxAbsJerkRadPerSec3: maxJerk, maxAbsVelocityRadPerSec: maxVelocity,
        maxAbsAccelerationRadPerSec2: maxAcceleration, reason: "settled",
      };
    }
  }
  return {
    state, plan, frames, settled: false,
    maxAbsJerkRadPerSec3: maxJerk, maxAbsVelocityRadPerSec: maxVelocity,
    maxAbsAccelerationRadPerSec2: maxAcceleration, reason: "frame-budget-exhausted",
  };
}

/**
 * Project the planner state into the transport rows the app-side
 * `mapMotorFrameToSemanticPose` validates. Emits measured state only: the target
 * stays a separate field, and `available` reflects whether the joint produced a
 * finite position this frame.
 */
export function toMotorFrameJointSamples3D(
  joints: readonly SkeletalJoint3D[],
  state: TrajectoryState3D,
  targets: JointPose3D,
): MotorFrameJointSampleLike3D[] {
  validateSkeleton3D(joints);
  const safeState = validateTrajectoryState3D(joints, state);
  return joints.map((joint) => {
    const row = safeState[joint.id];
    const available = !!row && Number.isFinite(row.positionRad);
    return {
      id: joint.id,
      angleRad: available ? row.positionRad : 0,
      targetAngleRad: targetForJoint(joint, targets),
      velocityRadPerSec: available ? row.velocityRadPerSec : 0,
      accelerationRadPerSec2: available ? row.accelerationRadPerSec2 : 0,
      available,
    };
  });
}
