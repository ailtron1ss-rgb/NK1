import assert from "node:assert/strict";
import test from "node:test";
import { resolveGlbFacialMorphWeights } from "../src/components/avatar/glbFacialMorphAdapter.ts";
import { resolveGlbSecondaryBoneRotation } from "../src/components/avatar/glbSecondaryMotionAdapter.ts";

const weightsByName = (dictionary, frame) =>
  Object.fromEntries(Object.entries(dictionary).map(([name, index]) => [name,
    resolveGlbFacialMorphWeights(dictionary, frame).find((item) => item.index === index)?.value ?? null]));

const baseFace = {
  emotion: "calm", gazeX: 0, gazeY: 0, energy: 0.8, cognitiveLoad: 0.2,
  uncertainty: 0.1, novelty: 0.1, curiosity: 0.1, valence: 0.5, sarcasm: 0.2,
  speaking: false, mouthOpen: 0, thinking: false, awake: true, blink: false,
};

test("GLB facial adapter drives emotion morphs and returns zero for inactive known targets", () => {
  const dictionary = { happy: 0, sad: 1, angry: 2, surprised: 3, grin: 4, worried: 5, blink: 6 };
  const joy = weightsByName(dictionary, { ...baseFace, emotion: "joy", valence: 0.9 });
  assert.ok(joy.happy > 0);
  assert.ok(joy.grin > 0);
  assert.equal(joy.sad, 0);
  assert.equal(joy.angry, 0);
  assert.equal(joy.blink, 0);

  const worried = weightsByName(dictionary, { ...baseFace, emotion: "anxiety" });
  assert.ok(worried.worried > 0);
  assert.equal(worried.happy, 0);
});

test("GLB facial adapter maps sceptical/smirk/concern/brow targets to bounded affect", () => {
  const dictionary = {
    smirk_left: 0, smirk_right: 1, brow_skeptic: 2, brow_focus: 3,
    brow_concern: 4, brow_furrow: 5, brow_surprise: 6, eye_squint: 7, eye_wide: 8,
  };
  const frame = { ...baseFace, emotion: "curiosity", sarcasm: 0.9, cognitiveLoad: 0.85, thinking: true, uncertainty: 0.9 };
  const values = weightsByName(dictionary, frame);
  assert.ok(values.smirk_left > values.smirk_right);
  assert.ok(values.brow_skeptic > 0);
  assert.ok(values.brow_focus > 0);
  assert.ok(values.brow_surprise > 0);
  assert.ok(values.eye_wide > 0);
  for (const value of Object.values(values)) assert.ok(value >= 0 && value <= 1);
});

test("GLB facial adapter maps normalized gaze and blink to exported morph targets", () => {
  const dictionary = { gaze_left: 0, gaze_right: 1, gaze_up: 2, gaze_down: 3, blink: 4, wink_left: 5, wink_right: 6 };
  const lookingDownRight = weightsByName(dictionary, { ...baseFace, gazeX: 0.8, gazeY: 0.6, blink: true, winkLeft: 0.75 });
  assert.equal(lookingDownRight.gaze_left, 0);
  assert.equal(lookingDownRight.gaze_right, 0.8);
  assert.equal(lookingDownRight.gaze_up, 0);
  assert.equal(lookingDownRight.gaze_down, 0.6);
  assert.equal(lookingDownRight.blink, 1);
  assert.equal(lookingDownRight.wink_left, 0.75);
  assert.equal(lookingDownRight.wink_right, 0);
});

test("GLB facial adapter resets jaw and rejects malformed morph dictionaries", () => {
  const dictionary = { jawOpen: 0, mouthOpen: 1, blink: 2 };
  const speaking = weightsByName(dictionary, { ...baseFace, speaking: true, mouthOpen: 0.67, blink: true });
  assert.equal(speaking.jawOpen, 0.67);
  assert.equal(speaking.mouthOpen, 0.67);
  assert.equal(speaking.blink, 1);
  const idle = weightsByName(dictionary, { ...baseFace, speaking: false, mouthOpen: 0.9 });
  assert.equal(idle.jawOpen, 0);
  assert.equal(idle.mouthOpen, 0);
  assert.deepEqual(resolveGlbFacialMorphWeights(null, baseFace), []);
  assert.deepEqual(resolveGlbFacialMorphWeights([], baseFace), []);
  assert.deepEqual(resolveGlbFacialMorphWeights({ broken: "0", bad: -1, sparse: 1.4 }, baseFace), []);
});

test("GLB secondary motion resolves hair sway deterministically and keeps it bounded", () => {
  const frame = { timeSeconds: 1.7, awake: true, energy: 0.8, action: "idle", bodyChannels: {} };
  const a = resolveGlbSecondaryBoneRotation("hairLockTipL", frame);
  const b = resolveGlbSecondaryBoneRotation("hairLockTipL", frame);
  assert.deepEqual(a, b);
  assert.ok(a.x >= -0.04 && a.x <= 0.04);
  assert.ok(a.z >= -0.02 && a.z <= 0.02);
  const asleep = resolveGlbSecondaryBoneRotation("hairLockTipL", { ...frame, awake: false });
  assert.ok(Math.abs(asleep.x) < Math.abs(a.x));
});

test("GLB secondary motion curls proximal and distal finger segments independently", () => {
  const frame = { timeSeconds: 0, awake: true, energy: 1, action: "respond", bodyChannels: { leftFingers: 0.8, rightFingers: 0.2 } };
  const root = resolveGlbSecondaryBoneRotation("leftIndex", frame);
  const tip = resolveGlbSecondaryBoneRotation("leftIndexTip", frame);
  const right = resolveGlbSecondaryBoneRotation("rightIndexTip", frame);
  assert.ok(root.x < 0);
  assert.ok(tip.x < root.x);
  assert.ok(Math.abs(right.x) < Math.abs(tip.x));
});

test("GLB secondary motion applies toe flex only from a bounded ankle channel", () => {
  const pose = resolveGlbSecondaryBoneRotation("leftToe", {
    timeSeconds: 0, awake: true, energy: 0.8, action: "walk", bodyChannels: { leftAnkle: 0.75 },
  });
  assert.ok(pose.x > 0);
  assert.equal(resolveGlbSecondaryBoneRotation("leftToe", {
    timeSeconds: 0, awake: true, energy: 0.8, action: "idle", bodyChannels: { leftAnkle: Number.NaN },
  }).x, 0);
  assert.equal(resolveGlbSecondaryBoneRotation("head", {
    timeSeconds: 0, awake: true, energy: 1, action: "idle",
  }), null);
});
