import assert from "node:assert/strict";
import test from "node:test";
import { advanceSwitchProgress, blendSharedPose, planEmbodimentSwitch, validateSemanticBodyState } from "../src/components/avatar/embodimentSwitch.ts";

const state = {
  schemaVersion: 1, revision: 42, capturedAtMonotonicMs: 1000,
  emotion: "curiosity", emotionIntensity: 0.7, expression: "thinking",
  gaze: { x: 0.2, y: -0.1, targetId: "object-7" },
  speech: { eventId: "speech-1", phase: "speaking", audioTimeMs: 420, mouthOpen: 0.35, mouthForm: -0.2 },
  action: "explain", intentId: "intent-9",
  pose: { headYaw: 0.3, leftElbow: 0.8, rightElbow: -0.4, leftFingers: 0.6, torsoPitch: 0.1 },
  wardrobeId: "lab-coat",
};

test("validates a complete semantic snapshot and rejects corrupt state", () => {
  assert.equal(validateSemanticBodyState(state), true);
  assert.equal(validateSemanticBodyState({ ...state, revision: -1 }), false);
  assert.equal(validateSemanticBodyState({ ...state, pose: { headYaw: Infinity } }), false);
  assert.equal(validateSemanticBodyState({ ...state, speech: { ...state.speech, mouthOpen: 4 } }), false);
});

test("plans a capability-aware switch without losing canonical speech, emotion or intent", () => {
  const plan = planEmbodimentSwitch("live2d", {
    mode: "vrm3d", rendererId: "vrm-main",
    channels: ["headYaw", "leftElbow", "rightElbow", "torsoPitch"],
    expressions: ["neutral", "curiosity"], supportsSpeechVisemes: true,
    supportsWorldTargets: true, supportsClothingLayers: true, supportsPhysics: true,
  }, state);
  assert.equal(plan.to, "vrm3d");
  assert.equal(plan.stateRevision, 42);
  assert.equal(plan.preserved.speech.eventId, "speech-1");
  assert.equal(plan.preserved.intentId, "intent-9");
  assert.deepEqual(plan.supportedPose, { headYaw: 0.3, leftElbow: 0.8, rightElbow: -0.4, torsoPitch: 0.1 });
  assert.deepEqual(plan.unsupportedChannels, ["leftFingers"]);
  assert.equal(plan.worldTargetSupported, true);
  assert.equal(plan.wardrobeSupported, true);
});

test("reports missing renderer capabilities instead of claiming unsupported behavior", () => {
  const plan = planEmbodimentSwitch("vrm3d", {
    mode: "live2d", rendererId: "live2d-main", channels: ["headYaw"],
    expressions: ["neutral"], supportsSpeechVisemes: false, supportsWorldTargets: false,
    supportsClothingLayers: false, supportsPhysics: false,
  }, state);
  assert.equal(plan.expressionSupported, false);
  assert.equal(plan.speechVisemesSupported, false);
  assert.equal(plan.worldTargetSupported, false);
  assert.equal(plan.wardrobeSupported, false);
  assert.ok(plan.unsupportedChannels.includes("leftFingers"));
});

test("shared pose blending is finite, bounded by endpoints and omits one-sided channels", () => {
  assert.deepEqual(blendSharedPose({ headYaw: -1, leftElbow: 0.2 }, { headYaw: 1, rightElbow: 0.9 }, 0.5), { headYaw: 0 });
  assert.deepEqual(blendSharedPose({ headYaw: 0 }, { headYaw: 1 }, 2), { headYaw: 1 });
  assert.deepEqual(blendSharedPose({ headYaw: 0 }, { headYaw: 1 }, -1), { headYaw: 0 });
});

test("switch progress is monotonic and robust to invalid timing", () => {
  assert.equal(advanceSwitchProgress(0.6, 200, 1000), 0.6);
  assert.equal(advanceSwitchProgress(0.2, 500, 1000), 0.5);
  assert.equal(advanceSwitchProgress(0.2, Infinity, 1000), 0.2);
  assert.equal(advanceSwitchProgress(0.2, 500, 0), 0.2);
});
