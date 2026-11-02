import type { VRM, VRMMeta } from "@pixiv/three-vrm";

export interface VrmExpressionFrame {
  emotion: string;
  speaking: boolean;
  mouthOpen: number;
  mouthForm: number;
  blink: boolean;
  /** Canonical organism affect signals; optional for legacy callers. */
  arousal?: number;
  valence?: number;
  dominance?: number;
  energy?: number;
  cognitiveLoad?: number;
  uncertainty?: number;
  socialNeed?: number;
  novelty?: number;
  curiosity?: number;
  warmth?: number;
  composure?: number;
  guardedness?: number;
}

export interface VrmEmotionExpression {
  expression: string;
  weight: number;
}

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

const readUnit = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? clamp01(value) : fallback;

const EMOTION_PRESETS: Record<string, { expression: string; weight: number }> = {
  joy: { expression: "happy", weight: 0.78 },
  anger: { expression: "angry", weight: 0.72 },
  frustration: { expression: "angry", weight: 0.6 },
  sadness: { expression: "sad", weight: 0.68 },
  anxiety: { expression: "sad", weight: 0.34 },
  calm: { expression: "relaxed", weight: 0.24 },
  protective: { expression: "relaxed", weight: 0.28 },
  curiosity: { expression: "surprised", weight: 0.36 },
};

 /**
  * Resolve the VRM face from the same affect/trait snapshot used by the
  * procedural 3D face. Emotion selects the semantic preset; appraisal and
  * personality modulate its intensity without introducing a second emotion
  * owner. Values are bounded and optional for backwards compatibility.
  */
export function resolveVrmEmotionExpression(
  frame: VrmExpressionFrame,
): VrmEmotionExpression | null {
  const preset = EMOTION_PRESETS[frame.emotion];
  if (!preset) return null;

  const arousal = readUnit(frame.arousal, 0.35);
  const valence = readUnit(frame.valence, 0.5);
  const dominance = readUnit(frame.dominance, 0.5);
  const uncertainty = readUnit(frame.uncertainty, 0.25);
  const socialNeed = readUnit(frame.socialNeed, 0.3);
  const novelty = readUnit(frame.novelty, 0.3);
  const curiosity = readUnit(frame.curiosity, 0.5);
  const warmth = readUnit(frame.warmth, 0.5);
  const composure = readUnit(frame.composure, 0.5);
  const guardedness = readUnit(frame.guardedness, 0.5);

  const activation = 0.55 + 0.45 * arousal;
  let multiplier = activation;
  switch (frame.emotion) {
    case "joy":
      multiplier *= (0.72 + 0.28 * valence) * (0.9 + 0.1 * warmth);
      break;
    case "anger":
      multiplier *= (0.78 + 0.22 * dominance) * (0.9 + 0.1 * guardedness);
      break;
    case "frustration":
      multiplier *= (0.78 + 0.22 * (1 - dominance)) * (0.9 + 0.1 * guardedness);
      break;
    case "sadness":
      multiplier = (0.55 + 0.45 * (1 - arousal)) * (0.65 + 0.35 * (1 - valence));
      break;
    case "anxiety":
      multiplier *= 0.6 + 0.4 * uncertainty;
      break;
    case "calm":
      multiplier = (0.6 + 0.4 * composure) * (1 - 0.35 * arousal);
      break;
    case "protective":
      multiplier = (0.7 + 0.3 * warmth) * (0.7 + 0.3 * socialNeed);
      break;
    case "curiosity":
      multiplier = (0.55 + 0.25 * curiosity + 0.2 * novelty) * (0.85 + 0.15 * uncertainty);
      break;
  }

  return {
    expression: preset.expression,
    weight: clamp01(preset.weight * multiplier),
  };
}

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
  leftArmIntent?: number;
  rightArmIntent?: number;
}

type NormalizedBoneNode = { rotation: { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown } };

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
  const seen = new Set<NormalizedBoneNode>();
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
  } else {
    const node = rig.head ?? rig.neck;
    if (node) {
      node.rotation.set(headX, headY, headZ);
      controlledBones.push(rig.head ? "head" : "neck");
    }
  }

  if (rig.leftUpperArm) {
    rig.leftUpperArm.rotation.z = clampSigned(frame.leftArmIntent ?? (frame.action === "explore" ? -0.14 : 0));
    controlledBones.push("leftUpperArm");
  }
  if (rig.rightUpperArm) {
    rig.rightUpperArm.rotation.z = clampSigned(frame.rightArmIntent ?? (frame.action === "respond" && frame.speaking
      ? -0.26
      : frame.action === "verify" ? -0.18 : 0));
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

  const preset = resolveVrmEmotionExpression(frame);
  if (preset) manager.setValue(preset.expression, preset.weight);

  if (frame.speaking) {
    const form = Number.isFinite(frame.mouthForm) ? frame.mouthForm : 0;
    const index = form < -0.35 ? 4 : form < -0.1 ? 2 : form > 0.45 ? 3 : form > 0.15 ? 1 : 0;
    manager.setValue(MOUTH_PRESETS[index], clamp01(frame.mouthOpen));
  }
  if (frame.blink) manager.setValue("blink", 1);
}

/** Call once per frame after NK1 writes normalized humanoid pose and expression weights. */
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
