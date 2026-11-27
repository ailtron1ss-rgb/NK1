import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { emptySnapshot } from "../src/organism/types.ts";
import { buildAvatarRenderProjection } from "../src/components/avatar/avatarRenderProjection.ts";

function frame(overrides = {}) {
  return {
    schemaVersion: 1,
    profile: "3d",
    expression: "determined",
    expressionWeight: 0.86,
    affect: {
      valence01: 0.72, arousal01: 0.61, dominance01: 0.68, curiosity01: 0.75,
      warmth01: 0.58, stress01: 0.14, confidence01: 0.82, memoryRecall01: 0.12,
    },
    channels: {
      eyeOpen: 0.82, browRaise: 0.62, browFurrow: 0.08, mouthSmile: 0.48,
      mouthOpen: 0.2, cheekRaise: 0.44, headTilt: 0.6, headYaw: -0.35,
      gazeX: 0.9, gazeY: -0.75, idleMotion: 0.3, lipSyncGain: 0.5,
    },
    freshness01: 1,
    reducedMotion: false,
    source: "organism-state",
    rendererHints: {
      live2d: { ParamEyeLOpen: 0.82 },
      layered2d: { parallax01: 0.2, depthBreath01: 0.1, faceRig01: 0.6 },
      spatial3d: { headPitch: 0.04, headYaw: -0.2, gazeDistance01: 0.6, shoulderRelax01: 0.7 },
    },
    projectedAt: 1700000000000,
    ...overrides,
  };
}

function input(snapshot) {
  return {
    snapshot,
    thinking: false,
    speaking: true,
    hasFreshTurn: true,
    turnText: "Сейчас объясню, что показывает результат.",
    speechPhase: "speaking",
    speechEventId: "speech-unified-1",
    audioClockId: "clock-unified-1",
    audioTimeMs: 840,
    clockSource: "speech-synthesis-boundary-anchored-monotonic",
    mouthPose: { open: 0.64, form: -0.35, viseme: "round" },
    voiceEmphasis: 0.42,
  };
}

test("canonical same-tick brain frame is folded into the one shared render projection", () => {
  const snapshot = emptySnapshot();
  snapshot.tick = 42;
  snapshot.lastOption = "respond";
  snapshot.emotion = { ...snapshot.emotion, label: "curiosity", valence: 0.7, arousal: 0.55 };
  snapshot.avatarBrain = { schemaVersion: 1, stateVersion: 42, frame: frame() };

  const projection = buildAvatarRenderProjection(input(snapshot));

  assert.equal(projection.tick, snapshot.tick, "the projection must retain the canonical organism tick independently of speech/intent sequences");
  assert.deepEqual(projection.brainFrame, snapshot.avatarBrain.frame);
  assert.equal(projection.expression, "focused", "canonical brain expression should win over renderer-local emotion mapping");
  assert.equal(projection.expressionIntensity, 0.86);
  assert.ok(Math.abs(projection.gaze.x - 0.36) < 1e-12);
  assert.ok(Math.abs(projection.gaze.y + 0.3) < 1e-12);
  assert.equal(projection.motorPlan.action, "explain", "the shared semantic motor plan remains the only action planner");
  assert.ok(Math.abs(projection.motorPlan.headTilt - 0.09) < 1e-12);
  assert.deepEqual(projection.mouthPose, { open: 0.32, form: -0.35, viseme: "round" });
  assert.deepEqual(projection.speech, {
    phase: "speaking",
    speechEventId: "speech-unified-1",
    audioClockId: "clock-unified-1",
    audioTimeMs: 840,
    clockSource: "speech-synthesis-boundary-anchored-monotonic",
  });
  assert.deepEqual(projection.brainChannels, snapshot.avatarBrain.frame.channels);
  assert.equal(projection.bodyChannels.headRoll, undefined, "head tilt is already owned by the single motor plan");
  assert.equal(projection.bodyChannels.headYaw, -0.35);
  assert.equal(projection.bodyChannels.gazeX, 0.9);
  assert.equal(projection.bodyChannels.breath, 0.3);
  assert.equal(projection.character.valence01, 0.72);
  assert.equal(projection.character.arousal01, 0.61);
  assert.equal(projection.character.dominance01, 0.68);
  assert.equal(projection.character.curiosity01, 0.75);
  assert.equal(projection.character.warmth01, 0.58);
  assert.equal(projection.character.stress01, 0.14);
  assert.equal(projection.character.reducedMotion, false);
  assert.equal(projection.character.traits.curiosity, snapshot.identity.traits.curiosity);
  assert.equal(projection.character.traits.guardedness, snapshot.identity.traits.guardedness);
});

test("stale brain frames fail closed and leave the existing renderer-neutral fallback intact", () => {
  const snapshot = emptySnapshot();
  snapshot.tick = 42;
  snapshot.lastOption = "respond";
  snapshot.emotion = { ...snapshot.emotion, label: "curiosity", valence: 0.7, arousal: 0.55 };
  snapshot.avatarBrain = { schemaVersion: 1, stateVersion: 41, frame: frame() };

  const projection = buildAvatarRenderProjection(input(snapshot));

  assert.equal(projection.brainFrame, null);
  assert.equal(projection.expression, "thinking");
  assert.deepEqual(projection.mouthPose, { open: 0.64, form: -0.35, viseme: "round" });
  assert.ok(Math.abs(projection.gaze.x - 0.042) < 1e-9);
  assert.equal(projection.character.valence01, snapshot.emotion.valence,
    "a stale brain frame must not leak its previous affect into the body");
  assert.equal(projection.character.curiosity01, snapshot.curiosity,
    "stale brain curiosity must fall back to the current organism");
});

test("all renderer components consume the same projection and Original2D owns no second planner", async () => {
  const [stage, original, three] = await Promise.all([
    readFile(new URL("../src/components/AvatarStage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/KurisuOriginalStage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8"),
  ]);

  assert.ok(stage.includes("buildAvatarRenderProjection("));
  assert.ok(stage.includes("avatarBrainFrame={projection.brainFrame ?? undefined}"));
  assert.ok(stage.includes("avatarBrainChannels={projection.brainChannels ?? undefined}"));
  assert.ok(stage.includes("motorPlan={projection.motorPlan}"));
  assert.ok(original.includes("motorPlan: AvatarMotorIntentPlan"));
  assert.ok(original.includes("avatarBrainChannels?: AvatarBrainChannelsV1"));
  assert.equal(original.includes("planAvatarMotorIntent("), false);
  assert.ok(three.includes("avatarBrainFrame?: AvatarBrainProjectionV1"));
  assert.ok(three.includes("resolveVrmArmIntent(p.motorPlan"));
});
