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
} from "../src/components/avatar/motionArbitration.ts";
import {
  DEFAULT_RENDERER_MANIFESTS,
  createDefaultBodyRendererRegistry,
} from "../src/components/avatar/rendererRegistryDefaults.ts";
import { capabilitiesForMode, projectSemanticBodyState } from "../src/components/avatar/embodimentUiBridge.ts";
import {
  applyVrmFullBodyChannels,
  resolveVrmFullBodyRig,
} from "../src/components/avatar/vrmRuntimeAdapter.ts";
import { emptySnapshot } from "../src/organism/types.ts";

function fakeBone() {
  return { rotation: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } } };
}
function createFakeVrm(names) {
  const bones = new Map(names.map((name) => [name, fakeBone()]));
  return {
    humanoid: {
      autoUpdateHumanBones: false,
      getNormalizedBoneNode(name) { return bones.get(name) ?? null; },
    },
    expressionManager: { resetValues() {}, setValue() {} },
    update() {},
    bones,
  };
}
const FULL_BODY_NAMES = ["head", "neck", "leftUpperArm", "rightUpperArm", "spine", "leftLowerArm", "rightLowerArm", "leftUpperLeg", "rightUpperLeg", "leftLowerLeg", "rightLowerLeg"];

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

test("rejects unknown channels and duplicate channel entries", () => {
  const bad = validateRendererCapabilityManifest({ ...baseManifest(), channels: ["headRoll", "headRoll"] }).map((i) => i.code);
  assert.ok(bad.includes("invalid-channels"));
  const unknown = validateRendererCapabilityManifest({ ...baseManifest(), channels: ["notAChannel"] }).map((i) => i.code);
  assert.ok(unknown.includes("invalid-channels"));
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

test("motion programs validate their keyframe contract", () => {
  for (const program of Object.values(MOTION_PROGRAMS)) {
    assert.deepEqual(validateMotionProgram(program), [], `${program.id} should be valid`);
  }
});

test("rejects a looping program whose seam values differ", () => {
  const broken = { ...MOTION_PROGRAMS.idle, keyframes: [{ t: 0, channels: { breath: 0 } }, { t: 1, channels: { breath: 0.5 } }] };
  assert.ok(validateMotionProgram(broken).map((i) => i.code).includes("loop-seam-mismatch"));
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
  assert.equal(resolvePrimaryProgram({ action: "wait", emotion: "sadness", speaking: false, thinking: false, awake: true, energy01: 0.5 }), "idle");
  assert.equal(resolvePrimaryProgram({ action: "wait", emotion: "sadness", speaking: false, thinking: false, awake: false, energy01: 0.5 }), "idle");
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
