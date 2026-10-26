import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveAffectiveEmbodiment } from '../src/components/avatar/embodimentTimeline.ts';

const baseline = {
  label: 'calm', valence01: 0.5, arousal01: 0.3, dominance01: 0.55,
  energy01: 0.7, cognitiveLoad01: 0.25, uncertainty01: 0.3, sleepPressure01: 0.12,
};
const bounds = {
  speechRate: [0.78, 1.12], speechPitch: [0.82, 1.15], expressionIntensity: [0, 1],
  voiceEmphasis: [0, 1], headTilt: [-0.15, 0.15], gazeXOffset: [-0.15, 0.15],
  gazeYOffset: [-0.12, 0.12], stress01: [0, 1],
};
function assertBounded(profile) {
  for (const [key, [low, high]] of Object.entries(bounds)) {
    assert.ok(Number.isFinite(profile[key]), key + ' must stay finite');
    assert.ok(profile[key] >= low && profile[key] <= high, key + ' must remain bounded');
  }
}

test('affective embodiment maps mood/body state into bounded voice and avatar controls', () => {
  assertBounded(deriveAffectiveEmbodiment(baseline));
  const joyful = deriveAffectiveEmbodiment({ ...baseline, label: 'joy', valence01: 0.9, arousal01: 0.8, dominance01: 0.7 });
  const sad = deriveAffectiveEmbodiment({ ...baseline, label: 'sadness', valence01: 0.15, arousal01: 0.25, dominance01: 0.3 });
  assertBounded(joyful);
  assertBounded(sad);
  assert.ok(joyful.speechPitch > sad.speechPitch, 'joy and sadness must produce distinguishable speech pitch');
  assert.ok(joyful.expressionIntensity > sad.expressionIntensity, 'higher arousal/positive valence should change expression intensity');
});

test('stale affective mood and feeling signals decay rather than freezing the avatar', () => {
  const mood = { valence01: 0.95, arousal01: 0.95, stress01: 0.05, confidence01: 1, dominantLabel: 'joy', persistence01: 1 };
  const freshMood = deriveAffectiveEmbodiment({ ...baseline, mood: { ...mood, freshness01: 1 } });
  const staleMood = deriveAffectiveEmbodiment({ ...baseline, mood: { ...mood, freshness01: 0 } });
  assert.ok(Math.abs(freshMood.speechPitch - staleMood.speechPitch) > 0.001, 'fresh persisted mood must influence voice');
  const feeling = { intensity01: 1, interoceptiveMismatch01: 0, selfAccessConfidence01: 1, bodilyFocus01: 1 };
  const freshFeeling = deriveAffectiveEmbodiment({ ...baseline, feeling: { ...feeling, freshness01: 1 } });
  const staleFeeling = deriveAffectiveEmbodiment({ ...baseline, feeling: { ...feeling, freshness01: 0 } });
  assert.ok(freshFeeling.expressionIntensity > staleFeeling.expressionIntensity, 'fresh feeling evidence may influence expression');
  assertBounded(freshMood); assertBounded(staleMood); assertBounded(freshFeeling); assertBounded(staleFeeling);
});

test('malformed telemetry does not leak non-finite values into embodiment controls', () => {
  const profile = deriveAffectiveEmbodiment({ ...baseline, valence01: Number.NaN, arousal01: Number.POSITIVE_INFINITY, energy01: Number.NaN, cognitiveLoad01: Number.NEGATIVE_INFINITY });
  assertBounded(profile);
});
