import assert from "node:assert/strict";
import test from "node:test";
import {
  BodyRendererRegistry,
  validateRendererCapabilityManifest,
} from "../src/components/avatar/rendererCapabilityManifest.ts";
import {
  MOTION_PROGRAMS,
  blendMotionLayers,
  sampleMotionProgram,
  validateMotionProgram,
} from "../src/components/avatar/motionLibrary.ts";
import {
  MOTION_TRANSITION_MS,
  arbitrateMotion,
  defaultMotionArbitrationState,
  resolvePrimaryProgram,
  restoreMotionArbitrationState,
} from "../src/components/avatar/motionArbitration.ts";
import {
  DEFAULT_RENDERER_MANIFESTS,
  LIVE2D_CHANNELS,
  SVG_CHANNELS,
  VRM3D_CHANNELS,
  createDefaultBodyRendererRegistry,
} from "../src/components/avatar/rendererRegistryDefaults.ts";
import { capabilitiesForMode, projectSemanticBodyState } from "../src/components/avatar/embodimentUiBridge.ts";
import {
  applyVrmFullBodyChannels,
  resolveVrmFullBodyRig,
} from "../src/components/avatar/vrmRuntimeAdapter.ts";
import { originalStageChannelOffsets } from "../src/components/avatar/originalStageChannels.ts";
import { emptySnapshot } from "../src/organism/types.ts";

function fakeBone() {
  return { rotation: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } } };
}
function createFakeVrm(names, metaVersion = "1") {
  const bones = new Map(names.map((name) => [name, fakeBone()]));
  return {
    meta: { metaVersion },
    humanoid: {
      autoUpdateHumanBones: false,
      getNormalizedBoneNode(name) { return bones.get(name) ?? null; },
    },
    expressionManager: { resetValues() {}, setValue() {} },
    update() {},
    bones,
  };
}
const FINGER_SUFFIXES = [
  "ThumbMetacarpal", "ThumbProximal", "ThumbDistal",
  "IndexProximal", "IndexIntermediate", "IndexDistal",
  "MiddleProximal", "MiddleIntermediate", "MiddleDistal",
  "RingProximal", "RingIntermediate", "RingDistal",
  "LittleProximal", "LittleIntermediate", "LittleDistal",
];
const VRM0_FINGER_SUFFIXES = [
  "ThumbProximal", "ThumbIntermediate", "ThumbDistal",
  ...FINGER_SUFFIXES.filter((suffix) => !suffix.startsWith("Thumb")),
];
const FULL_BODY_NAMES = [
  "head", "neck", "hips", "leftUpperArm", "rightUpperArm", "spine",
  "leftLowerArm", "rightLowerArm", "leftUpperLeg", "rightUpperLeg",
  "leftLowerLeg", "rightLowerLeg", "leftFoot", "rightFoot", "leftHand", "rightHand",
  ...FINGER_SUFFIXES.map((suffix) => "left" + suffix),
  ...FINGER_SUFFIXES.map((suffix) => "right" + suffix),
];
const VRM0_BODY_NAMES = [
  ...FULL_BODY_NAMES.filter((name) => !/^(left|right)Thumb(?:Metacarpal|Proximal|Distal)$/.test(name)),
  ...VRM0_FINGER_SUFFIXES.map((suffix) => "left" + suffix),
  ...VRM0_FINGER_SUFFIXES.map((suffix) => "right" + suffix),
];

const baseManifest = () => ({
  schemaVersion: 1,
  rendererId: "nk1-test-live2d",
  label: "Test Live2D",
  mode: "live2d",
  assetKind: "cubism-model",
  source: "bundled",
  productionReady: true,
  channels: ["headRoll", "gazeX", "gazeY", "breath"],
  expressions: ["neutral", "joy"],
  supportsSpeechVisemes: true,
  supportsWorldTargets: true,
  supportsClothingLayers: false,
  supportsPhysics: true,
  joints: ["head", "neck"],
});

test("accepts a well-formed capability manifest", () => {
  assert.deepEqual(validateRendererCapabilityManifest(baseManifest()), []);
});

test("rejects a production-ready renderer that has no asset", () => {
  const codes = validateRendererCapabilityManifest({ ...baseManifest(), assetKind: "none" }).map((i) => i.code);
  assert.ok(codes.includes("inconsistent-production-ready"));
});

test("malformed channel arrays return diagnostics instead of throwing", () => {
  const issues = validateRendererCapabilityManifest({ ...baseManifest(), channels: undefined, supportsClothingLayers: true });
  assert.ok(issues.some((issue) => issue.code === "invalid-channels"));
});

test("rejects unknown channels and duplicate channel entries", () => {
  const bad = validateRendererCapabilityManifest({ ...baseManifest(), channels: ["headRoll", "headRoll"] }).map((i) => i.code);
  assert.ok(bad.includes("invalid-channels"));
  const unknown = validateRendererCapabilityManifest({ ...baseManifest(), channels: ["notAChannel"] }).map((i) => i.code);
  assert.ok(unknown.includes("invalid-channels"));
});

test("rejects sparse channel, expression and joint arrays", () => {
  const sparseChannels = new Array(1);
  const sparseExpressions = new Array(1);
  const sparseJoints = new Array(1);
  const issues = validateRendererCapabilityManifest({
    ...baseManifest(),
    channels: sparseChannels,
    expressions: sparseExpressions,
    joints: sparseJoints,
  }).map((issue) => issue.code);
  assert.ok(issues.includes("invalid-channels"));
  assert.ok(issues.includes("invalid-expressions"));
  assert.ok(issues.includes("invalid-joints"));
});

test("registry fails closed on invalid or duplicate renderers", () => {
  const registry = new BodyRendererRegistry();
  registry.register(baseManifest());
  assert.throws(() => registry.register(baseManifest()), /duplicate-renderer-id/);
  assert.throws(() => registry.register({ ...baseManifest(), rendererId: "bad", mode: "wrong" }), /invalid-renderer-manifest/);
});

test("registry exposes only selectable renderers and resolves by mode", () => {
  const registry = new BodyRendererRegistry();
  registry.register(baseManifest());
  registry.register({ ...baseManifest(), rendererId: "nk1-test-2p5d", label: "2.5D", mode: "depth2d", assetKind: "none", productionReady: false, source: "none" });
  assert.equal(registry.selectable().length, 1);
  assert.equal(registry.selectable()[0].rendererId, "nk1-test-live2d");
  assert.equal(registry.resolveByMode("depth2d")?.rendererId, "nk1-test-2p5d");
  assert.equal(registry.resolveByMode("vrm3d"), null);
});


test("schema v2 requires truthful rig and selection metadata while schema v1 remains readable", () => {
  const v2 = { ...baseManifest(), schemaVersion: 2, rigClass: "cubism-deform", selectionRole: "primary" };
  assert.deepEqual(validateRendererCapabilityManifest(v2), []);
  assert.ok(validateRendererCapabilityManifest({ ...v2, rigClass: undefined }).some((issue) => issue.code === "invalid-rig-class"));
  assert.ok(validateRendererCapabilityManifest({ ...v2, selectionRole: undefined }).some((issue) => issue.code === "invalid-selection-role"));
  assert.deepEqual(validateRendererCapabilityManifest({ ...baseManifest(), schemaVersion: 1 }), []);
});

test("schema v2 rejects selectable previews, missing assets and rig/asset mismatches", () => {
  const preview = validateRendererCapabilityManifest({
    ...baseManifest(), schemaVersion: 2, rigClass: "cubism-deform", selectionRole: "preview-only",
  }).map((issue) => issue.code);
  assert.ok(preview.includes("preview-cannot-be-selectable"));

  const noAsset = validateRendererCapabilityManifest({
    ...baseManifest(), schemaVersion: 2, assetKind: "none", rigClass: "none", selectionRole: "fallback",
    productionReady: false,
  }).map((issue) => issue.code);
  assert.ok(noAsset.includes("selectable-role-needs-asset"));

  const mismatch = validateRendererCapabilityManifest({
    ...baseManifest(), schemaVersion: 2, rigClass: "static-poses", selectionRole: "primary",
  }).map((issue) => issue.code);
  assert.ok(mismatch.includes("rig-asset-mismatch"));
});

test("default registry distinguishes renderer rigs and keeps preview candidates out of selection", () => {
  const registry = createDefaultBodyRendererRegistry();
  assert.deepEqual(registry.list().map((entry) => [entry.rendererId, entry.rigClass, entry.selectionRole]), [
    ["nk1-live2d-cubism", "cubism-deform", "primary"],
    ["nk1-original-svg-2d", "vector-driven", "fallback"],
    ["nk1-legacy-sprites-2d", "static-poses", "fallback"],
    ["nk1-three-vrm3d", "humanoid-skeleton", "preview-only"],
  ]);
  assert.deepEqual(registry.selectable().map((entry) => entry.rendererId), [
    "nk1-live2d-cubism", "nk1-original-svg-2d", "nk1-legacy-sprites-2d",
  ]);
  assert.equal(registry.get("nk1-three-vrm3d")?.productionReady, false);
  assert.equal(registry.resolveSelectableByMode("vrm3d"), null);
  assert.equal(registry.resolveSelectableByMode("depth2d"), null);
  assert.equal(registry.list().some((entry) => entry.rigClass === "layered-depth-puppet" && entry.selectionRole !== "preview-only"), false);
});

test("registry resolves a canonical primary even when a fallback was registered first", () => {
  const registry = new BodyRendererRegistry();
  const primary = { ...baseManifest(), schemaVersion: 2, rendererId: "primary", rigClass: "cubism-deform", selectionRole: "primary" };
  const fallback = { ...baseManifest(), schemaVersion: 2, rendererId: "fallback", rigClass: "vector-driven", selectionRole: "fallback", assetKind: "svg-vector" };
  registry.register(fallback);
  registry.register({ ...primary, rendererId: "preview", selectionRole: "preview-only", productionReady: false });
  registry.register(primary);
  assert.equal(registry.resolveByMode("live2d")?.rendererId, "primary");
});

test("motion programs validate their keyframe contract", () => {
  for (const program of Object.values(MOTION_PROGRAMS)) {
    assert.deepEqual(validateMotionProgram(program), [], `${program.id} should be valid`);
  }
});

test("rejects a looping program whose seam values differ", () => {
  const broken = { ...MOTION_PROGRAMS.idle, keyframes: [{ t: 0, channels: { breath: 0 } }, { t: 1, channels: { breath: 0.5 } }] };
  assert.ok(validateMotionProgram(broken).map((i) => i.code).includes("loop-seam-mismatch"));
});

test("malformed and sparse motion keyframes fail validation without throwing", () => {
  const nullChannels = { ...MOTION_PROGRAMS.idle, keyframes: [{ t: 0, channels: null }, { t: 1, channels: {} }] };
  assert.ok(validateMotionProgram(nullChannels).some((issue) => issue.code === "invalid-channel-map"));
  const sparse = { ...MOTION_PROGRAMS.idle, keyframes: new Array(2) };
  const issues = validateMotionProgram(sparse);
  assert.ok(issues.some((issue) => issue.code === "invalid-keyframe-time"));
  assert.ok(issues.some((issue) => issue.code === "missing-start-keyframe"));
  assert.ok(issues.some((issue) => issue.code === "missing-end-keyframe"));
});

test("sampling interpolates between keyframes and wraps for loops", () => {
  const mid = sampleMotionProgram(MOTION_PROGRAMS.idle, MOTION_PROGRAMS.idle.durationMs / 2);
  assert.ok(mid.channels.breath > 0.4 && mid.channels.breath < 0.95);
  const wrapped = sampleMotionProgram(MOTION_PROGRAMS.idle, MOTION_PROGRAMS.idle.durationMs * 1.5);
  assert.equal(wrapped.timeMs, MOTION_PROGRAMS.idle.durationMs * 0.5);
});

test("blending normalizes weights and reports shared channels", () => {
  const blended = blendMotionLayers([
    { program: MOTION_PROGRAMS.respond, timeMs: 0, weight: 1 },
    { program: MOTION_PROGRAMS.explain, timeMs: 0, weight: 1 },
  ]);
  assert.ok(blended.blendedChannels.includes("rightShoulder"));
  assert.ok(Math.abs(blended.channels.rightShoulder) <= 1);
});

test("an all-zero weight set yields an empty pose, never a default", () => {
  const blended = blendMotionLayers([{ program: MOTION_PROGRAMS.respond, timeMs: 0, weight: 0 }]);
  assert.deepEqual(blended.channels, {});
});

test("primary program resolves from thinking, speaking and action precedence", () => {
  assert.equal(resolvePrimaryProgram({ action: "wait", emotion: "calm", speaking: false, thinking: true, awake: true, energy01: 0.5 }), "think");
  assert.equal(resolvePrimaryProgram({ action: "respond", emotion: "joy", speaking: true, thinking: false, awake: true, energy01: 0.5 }), "respond");
  assert.equal(resolvePrimaryProgram({ action: "explore", emotion: "curiosity", speaking: false, thinking: false, awake: true, energy01: 0.5 }), "explain");
  assert.equal(resolvePrimaryProgram({ action: "explore", emotion: "curiosity", speaking: false, thinking: false, awake: true, energy01: 0.5, allowLocomotion: true }), "walk");
  assert.equal(resolvePrimaryProgram({ action: "explore", emotion: "curiosity", speaking: false, thinking: false, awake: true, energy01: 0.5, allowLocomotion: "false" }), "explain",
    "truthy strings must never opt into locomotion");
  assert.equal(resolvePrimaryProgram({ action: "wait", emotion: "sadness", speaking: false, thinking: false, awake: true, energy01: 0.5 }), "idle");
  assert.equal(resolvePrimaryProgram({ action: "wait", emotion: "sadness", speaking: false, thinking: false, awake: false, energy01: 0.5 }), "idle");
});

test("arbitration rejects non-boolean locomotion consent and sanitizes restored state", () => {
  assert.throws(() => arbitrateMotion(null, {
    action: "explore", emotion: "curiosity", speaking: false, thinking: false,
    awake: true, energy01: 0.5, allowLocomotion: "false",
  }, 16), /invalid-motion-intent/);

  const restored = restoreMotionArbitrationState({
    schemaVersion: 1,
    layers: [
      { programId: "respond", timeMs: 10, weight: 4 },
      { programId: "respond", timeMs: 20, weight: 0.5 },
      { programId: "not-a-program", timeMs: 0, weight: 1 },
      { programId: "idle", timeMs: -1, weight: 0.4 },
      null,
    ],
    primary: "respond",
    transitionElapsedMs: Number.POSITIVE_INFINITY,
    transitioning: true,
  });
  assert.deepEqual(restored.layers, [{ programId: "respond", timeMs: 10, weight: 1 }]);
  assert.equal(restored.primary, "respond");
  assert.equal(restored.transitioning, false);
  assert.equal(restoreMotionArbitrationState({ schemaVersion: 1, layers: null }).layers.length, 0);
  const advanced = arbitrateMotion({ schemaVersion: 1, layers: null }, {
    action: "wait", emotion: "calm", speaking: false, thinking: false, awake: true, energy01: 0.5,
  }, 16);
  assert.equal(advanced.primary, "idle");
});

test("arbitration holds idle breathing and never freezes", () => {
  let state = defaultMotionArbitrationState();
  let result;
  for (let i = 0; i < 40; i += 1) {
    result = arbitrateMotion(state, { action: "wait", emotion: "calm", speaking: false, thinking: false, awake: true, energy01: 0.6 }, 16);
    state = result.state;
  }
  assert.equal(result.primary, "idle");
  assert.ok(Number.isFinite(result.channels.breath));
});

test("arbitration transitions between primaries over a bounded window", () => {
  let state = defaultMotionArbitrationState();
  const listen = { action: "wait", emotion: "curiosity", speaking: false, thinking: false, awake: true, energy01: 0.6 };
  state = arbitrateMotion(state, listen, 16).state;
  const think = { action: "reflect", emotion: "calm", speaking: false, thinking: true, awake: true, energy01: 0.6 };
  const first = arbitrateMotion(state, think, 16);
  assert.equal(first.primary, "think");
  assert.equal(first.state.transitioning, true);
  let settled = first.state;
  let steps = 0;
  while (settled.transitioning && steps < 100) {
    settled = arbitrateMotion(settled, think, 16).state;
    steps += 1;
  }
  assert.equal(settled.transitioning, false);
  assert.ok(steps * 16 <= MOTION_TRANSITION_MS + 32);
});

test("arbitration rejects malformed intent and ignores non-positive delta", () => {
  assert.throws(() => arbitrateMotion(null, { action: "wait" }, 16), /invalid-motion-intent/);
  const state = arbitrateMotion(null, { action: "wait", emotion: "calm", speaking: false, thinking: false, awake: true, energy01: 0.5 }, 0).state;
  assert.deepEqual(state.layers.map((l) => l.timeMs), [0]);
});

test("rapid intent changes never trim the primary program away", () => {
  // A burst of intents before the 260 ms transition settles builds up layers; the
  // fourth distinct intent pushes the count over MAX_LAYERS and triggers the trim.
  // The trim must keep the current primary, never drop it as the "lowest-weight"
  // layer (the primary starts each transition at weight ~0).
  const mk = (action, emotion, speaking, thinking) => ({ action, emotion, speaking, thinking, awake: true, energy01: 0.7 });
  let state = defaultMotionArbitrationState();
  state = arbitrateMotion(state, mk("respond", "joy", true, false), 16).state;
  state = arbitrateMotion(state, mk("reflect", "calm", false, true), 16).state;
  const trimmed = arbitrateMotion(state, mk("explore", "curiosity", false, false), 16);
  assert.equal(trimmed.primary, "explain");
  assert.ok(trimmed.state.layers.length <= 3);
  assert.ok(trimmed.state.layers.some((l) => l.programId === trimmed.primary), "primary must survive the trim");
  assert.ok(trimmed.state.layers.some((l) => l.programId === "idle"), "idle breath layer must survive the trim");
});

test("idle breath overlay is scaled by its real blend weight", () => {
  // During a transition the idle layer weight is < IDLE_BREATH_WEIGHT; the overlay
  // must follow weight * energyScale, not the raw constant. energy01 < 1 makes the
  // energy factor observable (energy01 = 1 would mask it).
  const intent = { action: "wait", emotion: "curiosity", speaking: false, thinking: false, awake: true, energy01: 0.5 };
  const state = arbitrateMotion(null, intent, 16).state; // idle primary, settled
  const think = { action: "reflect", emotion: "calm", speaking: false, thinking: true, awake: true, energy01: 0.5 };
  const r = arbitrateMotion(state, think, 16); // first frame of the think transition
  const idleLayer = r.state.layers.find((l) => l.programId === "idle");
  assert.ok(idleLayer && idleLayer.weight < 1);
  const idleOnly = sampleMotionProgram(MOTION_PROGRAMS.idle, idleLayer.timeMs).channels.breath ?? 0;
  const energyScale = 0.55 + 0.5 * 0.45;
  assert.ok(Math.abs(r.channels.breath - idleOnly * idleLayer.weight * energyScale) < 1e-9);
  assert.notEqual(r.channels.breath, idleOnly * idleLayer.weight);
});

test("default registry seeds four wired renderers with no channel drift", () => {
  const registry = createDefaultBodyRendererRegistry();
  assert.equal(registry.list().length, 4);
  assert.equal(DEFAULT_RENDERER_MANIFESTS.length, 4);
  // The switch contract must report exactly the registry's declared channels.
  for (const [mode, rendererId] of [["live2d", "nk1-live2d-cubism"], ["original", "nk1-original-svg-2d"], ["legacy", "nk1-legacy-sprites-2d"], ["3d", "nk1-three-vrm3d"]]) {
    const manifest = registry.get(rendererId);
    assert.ok(manifest, `${rendererId} should be registered`);
    const caps = capabilitiesForMode(mode);
    assert.deepEqual(caps.channels, manifest.channels);
    assert.equal(caps.supportsPhysics, manifest.supportsPhysics);
  }
});

// The manifest claims to describe "what each renderer actually applies today", so a
// declared channel must correspond to a real adapter mapping. These tests derive the
// expected channel set from the adapters themselves, so the manifest cannot drift
// back to a narrower or wider claim without failing.
test("declared Original 2D channels match the flat-SVG channel mapper", () => {
  const declared = new Set(SVG_CHANNELS);
  const probes = {
    torsoYaw: { channel: "torsoYaw", read: (o) => o.torsoOffsetX },
    torsoPitch: { channel: "torsoPitch", read: (o) => o.torsoOffsetY },
    headYaw: { channel: "headYaw", read: (o) => o.headOffsetX },
    headPitch: { channel: "headPitch", read: (o) => o.headOffsetY },
    headRoll: { channel: "headRoll", read: (o) => o.headRollDeg },
    breath: { channel: "breath", read: (o) => o.breathScale },
  };
  for (const [name, probe] of Object.entries(probes)) {
    const moved = probe.read(originalStageChannelOffsets({ [probe.channel]: 1 }));
    const rest = probe.read(originalStageChannelOffsets({ [probe.channel]: 0 }));
    assert.notEqual(moved, rest, `${name} must change the SVG rig`);
    assert.ok(declared.has(name), `${name} is applied by the SVG adapter and must be declared`);
  }
  // gazeX/gazeY are consumed by the stage's pupil offset, not this mapper.
  assert.ok(declared.has("gazeX") && declared.has("gazeY"));
  // A channel the mapper ignores must not be declared.
  assert.equal(declared.has("leftKnee"), false);
});

test("declared VRM 3D channels match the full-body bone applier", () => {
  const declared = new Set(VRM3D_CHANNELS);
  const vrm = createFakeVrm(FULL_BODY_NAMES);
  const bones = ["spine", "leftLowerArm", "rightLowerArm", "leftUpperLeg", "rightUpperLeg", "leftLowerLeg", "rightLowerLeg"];
  const result = applyVrmFullBodyChannels(vrm, {
    torsoPitch: 0.2, leftElbow: 0.2, rightElbow: 0.2, leftHip: 0.2, rightHip: 0.2, leftKnee: 0.2, rightKnee: 0.2,
  });
  assert.deepEqual(result.controlledBones.sort(), bones.sort());
  for (const channel of ["torsoPitch", "leftElbow", "rightElbow", "leftHip", "rightHip", "leftKnee", "rightKnee"]) {
    assert.ok(declared.has(channel), `${channel} drives a real bone and must be declared`);
  }
  for (const channel of ["torsoYaw", "rootYaw"]) {
    assert.ok(declared.has(channel), `${channel} drives a real normalized rig bone and must be declared`);
  }
  for (const channel of ["leftAnkle", "rightAnkle"]) {
    assert.ok(declared.has(channel), `${channel} drives a real foot bone and must be declared`);
  }
  for (const channel of ["leftWrist", "rightWrist", "leftHand", "rightHand", "leftFingers", "rightFingers"]) {
    assert.ok(declared.has(channel), `${channel} is backed by normalized hand/finger joints and must be declared`);
  }
  const vrmManifest = DEFAULT_RENDERER_MANIFESTS.find((entry) => entry.rendererId === "nk1-three-vrm3d");
  assert.ok(vrmManifest);
  assert.ok(vrmManifest.joints.includes("hips") && vrmManifest.joints.includes("leftFoot") && vrmManifest.joints.includes("rightFoot"),
    "the rig manifest must list normalized pelvis and foot joints");
  assert.ok(vrmManifest.joints.includes("leftHand") && vrmManifest.joints.includes("rightHand"));
  for (const suffix of [...new Set([...FINGER_SUFFIXES, "ThumbIntermediate"])]) {
    assert.ok(vrmManifest.joints.includes("left" + suffix), "left finger joint " + suffix + " must be declared");
    assert.ok(vrmManifest.joints.includes("right" + suffix), "right finger joint " + suffix + " must be declared");
  }

  // The head/gaze controller owns headYaw/headPitch/headRoll and shoulders; the
  // full-body pass must not claim them.
  for (const channel of ["leftShoulder", "rightShoulder", "headYaw", "headPitch", "headRoll"]) {
    assert.equal(declared.has(channel), false, `${channel} is not a full-body bone channel`);
  }
});

test("declared Live2D channels match what the viewer can actually drive", () => {
  const declared = new Set(LIVE2D_CHANNELS);
  // The bundled viewer writes ParamAngleX/Y/Z, eye-ball and mouth params. It applies
  // head roll, gaze and mouth, but has no breath parameter, so breath must not be declared.
  assert.deepEqual([...declared].sort(), ["gazeX", "gazeY", "headRoll"].sort());
  assert.equal(declared.has("breath"), false, "the Live2D viewer exposes no breath parameter");
  assert.equal(declared.has("torsoYaw"), false, "the Live2D viewer drives no torso channel");
});

test("motion arbiter channels flow into the semantic pose but never override derived channels", () => {
  const snapshot = emptySnapshot();
  const state = projectSemanticBodyState({
    snapshot,
    revision: 1,
    monotonicMs: 1000,
    headTilt: 0.2,
    gaze: { x: 0.3, y: -0.1 },
    speechPhase: "idle",
    speechEventId: null,
    audioTimeMs: 0,
    mouth: null,
    // headRoll is derived and must win; rightShoulder is new and must survive.
    pose: { headRoll: 0.9, rightShoulder: -0.4, breath: 0.5 },
  });
  assert.equal(state.pose.headRoll, 0.2);
  assert.equal(state.pose.rightShoulder, -0.4);
  assert.equal(state.pose.breath, 0.5);
});

test("out-of-range arbiter channels are clamped at the semantic boundary", () => {
  const state = projectSemanticBodyState({
    snapshot: emptySnapshot(),
    revision: 1,
    monotonicMs: 1000,
    headTilt: 0,
    speechPhase: "idle",
    speechEventId: null,
    audioTimeMs: 0,
    pose: { rightElbow: 5, leftElbow: -5 },
  });
  assert.equal(state.pose.rightElbow, 1);
  assert.equal(state.pose.leftElbow, -1);
});

test("full-body rig resolves the optional normalized bones and tolerates a partial rig", () => {
  const full = resolveVrmFullBodyRig(createFakeVrm(FULL_BODY_NAMES));
  assert.ok(full.spine && full.leftUpperLeg && full.rightLowerLeg);
  const partial = resolveVrmFullBodyRig(createFakeVrm(["head", "neck"]));
  assert.equal(partial.spine, null);
  assert.equal(partial.leftUpperLeg, null);
});

test("full-body channels drive normalized leg/arm/spine bones and report what they wrote", () => {
  const vrm = createFakeVrm(FULL_BODY_NAMES);
  const result = applyVrmFullBodyChannels(vrm, { leftHip: -0.3, rightKnee: 0.15, rightElbow: 0.5, torsoPitch: 0.05 });
  assert.equal(result.applied, true);
  assert.deepEqual(result.controlledBones.sort(), ["leftUpperLeg", "rightLowerArm", "rightLowerLeg", "spine"].sort());
  assert.ok(vrm.bones.get("leftUpperLeg").rotation.z < 0);
  assert.equal(vrm.bones.get("rightUpperLeg").rotation.z, 0);
  assert.ok(vrm.bones.get("rightLowerLeg").rotation.z > 0);
  assert.ok(vrm.bones.get("rightLowerArm").rotation.z > 0);
  assert.ok(vrm.bones.get("spine").rotation.x > 0);
});

test("full-body apply is idempotent across frames and returns bones to rest", () => {
  const vrm = createFakeVrm(FULL_BODY_NAMES);
  const channels = { torsoPitch: 0.1, leftKnee: 0.1 };
  applyVrmFullBodyChannels(vrm, channels);
  const spineAfterOne = vrm.bones.get("spine").rotation.x;
  const kneeAfterOne = vrm.bones.get("leftLowerLeg").rotation.z;
  assert.ok(spineAfterOne > 0 && kneeAfterOne > 0);
  // Re-applying the same channels must not accumulate (the head/arm pass resets every frame).
  applyVrmFullBodyChannels(vrm, channels);
  applyVrmFullBodyChannels(vrm, channels);
  assert.equal(vrm.bones.get("spine").rotation.x, spineAfterOne);
  assert.equal(vrm.bones.get("leftLowerLeg").rotation.z, kneeAfterOne);
  // A channel that stops being emitted must return the bone to rest, not freeze it.
  applyVrmFullBodyChannels(vrm, {});
  assert.equal(vrm.bones.get("spine").rotation.x, 0);
  assert.equal(vrm.bones.get("leftLowerLeg").rotation.z, 0);
});

test("full-body ankle channels drive normalized feet and return them to neutral", () => {
  const vrm = createFakeVrm(FULL_BODY_NAMES);
  const driven = applyVrmFullBodyChannels(vrm, { leftAnkle: 0.5, rightAnkle: -0.25 });
  assert.deepEqual(driven.controlledBones.sort(), ["leftFoot", "rightFoot"]);
  assert.equal(vrm.bones.get("leftFoot").rotation.x, 0.25);
  assert.equal(vrm.bones.get("rightFoot").rotation.x, -0.125);

  const neutral = applyVrmFullBodyChannels(vrm, {});
  assert.equal(neutral.applied, false);
  assert.equal(vrm.bones.get("leftFoot").rotation.x, 0);
  assert.equal(vrm.bones.get("rightFoot").rotation.x, 0);
});

test("full-body torso pitch/yaw share one spine receipt and root yaw returns to neutral", () => {
  const vrm = createFakeVrm(FULL_BODY_NAMES);
  const driven = applyVrmFullBodyChannels(vrm, { torsoPitch: 0.25, torsoYaw: 0.5, rootYaw: -0.5 });
  assert.deepEqual(driven.controlledBones.sort(), ["hips", "spine"]);
  assert.equal(vrm.bones.get("spine").rotation.x, 0.1);
  assert.equal(vrm.bones.get("spine").rotation.y, 0.25);
  assert.equal(vrm.bones.get("hips").rotation.y, -0.45);

  const neutral = applyVrmFullBodyChannels(vrm, {});
  assert.equal(neutral.applied, false);
  assert.equal(vrm.bones.get("spine").rotation.x, 0);
  assert.equal(vrm.bones.get("spine").rotation.y, 0);
  assert.equal(vrm.bones.get("hips").rotation.y, 0);
});

test("full-body apply ignores channels it cannot map and reports none written", () => {
  const vrm = createFakeVrm(FULL_BODY_NAMES);
  const result = applyVrmFullBodyChannels(vrm, { gazeX: 0.4, breath: 0.6, leftShoulder: -0.3 });
  assert.equal(result.applied, false);
  assert.equal(result.reason, "no-supported-full-body-channels");
  assert.deepEqual(result.controlledBones, []);
  // Shoulders belong to the gaze/gesture controller, so the full-body pass must not touch them.
  assert.equal(vrm.bones.get("leftUpperArm").rotation.z, 0);
});

test("full-body apply leaves an absent bone untouched without throwing", () => {
  const vrm = createFakeVrm(["head", "neck", "leftUpperArm"]);
  const result = applyVrmFullBodyChannels(vrm, { leftHip: 0.5, torsoPitch: 0.2 });
  assert.equal(result.applied, false);
  assert.deepEqual(result.controlledBones, []);
});

test("2D channel mapping is bounded, zero-safe and keeps the breath term additive", () => {
  const idle = originalStageChannelOffsets();
  assert.deepEqual(idle, { torsoOffsetX: 0, torsoOffsetY: 0, headOffsetX: 0, headOffsetY: 0, headRollDeg: 0, breathScale: 1 });
  const extreme = originalStageChannelOffsets({ headYaw: 9, headPitch: -9, torsoYaw: 9, torsoPitch: -9, headRoll: 9, breath: 9 });
  assert.equal(extreme.headOffsetX, 7);
  assert.equal(extreme.headOffsetY, -5);
  assert.equal(extreme.torsoOffsetX, 8);
  assert.equal(extreme.headRollDeg, 7);
  assert.equal(extreme.breathScale, 1.015);
  const nonFinite = originalStageChannelOffsets({ headYaw: Number.NaN, breath: Number.POSITIVE_INFINITY });
  assert.equal(nonFinite.headOffsetX, 0);
  assert.equal(nonFinite.breathScale, 1);
});


test("the default 3D asset is honestly marked remote and not production-ready",()=>{
  const manifest=DEFAULT_RENDERER_MANIFESTS.find((entry)=>entry.rendererId==="nk1-three-vrm3d");
  assert.ok(manifest);
  assert.equal(manifest.assetKind,"gltf");
  assert.equal(manifest.source,"remote");
  assert.equal(manifest.productionReady,false);
  const registry=createDefaultBodyRendererRegistry();
  assert.equal(registry.selectable().some((entry)=>entry.rendererId==="nk1-three-vrm3d"),false,
    "an externally hosted, visually unaccepted asset must not enter the production-ready selector");
});

test("full-body wrist and palm channels drive separate normalized hand axes", () => {
  const vrm = createFakeVrm(FULL_BODY_NAMES);
  const driven = applyVrmFullBodyChannels(vrm, { leftWrist: 0.5, leftHand: 0.5, rightWrist: -0.5, rightHand: -0.5 });
  assert.deepEqual(driven.controlledBones.sort(), ["leftHand", "rightHand"]);
  assert.equal(vrm.bones.get("leftHand").rotation.x, 0.2);
  assert.equal(vrm.bones.get("leftHand").rotation.y, 0.175);
  assert.equal(vrm.bones.get("rightHand").rotation.x, -0.2);
  assert.equal(vrm.bones.get("rightHand").rotation.y, -0.175);
  const neutral = applyVrmFullBodyChannels(vrm, {});
  assert.equal(neutral.applied, false);
  for (const name of ["leftHand", "rightHand"]) {
    assert.equal(vrm.bones.get(name).rotation.x, 0);
    assert.equal(vrm.bones.get(name).rotation.y, 0);
    assert.equal(vrm.bones.get(name).rotation.z, 0);
  }
});

test("aggregate finger curl reaches all standard optional VRM finger segments and resets", () => {
  const vrm = createFakeVrm(FULL_BODY_NAMES);
  const driven = applyVrmFullBodyChannels(vrm, { leftFingers: 0.5, rightFingers: -0.5 });
  assert.equal(driven.controlledBones.length, 30);
  assert.ok(driven.controlledBones.includes("leftThumbMetacarpal"));
  assert.ok(driven.controlledBones.includes("leftIndexIntermediate"));
  assert.ok(driven.controlledBones.includes("rightLittleDistal"));
  assert.equal(vrm.bones.get("leftIndexProximal").rotation.x, 0.425 * 0.64);
  assert.equal(vrm.bones.get("leftIndexIntermediate").rotation.x, 0.425 * 0.78);
  assert.equal(vrm.bones.get("rightMiddleDistal").rotation.x, -0.425 * 0.58);
  const neutral = applyVrmFullBodyChannels(vrm, {});
  assert.equal(neutral.applied, false);
  for (const suffix of FINGER_SUFFIXES) {
    assert.equal(vrm.bones.get("left" + suffix).rotation.x, 0);
    assert.equal(vrm.bones.get("right" + suffix).rotation.x, 0);
  }
});

test("VRM 0.x resolves legacy thumb intermediate joints instead of VRM 1.0 metacarpals", () => {
  const vrm = createFakeVrm(VRM0_BODY_NAMES, "0");
  const driven = applyVrmFullBodyChannels(vrm, { leftFingers: 0.5, rightFingers: -0.5 });
  assert.equal(driven.controlledBones.length, 30);
  assert.ok(driven.controlledBones.includes("leftThumbProximal"));
  assert.ok(driven.controlledBones.includes("leftThumbIntermediate"));
  assert.ok(driven.controlledBones.includes("rightThumbIntermediate"));
  assert.equal(driven.controlledBones.includes("leftThumbMetacarpal"), false);
  assert.equal(vrm.bones.get("leftThumbIntermediate").rotation.x, 0.425 * 0.58);
  assert.equal(vrm.bones.get("rightThumbIntermediate").rotation.x, -0.425 * 0.58);
  assert.equal(vrm.bones.has("leftThumbMetacarpal"), false);

  const neutral = applyVrmFullBodyChannels(vrm, {});
  assert.equal(neutral.applied, false);
  for (const suffix of VRM0_FINGER_SUFFIXES) {
    assert.equal(vrm.bones.get("left" + suffix).rotation.x, 0);
    assert.equal(vrm.bones.get("right" + suffix).rotation.x, 0);
  }
});

test("missing optional VRM finger joints are skipped without false control receipts", () => {
  const vrm = createFakeVrm(FULL_BODY_NAMES.filter((name) => !FINGER_SUFFIXES.some((suffix) => name === "left" + suffix || name === "right" + suffix)));
  const result = applyVrmFullBodyChannels(vrm, { leftFingers: 0.8, rightFingers: 0.8 });
  assert.equal(result.applied, false);
  assert.deepEqual(result.controlledBones, []);
});
