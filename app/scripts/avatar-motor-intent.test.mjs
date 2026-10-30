import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { planAvatarMotorIntent } from "../src/components/avatar/motorIntent.ts";
import { isEmbodimentIntentV1, normalizeEmbodimentIntentV1 } from "../../runtime/neuro-kurisu/public/live2d/embodiment-intent.mjs";

const baseIntent = (overrides = {}) => ({
  type: "kurisu_embodiment_intent",
  protocolVersion: 1,
  stateVersion: 1,
  sentAtEpochMs: 1_798_000_000_000,
  speechEventId: "speech-1",
  audioClockId: "clock-1",
  speechPhase: "speaking",
  audioTimeMs: 120,
  clockSource: "speech-synthesis-boundary-anchored-monotonic",
  priority: 70,
  cancellationToken: null,
  expression: "happy",
  expressionIntensity: 0.8,
  mouth: { open: 0.65, form: 0.2, viseme: "a" },
  gaze: { x: 0.2, y: -0.1, driven: true },
  body: { headTilt: -0.04, gesture: true, motionGroup: "Special", motionIndex: 1, motionToken: 4 },
  voiceEmphasis: 0.5,
  ...overrides,
});

test("rest state suppresses gestures and selects the shipped Idle motion", () => {
  const plan = planAvatarMotorIntent({
    emotion: "joy", valence: 0.9, arousal: 0.8, action: "respond", thinking: false,
    speaking: false, hasFreshTurn: false, turnText: "", awake: false,
  });
  assert.equal(plan.action, "rest");
  assert.equal(plan.motionGroup, "Idle");
  assert.equal(plan.gesture, false);
});

test("cognitive reflection chooses TapHead without inventing unsupported motion groups", () => {
  const plan = planAvatarMotorIntent({
    emotion: "curiosity", valence: 0.6, arousal: 0.4, action: "wait", thinking: true,
    speaking: false, hasFreshTurn: false, turnText: "", awake: true,
  });
  assert.equal(plan.action, "reflect");
  assert.equal(plan.motionGroup, "TapHead");
  assert.ok(plan.headTilt >= -0.15 && plan.headTilt <= 0.15);
});

test("explanatory language produces an inspectable body-level gesture intention", () => {
  const plan = planAvatarMotorIntent({
    emotion: "calm", valence: 0.58, arousal: 0.55, action: "respond", thinking: false,
    speaking: true, hasFreshTurn: true, turnText: "Смотри, я объясню, что показывают данные.", awake: true,
  });
  assert.equal(plan.action, "explain");
  assert.equal(plan.motionGroup, "TapBody");
  assert.equal(plan.gesture, true);
});

test("planner output is deterministic and remains within available asset ranges", () => {
  const input = {
    emotion: "joy", valence: 0.95, arousal: 0.9, action: "respond", thinking: false,
    speaking: true, hasFreshTurn: true, turnText: "Отлично, получилось!", awake: true,
  };
  const a = planAvatarMotorIntent(input);
  const b = planAvatarMotorIntent(input);
  assert.deepEqual(a, b);
  assert.equal(a.motionGroup, "Special");
  assert.equal(a.motionIndex, 1);
  assert.ok(Math.abs(a.headTilt) <= 0.15);
});

test("strict protocol accepts the app's envelope and normalizes speech/body fields", () => {
  const value = baseIntent();
  assert.equal(isEmbodimentIntentV1(value), true);
  assert.deepEqual(normalizeEmbodimentIntentV1(value), {
    stateVersion: 1, expression: "happy", expressionIntensity: 0.8, speaking: true,
    mouthOpen: 0.65, mouthForm: 0.2, gazeX: 0.2, gazeY: -0.1, gazeDriven: true,
    headTilt: -0.04, gesture: true, motionGroup: "Special", motionIndex: 1, motionToken: 4, voiceEmphasis: 0.5,
  });
});

test("invalid motion, extra protocol fields, and out-of-range data fail closed", () => {
  assert.equal(isEmbodimentIntentV1(baseIntent({ body: { headTilt: 0, gesture: true, motionGroup: "Special", motionIndex: 2, motionToken: 4 } })), false);
  assert.equal(isEmbodimentIntentV1({ ...baseIntent(), hiddenDebugPayload: true }), false);
  assert.equal(isEmbodimentIntentV1(baseIntent({ gaze: { x: 5, y: 0, driven: true } })), false);
  assert.equal(normalizeEmbodimentIntentV1(baseIntent({ speechPhase: "cancelled", cancellationToken: "cancel:speech-1", mouth: { open: 0.8, form: 0, viseme: "a" } })).mouthOpen, 0);
});

test("the production viewer listens to the protocol emitted by AvatarStage and uses token-aware motion identity", async () => {
  const viewer = await readFile(new URL("../../runtime/neuro-kurisu/public/live2d/viewer.html", import.meta.url), "utf8");
  assert.match(viewer, /type="module"/);
  assert.ok(viewer.includes("from './embodiment-intent.mjs'"));
  assert.match(viewer, /d.type==='kurisu_embodiment_intent'/);
  assert.match(viewer, /lastIntentStateVersion/);
  assert.match(viewer, /motionToken||0/);
  assert.ok(viewer.includes("lipTarget=bodySignal.speaking?mouth:0.015"));
});

test("Original 2.5D preview is selectable and keeps independent outfit/pose customization", async () => {
  const stage = await readFile(new URL("../src/components/AvatarStage.tsx", import.meta.url), "utf8");
  const original = await readFile(new URL("../src/components/KurisuOriginalStage.tsx", import.meta.url), "utf8");
  assert.ok(stage.includes('type ViewMode = "live2d" | "legacy" | "original" | "3d"'));
  assert.ok(stage.includes('onClick={() => setMode("original")}'));
  assert.ok(stage.includes("<KurisuOriginalStage"));
  assert.ok(stage.includes('saved === "legacy" || saved === "original" || saved === "3d"'));
  assert.ok(original.includes('type Outfit = "lab" | "casual" | "night"'));
  assert.ok(original.includes('type PoseOverride = "auto" | "crossed" | "thinking" | "explain"'));
  assert.ok(original.includes('writeAvatarPreference("kurisu-original-outfit", outfit)'));
  assert.ok(original.includes("2.5D depth/parallax SVG preview"));
});

test("the app-served viewer applies intent parameters after Cubism motion and physics updates", async () => {
  const viewer = await readFile(new URL("../public/live2d/viewer.html", import.meta.url), "utf8");
  assert.match(viewer, /d\.type!=='kurisu_embodiment_intent'/);
  assert.match(viewer, /beforeModelUpdate/);
  assert.ok(viewer.includes("model.internalModel?.on?.('beforeModelUpdate',applyModelParameterOverrides)"));
  assert.ok(!viewer.includes("app.internalModel?.on?.('beforeModelUpdate',applyModelParameterOverrides)"));
  assert.match(viewer, /addParameterValueById/);
  assert.match(viewer, /resolution,autoDensity:true/);
  assert.match(viewer, /MOTION_COUNTS/);
  assert.match(viewer, /lastIntentStateVersion/);
  assert.ok(viewer.includes("lipTarget=bodySignal.speaking?mouth:0.015"));
});
