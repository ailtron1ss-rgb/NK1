import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyVrmExpressionFrame,
  applyVrmNormalizedMotorFrame,
  configureVrmForNk1NormalizedMotorDrive,
  resolveVrmNormalizedMotorRig,
  resolveVrmEmotionExpression,
  summarizeVrmMeta,
  updateVrmForNk1Frame,
} from "../src/components/avatar/vrmRuntimeAdapter.ts";

function fakeBone(name) {
  const bone = {
    name,
    rotation: {
      x: 0, y: 0, z: 0,
      set(x, y, z) { this.x = x; this.y = y; this.z = z; },
    },
  };
  return bone;
}

function createFakeVrm(available = ["head", "neck", "leftUpperArm", "rightUpperArm"]) {
  const values = new Map();
  const bones = new Map(available.map((name) => [name, fakeBone(name)]));
  let resetCount = 0;
  let updateDelta = null;
  return {
    humanoid: {
      autoUpdateHumanBones: false,
      getNormalizedBoneNode(name) { return bones.get(name) ?? null; },
    },
    expressionManager: {
      resetValues() { values.clear(); resetCount += 1; },
      setValue(name, weight) { values.set(name, weight); },
    },
    update(delta) { updateDelta = delta; },
    bones,
    values,
    get resetCount() { return resetCount; },
    get updateDelta() { return updateDelta; },
  };
}

test("VRM normalized humanoid becomes the sole canonical bone output surface", () => {
  const vrm = createFakeVrm();
  configureVrmForNk1NormalizedMotorDrive(vrm);
  assert.equal(vrm.humanoid.autoUpdateHumanBones, true);
  assert.equal(vrm.resetCount, 1);
});

test("normalized rig resolves the model-specific humanoid proxy nodes", () => {
  const vrm = createFakeVrm(["head", "neck", "leftUpperArm"]);
  const rig = resolveVrmNormalizedMotorRig(vrm);
  assert.ok(rig.head);
  assert.ok(rig.neck);
  assert.ok(rig.leftUpperArm);
  assert.equal(rig.rightUpperArm, null);
});

test("normalized motor frame maps gaze and action gestures without Euler drift", () => {
  const vrm = createFakeVrm();
  configureVrmForNk1NormalizedMotorDrive(vrm);
  const frame = {
    action: "respond", emotion: "sadness", gazeX: 0.5, gazeY: -0.25,
    cognitiveLoad: 0.4, energy: 0.8, socialNeed: 0.2, uncertainty: 0.3,
    speaking: true,
  };
  const first = applyVrmNormalizedMotorFrame(vrm, frame);
  assert.equal(first.applied, true);
  assert.deepEqual(first.controlledBones, ["neck", "head", "leftUpperArm", "rightUpperArm"]);
  assert.ok(Math.abs(vrm.bones.get("neck").rotation.x - ((0.03 - 0.014 + 0.008) * 0.35)) < 1e-9);
  assert.equal(vrm.bones.get("rightUpperArm").rotation.z, -0.26);
  const firstPose = Object.fromEntries([...vrm.bones].map(([name, bone]) => [name, { ...bone.rotation }]));
  const second = applyVrmNormalizedMotorFrame(vrm, frame);
  assert.equal(second.applied, true);
  assert.deepEqual(Object.fromEntries([...vrm.bones].map(([name, bone]) => [name, { ...bone.rotation }])), firstPose);
});

test("normalized motor reports missing humanoid bones without fabricating a pose", () => {
  const vrm = createFakeVrm([]);
  const result = applyVrmNormalizedMotorFrame(vrm, {
    action: "explore", emotion: "curiosity", gazeX: 0, gazeY: 0,
    cognitiveLoad: 0, energy: 1, socialNeed: 0, uncertainty: 0, speaking: false,
  });
  assert.equal(result.applied, false);
  assert.equal(result.reason, "normalized-rig-unavailable");
  assert.deepEqual(result.controlledBones, []);
});


test("normalized motor preserves precomputed NK1 affect and social arm intent", () => {
  const vrm = createFakeVrm();
  const result = applyVrmNormalizedMotorFrame(vrm, {
    action: "explore", emotion: "anger", gazeX: 0.2, gazeY: 0,
    cognitiveLoad: 0.4, energy: 0.8, socialNeed: 0.7, uncertainty: 0.1,
    speaking: true, leftArmIntent: -0.64, rightArmIntent: 0.38,
  });
  assert.equal(result.applied, true);
  assert.equal(vrm.bones.get("leftUpperArm").rotation.z, -0.64);
  assert.equal(vrm.bones.get("rightUpperArm").rotation.z, 0.38);
});

test("VRM expression mapping follows NK1 affect and speech frame", () => {
  const vrm = createFakeVrm();
  applyVrmExpressionFrame(vrm, {
    emotion: "joy",
    speaking: true,
    mouthOpen: 0.7,
    mouthForm: -0.6,
    blink: true,
  });
  assert.equal(vrm.values.get("happy"), resolveVrmEmotionExpression({
    emotion: "joy", speaking: true, mouthOpen: 0.7, mouthForm: -0.6, blink: true,
  }).weight);
  assert.equal(vrm.values.get("oh"), 0.7);
  assert.equal(vrm.values.get("blink"), 1);

  applyVrmExpressionFrame(vrm, {
    emotion: "anger",
    speaking: true,
    mouthOpen: 2,
    mouthForm: 0.8,
    blink: false,
  });
  assert.equal(vrm.values.has("happy"), false);
  assert.equal(vrm.values.get("angry"), resolveVrmEmotionExpression({
    emotion: "anger", speaking: true, mouthOpen: 2, mouthForm: 0.8, blink: false,
  }).weight);
  assert.equal(vrm.values.get("ee"), 1);
  assert.equal(vrm.values.has("blink"), false);
});

test("VRM update uses bounded frame delta and rejects invalid time", () => {
  const vrm = createFakeVrm();
  updateVrmForNk1Frame(vrm, 0.016);
  assert.equal(vrm.updateDelta, 0.016);
  updateVrmForNk1Frame(vrm, 0.2);
  assert.equal(vrm.updateDelta, 0.05);
  updateVrmForNk1Frame(vrm, Number.NaN);
  updateVrmForNk1Frame(vrm, -1);
  assert.equal(vrm.updateDelta, 0.05);
  updateVrmForNk1Frame(null, 0.016);
});

test("VRM 1 metadata is summarized without treating it as license approval", () => {
  const result = summarizeVrmMeta({
    metaVersion: "1",
    name: "Kurisu Sample",
    authors: ["Author A", "Author B"],
    licenseUrl: "https://example.invalid/license",
    avatarPermission: "everyone",
    creditNotation: "required",
  });
  assert.equal(result.modelName, "Kurisu Sample");
  assert.deepEqual(result.authors, ["Author A", "Author B"]);
  assert.equal(result.license, "https://example.invalid/license");
  assert.equal(result.avatarPermission, "everyone");
  assert.equal(result.credit, "required");
});

test("VRM 0 metadata is supported and missing license remains explicit", () => {
  const result = summarizeVrmMeta({
    metaVersion: "0",
    title: "Legacy Avatar",
    author: "Legacy Author",
    licenseName: "CC_BY_NC",
    allowedUserName: "Everyone",
  });
  assert.equal(result.modelName, "Legacy Avatar");
  assert.deepEqual(result.authors, ["Legacy Author"]);
  assert.equal(result.license, "CC_BY_NC");
  assert.equal(result.avatarPermission, "Everyone");
  assert.equal(result.credit, "check model license");

  const missing = summarizeVrmMeta(undefined);
  assert.equal(missing.license, "not declared");
});

test("Avatar3DStage registers the native plugin and updates/disposes VRM runtime", async () => {
  const stage = await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8");
  assert.match(stage, /new VRMLoaderPlugin\(parser,\s*\{\s*autoUpdateHumanBones:\s*true\s*\}\)/);
  assert.match(stage, /gltf\.userData\?\.vrm/);
  assert.match(stage, /configureVrmForNk1NormalizedMotorDrive\(vrm\)/);
  assert.match(stage, /applyVrmNormalizedMotorFrame\(rt\.vrm/);
  assert.match(stage, /rt\.mixer=!vrm&&rt\.clips\.length\?new THREE\.AnimationMixer\(root\):null/);
  assert.match(stage, /VRMUtils\.rotateVRM0\(vrm\)/);
  assert.match(stage, /updateVrmForNk1Frame\(rt\.vrm,dt\)/);
  assert.match(stage, /VRMUtils\.deepDispose\(rt\.loaded\)/);
  assert.match(stage, /applyVrmExpressionFrame\(rt\.vrm/);
});

test("VRM expression projection scales joy with arousal, valence and warmth", () => {
  const low = resolveVrmEmotionExpression({
    emotion: "joy", speaking: false, mouthOpen: 0, mouthForm: 0, blink: false,
    arousal: .15, valence: .25, warmth: .1,
  });
  const high = resolveVrmEmotionExpression({
    emotion: "joy", speaking: false, mouthOpen: 0, mouthForm: 0, blink: false,
    arousal: .95, valence: .95, warmth: .95,
  });
  assert.equal(low.expression, "happy");
  assert.equal(high.expression, "happy");
  assert.ok(high.weight > low.weight);
  assert.ok(high.weight <= .78);
});

test("VRM curiosity uses a bounded surprised preset and responds to novelty", () => {
  const low = resolveVrmEmotionExpression({
    emotion: "curiosity", speaking: false, mouthOpen: 0, mouthForm: 0, blink: false,
    curiosity: .1, novelty: .1,
  });
  const high = resolveVrmEmotionExpression({
    emotion: "curiosity", speaking: false, mouthOpen: 0, mouthForm: 0, blink: false,
    curiosity: .95, novelty: .95,
  });
  assert.equal(low.expression, "surprised");
  assert.equal(high.expression, "surprised");
  assert.ok(high.weight > low.weight);
  assert.ok(high.weight <= .36);
});

test("VRM anger and frustration distinguish perceived control", () => {
  const angerLowControl = resolveVrmEmotionExpression({
    emotion: "anger", speaking: false, mouthOpen: 0, mouthForm: 0, blink: false,
    arousal: .8, dominance: .1,
  });
  const angerHighControl = resolveVrmEmotionExpression({
    emotion: "anger", speaking: false, mouthOpen: 0, mouthForm: 0, blink: false,
    arousal: .8, dominance: .9,
  });
  const frustrationLowControl = resolveVrmEmotionExpression({
    emotion: "frustration", speaking: false, mouthOpen: 0, mouthForm: 0, blink: false,
    arousal: .8, dominance: .1,
  });
  const frustrationHighControl = resolveVrmEmotionExpression({
    emotion: "frustration", speaking: false, mouthOpen: 0, mouthForm: 0, blink: false,
    arousal: .8, dominance: .9,
  });
  assert.ok(angerHighControl.weight > angerLowControl.weight);
  assert.ok(frustrationLowControl.weight > frustrationHighControl.weight);
});

test("VRM calm and protective expressions use composure, warmth and social need", () => {
  const composed = resolveVrmEmotionExpression({
    emotion: "calm", speaking: false, mouthOpen: 0, mouthForm: 0, blink: false,
    arousal: .1, composure: .95,
  });
  const agitated = resolveVrmEmotionExpression({
    emotion: "calm", speaking: false, mouthOpen: 0, mouthForm: 0, blink: false,
    arousal: .9, composure: .1,
  });
  const protectiveWarm = resolveVrmEmotionExpression({
    emotion: "protective", speaking: false, mouthOpen: 0, mouthForm: 0, blink: false,
    warmth: .95, socialNeed: .95,
  });
  const protectiveGuarded = resolveVrmEmotionExpression({
    emotion: "protective", speaking: false, mouthOpen: 0, mouthForm: 0, blink: false,
    warmth: .1, socialNeed: .1,
  });
  assert.ok(composed.weight > agitated.weight);
  assert.ok(protectiveWarm.weight > protectiveGuarded.weight);
});

test("VRM expression projection rejects malformed affect values and keeps legacy callers safe", () => {
  const malformed = resolveVrmEmotionExpression({
    emotion: "joy", speaking: false, mouthOpen: 0, mouthForm: 0, blink: false,
    arousal: Number.NaN, valence: Number.POSITIVE_INFINITY, warmth: -100,
    dominance: "0.9",
  });
  const legacy = resolveVrmEmotionExpression({
    emotion: "joy", speaking: false, mouthOpen: 0, mouthForm: 0, blink: false,
  });
  assert.ok(Number.isFinite(malformed.weight));
  assert.ok(malformed.weight >= 0 && malformed.weight <= .78);
  assert.ok(Number.isFinite(legacy.weight));
  assert.ok(legacy.weight > 0);
  assert.equal(resolveVrmEmotionExpression({
    emotion: "unmapped", speaking: false, mouthOpen: 0, mouthForm: 0, blink: false,
  }), null);
});

test("VRM expression application preserves speech visemes while using affect intensity", () => {
  const vrm = createFakeVrm();
  applyVrmExpressionFrame(vrm, {
    emotion: "curiosity", speaking: true, mouthOpen: .64, mouthForm: -.5, blink: false,
    arousal: .8, novelty: .9, curiosity: .95,
  });
  assert.equal(vrm.values.get("surprised"), resolveVrmEmotionExpression({
    emotion: "curiosity", speaking: true, mouthOpen: .64, mouthForm: -.5, blink: false,
    arousal: .8, novelty: .9, curiosity: .95,
  }).weight);
  assert.equal(vrm.values.get("oh"), .64);
});
