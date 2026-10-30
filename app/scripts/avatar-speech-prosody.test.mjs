import assert from "node:assert/strict";
import test from "node:test";
import { deriveSpeechProsody } from "../src/components/avatar/speechProsody.ts";

const emotions = ["curiosity", "calm", "joy", "anxiety", "frustration", "sadness", "anger", "protective"];

test("all canonical emotions produce bounded browser speech controls", () => {
  for (const emotion of emotions) {
    const profile = deriveSpeechProsody({ emotion, valence: 0.5, arousal: 0.5, dominance: 0.5 });
    assert.ok(profile.rate >= 0.82 && profile.rate <= 1.16, emotion);
    assert.ok(profile.pitch >= 0.86 && profile.pitch <= 1.14, emotion);
    assert.ok(profile.volume >= 0.72 && profile.volume <= 1, emotion);
    assert.ok(profile.pauseScale >= 0.72 && profile.pauseScale <= 1.42, emotion);
  }
});

test("arousal changes tempo and emphasis increases vocal energy", () => {
  const low = deriveSpeechProsody({ emotion: "calm", valence: 0.5, arousal: 0.1, dominance: 0.5, emphasis: 0.1 });
  const high = deriveSpeechProsody({ emotion: "calm", valence: 0.5, arousal: 0.9, dominance: 0.5, emphasis: 0.9 });
  assert.ok(high.rate > low.rate);
  assert.ok(high.pitch > low.pitch);
  assert.ok(high.volume > low.volume);
  assert.ok(high.pauseScale < low.pauseScale);
});

test("emotion establishes distinct speaking registers", () => {
  const base = { valence: 0.5, arousal: 0.45, dominance: 0.5, emphasis: 0.35 };
  const sad = deriveSpeechProsody({ ...base, emotion: "sadness" });
  const joyful = deriveSpeechProsody({ ...base, emotion: "joy" });
  const angry = deriveSpeechProsody({ ...base, emotion: "anger" });
  assert.ok(sad.rate < joyful.rate);
  assert.ok(sad.volume < joyful.volume);
  assert.ok(angry.pitch < joyful.pitch);
  assert.ok(sad.pauseScale > joyful.pauseScale);
});

test("malformed inputs remain finite and deterministic", () => {
  const input = { emotion: "protective", valence: Number.NaN, arousal: Number.POSITIVE_INFINITY, dominance: -50, emphasis: Number.NaN };
  const first = deriveSpeechProsody(input);
  assert.deepEqual(first, deriveSpeechProsody(input));
  for (const value of Object.values(first)) assert.ok(Number.isFinite(value));
});

test("unknown emotion falls back to the calm register", () => {
  const safe = deriveSpeechProsody({ emotion: "not-an-emotion", valence: 0.5, arousal: 0.5, dominance: 0.5 });
  const calm = deriveSpeechProsody({ emotion: "calm", valence: 0.5, arousal: 0.5, dominance: 0.5 });
  assert.deepEqual(safe, calm);
});
