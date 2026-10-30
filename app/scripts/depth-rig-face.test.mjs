import assert from "node:assert/strict";
import test from "node:test";
import { applyDepthRigFaceMorphs, resolveDepthRigFacePose } from "../src/components/avatar/depthRigFace.ts";

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

test("applies only available optional morphs and reports missing channels", () => {
  const node = { morphTargetDictionary: { Blink: 0, viseme_aa: 1, Happy: 2 }, morphTargetInfluences: [0, 0, 0] };
  const root = { traverse(callback) { callback(node); } };
  const values = resolveDepthRigFacePose({ emotion: "joy", speaking: true, mouthOpen: .6 });
  const result = applyDepthRigFaceMorphs(root, values);
  assert.equal(result.applied, 3);
  assert.equal(node.morphTargetInfluences[0], 0);
  assert.equal(node.morphTargetInfluences[1], .6);
  assert.equal(node.morphTargetInfluences[2], 1);
  assert.ok(result.missing.includes("browRaise"));
});

test("does not write to ambiguous normalized morph names", () => {
  const node = { morphTargetDictionary: { "Eye Blink": 0, eye_blink: 1 }, morphTargetInfluences: [.2, .3] };
  const root = { traverse(callback) { callback(node); } };
  const result = applyDepthRigFaceMorphs(root, resolveDepthRigFacePose({ emotion: "calm", blink: 1 }));
  assert.equal(result.applied, 0);
  assert.deepEqual(node.morphTargetInfluences, [.2, .3]);
  assert.ok(result.ambiguous.includes("eyeblink"));
});

test("supports artist-defined morph aliases without requiring every channel", () => {
  const node = { morphTargetDictionary: { EyeClose_L: 0 }, morphTargetInfluences: [0] };
  const root = { traverse(callback) { callback(node); } };
  const result = applyDepthRigFaceMorphs(root, resolveDepthRigFacePose({ emotion: "calm", blink: .5 }), { blink: ["EyeClose_L"] });
  assert.equal(result.applied, 1);
  assert.equal(node.morphTargetInfluences[0], .5);
});
