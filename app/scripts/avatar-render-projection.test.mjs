import assert from "node:assert/strict";
import test from "node:test";
import { emptySnapshot } from "../src/organism/types.ts";
import { buildAvatarRenderProjection } from "../src/components/avatar/avatarRenderProjection.ts";

function baseInput(overrides = {}) {
  const snapshot = emptySnapshot();
  snapshot.emotion = {
    ...snapshot.emotion,
    label: "curiosity",
    valence: 0.7,
    arousal: 0.55,
  };
  snapshot.lastOption = "respond";
  snapshot.needs = {
    ...snapshot.needs,
    energy: 0.8,
    cognitiveLoad: 0.2,
    uncertainty: 0.3,
    socialNeed: 0.4,
    novelty: 0.6,
    goalPressure: 0.3,
  };
  return {
    snapshot,
    thinking: false,
    speaking: true,
    hasFreshTurn: true,
    turnText: "Смотри, я объясню, что показывают данные.",
    speechPhase: "speaking",
    speechEventId: "speech-42",
    audioClockId: "clock-42",
    audioTimeMs: 840,
    clockSource: "speech-synthesis-boundary-anchored-monotonic",
    mouthPose: { open: 0.64, form: -0.35, viseme: "round" },
    voiceEmphasis: 0.42,
    ...overrides,
  };
}

test("one projection produces the canonical motor, expression, gaze and speech frame", () => {
  const projection = buildAvatarRenderProjection(baseInput());

  assert.equal(projection.action, "respond", "raw organism action remains available to renderer clip selectors");
  assert.equal(projection.motorPlan.action, "explain");
  assert.equal(projection.motorPlan.motionGroup, "TapBody");
  assert.equal(projection.motorPlan.gesture, true);
  assert.equal(projection.expression, "thinking");
  assert.equal(projection.expressionIntensity, 0.55);
  assert.ok(Math.abs(projection.gaze.x - 0.042) < 1e-9);
  assert.ok(Math.abs(projection.gaze.y - 0.01) < 1e-9);
  assert.equal(projection.speech.phase, "speaking");
  assert.equal(projection.speech.speechEventId, "speech-42");
  assert.equal(projection.speech.audioClockId, "clock-42");
  assert.equal(projection.speech.audioTimeMs, 840);
  assert.equal(projection.speaking, true);
  assert.deepEqual(projection.mouthPose, { open: 0.64, form: -0.35, viseme: "round" });
  assert.equal(projection.voiceEmphasis, 0.42);
});

test("terminal speech lifecycle closes the mouth even when the last sampled mouth was open", () => {
  for (const phase of ["ended", "cancelled", "unknown", "idle", "starting"]) {
    const projection = buildAvatarRenderProjection(baseInput({ speechPhase: phase }));
    assert.equal(projection.speaking, false, phase + " must not advertise active speech");
    assert.deepEqual(projection.mouthPose, { open: 0.015, form: 0, viseme: "rest" });
    assert.equal(projection.voiceEmphasis, 0);
  }
});

test("a speaking phase without a browser-confirmed active utterance remains visually silent", () => {
  const projection = buildAvatarRenderProjection(baseInput({ speaking: false }));
  assert.equal(projection.speech.phase, "speaking");
  assert.equal(projection.speaking, false);
  assert.deepEqual(projection.mouthPose, { open: 0.015, form: 0, viseme: "rest" });
});

test("missing speech identity and malformed numeric samples fail closed", () => {
  const input = baseInput({
    speechEventId: " ",
    audioClockId: null,
    audioTimeMs: Number.NaN,
    voiceEmphasis: Number.POSITIVE_INFINITY,
  });
  input.snapshot.emotion = { ...input.snapshot.emotion, valence: Number.NaN, arousal: Number.POSITIVE_INFINITY };
  const projection = buildAvatarRenderProjection(input);

  assert.equal(projection.speaking, false);
  assert.equal(projection.speech.speechEventId, null);
  assert.equal(projection.speech.audioClockId, null);
  assert.equal(projection.speech.audioTimeMs, 0);
  assert.equal(projection.expressionIntensity, 0);
  assert.ok(Math.abs(projection.gaze.x - 0.01) < 1e-9, "invalid valence uses neutral offset while preserving the respond gaze baseline");
  assert.equal(projection.voiceEmphasis, 0);
  assert.deepEqual(projection.mouthPose, { open: 0.015, form: 0, viseme: "rest" });
});

test("organism rest and wake state are reflected by the shared plan for every renderer", () => {
  const input = baseInput({ speaking: false, hasFreshTurn: false, turnText: "", speechPhase: "ended" });
  input.snapshot.awake = false;
  const projection = buildAvatarRenderProjection(input);

  assert.equal(projection.motorPlan.action, "rest");
  assert.equal(projection.motorPlan.motionGroup, "Idle");
  assert.equal(projection.motorPlan.gesture, false);
});

test("a recent canonical avatar contact adds a bounded non-emotional motor acknowledgment", () => {
  const input = baseInput({ speaking: false, hasFreshTurn: false, speechPhase: "idle", speechEventId: null, audioClockId: null });
  input.snapshot.at = 11_000;
  const baseline = buildAvatarRenderProjection(input);
  input.snapshot.avatarInteraction = {
    schemaVersion: 1,
    kind: "avatar-contact",
    zone: "head",
    at: 10_000,
    confidence01: 0.72,
    evidenceId: "user-action-head-1",
  };

  const touched = buildAvatarRenderProjection(input);
  assert.equal(touched.interaction?.zone, "head");
  assert.equal(touched.interaction?.evidenceId, "user-action-head-1");
  assert.ok(touched.interaction?.pulse01 > 0 && touched.interaction?.pulse01 < 1);
  assert.ok(touched.motorPlan.headTilt > baseline.motorPlan.headTilt, "head contact should produce a bounded renderer-neutral head acknowledgment");
  assert.equal(touched.expression, baseline.expression, "contact must not fabricate a new emotion");
  assert.equal(touched.expressionIntensity, baseline.expressionIntensity, "contact must not force facial affect intensity");
});

test("expired or malformed avatar contact never leaks into a fresh renderer frame", () => {
  const input = baseInput({ speaking: false, hasFreshTurn: false, speechPhase: "idle", speechEventId: null, audioClockId: null });
  input.snapshot.at = 20_000;
  const baseline = buildAvatarRenderProjection(input);
  input.snapshot.avatarInteraction = {
    schemaVersion: 1,
    kind: "avatar-contact",
    zone: "head",
    at: 10_000,
    confidence01: 0.72,
    evidenceId: "old-contact",
  };
  const expired = buildAvatarRenderProjection(input);
  assert.equal(expired.interaction, null);
  assert.equal(expired.motorPlan.headTilt, baseline.motorPlan.headTilt);

  input.snapshot.avatarInteraction = {
    schemaVersion: 1,
    kind: "avatar-contact",
    zone: "unknown",
    at: 19_900,
    confidence01: 0.72,
    evidenceId: "malformed-contact",
  };
  const malformed = buildAvatarRenderProjection(input);
  assert.equal(malformed.interaction, null);
  assert.equal(malformed.motorPlan.headTilt, baseline.motorPlan.headTilt);
});
