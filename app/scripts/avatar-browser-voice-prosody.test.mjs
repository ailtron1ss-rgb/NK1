import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { deriveBrowserVoiceProsody } from "../src/components/avatar/browserVoiceProsody.ts";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function input(overrides = {}) {
  return {
    emotion: "calm",
    valence: 0.5,
    arousal: 0.5,
    dominance: 0.5,
    action: "respond",
    traits: { warmth: 0.5, composure: 0.5, sarcasm: 0.5 },
    ...overrides,
  };
}

test("browser prosody is deterministic and bounded for the Web Speech API", () => {
  const result = deriveBrowserVoiceProsody(input());
  assert.deepEqual(result, deriveBrowserVoiceProsody(input()));
  assert.ok(result.pitch >= 0.82 && result.pitch <= 1.18);
  assert.ok(result.rate >= 0.78 && result.rate <= 1.15);
  assert.ok(result.volume >= 0.5 && result.volume <= 0.98);
  assert.ok(result.reasons.length > 0);
});

test("positive appraisal creates a warmer delivery without changing the words", () => {
  const calm = deriveBrowserVoiceProsody(input());
  const happy = deriveBrowserVoiceProsody(input({ emotion: "joy", valence: 0.82, arousal: 0.62 }));
  assert.ok(happy.pitch > calm.pitch);
  assert.ok(happy.volume > calm.volume);
  assert.ok(happy.reasons.includes("affect-joy"));
});

test("high negative arousal is regulated instead of amplifying anger", () => {
  const angry = deriveBrowserVoiceProsody(input({ emotion: "anger", valence: 0.12, arousal: 0.98 }));
  const neutral = deriveBrowserVoiceProsody(input({ emotion: "calm", valence: 0.5, arousal: 0.5 }));
  assert.ok(angry.volume < neutral.volume);
  assert.ok(angry.rate < neutral.rate);
  assert.ok(angry.reasons.includes("affect-deescalation"));
  assert.ok(angry.reasons.includes("high-negative-arousal-regulation"));
});

test("action, warmth, and composure have bounded prosody effects", () => {
  const baseline = deriveBrowserVoiceProsody(input());
  const reflective = deriveBrowserVoiceProsody(input({
    action: "reflect",
    traits: { warmth: 1, composure: 1, sarcasm: 0.5 },
  }));
  assert.ok(reflective.rate < deriveBrowserVoiceProsody(input({ action: "explore" })).rate);
  assert.ok(reflective.pitch > deriveBrowserVoiceProsody(input({ traits: { warmth: 0, composure: 0.5, sarcasm: 0.5 } })).pitch);
  assert.ok(reflective.rate >= 0.78 && reflective.rate <= 1.15);
  assert.ok(baseline.volume <= 0.98);
});

test("non-finite and out-of-range appraisal values cannot escape prosody bounds", () => {
  const result = deriveBrowserVoiceProsody(input({
    valence: Number.NaN,
    arousal: Number.POSITIVE_INFINITY,
    dominance: -100,
    traits: { warmth: 10, composure: Number.NaN, sarcasm: -10 },
  }));
  assert.ok(Number.isFinite(result.pitch) && result.pitch >= 0.82 && result.pitch <= 1.18);
  assert.ok(Number.isFinite(result.rate) && result.rate >= 0.78 && result.rate <= 1.15);
  assert.ok(Number.isFinite(result.volume) && result.volume >= 0.5 && result.volume <= 0.98);
});

test("speech synthesis and viseme timeline use the same affect-derived rate", async () => {
  const source = await readFile(path.join(appRoot, "src/components/AvatarStage.tsx"), "utf8");
  assert.match(source, /deriveBrowserVoiceProsody/);
  assert.match(source, /valence: snap\.emotion\.valence/);
  assert.match(source, /arousal: snap\.emotion\.arousal/);
  assert.match(source, /traits: snap\.identity\.traits/);
  assert.match(source, /timeline: buildVisemeTimeline\(text, rate, language\)/);
  assert.match(source, /utterance\.rate = prosody\.rate/);
  assert.match(source, /utterance\.pitch = prosody\.pitch/);
  assert.match(source, /utterance\.volume = prosody\.volume/);
});
