import type { VRM, VRMMeta } from "@pixiv/three-vrm";
import type { Euler, Object3D } from "three";

export interface VrmExpressionFrame {
  emotion: string;
  speaking: boolean;
  mouthOpen: number;
  mouthForm: number;
  blink: boolean;
}

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

const EMOTION_PRESETS: Record<string, { expression: string; weight: number }> = {
  joy: { expression: "happy", weight: 0.78 },
  anger: { expression: "angry", weight: 0.72 },
  frustration: { expression: "angry", weight: 0.6 },
  sadness: { expression: "sad", weight: 0.68 },
  anxiety: { expression: "sad", weight: 0.34 },
  calm: { expression: "relaxed", weight: 0.24 },
  protective: { expression: "relaxed", weight: 0.28 },
};

const MOUTH_PRESETS = ["aa", "ih", "ou", "ee", "oh"] as const;

export interface VrmNormalizedMotorFrame {
  action: string;
  emotion: string;
  gazeX: number;
  gazeY: number;
  cognitiveLoad: number;
  energy: number;
  socialNeed: number;
  uncertainty: number;
  speaking: boolean;
}

type NormalizedBoneNode = Object3D & { rotation: Euler };

export interface VrmNormalizedMotorRig {
  head: NormalizedBoneNode | null;
  neck: NormalizedBoneNode | null;
  leftUpperArm: NormalizedBoneNode | null;
  rightUpperArm: NormalizedBoneNode | null;
}

export interface VrmNormalizedMotorResult {
  applied: boolean;
  reason: "normalized-motor-applied" | "normalized-rig-unavailable";
  controlledBones: string[];
  available: {
    head: boolean;
    neck: boolean;
    leftUpperArm: boolean;
    rightUpperArm: boolean;
  };
}

const clampSigned = (value: number, min = -1, max = 1): number =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : 0;

/**
 * Use the canonical VRM normalized proxy rig as the one humanoid command
 * surface. VRMHumanoid.update() then transfers it to raw bones inside vrm.update.
 * This avoids a second raw-bone controller and keeps the motor independent
 * of author-specific local bone axes.
 */
export function configureVrmForNk1NormalizedMotorDrive(vrm: VRM): void {
  vrm.humanoid.autoUpdateHumanBones = true;
  vrm.expressionManager?.resetValues();
}

export function resolveVrmNormalizedMotorRig(vrm: VRM): VrmNormalizedMotorRig {
  const humanoid = vrm?.humanoid;
  if (!humanoid || typeof humanoid.getNormalizedBoneNode !== "function") {
    return { head: null, neck: null, leftUpperArm: null, rightUpperArm: null };
  }

  const resolve = (name: "head" | "neck" | "leftUpperArm" | "rightUpperArm") => {
    try {
      return humanoid.getNormalizedBoneNode(name) as NormalizedBoneNode | null;
    } catch {
      return null;
    }
  };

  return {
    head: resolve("head"),
    neck: resolve("neck"),
    leftUpperArm: resolve("leftUpperArm"),
    rightUpperArm: resolve("rightUpperArm"),
  };
}

/**
 * Apply existing NK1 motor intent to normalized VRM proxy bones.
 * These are deliberate high-level gaze/gesture offsets, not a fabricated IK
 * target. Every frame is written from identity to prevent accumulated drift.
 */
export function applyVrmNormalizedMotorFrame(
  vrm: VRM,
  frame: VrmNormalizedMotorFrame,
): VrmNormalizedMotorResult {
  const rig = resolveVrmNormalizedMotorRig(vrm);
  const entries = Object.entries(rig) as [keyof VrmNormalizedMotorRig, NormalizedBoneNode | null][];
  const seen = new Set<Object3D>();
  for (const [, node] of entries) {
    if (!node || seen.has(node)) continue;
    seen.add(node);
    node.rotation.set(0, 0, 0);
  }

  const available = {
    head: Boolean(rig.head),
    neck: Boolean(rig.neck),
    leftUpperArm: Boolean(rig.leftUpperArm),
    rightUpperArm: Boolean(rig.rightUpperArm),
  };
  const controlledBones: string[] = [];
  const gazeX = clampSigned(frame.gazeX);
  const gazeY = clampSigned(frame.gazeY);
  const load = clamp01(frame.cognitiveLoad);
  const energy = clamp01(frame.energy);
  const social = clamp01(frame.socialNeed);
  const uncertainty = clamp01(frame.uncertainty);

  const headX = -gazeY * 0.12 - load * 0.035 + (1 - energy) * 0.04;
  const headY = gazeX * (0.22 - social * 0.05) + uncertainty * 0.025;
  const headZ = frame.emotion === "sadness"
    ? 0.055
    : frame.emotion === "anger" || frame.emotion === "frustration" ? -0.04 : 0;

  if (rig.head && rig.neck && rig.head !== rig.neck) {
    rig.neck.rotation.set(headX * 0.35, headY * 0.35, headZ * 0.35);
    rig.head.rotation.set(headX * 0.65, headY * 0.65, headZ * 0.65);
    controlledBones.push("neck", "head");
  } else if (rig.head || rig.neck) {
    const node = rig.head ?? rig.neck;
    node.rotation.set(headX, headY, headZ);
    controlledBones.push(rig.head ? "head" : "neck");
  }

  if (rig.leftUpperArm) {
    rig.leftUpperArm.rotation.z = frame.action === "explore" ? -0.14 : 0;
    controlledBones.push("leftUpperArm");
  }
  if (rig.rightUpperArm) {
    rig.rightUpperArm.rotation.z = frame.action === "respond" && frame.speaking
      ? -0.26
      : frame.action === "verify" ? -0.18 : 0;
    controlledBones.push("rightUpperArm");
  }

  return {
    applied: controlledBones.length > 0,
    reason: controlledBones.length ? "normalized-motor-applied" : "normalized-rig-unavailable",
    controlledBones,
    available,
  };
}

/** Set standard VRM preset expressions from the same NK1 affect/speech frame. */
export function applyVrmExpressionFrame(vrm: VRM, frame: VrmExpressionFrame): void {
  const manager = vrm.expressionManager;
  if (!manager) return;

  manager.resetValues();

  const preset = EMOTION_PRESETS[frame.emotion];
  if (preset) manager.setValue(preset.expression, preset.weight);

  if (frame.speaking) {
    const form = Number.isFinite(frame.mouthForm) ? frame.mouthForm : 0;
    const index = form < -0.35 ? 4 : form < -0.1 ? 2 : form > 0.45 ? 3 : form > 0.15 ? 1 : 0;
    manager.setValue(MOUTH_PRESETS[index], clamp01(frame.mouthOpen));
  }
  if (frame.blink) manager.setValue("blink", 1);
}

/** Call once per frame after NK1 writes raw body pose and expression weights. */
export function updateVrmForNk1Frame(vrm: VRM | null, deltaSeconds: number): void {
  if (!vrm || !Number.isFinite(deltaSeconds) || deltaSeconds < 0) return;
  vrm.update(Math.min(deltaSeconds, 0.05));
}

export interface VrmMetaSummary {
  modelName: string;
  authors: string[];
  license: string;
  avatarPermission: string;
  credit: string;
}

/** Safe display-only metadata summary; it is not an authorization decision. */
export function summarizeVrmMeta(meta: VRMMeta | null | undefined): VrmMetaSummary {
  if (!meta) {
    return { modelName: "VRM model", authors: [], license: "not declared", avatarPermission: "not declared", credit: "not declared" };
  }

  if (meta.metaVersion === "1") {
    return {
      modelName: String(meta.name || "VRM model").slice(0, 120),
      authors: Array.isArray(meta.authors) ? meta.authors.filter((item) => typeof item === "string").slice(0, 12).map((item) => item.slice(0, 120)) : [],
      license: String(meta.licenseUrl || meta.otherLicenseUrl || "not declared").slice(0, 240),
      avatarPermission: String(meta.avatarPermission || "not declared"),
      credit: String(meta.creditNotation || "not declared"),
    };
  }

  return {
    modelName: String(meta.title || "VRM model").slice(0, 120),
    authors: typeof meta.author === "string" && meta.author ? [meta.author.slice(0, 120)] : [],
    license: String(meta.licenseName || meta.otherLicenseUrl || "not declared").slice(0, 240),
    avatarPermission: String(meta.allowedUserName || "not declared"),
    credit: "check model license",
  };
}
