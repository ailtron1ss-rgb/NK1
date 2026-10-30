/**
 * NK1 Embodied Motor Controller — first shared kinematic execution substrate.
 *
 * This is a renderer-neutral control layer, not an animation clip selector.
 * It accepts semantic motor goals, applies joint limits and velocity bounds,
 * supports priority-aware interruption, and exposes a deterministic planar
 * two-bone IK primitive for adapters that have a skeletal limb.
 *
 * Angles are radians. Time is monotonic milliseconds supplied by the caller.
 * No browser, renderer, device, or wall-clock dependency is introduced.
 */

export interface JointDefinition {
  id: string;
  parentId?: string | null;
  restAngleRad?: number;
  minAngleRad: number;
  maxAngleRad: number;
  maxSpeedRadPerSec: number;
}

export interface JointState {
  id: string;
  angleRad: number;
  targetAngleRad: number;
  velocityRadPerSec: number;
  available: boolean;
}

export interface MotorGoal {
  id: string;
  action: string;
  source: "organism" | "reflex" | "user" | "recovery";
  priority: number;
  confidence01: number;
  createdAtMs: number;
  expiresAtMs?: number;
  targetJointAnglesRad: Record<string, number>;
  interruptible?: boolean;
  reason: string;
}

export interface MotorFrame {
  version: 1;
  tick: number;
  atMs: number;
  goalId: string | null;
  action: string;
  phase: "idle" | "moving" | "holding" | "rejected" | "expired";
  joints: Record<string, JointState>;
  reachedJointIds: string[];
  blockedJointIds: string[];
  completion01: number;
  reason: string;
}

export interface MotorControllerSnapshot {
  version: 1;
  tick: number;
  lastAtMs: number | null;
  joints: Record<string, JointState>;
  activeGoal: MotorGoal | null;
  lastFrame: MotorFrame | null;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
const finite = (value: unknown, fallback = 0): number =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
const clone = <T>(value: T): T => structuredClone(value);

export function validateMotorGoal(goal: MotorGoal): { ok: boolean; reason: string } {
  if (!goal || typeof goal !== "object") return { ok: false, reason: "goal-not-object" };
  if (!/^[a-z0-9][a-z0-9._:-]{1,95}$/i.test(String(goal.id ?? ""))) return { ok: false, reason: "invalid-goal-id" };
  if (!String(goal.action ?? "").trim()) return { ok: false, reason: "missing-action" };
  if (!["organism", "reflex", "user", "recovery"].includes(goal.source)) return { ok: false, reason: "invalid-source" };
  if (!Number.isFinite(goal.priority) || goal.priority < 0 || goal.priority > 100) return { ok: false, reason: "priority-out-of-range" };
  if (!Number.isFinite(goal.confidence01) || goal.confidence01 < 0 || goal.confidence01 > 1) return { ok: false, reason: "confidence-out-of-range" };
  if (!Number.isFinite(goal.createdAtMs) || goal.createdAtMs < 0) return { ok: false, reason: "invalid-created-at" };
  if (goal.expiresAtMs !== undefined && (!Number.isFinite(goal.expiresAtMs) || goal.expiresAtMs <= goal.createdAtMs)) return { ok: false, reason: "invalid-expiry" };
  if (!goal.targetJointAnglesRad || typeof goal.targetJointAnglesRad !== "object" || Array.isArray(goal.targetJointAnglesRad)) return { ok: false, reason: "invalid-joint-targets" };
  const entries = Object.entries(goal.targetJointAnglesRad);
  if (!entries.length || entries.length > 64) return { ok: false, reason: "joint-target-count-out-of-range" };
  if (entries.some(([id, angle]) => !/^[a-z][a-z0-9._-]{0,63}$/i.test(id) || !Number.isFinite(angle))) return { ok: false, reason: "invalid-joint-target" };
  return { ok: true, reason: "valid" };
}

export function createJointState(definition: JointDefinition): JointState {
  const rest = clamp(finite(definition.restAngleRad), definition.minAngleRad, definition.maxAngleRad);
  return { id: definition.id, angleRad: rest, targetAngleRad: rest, velocityRadPerSec: 0, available: true };
}

export class EmbodiedMotorController {
  private definitions = new Map<string, JointDefinition>();
  private state: MotorControllerSnapshot = {
    version: 1, tick: 0, lastAtMs: null, joints: {}, activeGoal: null, lastFrame: null,
  };

  configureSkeleton(definitions: readonly JointDefinition[]): void {
    if (!Array.isArray(definitions) || definitions.length === 0 || definitions.length > 128) {
      throw new Error("skeleton-definition-count-out-of-range");
    }
    const next = new Map<string, JointDefinition>();
    for (const raw of definitions) {
      const d = { ...raw };
      if (!/^[a-z][a-z0-9._-]{0,63}$/i.test(d.id) || next.has(d.id)) throw new Error("invalid-or-duplicate-joint-id");
      if (![d.minAngleRad, d.maxAngleRad, d.maxSpeedRadPerSec].every(Number.isFinite)
        || d.minAngleRad > d.maxAngleRad || d.maxSpeedRadPerSec <= 0 || d.maxSpeedRadPerSec > 20) {
        throw new Error(`invalid-joint-limits:${d.id}`);
      }
      if (d.parentId && d.parentId === d.id) throw new Error("joint-cannot-parent-itself");
      next.set(d.id, d);
    }
    for (const d of next.values()) if (d.parentId && !next.has(d.parentId)) throw new Error(`missing-joint-parent:${d.id}`);
    const joints: Record<string, JointState> = {};
    for (const d of next.values()) {
      const prior = this.state.joints[d.id];
      const rest = clamp(finite(d.restAngleRad), d.minAngleRad, d.maxAngleRad);
      const angle = clamp(prior?.angleRad ?? rest, d.minAngleRad, d.maxAngleRad);
      joints[d.id] = { id: d.id, angleRad: angle, targetAngleRad: angle, velocityRadPerSec: 0, available: true };
    }
    this.definitions = next;
    this.state = { ...this.state, joints, activeGoal: null, lastFrame: null };
  }

  setGoal(goal: MotorGoal, nowMs: number): { accepted: boolean; reason: string } {
    const validation = validateMotorGoal(goal);
    if (!validation.ok) return { accepted: false, reason: validation.reason };
    if (!Number.isFinite(nowMs) || nowMs < 0 || goal.createdAtMs > nowMs + 1000) return { accepted: false, reason: "invalid-goal-time" };
    if (goal.expiresAtMs !== undefined && goal.expiresAtMs <= nowMs) return { accepted: false, reason: "goal-already-expired" };
    if (!this.definitions.size) return { accepted: false, reason: "skeleton-not-configured" };
    const unknown = Object.keys(goal.targetJointAnglesRad).filter((id) => !this.definitions.has(id));
    if (unknown.length) return { accepted: false, reason: `unknown-joints:${unknown.slice(0, 4).join(",")}` };
    const current = this.state.activeGoal;
    if (current && current.id !== goal.id && current.interruptible === false && goal.priority <= current.priority) {
      return { accepted: false, reason: "active-goal-protected" };
    }
    if (current && current.id !== goal.id && goal.priority < current.priority) {
      return { accepted: false, reason: "lower-priority-than-active-goal" };
    }
    for (const [id, target] of Object.entries(goal.targetJointAnglesRad)) {
      const definition = this.definitions.get(id)!;
      this.state.joints[id].targetAngleRad = clamp(target, definition.minAngleRad, definition.maxAngleRad);
    }
    this.state.activeGoal = clone(goal);
    return { accepted: true, reason: "goal-accepted" };
  }

  cancelGoal(reason = "goal-cancelled"): void {
    this.state.activeGoal = null;
    for (const joint of Object.values(this.state.joints)) joint.targetAngleRad = joint.angleRad;
    this.state.lastFrame = this.makeFrame(this.state.lastAtMs ?? 0, "holding", reason);
  }

  step(nowMs: number): MotorFrame {
    if (!Number.isFinite(nowMs) || nowMs < 0) throw new Error("invalid-monotonic-time");
    if (this.state.lastAtMs !== null && nowMs < this.state.lastAtMs) throw new Error("motor-clock-must-be-monotonic");
    const dt = this.state.lastAtMs === null ? 0 : Math.min(0.1, (nowMs - this.state.lastAtMs) / 1000);
    this.state.lastAtMs = nowMs;
    this.state.tick++;
    const goal = this.state.activeGoal;
    if (goal?.expiresAtMs !== undefined && nowMs >= goal.expiresAtMs) {
      this.cancelGoal("goal-expired");
      const expired = this.makeFrame(nowMs, "expired", "goal-expired");
      this.state.lastFrame = clone(expired);
      return expired;
    }
    if (!goal) {
      const idle = this.makeFrame(nowMs, "idle", "no-active-motor-goal");
      this.state.lastFrame = clone(idle);
      return idle;
    }

    const reached: string[] = [];
    const blocked: string[] = [];
    let totalError = 0;
    let totalDistance = 0;
    for (const [id, definition] of this.definitions) {
      const joint = this.state.joints[id];
      const target = joint.targetAngleRad;
      const delta = target - joint.angleRad;
      const distance = Math.abs(delta);
      totalDistance += Math.abs(target - (definition.restAngleRad ?? 0)) + 1e-6;
      totalError += distance;
      if (distance <= 0.002) {
        joint.angleRad = target;
        joint.velocityRadPerSec = 0;
        reached.push(id);
        continue;
      }
      const maxStep = definition.maxSpeedRadPerSec * dt;
      if (maxStep <= 0) { joint.velocityRadPerSec = 0; continue; }
      const applied = Math.sign(delta) * Math.min(distance, maxStep);
      const next = clamp(joint.angleRad + applied, definition.minAngleRad, definition.maxAngleRad);
      joint.velocityRadPerSec = dt > 0 ? (next - joint.angleRad) / dt : 0;
      joint.angleRad = next;
      if (Math.abs(target - next) <= 0.002) reached.push(id);
    }
    const completion = this.completion01();
    const moving = Object.values(this.state.joints).some((j) => Math.abs(j.targetAngleRad - j.angleRad) > 0.002);
    const phase = moving ? "moving" : "holding";
    const frame = this.makeFrame(nowMs, phase, moving ? "bounded-joint-motion-in-progress" : "motor-goal-reached", reached, blocked, completion);
    this.state.lastFrame = clone(frame);
    return frame;
  }

  completion01(): number {
    const joints = Object.values(this.state.joints);
    if (!joints.length) return 0;
    const errors = joints.map((j) => Math.abs(j.targetAngleRad - j.angleRad));
    const scale = Math.PI / 2;
    return clamp(1 - errors.reduce((sum, e) => sum + Math.min(1, e / scale), 0) / joints.length, 0, 1);
  }

  snapshot(): MotorControllerSnapshot { return clone(this.state); }

  restore(raw: Partial<MotorControllerSnapshot> | null | undefined): void {
    const joints: Record<string, JointState> = {};
    for (const [id, definition] of this.definitions) {
      const prior = raw?.joints?.[id];
      const rest = clamp(finite(definition.restAngleRad), definition.minAngleRad, definition.maxAngleRad);
      const angle = clamp(finite(prior?.angleRad, rest), definition.minAngleRad, definition.maxAngleRad);
      const target = clamp(finite(prior?.targetAngleRad, angle), definition.minAngleRad, definition.maxAngleRad);
      joints[id] = { id, angleRad: angle, targetAngleRad: target, velocityRadPerSec: clamp(finite(prior?.velocityRadPerSec), -definition.maxSpeedRadPerSec, definition.maxSpeedRadPerSec), available: true };
    }
    const active = raw?.activeGoal && validateMotorGoal(raw.activeGoal).ok ? clone(raw.activeGoal) : null;
    this.state = {
      version: 1, tick: Math.max(0, Math.floor(finite(raw?.tick))), lastAtMs: raw?.lastAtMs === null || raw?.lastAtMs === undefined ? null : Math.max(0, finite(raw.lastAtMs)),
      joints, activeGoal: active, lastFrame: raw?.lastFrame ? clone(raw.lastFrame) : null,
    };
  }

  private makeFrame(atMs: number, phase: MotorFrame["phase"], reason: string, reachedJointIds: string[] = [], blockedJointIds: string[] = [], completion01 = this.completion01()): MotorFrame {
    return {
      version: 1, tick: this.state.tick, atMs, goalId: this.state.activeGoal?.id ?? null,
      action: this.state.activeGoal?.action ?? "none", phase, joints: clone(this.state.joints),
      reachedJointIds, blockedJointIds, completion01, reason,
    };
  }
}

export interface TwoBoneIKResult {
  reachable: boolean;
  shoulderAngleRad: number;
  elbowAngleRad: number;
  clampedTarget: { x: number; y: number };
  reachError: number;
}

/** Stable planar two-bone IK; returns angles in radians and clamps unreachable targets. */
export function solvePlanarTwoBoneIK(input: {
  upperLength: number;
  lowerLength: number;
  targetX: number;
  targetY: number;
  bendDirection?: 1 | -1;
}): TwoBoneIKResult {
  const { upperLength: a, lowerLength: b } = input;
  if (![a, b, input.targetX, input.targetY].every(Number.isFinite) || a <= 0 || b <= 0 || a > 10 || b > 10) {
    throw new Error("invalid-two-bone-ik-input");
  }
  const minReach = Math.abs(a - b) + 1e-6;
  const maxReach = a + b - 1e-6;
  const rawDistance = Math.hypot(input.targetX, input.targetY);
  const distance = clamp(rawDistance, minReach, maxReach);
  const scale = rawDistance > 1e-9 ? distance / rawDistance : 1;
  const x = rawDistance > 1e-9 ? input.targetX * scale : minReach;
  const y = rawDistance > 1e-9 ? input.targetY * scale : 0;
  const cosElbow = clamp((distance * distance - a * a - b * b) / (2 * a * b), -1, 1);
  const direction = input.bendDirection === -1 ? -1 : 1;
  const elbow = direction * Math.acos(cosElbow);
  const shoulder = Math.atan2(y, x) - Math.atan2(b * Math.sin(elbow), a + b * Math.cos(elbow));
  return {
    reachable: rawDistance >= minReach && rawDistance <= maxReach,
    shoulderAngleRad: shoulder,
    elbowAngleRad: elbow,
    clampedTarget: { x, y },
    reachError: Math.abs(rawDistance - distance),
  };
}
