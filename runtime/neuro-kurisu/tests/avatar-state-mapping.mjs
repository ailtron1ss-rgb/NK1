import assert from 'node:assert/strict';
import { buildAvatarPresentation } from '../public/avatar-state.mjs';

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
assert.equal(speaking.lipsync, 0.67);
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
console.log('AVATAR_STATE_MAPPING=PASS explore/respond/emotion/speech/bounds');
