import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { planAvatarMotorIntent } from "../src/components/avatar/motorIntent.ts";
import { deriveEmbodimentPose } from "../../runtime/neuro-kurisu/public/embodiment-pose.mjs";
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
    mouthOpen: 0.65, gazeX: 0.2, gazeY: -0.1, headTilt: -0.04,
    headAngleX: 0.2, headAngleY: -0.1, bodyAngleX: 0, bodyAngleY: 0, bodyAngleZ: 0, breathIntensity: 0.8,
    motorAction: "respond", intentReason: "legacy-v1-payload",
    gesture: true, motionGroup: "Special", motionIndex: 1, motionToken: 4, voiceEmphasis: 0.5,
  });
});

test("continuous pose channels remain optional for legacy v1 payloads and bounded for new senders", () => {
  const legacy = baseIntent();
  assert.equal(isEmbodimentIntentV1(legacy), true);
  const extended = baseIntent({ body: {
    ...legacy.body, headAngleX: 0.4, headAngleY: -0.2, bodyAngleX: 0.25,
    bodyAngleY: -0.1, bodyAngleZ: 0.05, breathIntensity: 0.7,
  } });
  assert.equal(isEmbodimentIntentV1(extended), true);
  const normalized = normalizeEmbodimentIntentV1(extended);
  assert.equal(normalized.bodyAngleX, 0.25);
  assert.equal(normalized.bodyAngleY, -0.1);
  assert.equal(normalized.bodyAngleZ, 0.05);
  assert.equal(normalized.breathIntensity, 0.7);
  assert.equal(isEmbodimentIntentV1(baseIntent({ body: { ...legacy.body, headAngleX: 1.01 } })), false);
  assert.equal(isEmbodimentIntentV1(baseIntent({ body: { ...legacy.body, breathIntensity: -0.01 } })), false);
  assert.equal(isEmbodimentIntentV1(baseIntent({ body: { ...legacy.body, untrustedExtra: true } })), false);
});

test("continuous pose mapper is deterministic, bounded and neutral-safe on invalid inputs", () => {
  const inspect = deriveEmbodimentPose("explore", "curiosity", 0.7);
  const rest = deriveEmbodimentPose("rest", "calm", 0.15);
  assert.notDeepEqual(inspect, rest);
  assert.deepEqual(inspect, deriveEmbodimentPose("explore", "curiosity", 0.7));
  assert.deepEqual(deriveEmbodimentPose("unknown", "unrecognized", Number.NaN), deriveEmbodimentPose("wait", "calm", 0.25));
  for (const pose of [inspect, rest]) {
    for (const key of ["headAngleX", "headAngleY", "bodyAngleX", "bodyAngleY", "bodyAngleZ"]) {
      assert.ok(Number.isFinite(pose[key]) && pose[key] >= -1 && pose[key] <= 1);
    }
    assert.ok(Number.isFinite(pose.breathIntensity) && pose.breathIntensity >= 0 && pose.breathIntensity <= 1);
  }
});

test("semantic motor goal and bounded rationale survive strict normalization", () => {
  const legacy = normalizeEmbodimentIntentV1(baseIntent());
  assert.equal(legacy.motorAction, "respond", "old Special motion maps to a semantic compatibility fallback");
  assert.equal(legacy.intentReason, "legacy-v1-payload");
  const value = baseIntent({ body: {
    ...baseIntent().body,
    motorAction: "explain",
    intentReason: "explanatory-language-and-response-context",
  } });
  assert.equal(isEmbodimentIntentV1(value), true);
  const normalized = normalizeEmbodimentIntentV1(value);
  assert.equal(normalized.motorAction, "explain");
  assert.equal(normalized.intentReason, "explanatory-language-and-response-context");
  assert.equal(isEmbodimentIntentV1(baseIntent({ body: { ...baseIntent().body, motorAction: "dance" } })), false);
  assert.equal(isEmbodimentIntentV1(baseIntent({ body: { ...baseIntent().body, intentReason: "bad reason" } })), false);
});

test("invalid motion, extra protocol fields, and out-of-range data fail closed", () => {
  assert.equal(isEmbodimentIntentV1(baseIntent({ body: { headTilt: 0, gesture: true, motionGroup: "Special", motionIndex: 2, motionToken: 4 } })), false);
  assert.equal(isEmbodimentIntentV1({ ...baseIntent(), hiddenDebugPayload: true }), false);
  assert.equal(isEmbodimentIntentV1(baseIntent({ gaze: { x: 5, y: 0, driven: true } })), false);
  assert.equal(normalizeEmbodimentIntentV1(baseIntent({ speechPhase: "cancelled", cancellationToken: "cancel:speech-1", mouth: { open: 0.8, form: 0, viseme: "a" } })).mouthOpen, 0);
});

test("the production viewers preserve motor intent and map continuous pose to the available rig", async () => {
  const viewer = await readFile(new URL("../../runtime/neuro-kurisu/public/live2d/viewer.html", import.meta.url), "utf8");
  const appViewer = await readFile(new URL("../public/live2d/viewer.html", import.meta.url), "utf8");
  const stage = await readFile(new URL("../src/components/AvatarStage.tsx", import.meta.url), "utf8");
  assert.ok(stage.includes("motorAction: motorPlan.action"));
  assert.ok(stage.includes("intentReason: motorPlan.reason"));
  assert.match(viewer, /type="module"/);
  assert.ok(viewer.includes("from './embodiment-intent.mjs'"));
  assert.match(viewer, /d.type==='kurisu_embodiment_intent'/);
  for (const token of ["ParamBodyAngleX", "ParamBodyAngleY", "ParamBodyAngleZ", "ParamBreath", "breathIntensity"]) {
    assert.ok(viewer.includes(token), `standalone viewer must consume ${token}`);
    assert.ok(appViewer.includes(token), `app viewer must consume ${token}`);
  }
  const intentContract = await readFile(new URL("../../runtime/neuro-kurisu/public/live2d/embodiment-intent.mjs", import.meta.url), "utf8");
  for (const token of ["motorAction", "intentReason", "MOTOR_ACTIONS", "legacy-v1-payload"]) {
    assert.ok(intentContract.includes(token), `shared intent contract must preserve ${token}`);
  }
  assert.ok(appViewer.includes("motorAction:d.body.motorAction"));
  assert.ok(appViewer.includes("intentReason:d.body.intentReason"));
  assert.match(viewer, /lastIntentStateVersion/);
  assert.match(viewer, /motionToken||0/);
  assert.ok(viewer.includes("lipTarget=clamp(mouth+emph*.08,0,1)"));
});

test("Original 2D concept is selectable and keeps independent outfit/pose customization", async () => {
  const stage = await readFile(new URL("../src/components/AvatarStage.tsx", import.meta.url), "utf8");
  const original = await readFile(new URL("../src/components/KurisuOriginalStage.tsx", import.meta.url), "utf8");
  assert.ok(stage.includes('type ViewMode = "live2d" | "legacy" | "original"'));
  assert.ok(stage.includes('onClick={() => setMode("original")}'));
  assert.ok(stage.includes("<KurisuOriginalStage"));
  assert.ok(stage.includes('saved === "legacy" || saved === "original"'));
  assert.ok(original.includes('type Outfit = "lab" | "casual" | "night"'));
  assert.ok(original.includes('type PoseOverride = "auto" | "crossed" | "thinking" | "explain"'));
  assert.ok(original.includes('writeAvatarPreference("kurisu-original-outfit", outfit)'));
  assert.ok(original.includes("Original 2D concept"));
});
