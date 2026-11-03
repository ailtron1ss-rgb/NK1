/**
 * Versioned renderer capability manifests and a body-renderer registry (NK1 aspect 11).
 *
 * A manifest declares only what a renderer actually applies today. It is the single
 * machine-readable description of a body's real channels, expressions, visemes and
 * physics, so the switch contract can degrade unsupported channels instead of
 * pretending they executed. Registering a renderer that claims a channel it cannot
 * apply is a correctness bug, not a cosmetic one.
 *
 * This module owns no cognitive state and no rig state. It is a truthful catalogue.
 */
import type { BodyChannel, EmbodimentMode, ExpressionChannel } from "./embodimentSwitch.ts";

export type AvatarAssetKind = "none" | "sprite-sheet" | "svg-vector" | "cubism-model" | "layered-depth-rig" | "gltf" | "vrm";

export interface BodyRendererCapabilityManifest {
  schemaVersion: 1;
  /** Precise adapter identity; two 2D renderers must not share this. */
  rendererId: string;
  label: string;
  mode: EmbodimentMode;
  assetKind: AvatarAssetKind;
  /** Honest source of the body, e.g. "bundled" or "user-import". */
  source: "bundled" | "user-import" | "procedural" | "none";
  /** Whether a real, selectable body exists. A placeholder must set this false. */
  productionReady: boolean;
  channels: readonly BodyChannel[];
  expressions: readonly ExpressionChannel[];
  supportsSpeechVisemes: boolean;
  supportsWorldTargets: boolean;
  supportsClothingLayers: boolean;
  supportsPhysics: boolean;
  /** Humanoid joints the renderer can actually drive, in normalized naming. */
  joints: readonly string[];
  notes?: string;
}

export interface RendererCapabilityIssue {
  code: string;
  message: string;
}

const MODES: ReadonlySet<EmbodimentMode> = new Set(["live2d", "depth2d", "vrm3d"]);
const ASSET_KINDS: ReadonlySet<AvatarAssetKind> = new Set([
  "none", "sprite-sheet", "svg-vector", "cubism-model", "layered-depth-rig", "gltf", "vrm",
]);
const SOURCES: ReadonlySet<BodyRendererCapabilityManifest["source"]> = new Set([
  "bundled", "user-import", "procedural", "none",
]);
const BODY_CHANNELS: ReadonlySet<BodyChannel> = new Set([
  "headYaw", "headPitch", "headRoll", "torsoYaw", "torsoPitch",
  "leftShoulder", "leftElbow", "leftWrist", "rightShoulder", "rightElbow", "rightWrist",
  "leftHip", "leftKnee", "leftAnkle", "rightHip", "rightKnee", "rightAnkle",
  "leftHand", "rightHand", "leftFingers", "rightFingers", "gazeX", "gazeY", "breath", "rootYaw",
]);
const EXPRESSION_CHANNELS: ReadonlySet<ExpressionChannel> = new Set([
  "neutral", "joy", "sadness", "anger", "anxiety", "curiosity", "protective", "surprise",
]);

const isBoundedNonBlank = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

const isUniqueStringList = (value: unknown, max: number): value is string[] =>
  Array.isArray(value) && value.length <= max
    && value.every((item) => typeof item === "string" && item.trim().length > 0)
    && new Set(value).size === value.length;

/**
 * Structural validation. Returns every problem rather than the first, so a bad
 * manifest cannot pass by accident and its diagnostics are actionable.
 */
export function validateRendererCapabilityManifest(manifest: BodyRendererCapabilityManifest): RendererCapabilityIssue[] {
  const issues: RendererCapabilityIssue[] = [];
  if (!manifest || typeof manifest !== "object") {
    return [{ code: "invalid-manifest", message: "manifest must be an object" }];
  }
  if (manifest.schemaVersion !== 1) issues.push({ code: "unsupported-schema-version", message: "schemaVersion must be 1" });
  if (!isBoundedNonBlank(manifest.rendererId, 96)) issues.push({ code: "invalid-renderer-id", message: "rendererId must be a non-blank string <= 96 chars" });
  if (!isBoundedNonBlank(manifest.label, 96)) issues.push({ code: "invalid-label", message: "label must be a non-blank string <= 96 chars" });
  if (!MODES.has(manifest.mode)) issues.push({ code: "invalid-mode", message: "mode must be live2d | depth2d | vrm3d" });
  if (!ASSET_KINDS.has(manifest.assetKind)) issues.push({ code: "invalid-asset-kind", message: "unknown assetKind" });
  if (!SOURCES.has(manifest.source)) issues.push({ code: "invalid-source", message: "unknown source" });
  if (typeof manifest.productionReady !== "boolean") issues.push({ code: "invalid-production-ready", message: "productionReady must be boolean" });
  for (const flag of ["supportsSpeechVisemes", "supportsWorldTargets", "supportsClothingLayers", "supportsPhysics"] as const) {
    if (typeof manifest[flag] !== "boolean") issues.push({ code: "invalid-flag", message: `${flag} must be boolean` });
  }
  if (!isUniqueStringList(manifest.channels, 64) || !manifest.channels.every((channel) => BODY_CHANNELS.has(channel))) {
    issues.push({ code: "invalid-channels", message: "channels must be a unique list of known body channels" });
  }
  if (!isUniqueStringList(manifest.expressions, 32) || !manifest.expressions.every((expression) => EXPRESSION_CHANNELS.has(expression))) {
    issues.push({ code: "invalid-expressions", message: "expressions must be a unique list of known expression channels" });
  }
  if (!isUniqueStringList(manifest.joints, 128)) issues.push({ code: "invalid-joints", message: "joints must be a unique list of non-blank strings" });
  // Honesty invariants: a manifest that cannot be true is rejected.
  if (manifest.assetKind === "none" && manifest.productionReady) {
    issues.push({ code: "inconsistent-production-ready", message: "a renderer with no asset cannot be productionReady" });
  }
  if (manifest.supportsClothingLayers && manifest.channels.length === 0) {
    issues.push({ code: "inconsistent-clothing", message: "clothing layers require at least one driven channel" });
  }
  return issues;
}

/**
 * Body-renderer registry. Holds validated manifests and exposes the capability
 * descriptor the switch contract consumes. Registration fails closed on any
 * invalid or duplicate renderer, and a later registration may not silently
 * overwrite an existing renderer id.
 */
export class BodyRendererRegistry {
  private readonly manifests = new Map<string, BodyRendererCapabilityManifest>();

  register(manifest: BodyRendererCapabilityManifest): void {
    const issues = validateRendererCapabilityManifest(manifest);
    if (issues.length) throw new TypeError(`invalid-renderer-manifest:${issues.map((issue) => issue.code).join(",")}`);
    if (this.manifests.has(manifest.rendererId)) throw new TypeError(`duplicate-renderer-id:${manifest.rendererId}`);
    this.manifests.set(manifest.rendererId, structuredCloneSafe(manifest));
  }

  get(rendererId: string): BodyRendererCapabilityManifest | null {
    const found = this.manifests.get(rendererId);
    return found ? structuredCloneSafe(found) : null;
  }

  list(): BodyRendererCapabilityManifest[] {
    return [...this.manifests.values()].map(structuredCloneSafe);
  }

  /** Selectable renderers that actually have a body, in stable registration order. */
  selectable(): BodyRendererCapabilityManifest[] {
    return this.list().filter((manifest) => manifest.productionReady && manifest.assetKind !== "none");
  }

  /** Resolve a renderer by coarse mode, preferring a production-ready body. */
  resolveByMode(mode: EmbodimentMode): BodyRendererCapabilityManifest | null {
    const candidates = this.list().filter((manifest) => manifest.mode === mode);
    if (!candidates.length) return null;
    return candidates.find((manifest) => manifest.productionReady) ?? candidates[0]!;
  }
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
