import type { VRM, VRMMeta } from "@pixiv/three-vrm";

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

/**
 * The existing NK1 avatar motor and imported GLTF clips animate raw skeleton
 * nodes. Disable automatic normalized-to-raw copying for this loaded VRM so
 * VRM.update() cannot overwrite the current raw-bone animation after the mixer.
 * VRM expressions, look-at, node constraints, spring bones and MToon updates
 * remain active through VRM.update(delta).
 */
export function configureVrmForNk1RawBoneDrive(vrm: VRM): void {
  vrm.humanoid.autoUpdateHumanBones = false;
  vrm.expressionManager?.resetValues();
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
