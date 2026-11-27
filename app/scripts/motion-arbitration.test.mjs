import test from "node:test";
import assert from "node:assert/strict";
import { MOTION_PROGRAMS, sampleMotionProgram, validateMotionProgram } from "../src/components/avatar/motionLibrary.ts";
import { arbitrateMotion, defaultMotionArbitrationState, resolvePrimaryProgram } from "../src/components/avatar/motionArbitration.ts";

const base = {
  action: "respond",
  emotion: "calm",
  speaking: true,
  thinking: false,
  awake: true,
  energy01: 0.8,
};

test("N.E.K.O.-derived gesture cards select NK1-owned body programs", () => {
  for (const programId of ["nod", "shake", "wave", "clap", "bow", "point"]) {
    assert.equal(resolvePrimaryProgram({ ...base, gestureProgram: programId }), programId);
    assert.deepEqual(validateMotionProgram(MOTION_PROGRAMS[programId]), []);
    const selected = arbitrateMotion(defaultMotionArbitrationState(), { ...base, gestureProgram: programId }, 260);
    assert.equal(selected.primary, programId);
  }
});

test("thinking retains priority over an explicit gesture and sleeping suppresses it", () => {
  assert.equal(resolvePrimaryProgram({ ...base, thinking: true, gestureProgram: "wave" }), "think");
  assert.equal(resolvePrimaryProgram({ ...base, awake: false, gestureProgram: "wave" }), "idle");
});

test("gesture programs return to a neutral body pose when a one-shot finishes", () => {
  for (const programId of ["nod", "shake", "clap", "bow", "point"]) {
    const program = MOTION_PROGRAMS[programId];
    assert.equal(program.loop, false);
    const finalFrame = program.keyframes.at(-1);
    for (const value of Object.values(finalFrame.channels)) assert.equal(value, 0);
  }
});


test("point gesture extends the index while curling the other fingers", () => {
  const pose = sampleMotionProgram(MOTION_PROGRAMS.point, MOTION_PROGRAMS.point.durationMs * 0.5);
  assert.ok(pose.channels.rightIndexCurl < -0.7);
  assert.ok(pose.channels.rightThumbCurl > 0);
  assert.ok(pose.channels.rightMiddleCurl > 0.5);
  assert.ok(pose.channels.rightRingCurl > 0.5);
  assert.ok(pose.channels.rightLittleCurl > 0.5);
});

test("point gesture returns every articulated channel to neutral at completion", () => {
  const pose = sampleMotionProgram(MOTION_PROGRAMS.point, MOTION_PROGRAMS.point.durationMs);
  for (const value of Object.values(pose.channels)) assert.equal(value, 0);
});

test("wave gesture supplies a relaxed whole-hand shape without forcing a fist", () => {
  const pose = sampleMotionProgram(MOTION_PROGRAMS.wave, 0);
  assert.ok(pose.channels.rightFingers > 0 && pose.channels.rightFingers < 0.25);
});


test("explicit point gesture takes precedence over ordinary speech motion", () => {
  const selected = arbitrateMotion(defaultMotionArbitrationState(), { ...base, gestureProgram: "point" }, 260);
  assert.equal(selected.primary, "point");
  assert.deepEqual(validateMotionProgram(MOTION_PROGRAMS.point), []);
});

const neutralCharacter = {
  valence01: 0.5, arousal01: 0.3, dominance01: 0.5, curiosity01: 0.25, warmth01: 0.5,
  stress01: 0.25, confidence01: 0.7, cognitiveLoad01: 0.2, uncertainty01: 0.25,
  socialNeed01: 0.3, novelty01: 0.2, goalPressure01: 0.2, predictionError01: 0.2,
  traits: { curiosity: 0.7, warmth: 0.63, guardedness: 0.58, composure: 0.87, playfulness: 0.45, sarcasm: 0.68 },
  reducedMotion: false,
};

test("the semantic motor plan, not a stale organism option, owns the primary body program", () => {
  assert.equal(resolvePrimaryProgram({ ...base, action: "wait", semanticAction: "explain" }), "explain");
  assert.equal(resolvePrimaryProgram({ ...base, action: "respond", semanticAction: "inspect", speaking: false }), "inspect");
  assert.equal(resolvePrimaryProgram({ ...base, action: "respond", semanticAction: "comfort", speaking: false }), "comfort");
  assert.equal(resolvePrimaryProgram({ ...base, action: "wait", semanticAction: "rest" }), "idle");
  assert.equal(resolvePrimaryProgram({ ...base, semanticAction: "explain", gestureProgram: "point" }), "point");
  assert.equal(resolvePrimaryProgram({ ...base, awake: false, semanticAction: "explain", gestureProgram: "point" }), "idle");
});

test("affect and identity traits shape a bounded deterministic micro-posture without replacing the gesture", () => {
  const curiousCharacter = {
    ...neutralCharacter,
    valence01: 0.72,
    arousal01: 0.62,
    dominance01: 0.66,
    curiosity01: 0.94,
    warmth01: 0.64,
    confidence01: 0.86,
    novelty01: 0.92,
    socialNeed01: 0.55,
    goalPressure01: 0.72,
    traits: { ...neutralCharacter.traits, curiosity: 0.98, playfulness: 0.62 },
  };
  const neutral = arbitrateMotion(defaultMotionArbitrationState(), {
    ...base, action: "wait", semanticAction: "listen", speaking: false, character: neutralCharacter,
  }, 90);
  const curious = arbitrateMotion(defaultMotionArbitrationState(), {
    ...base, action: "wait", semanticAction: "listen", speaking: false, character: curiousCharacter,
  }, 90);
  const repeated = arbitrateMotion(defaultMotionArbitrationState(), {
    ...base, action: "wait", semanticAction: "listen", speaking: false, character: curiousCharacter,
  }, 90);

  assert.equal(curious.primary, "listen");
  assert.notDeepEqual(curious.channels, neutral.channels, "the same idle/listen program should acquire a character-specific posture");
  assert.deepEqual(curious.channels, repeated.channels, "identical state must remain deterministic");
  for (const value of Object.values(curious.channels)) {
    assert.ok(Number.isFinite(value) && value >= -1 && value <= 1);
  }
});

test("reduced motion suppresses affect micro-posture while retaining the selected semantic program", () => {
  const baseline = arbitrateMotion(defaultMotionArbitrationState(), {
    ...base, semanticAction: "listen",
  }, 90);
  const reduced = arbitrateMotion(defaultMotionArbitrationState(), {
    ...base, semanticAction: "listen", character: { ...neutralCharacter, reducedMotion: true },
  }, 90);
  assert.deepEqual(reduced.channels, baseline.channels, "reduced-motion suppresses only the additional personality offsets");
  assert.equal(reduced.primary, "listen");
});

test("character context is validated before it can influence a body pose", () => {
  assert.throws(() => arbitrateMotion(null, {
    ...base, semanticAction: "explain", character: { ...neutralCharacter, arousal01: Number.NaN },
  }, 16), /invalid-motion-intent/);
  assert.throws(() => arbitrateMotion(null, {
    ...base, character: { ...neutralCharacter, traits: { ...neutralCharacter.traits, hiddenControl: 1 } },
  }, 16), /invalid-motion-intent/);
});

