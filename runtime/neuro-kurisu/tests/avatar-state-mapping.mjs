import assert from 'node:assert/strict';
import { buildAvatarPresentation, buildAvatarSpeechTimeline, sampleAvatarSpeechTimeline } from '../public/avatar-state.mjs';
import { buildVisemeTimeline, sampleVisemeTimeline, poseForGrapheme } from '../public/speech-viseme-core.mjs';

const explore = buildAvatarPresentation({
  ok: true,
  tick: 42,
  awake: true,
  state: { lastAction: 'explore', needs: { energy: 0.7 } },
  emotion: { label: 'curiosity', valence: 0.8, arousal: 0.7 },
  voice: { speaking: false, listening: false },
});
assert.ok(explore);
assert.equal(explore.tick, 42);
assert.equal(explore.awake, true);
assert.equal(explore.action, 'explore');
assert.equal(explore.emotion, 'curiosity');
assert.equal(explore.expression, 'thinking');
assert.equal(explore.body.motionGroup, 'TapBody');
assert.equal(explore.body.gazeDriven, true);
assert.equal(explore.body.expressionIntensity, 0.7);
assert.equal(explore.body.speaking, false);
assert.equal(explore.lipsync, 0);

const speaking = buildAvatarPresentation({
  ok: true,
  tick: 43,
  awake: true,
  state: { lastAction: 'respond' },
  emotion: { label: 'joy', valence: 0.9, arousal: 1.4 },
  voice: { speaking: true },
});
assert.ok(speaking);
assert.equal(speaking.expression, 'happy');
assert.equal(speaking.body.motionGroup, 'Special');
assert.equal(speaking.body.expressionIntensity, 1, 'arousal must be bounded before it reaches the viewer');
assert.equal(speaking.body.voiceEmphasis, 1);
assert.equal(speaking.lipsync, 0, 'speech mouth amplitude is sampled from the timed viseme timeline instead of a fixed value');
assert.equal(speaking.body.speaking, true);

const safeFallback = buildAvatarPresentation({
  ok: true,
  tick: -1,
  awake: false,
  state: { lastAction: 'unexpected-action' },
  emotion: { label: 'unknown', valence: Number.NaN, arousal: Number.POSITIVE_INFINITY },
  voice: { speaking: 'yes' },
});
assert.ok(safeFallback);
assert.equal(safeFallback.action, 'wait');
assert.equal(safeFallback.emotion, 'calm');
assert.equal(safeFallback.expression, 'neutral');
assert.equal(safeFallback.tick, 0);
assert.equal(safeFallback.body.expressionIntensity, 0.2);
assert.equal(safeFallback.body.speaking, false);
assert.equal(safeFallback.lipsync, 0);

assert.equal(buildAvatarPresentation(null), null);
assert.equal(buildAvatarPresentation({ ok: true, state: {}, emotion: null }), null);

const visemes = buildAvatarSpeechTimeline('мама, мир', 1, 'ru-RU');
const sharedTimeline = buildVisemeTimeline('мама, мир', 1, 'ru-RU');
assert.deepEqual(
  visemes.map(({ startMs, endMs, pose, grapheme }) => ({ startMs, endMs, pose, grapheme })),
  sharedTimeline.map(frame => ({
    startMs: frame.startMs, endMs: frame.endMs, pose: frame.pose,
    grapheme: 'мама, мир'.slice(frame.charIndex, frame.endCharIndex),
  })),
  'runtime avatar must use the same frame times and mouth poses as the shared browser timeline',
);
assert.deepEqual(sampleAvatarSpeechTimeline(visemes, visemes[1].startMs + 1),
  sampleVisemeTimeline(sharedTimeline, sharedTimeline[1].startMs + 1));
assert.deepEqual(poseForGrapheme('а'), { open: 0.60, form: 0.10, viseme: 'open' });
assert.ok(visemes.length >= 8);
assert.ok(visemes.every((frame, index) => frame.endMs > frame.startMs && (index === 0 || frame.startMs >= visemes[index - 1].endMs)));
assert.deepEqual(sampleAvatarSpeechTimeline(visemes, 0), { open: 0.025, form: -0.05, viseme: 'closed' });
assert.ok(sampleAvatarSpeechTimeline(visemes, visemes[1].startMs + 1).open > 0.3,
  'the second grapheme (a vowel) must produce a different mouth shape from the initial closed consonant');
const commaPose = visemes.find(frame => frame.grapheme === ',');
assert.ok(commaPose);
assert.equal(commaPose.pose.viseme, 'rest', 'punctuation maps to a closed pause pose');
assert.deepEqual(sampleAvatarSpeechTimeline(visemes, Number.NaN), { open: 0.015, form: 0, viseme: 'rest' });
assert.deepEqual(buildAvatarSpeechTimeline('', 1), []);
assert.deepEqual(buildAvatarSpeechTimeline({ toString: () => 'unsafe' }, 1), []);
assert.deepEqual(sampleAvatarSpeechTimeline(visemes, visemes.at(-1).endMs + 20), { open: 0.015, form: 0, viseme: 'rest' });

console.log('AVATAR_STATE_MAPPING=PASS explore/respond/emotion/speech/bounds');
