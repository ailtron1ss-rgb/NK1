import assert from "node:assert/strict";
import test from "node:test";
import { applyDepthRigFaceMorphs, blendDepthRigFacePose, resolveDepthRigFacePose } from "../src/components/avatar/depthRigFace.ts";

test("maps emotion and speech to bounded independent facial controls", () => {
  const joy = resolveDepthRigFacePose({ emotion: "joy", speaking: true, mouthOpen: 1.8, mouthForm: .8, blink: -1 });
  assert.equal(joy.joy, 1);
  assert.equal(joy.smile, .72);
  assert.equal(joy.mouthOpen, 1);
  assert.equal(joy.mouthWide, .8);
  assert.equal(joy.blink, 0);
  const anxiety = resolveDepthRigFacePose({ emotion: "anxiety", thinking: true });
  assert.ok(anxiety.browRaise > 0);
  assert.ok(anxiety.frown > 0);
  assert.equal(anxiety.mouthOpen, 0);
});

test("supports asymmetric eyelids, independent gaze and left/right brow controls", () => {
  const face = resolveDepthRigFacePose({
    emotion: "curiosity", blinkLeft: .9, blinkRight: .15,
    gazeX: 1.8, gazeY: -.4, thinking: true,
  });
  assert.equal(face.blinkLeft, .9);
  assert.equal(face.blinkRight, .15);
  assert.equal(face.eyeLookXLeft, 1);
  assert.equal(face.eyeLookXRight, 1);
  assert.equal(face.eyeLookYLeft, -.4);
  assert.equal(face.browRaiseLeft, face.browRaise * 1.04);
  assert.notEqual(face.browRaiseLeft, face.browRaiseRight);
});

test("maps a speech viseme to one bounded viseme channel", () => {
  const face = resolveDepthRigFacePose({ emotion: "calm", speaking: true, mouthOpen: .8, viseme: "FV", visemeWeight: 1.4 });
  assert.equal(face.visemeFV, 1);
  assert.equal(face.visemeAA, 0);
  assert.equal(face.mouthOpen, .8);
  const silent = resolveDepthRigFacePose({ emotion: "calm", speaking: false, viseme: "aa", visemeWeight: 1 });
  assert.equal(silent.visemeAA, 0);
});

test("blends expression transitions without overshoot and clamps elapsed time", () => {
  const from = resolveDepthRigFacePose({ emotion: "calm" });
  const to = resolveDepthRigFacePose({ emotion: "anger", speaking: true, mouthOpen: 1, viseme: "oh" });
  const mid = blendDepthRigFacePose(from, to, .03);
  assert.ok(mid.anger > from.anger && mid.anger < to.anger);
  assert.ok(mid.visemeOH > 0 && mid.visemeOH < to.visemeOH);
  const settled = blendDepthRigFacePose(from, to, 10);
  assert.ok(settled.anger <= 1 && settled.anger >= 0);
});

test("applies only available optional morphs and reports missing channels", () => {
  const node = { morphTargetDictionary: { Blink: 0, MouthOpen: 1, Happy: 2 }, morphTargetInfluences: [0, 0, 0] };
  const root = { traverse(callback) { callback(node); } };
  const values = resolveDepthRigFacePose({ emotion: "joy", speaking: true, mouthOpen: .6 });
  const result = applyDepthRigFaceMorphs(root, values);
  assert.ok(result.applied >= 3);
  assert.equal(node.morphTargetInfluences[0], 0);
  assert.equal(node.morphTargetInfluences[1], .6);
  assert.equal(node.morphTargetInfluences[2], 1);
  assert.ok(result.missing.includes("browRaise"));
});

test("does not write to ambiguous normalized morph names", () => {
  const node = { morphTargetDictionary: { "Eye Blink": 0, eye_blink: 1 }, morphTargetInfluences: [.2, .3] };
  const root = { traverse(callback) { callback(node); } };
  const result = applyDepthRigFaceMorphs(root, resolveDepthRigFacePose({ emotion: "calm", blink: 1 }));
  assert.deepEqual(node.morphTargetInfluences, [.2, .3]);
  assert.ok(result.ambiguous.includes("eyeblink"));
});

test("supports artist aliases and safely ignores malformed optional bindings", () => {
  const node = { morphTargetDictionary: { EyeClose_L: 0, mouth_FV: 1 }, morphTargetInfluences: [0, 0] };
  const root = { traverse(callback) { callback(node); } };
  const face = resolveDepthRigFacePose({ emotion: "calm", blinkLeft: .5, speaking: true, viseme: "fv", visemeWeight: .7 });
  const result = applyDepthRigFaceMorphs(root, face, {
    blinkLeft: ["EyeClose_L"], visemeFV: ["mouth_FV"], blinkRight: "not-an-array",
  });
  assert.equal(node.morphTargetInfluences[0], .5);
  assert.equal(node.morphTargetInfluences[1], .7);
  assert.equal(result.applied, 2);
});
