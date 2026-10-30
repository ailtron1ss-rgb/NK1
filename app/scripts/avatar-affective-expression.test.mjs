import assert from "node:assert/strict";
import test from "node:test";
import { deriveAffectiveExpression } from "../src/components/avatar/affectiveExpression.ts";

const labels = ["curiosity", "calm", "joy", "anxiety", "frustration", "sadness", "anger", "protective"];

test("all canonical emotion labels map to supported Live2D expression keys", () => {
  for (const emotion of labels) {
    const profile = deriveAffectiveExpression({ emotion, valence: 0.5, arousal: 0.4, dominance: 0.5 });
    assert.ok(["thinking", "neutral", "happy", "sad", "angry", "focused"].includes(profile.expression));
    assert.ok(profile.expressionIntensity >= 0.12 && profile.expressionIntensity <= 0.92);
  }
});

test("affective channels remain finite and bounded for malformed and extreme inputs", () => {
  const profile = deriveAffectiveExpression({
    emotion: "joy",
    valence: Number.NaN,
    arousal: Number.POSITIVE_INFINITY,
    dominance: -100,
  });
  for (const key of ["expressionIntensity", "gazeX", "gazeY", "headTilt", "gestureDrive", "voiceEmphasis"]) {
    assert.ok(Number.isFinite(profile[key]), key);
  }
  assert.ok(profile.gazeX >= -0.4 && profile.gazeX <= 0.4);
  assert.ok(profile.gazeY >= -0.25 && profile.gazeY <= 0.25);
  assert.ok(profile.headTilt >= -0.15 && profile.headTilt <= 0.15);
  assert.ok(profile.gestureDrive >= 0 && profile.gestureDrive <= 1);
  assert.ok(profile.voiceEmphasis >= 0 && profile.voiceEmphasis <= 0.85);
});

test("arousal increases expressive intensity and voice emphasis", () => {
  const low = deriveAffectiveExpression({ emotion: "calm", valence: 0.5, arousal: 0.1, dominance: 0.7 });
  const high = deriveAffectiveExpression({ emotion: "calm", valence: 0.5, arousal: 0.9, dominance: 0.7 });
  assert.ok(high.expressionIntensity > low.expressionIntensity);
  assert.ok(high.voiceEmphasis > low.voiceEmphasis);
  assert.ok(high.gestureDrive > low.gestureDrive);
});

test("dominance and valence affect body cues without changing the emotion owner", () => {
  const lowControl = deriveAffectiveExpression({ emotion: "curiosity", valence: 0.2, arousal: 0.5, dominance: 0.1 });
  const highControl = deriveAffectiveExpression({ emotion: "curiosity", valence: 0.8, arousal: 0.5, dominance: 0.9 });
  assert.equal(lowControl.expression, "thinking");
  assert.equal(highControl.expression, "thinking");
  assert.notEqual(lowControl.headTilt, highControl.headTilt);
  assert.notEqual(lowControl.gazeX, highControl.gazeX);
});

test("same appraisal produces deterministic expression profile", () => {
  const input = { emotion: "protective", valence: 0.34, arousal: 0.78, dominance: 0.62 };
  assert.deepEqual(deriveAffectiveExpression(input), deriveAffectiveExpression(input));
});

test("continuous channels ease toward the next appraisal without overshoot", async () => {
  const { smoothAffectiveExpression } = await import("../src/components/avatar/affectiveExpression.ts");
  const previous = deriveAffectiveExpression({ emotion: "calm", valence: 0.5, arousal: 0.1, dominance: 0.8 });
  const next = deriveAffectiveExpression({ emotion: "joy", valence: 0.9, arousal: 0.9, dominance: 0.4 });
  const stepped = smoothAffectiveExpression(previous, next, 40);
  assert.equal(stepped.expression, next.expression);
  assert.ok(stepped.expressionIntensity > previous.expressionIntensity);
  assert.ok(stepped.expressionIntensity < next.expressionIntensity);
  assert.ok(stepped.gazeX > previous.gazeX && stepped.gazeX < next.gazeX);
  const released = smoothAffectiveExpression(stepped, previous, 40);
  assert.ok(released.expressionIntensity < stepped.expressionIntensity);
  assert.ok(released.expressionIntensity > previous.expressionIntensity);
});
