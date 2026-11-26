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
export type AvatarRigClass =
  | "none"
  | "static-poses"
  | "vector-driven"
  | "cubism-deform"
  | "layered-depth-puppet"
  | "humanoid-skeleton";
export type RendererSelectionRole = "primary" | "fallback" | "preview-only";

export interface BodyRendererCapabilityManifest {
  /** Schema v1 remains readable for persisted manifests; all current defaults use v2. */
  schemaVersion: 1 | 2;
  /** Required by schema v2: what kind of rig actually drives the rendered body. */
  rigClass?: AvatarRigClass;
  /** Required by schema v2: primary body, user-selectable fallback, or preview-only candidate. */
  selectionRole?: RendererSelectionRole;
  /** Precise adapter identity; two 2D renderers must not share this. */
  rendererId: string;
  label: string;
  mode: EmbodimentMode;
  assetKind: AvatarAssetKind;
  /** Honest source of the body, e.g. "bundled" or "user-import". */
  source: "bundled" | "remote" | "user-import" | "procedural" | "none";
  /**
   * Backward-compatible existence/selectability flag, not visual, device, legal,
   * or release approval. Use selectionRole to distinguish fallback vs preview.
   */
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
const RIG_CLASSES: ReadonlySet<AvatarRigClass> = new Set([
  "none", "static-poses", "vector-driven", "cubism-deform", "layered-depth-puppet", "humanoid-skeleton",
]);
const SELECTION_ROLES: ReadonlySet<RendererSelectionRole> = new Set(["primary", "fallback", "preview-only"]);
const ASSET_KINDS: ReadonlySet<AvatarAssetKind> = new Set([
  "none", "sprite-sheet", "svg-vector", "cubism-model", "layered-depth-rig", "gltf", "vrm",
]);
const SOURCES: ReadonlySet<BodyRendererCapabilityManifest["source"]> = new Set([
  "bundled", "remote", "user-import", "procedural", "none",
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

const isUniqueStringList = (value: unknown, max: number): value is string[] => {
  if (!Array.isArray(value) || value.length > max) return false;
  try {
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      // Array#every skips holes; a sparse capability list must never be accepted.
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) return false;
      const item = descriptor.value;
      if (typeof item !== "string" || !item.trim() || seen.has(item)) return false;
      seen.add(item);
    }
    return true;
  } catch {
    return false;
  }
};

/**
 * Structural validation. Returns every problem rather than the first, so a bad
 * manifest cannot pass by accident and its diagnostics are actionable.
 */
export function validateRendererCapabilityManifest(manifest: BodyRendererCapabilityManifest): RendererCapabilityIssue[] {
  const issues: RendererCapabilityIssue[] = [];
  if (!manifest || typeof manifest !== "object") {
    return [{ code: "invalid-manifest", message: "manifest must be an object" }];
  }
  if (manifest.schemaVersion !== 1 && manifest.schemaVersion !== 2) {
    issues.push({ code: "unsupported-schema-version", message: "schemaVersion must be 1 or 2" });
  }
  if (manifest.schemaVersion === 2) {
    if (!RIG_CLASSES.has(manifest.rigClass as AvatarRigClass)) {
      issues.push({ code: "invalid-rig-class", message: "schema v2 requires a known rigClass" });
    }
    if (!SELECTION_ROLES.has(manifest.selectionRole as RendererSelectionRole)) {
      issues.push({ code: "invalid-selection-role", message: "schema v2 requires primary | fallback | preview-only" });
    }
  } else if (manifest.rigClass !== undefined || manifest.selectionRole !== undefined) {
    if (manifest.rigClass !== undefined && !RIG_CLASSES.has(manifest.rigClass)) {
      issues.push({ code: "invalid-rig-class", message: "unknown rigClass" });
    }
    if (manifest.selectionRole !== undefined && !SELECTION_ROLES.has(manifest.selectionRole)) {
      issues.push({ code: "invalid-selection-role", message: "unknown selectionRole" });
    }
  }
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
  // Schema v2 separates "selectable body exists" from production approval.
  if (manifest.schemaVersion === 2) {
    const role = manifest.selectionRole;
    if (role === "preview-only" && manifest.productionReady) {
      issues.push({ code: "preview-cannot-be-selectable", message: "preview-only renderers must not set productionReady true" });
    }
    if ((role === "primary" || role === "fallback")
      && (!manifest.productionReady || manifest.assetKind === "none")) {
      issues.push({ code: "selectable-role-needs-asset", message: "primary/fallback roles require an existing selectable asset" });
    }
    const expectedRig: Partial<Record<AvatarRigClass, readonly AvatarAssetKind[]>> = {
      "static-poses": ["sprite-sheet"],
      "vector-driven": ["svg-vector"],
      "cubism-deform": ["cubism-model"],
      "layered-depth-puppet": ["layered-depth-rig"],
      "humanoid-skeleton": ["gltf", "vrm"],
    };
    const compatibleAssets = expectedRig[manifest.rigClass as AvatarRigClass];
    if (compatibleAssets && !compatibleAssets.includes(manifest.assetKind)) {
      issues.push({ code: "rig-asset-mismatch", message: "rigClass does not match assetKind" });
    }
    if (manifest.rigClass === "none" && manifest.assetKind !== "none") {
      issues.push({ code: "rig-asset-mismatch", message: "rigClass none is only valid without a body asset" });
    }
  }
  if (manifest.supportsClothingLayers && Array.isArray(manifest.channels) && manifest.channels.length === 0) {
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

  /** Selectable primary/fallback bodies, never preview-only candidates. */
  selectable(): BodyRendererCapabilityManifest[] {
    return this.list().filter((manifest) =>
      manifest.productionReady
      && manifest.assetKind !== "none"
      && manifest.selectionRole !== "preview-only",
    );
  }

  /** Resolve a renderer by coarse mode; prefer the canonical primary body. */
  resolveByMode(mode: EmbodimentMode): BodyRendererCapabilityManifest | null {
    const candidates = this.list().filter((manifest) => manifest.mode === mode);
    if (!candidates.length) return null;
    return candidates.find((manifest) => manifest.selectionRole === "primary")
      ?? candidates.find((manifest) => manifest.productionReady && manifest.selectionRole !== "preview-only")
      ?? candidates[0]!;
  }
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
