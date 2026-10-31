/**
 * NK1 Aspect 13: canonical body-rig profiles.
 * Profiles adapt one MotorFrame to a specific renderer; they never own a second controller.
 * Live2D mappings are approximate Cubism parameters, not claims of free skeletal joints.
 */
import type { JointDefinition, MotorFrame } from "./EmbodiedMotorController.ts";
import { validateMotorFrameForTransport } from "./MotorFrameChannel.ts";
import type { SkeletalJoint3D, Vec3 } from "./SkeletalKinematics3D.ts";

const CORE = [
  "pelvis.yaw","pelvis.pitch","pelvis.roll","torso.yaw","torso.pitch","torso.roll",
  "neck.yaw","neck.pitch","neck.roll","head.yaw","head.pitch","head.roll",
  "left.shoulder.pitch","left.shoulder.abduction","left.shoulder.rotation","left.elbow.flexion","left.forearm.pronation","left.wrist.flexion","left.wrist.deviation",
  "right.shoulder.pitch","right.shoulder.abduction","right.shoulder.rotation","right.elbow.flexion","right.forearm.pronation","right.wrist.flexion","right.wrist.deviation",
  "left.hip.flexion","left.hip.abduction","left.hip.rotation","left.knee.flexion","left.ankle.dorsiflexion","left.ankle.inversion","left.toe.flexion",
  "right.hip.flexion","right.hip.abduction","right.hip.rotation","right.knee.flexion","right.ankle.dorsiflexion","right.ankle.inversion","right.toe.flexion"
] as const;
const HANDS = [
  "left.hand.thumb.flexion","left.hand.thumb.abduction","left.hand.thumb.opposition","left.hand.index.flexion","left.hand.index.abduction",
  "left.hand.middle.flexion","left.hand.middle.abduction","left.hand.ring.flexion","left.hand.ring.abduction","left.hand.little.flexion","left.hand.little.abduction",
  "right.hand.thumb.flexion","right.hand.thumb.abduction","right.hand.thumb.opposition","right.hand.index.flexion","right.hand.index.abduction",
  "right.hand.middle.flexion","right.hand.middle.abduction","right.hand.ring.flexion","right.hand.ring.abduction","right.hand.little.flexion","right.hand.little.abduction"
] as const;

export const CANONICAL_MOTOR_JOINT_ROLES = [...CORE, ...HANDS] as const;
export type CanonicalMotorJointRole = typeof CANONICAL_MOTOR_JOINT_ROLES[number];
export type MotorRendererKind = "live2d" | "depth2d" | "vrm3d";
export type MotorBindingComponent = "value" | "x" | "y" | "z" | "rotation";
export type RendererMotorValueUnit = "parameter" | "radians" | "degrees" | "normalized" | "meters";
type TargetKind = "cubism-parameter" | "depth-rig-node" | "humanoid-bone";
type Fidelity = "direct" | "approximate";

export interface MotorRigBinding {
  targetId: string;
  targetKind: TargetKind;
  component: MotorBindingComponent;
  scale: number;
  offset: number;
  minValue: number;
  maxValue: number;
  fidelity: Fidelity;
  requiredInFrame: boolean;
}
export interface MotorRigJointProfile {
  id: string;
  role: CanonicalMotorJointRole;
  parentId: string | null;
  minAngleRad: number;
  maxAngleRad: number;
  restAngleRad: number;
  maxSpeedRadPerSec: number;
  maxAccelerationRadPerSec2: number;
  maxJerkRadPerSec3: number;
  geometry?: { offset: Vec3; axis: Vec3 };
  binding: MotorRigBinding;
}
export interface MotorRigProfileV1 {
  schemaVersion: 1;
  profileId: string;
  modelId: string;
  revision: number;
  renderer: MotorRendererKind;
  coordinateFrame: { handedness: "right"; upAxis: "y"; forwardAxis: "+z" | "-z"; positionUnit: "meters" | "normalized"; angleUnit: "radians" };
  calibration: { status: "calibrated" | "test-fixture"; evidenceId?: string; calibratedAt?: string; verifierVersion?: string };
  joints: readonly MotorRigJointProfile[];
}
export interface MotorRigValidation { ok: boolean; reason: string; jointCount: number }
export interface MotorRigCompileOptions { allowTestFixture?: boolean }
export interface RendererMotorCommand {
  jointId: string; role: CanonicalMotorJointRole; targetId: string; targetKind: TargetKind;
  component: MotorBindingComponent; value: number; valueUnit: RendererMotorValueUnit; fidelity: Fidelity; clamped: boolean;
}
export interface RendererMotorCommandBatch {
  version: 1; profileId: string; modelId: string; renderer: MotorRendererKind;
  frameTick: number; frameAtMs: number; goalId: string | null;
  commands: RendererMotorCommand[]; unmappedFrameJointIds: string[]; clampedJointIds: string[];
}
export interface MotorRigCapabilities {
  profileId: string; renderer: MotorRendererKind; calibrated: boolean;
  availableRoles: CanonicalMotorJointRole[]; directlyControllableRoles: CanonicalMotorJointRole[];
  approximatedRoles: CanonicalMotorJointRole[]; hasSpatialKinematicGeometry: boolean;
  supportsIndependentFingerChannels: boolean;
  supportsRootTranslation: false; supportsContactDynamics: false; supportsBalanceDynamics: false;
}

const ROLES = new Set<string>(CANONICAL_MOTOR_JOINT_ROLES);
const ID = /^[a-z][a-z0-9._-]{0,63}$/i;
const PROFILE_ID = /^[a-z0-9][a-z0-9._:-]{1,95}$/i;
const TARGET_KIND: Record<MotorRendererKind, TargetKind> = { live2d: "cubism-parameter", depth2d: "depth-rig-node", vrm3d: "humanoid-bone" };
const POSITION_UNIT: Record<MotorRendererKind, "meters" | "normalized"> = { live2d: "normalized", depth2d: "normalized", vrm3d: "meters" };
const isObject = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
const vec = (v: unknown): v is Vec3 => isObject(v) && [v.x, v.y, v.z].every((n) => typeof n === "number" && Number.isFinite(n));
const fail = (reason: string, jointCount = 0): MotorRigValidation => ({ ok: false, reason, jointCount });

export function validateMotorRigProfile(raw: unknown): MotorRigValidation {
  if (!isObject(raw) || raw.schemaVersion !== 1) return fail("profile-schema-invalid");
  if (typeof raw.profileId !== "string" || !PROFILE_ID.test(raw.profileId) || typeof raw.modelId !== "string" || !PROFILE_ID.test(raw.modelId)) return fail("profile-identity-invalid");
  if (!Number.isSafeInteger(raw.revision) || raw.revision < 1) return fail("profile-revision-invalid");
  if (!(raw.renderer in TARGET_KIND)) return fail("renderer-kind-invalid");
  const renderer = raw.renderer as MotorRendererKind;
  const cf = raw.coordinateFrame;
  if (!isObject(cf) || cf.handedness !== "right" || cf.upAxis !== "y" || !["+z","-z"].includes(cf.forwardAxis)
    || cf.angleUnit !== "radians" || cf.positionUnit !== POSITION_UNIT[renderer]) return fail("coordinate-frame-invalid");
  const cal = raw.calibration;
  if (!isObject(cal) || !["calibrated","test-fixture"].includes(cal.status)) return fail("calibration-status-invalid");
  if (cal.status === "calibrated" && (typeof cal.evidenceId !== "string" || !PROFILE_ID.test(cal.evidenceId)
    || typeof cal.verifierVersion !== "string" || !cal.verifierVersion.trim()
    || typeof cal.calibratedAt !== "string" || !Number.isFinite(Date.parse(cal.calibratedAt)))) return fail("calibration-evidence-missing");
  if (!Array.isArray(raw.joints) || raw.joints.length < 1 || raw.joints.length > 128) return fail("joint-count-invalid");
  const joints = raw.joints as unknown[];
  const byId = new Map<string, Record<string, any>>();
  const roles = new Set<string>();
  const targets = new Set<string>();
  for (const value of joints) {
    if (!isObject(value)) return fail("joint-not-object", joints.length);
    const j = value;
    if (typeof j.id !== "string" || !ID.test(j.id) || byId.has(j.id)) return fail("joint-id-duplicate-or-invalid", joints.length);
    if (typeof j.role !== "string" || !ROLES.has(j.role) || roles.has(j.role)) return fail("joint-role-duplicate-or-invalid", joints.length);
    if (j.parentId !== null && (typeof j.parentId !== "string" || !ID.test(j.parentId) || j.parentId === j.id)) return fail("joint-parent-invalid", joints.length);
    const nums = [j.minAngleRad,j.maxAngleRad,j.restAngleRad,j.maxSpeedRadPerSec,j.maxAccelerationRadPerSec2,j.maxJerkRadPerSec3];
    if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return fail("joint-limit-non-finite", joints.length);
    if (j.minAngleRad < -Math.PI * 2 || j.maxAngleRad > Math.PI * 2 || j.minAngleRad > j.maxAngleRad
      || j.restAngleRad < j.minAngleRad || j.restAngleRad > j.maxAngleRad) return fail("joint-angle-range-invalid", joints.length);
    if (j.maxSpeedRadPerSec <= 0 || j.maxSpeedRadPerSec > 20 || j.maxAccelerationRadPerSec2 <= 0
      || j.maxAccelerationRadPerSec2 > 200 || j.maxJerkRadPerSec3 <= 0 || j.maxJerkRadPerSec3 > 2000) return fail("joint-dynamics-invalid", joints.length);
    if (renderer === "live2d") {
      if (j.geometry !== undefined) return fail("live2d-must-not-claim-spatial-geometry", joints.length);
    } else {
      if (!isObject(j.geometry) || !vec(j.geometry.offset) || !vec(j.geometry.axis)) return fail("spatial-joint-geometry-missing", joints.length);
      if (Math.abs(Math.hypot(j.geometry.axis.x,j.geometry.axis.y,j.geometry.axis.z)-1) > 0.001) return fail("joint-axis-not-normalized", joints.length);
      if (Math.max(Math.abs(j.geometry.offset.x),Math.abs(j.geometry.offset.y),Math.abs(j.geometry.offset.z)) > 10) return fail("joint-offset-out-of-range", joints.length);
    }
    const b = j.binding;
    if (!isObject(b) || typeof b.targetId !== "string" || !ID.test(b.targetId)) return fail("renderer-binding-invalid", joints.length);
    if (b.targetKind !== TARGET_KIND[renderer]) return fail("renderer-binding-kind-mismatch", joints.length);
    if (renderer === "live2d" ? b.component !== "value"
      : renderer === "depth2d" ? !["x","y","z","rotation"].includes(b.component)
      : !["x","y","z"].includes(b.component)) return fail("renderer-binding-component-mismatch", joints.length);
    const targetKey = b.targetKind + ":" + b.targetId + ":" + b.component;
    if (targets.has(targetKey)) return fail("renderer-target-channel-duplicate", joints.length);
    if (![b.scale,b.offset,b.minValue,b.maxValue].every((n) => typeof n === "number" && Number.isFinite(n))
      || Math.abs(b.scale) < 0.000001 || Math.abs(b.scale) > 1000 || b.minValue >= b.maxValue) return fail("renderer-binding-range-invalid", joints.length);
    if (typeof b.requiredInFrame !== "boolean" || !["direct","approximate"].includes(b.fidelity)) return fail("renderer-binding-policy-invalid", joints.length);
    if (renderer === "live2d" && b.fidelity !== "approximate") return fail("live2d-binding-must-be-approximate", joints.length);
    targets.add(targetKey); roles.add(j.role); byId.set(j.id,j);
  }
  for (const j of joints as Record<string, any>[]) if (j.parentId !== null && !byId.has(j.parentId)) return fail("joint-parent-not-found", joints.length);
  for (const j of joints as Record<string, any>[]) {
    const seen = new Set<string>([j.id]); let parent: string | null = j.parentId;
    while (parent) { if (seen.has(parent)) return fail("joint-parent-cycle", joints.length); seen.add(parent); parent = byId.get(parent)?.parentId ?? null; }
  }
  return { ok: true, reason: "valid", jointCount: joints.length };
}

function assertProfile(profile: MotorRigProfileV1, options: MotorRigCompileOptions = {}): void {
  const valid = validateMotorRigProfile(profile);
  if (!valid.ok) throw new Error("invalid-motor-rig-profile:" + valid.reason);
  if (profile.calibration.status !== "calibrated" && !options.allowTestFixture) throw new Error("motor-rig-profile-not-production-calibrated");
}

export function compileMotorJointDefinitions(profile: MotorRigProfileV1, options: MotorRigCompileOptions = {}): JointDefinition[] {
  assertProfile(profile, options);
  return profile.joints.map((j) => ({
    id: j.id, parentId: j.parentId, minAngleRad: j.minAngleRad, maxAngleRad: j.maxAngleRad,
    restAngleRad: j.restAngleRad, maxSpeedRadPerSec: j.maxSpeedRadPerSec,
    maxAccelerationRadPerSec2: j.maxAccelerationRadPerSec2, maxJerkRadPerSec3: j.maxJerkRadPerSec3
  }));
}

export function compileSkeletalJoints3D(profile: MotorRigProfileV1, options: MotorRigCompileOptions = {}): SkeletalJoint3D[] {
  assertProfile(profile, options);
  if (profile.renderer === "live2d") throw new Error("live2d-profile-has-no-spatial-skeleton");
  return profile.joints.map((j) => {
    if (!j.geometry) throw new Error("spatial-joint-geometry-missing:" + j.id);
    return { id: j.id, parentId: j.parentId, offset: { ...j.geometry.offset }, axis: { ...j.geometry.axis },
      minAngleRad: j.minAngleRad, maxAngleRad: j.maxAngleRad, restAngleRad: j.restAngleRad };
  });
}

export function mapMotorFrameToRendererCommands(profile: MotorRigProfileV1, frame: MotorFrame, options: MotorRigCompileOptions = {}): {
  ok: boolean; reason: string; batch: RendererMotorCommandBatch | null
} {
  try { assertProfile(profile, options); } catch (e) { return { ok: false, reason: e instanceof Error ? e.message : "profile-invalid", batch: null }; }
  const valid = validateMotorFrameForTransport(frame);
  if (!valid.ok) return { ok: false, reason: "motor-frame-invalid:" + valid.reason, batch: null };
  const commands: RendererMotorCommand[] = [];
  const clamped: string[] = [];
  const mapped = new Set(profile.joints.map((j) => j.id));
  for (const j of profile.joints) {
    const state = frame.joints[j.id];
    if (!state || !state.available) {
      if (j.binding.requiredInFrame) return { ok: false, reason: "required-joint-missing-or-unavailable:" + j.id, batch: null };
      continue;
    }
    if (state.angleRad < j.minAngleRad - 1e-5 || state.angleRad > j.maxAngleRad + 1e-5) return { ok: false, reason: "joint-angle-outside-profile:" + j.id, batch: null };
    const raw = state.angleRad * j.binding.scale + j.binding.offset;
    const value = Math.max(j.binding.minValue, Math.min(j.binding.maxValue, raw));
    const isClamped = Math.abs(raw - value) > 1e-9;
    if (isClamped) clamped.push(j.id);
    commands.push({ jointId: j.id, role: j.role, targetId: j.binding.targetId, targetKind: j.binding.targetKind,
      component: j.binding.component, value,
      valueUnit: profile.renderer === "live2d" ? "parameter"
        : profile.renderer === "depth2d" ? (j.binding.component === "rotation" ? "degrees" : "normalized")
        : "radians",
      fidelity: j.binding.fidelity, clamped: isClamped });
  }
  if (!commands.length) return { ok: false, reason: "motor-frame-has-no-mappable-joints", batch: null };
  return { ok: true, reason: "renderer-command-batch-ready", batch: {
    version: 1, profileId: profile.profileId, modelId: profile.modelId, renderer: profile.renderer,
    frameTick: frame.tick, frameAtMs: frame.atMs, goalId: frame.goalId, commands,
    unmappedFrameJointIds: Object.keys(frame.joints).filter((id) => !mapped.has(id)), clampedJointIds: clamped
  }};
}

export function describeMotorRigCapabilities(profile: MotorRigProfileV1): MotorRigCapabilities {
  assertProfile(profile, { allowTestFixture: true });
  const availableRoles = profile.joints.map((j) => j.role);
  return {
    profileId: profile.profileId, renderer: profile.renderer, calibrated: profile.calibration.status === "calibrated",
    availableRoles, directlyControllableRoles: profile.joints.filter((j) => j.binding.fidelity === "direct").map((j) => j.role),
    approximatedRoles: profile.joints.filter((j) => j.binding.fidelity === "approximate").map((j) => j.role),
    hasSpatialKinematicGeometry: profile.renderer !== "live2d" && profile.joints.every((j) => !!j.geometry),
    supportsIndependentFingerChannels: availableRoles.some((role) => role.includes(".hand.")),
    supportsRootTranslation: false, supportsContactDynamics: false, supportsBalanceDynamics: false
  };
}
