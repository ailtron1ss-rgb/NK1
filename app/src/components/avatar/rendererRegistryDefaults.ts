/**
 * Canonical default body-renderer manifests for the four wired UI modes.
 *
 * These describe what each renderer actually applies today. They are the single
 * source of truth consumed by `embodimentUiBridge`, so a renderer's declared
 * channels cannot drift between the switch contract and the registry. The
 * numbers here are deliberately narrow: unsupported channels must be reported,
 * not silently dropped.
 */
import { BodyRendererRegistry, type BodyRendererCapabilityManifest } from "./rendererCapabilityManifest.ts";

const EXPRESSION_CHANNELS = [
  "neutral", "joy", "sadness", "anger", "anxiety", "curiosity", "protective", "surprise",
] as const;

/**
 * Channels each wired renderer actually applies today.
 *
 * Each list is checked against the renderer's own adapter by `body-systems.test.mjs`:
 * a channel may only be declared if the adapter maps it to a real rig change.
 */
export const LIVE2D_CHANNELS = ["headRoll", "gazeX", "gazeY"] as const;
export const SVG_CHANNELS = ["torsoYaw", "torsoPitch", "headYaw", "headPitch", "headRoll", "gazeX", "gazeY", "breath"] as const;
export const SPRITE_CHANNELS = [] as const;
export const VRM3D_CHANNELS = ["torsoPitch", "leftElbow", "rightElbow", "leftHip", "rightHip", "leftKnee", "rightKnee", "gazeX", "gazeY"] as const;

export const DEFAULT_RENDERER_MANIFESTS: readonly BodyRendererCapabilityManifest[] = [
  {
    schemaVersion: 1,
    rendererId: "nk1-live2d-cubism",
    label: "Live2D Cubism",
    mode: "live2d",
    assetKind: "cubism-model",
    source: "bundled",
    productionReady: true,
    channels: [...LIVE2D_CHANNELS],
    expressions: [...EXPRESSION_CHANNELS],
    supportsSpeechVisemes: true,
    supportsWorldTargets: true,
    supportsClothingLayers: false,
    supportsPhysics: true,
    joints: ["head", "neck"],
    notes: "Bundled Cubism model with physics; limb channels are not driven yet.",
  },
  {
    schemaVersion: 1,
    rendererId: "nk1-original-svg-2d",
    label: "NK1 Original 2D",
    mode: "live2d",
    assetKind: "svg-vector",
    source: "bundled",
    productionReady: true,
    channels: [...SVG_CHANNELS],
    expressions: [...EXPRESSION_CHANNELS],
    supportsSpeechVisemes: false,
    supportsWorldTargets: true,
    supportsClothingLayers: false,
    supportsPhysics: false,
    joints: [],
    notes: "Flat SVG concept; yaw/pitch map to translation, roll to rotation, breath to a bounded scale. No skeletal joints.",
  },
  {
    schemaVersion: 1,
    rendererId: "nk1-legacy-sprites-2d",
    label: "Legacy sprites",
    mode: "live2d",
    assetKind: "sprite-sheet",
    source: "bundled",
    productionReady: true,
    channels: [...SPRITE_CHANNELS],
    expressions: [...EXPRESSION_CHANNELS],
    supportsSpeechVisemes: false,
    supportsWorldTargets: false,
    supportsClothingLayers: false,
    supportsPhysics: false,
    joints: [],
    notes: "Static reaction frames; no independent channel control.",
  },
  {
    schemaVersion: 1,
    rendererId: "nk1-three-vrm3d",
    label: "Three.js VRM / 3D",
    mode: "vrm3d",
    assetKind: "vrm",
    source: "bundled",
    productionReady: true,
    channels: [...VRM3D_CHANNELS],
    expressions: [...EXPRESSION_CHANNELS],
    supportsSpeechVisemes: true,
    supportsWorldTargets: true,
    supportsClothingLayers: false,
    supportsPhysics: true,
    joints: ["head", "neck", "leftUpperArm", "rightUpperArm", "spine", "leftLowerArm", "rightLowerArm", "leftUpperLeg", "rightUpperLeg", "leftLowerLeg", "rightLowerLeg"],
    notes: "Normalized humanoid drive: head/neck, shoulders, elbows, spine, hips and knees; wrists, hands and ankles are not wired yet.",
  },
];

/** Build a registry seeded with the canonical defaults. */
export function createDefaultBodyRendererRegistry(): BodyRendererRegistry {
  const registry = new BodyRendererRegistry();
  for (const manifest of DEFAULT_RENDERER_MANIFESTS) registry.register(manifest);
  return registry;
}
