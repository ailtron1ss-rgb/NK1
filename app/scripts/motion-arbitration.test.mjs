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
  for (const programId of ["nod", "shake", "clap", "bow"]) {
    const program = MOTION_PROGRAMS[programId];
    assert.equal(program.loop, false);
    const finalFrame = program.keyframes.at(-1);
    for (const value of Object.values(finalFrame.channels)) assert.equal(value, 0);
  }
});


test("point gesture extends the index while curling the other fingers", () => {
  const pose = sampleMotionProgram(MOTION_PROGRAMS.point, MOTION_PROGRAMS.point.durationMs);
  assert.ok(pose.channels.rightIndexCurl < -0.7);
  assert.ok(pose.channels.rightThumbCurl > 0);
  assert.ok(pose.channels.rightMiddleCurl > 0.5);
  assert.ok(pose.channels.rightRingCurl > 0.5);
  assert.ok(pose.channels.rightLittleCurl > 0.5);
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
