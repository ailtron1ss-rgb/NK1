import assert from 'node:assert/strict';
import { EmbodimentRuntime } from '../src/organism/body/EmbodimentRuntime.ts';

const state = {
  needs: {
    energy: .8,
    cognitiveLoad: .2,
    uncertainty: .2,
    socialNeed: .7,
    novelty: .8,
    identityCoherence: .8,
    goalPressure: .3,
  },
  predictionError: .1,
  lastActionSuccess: .9,
  lastPredictionConfidence: .85,
  autonomyScore: .75,
};
const personality = {
  adaptiveNames: ['warmth', 'curiosity', 'playfulness', 'composure', 'directness'],
  adaptiveValues: [.95, .9, .85, .8, .7],
};

const runtime = new EmbodimentRuntime();
const projection = runtime.avatarProjection?.(state, {
  profile: '3d',
  personality,
  affect: { memoryRecall01: .7, sampledAt: 10_000, memoryText: 'private-memory-marker', memoryId: 'private-id-marker' },
  now: 10_000,
});
assert.ok(projection && typeof projection === 'object',
  'EmbodimentRuntime must expose a renderer-neutral projection from canonical organism state');
assert.equal(projection.schemaVersion, 1);
assert.equal(projection.source, 'organism-state');
assert.equal(projection.profile, '3d');
assert.equal(projection.affect.memoryRecall01, .7,
  'only bounded memory salience, not memory content or identifiers, reaches the projection');
assert.ok(!JSON.stringify(projection).includes('private-memory-marker'));
assert.ok(!JSON.stringify(projection).includes('private-id-marker'));
assert.ok(projection.affect.warmth01 > .5,
  'canonical adaptive personality traits must influence rendered affect');
for (const value of Object.values(projection.channels)) {
  assert.ok(Number.isFinite(value), 'renderer channels must always be finite');
}
assert.ok(projection.channels.eyeOpen >= 0 && projection.channels.eyeOpen <= 1);

const controls = ['headPitch', 'headYaw', 'gazeDistance01', 'shoulderRelax01'];
const mapped = runtime.avatarRendererMapping?.(
  state,
  { profile: '3d', controlIds: controls, expressionIds: [projection.expression] },
  { personality, now: 10_000 },
);
assert.ok(mapped && typeof mapped === 'object',
  'EmbodimentRuntime must map the canonical projection to declared renderer capabilities');
assert.equal(mapped.compatible, true);
assert.equal(mapped.commands.length, 5,
  'all four supported spatial controls and the one model-authored expression must be emitted');
assert.ok(mapped.commands.every(command => Number.isFinite(command.value)));

const incomplete = runtime.avatarRendererMapping?.(
  state,
  { profile: '2d', parameterIds: ['ParamEyeLOpen'] },
  { now: 10_100 },
);
assert.equal(incomplete.commands.length, 1,
  'an absent model parameter must never be invented or sent to the renderer');
assert.equal(incomplete.skipped, 10);

const layered = runtime.avatarRendererMapping?.(
  state,
  { profile: '2.5d', controlIds: ['parallaxX', 'parallaxY', 'depthBreath01', 'faceRig01'] },
  { personality, now: 10_200 },
);
assert.equal(layered.compatible, true);
assert.equal(layered.commands.length, 4,
  'the 2.5D adapter must emit only the four supported layered controls');

runtime.sleep('avatar-renderer-contract-test');
const asleep = runtime.avatarProjection?.(state, { profile: '2d', now: 10_300 });
assert.equal(asleep.reducedMotion, true);
assert.equal(asleep.channels.idleMotion, 0);
assert.equal(asleep.channels.lipSyncGain, 0);

console.log('avatar-brain-renderer-runtime: PASS');
