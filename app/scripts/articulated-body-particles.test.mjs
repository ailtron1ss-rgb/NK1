import assert from "node:assert/strict";
import test from "node:test";
import {
  AVATAR_ARTICULATED_BODY_PARTICLE_COUNT,
  AVATAR_ARTICULATED_BODY_SEGMENT_COUNT,
  createAvatarArticulatedBodyState,
  stepAvatarArticulatedBody,
} from "../src/components/avatar/articulatedBodyParticles.ts";

function run(initial, frames, target, options = { awake: true, energy01: 0.8 }) {
  let state = initial;
  let result = null;
  for (let index = 0; index < frames; index += 1) {
    result = stepAvatarArticulatedBody(state, target, 1000 / 30, options);
    state = result.state;
  }
  return result;
}
function everyNumberIsFinite(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (!value || typeof value !== "object") return true;
  return Object.values(value).every(everyNumberIsFinite);
}

test("creates an articulated anatomical particle body rather than a flat/static pose", () => {
  const state = createAvatarArticulatedBodyState();
  assert.equal(state.schemaVersion, 1);
  assert.equal(state.particleCount, 18);
  assert.equal(AVATAR_ARTICULATED_BODY_PARTICLE_COUNT, 18);
  assert.equal(state.segments.length, 17);
  assert.equal(AVATAR_ARTICULATED_BODY_SEGMENT_COUNT, 17);
  assert.ok(state.particles.head.position.y > state.particles.chest.position.y);
  assert.ok(state.particles.leftHandPoint.position.x < state.particles.chest.position.x);
  assert.ok(state.particles.rightAnklePoint.position.y < state.particles.rightKneePoint.position.y);
  assert.ok(state.segments.every((segment) => segment.restLength > 0.02));
});

test("motor targets create inertial joint motion and move corresponding body particles", () => {
  const initial = createAvatarArticulatedBodyState();
  const first = stepAvatarArticulatedBody(initial, {
    leftShoulder: 0.8, leftElbow: 0.55, rightHip: -0.6, rightKnee: 0.45,
    headYaw: 0.5, torsoPitch: -0.3,
  }, 1000 / 30, { awake: true, energy01: 0.9 });
  assert.ok(first.channels.leftShoulder > 0 && first.channels.leftShoulder < 0.8);
  assert.ok(first.channels.leftElbow > 0 && first.channels.leftElbow < 0.55);
  assert.ok(first.channels.rightHip < 0);
  assert.ok(first.channels.headYaw > 0);
  assert.notDeepEqual(first.state.particles.leftElbowPoint.position, initial.particles.leftElbowPoint.position);
  assert.notDeepEqual(first.state.particles.head.position, initial.particles.head.position);
  assert.equal(first.substeps, 2);
});

test("joint motors converge without runaway and connected particle segments preserve lengths", () => {
  const result = run(createAvatarArticulatedBodyState(), 360, {
    leftShoulder: 0.8, leftElbow: -0.7, rightShoulder: -0.65, rightElbow: 0.7,
    leftHip: 0.5, leftKnee: 0.85, rightHip: -0.45, rightKnee: 0.75,
    torsoPitch: 0.55, torsoYaw: -0.35, headYaw: 0.65, headPitch: -0.4,
    rootYaw: 0.4, breath: 0.8,
  });
  assert.ok(result.channels.leftShoulder > 0.45);
  assert.ok(result.channels.leftElbow < -0.35);
  assert.ok(result.channels.rightKnee > 0.25);
  assert.ok(result.maxConstraintError < 0.035, "max constraint error " + result.maxConstraintError);
  assert.ok(everyNumberIsFinite(result.state));
  for (const particle of Object.values(result.state.particles)) {
    assert.ok(Math.abs(particle.position.x) <= 2);
    assert.ok(Math.abs(particle.position.y) <= 3);
    assert.ok(Math.abs(particle.position.z) <= 2);
  }
});

test("sleep, low energy and reduced-motion regulation attenuate motor motion", () => {
  const target = { leftShoulder: 0.9, rightKnee: 0.8, headYaw: 0.7 };
  const awake = run(createAvatarArticulatedBodyState(), 90, target, { awake: true, energy01: 1 });
  const tired = run(createAvatarArticulatedBodyState(), 90, target, { awake: true, energy01: 0.05 });
  const asleep = run(createAvatarArticulatedBodyState(), 90, target, { awake: false, energy01: 1 });
  const reduced = run(createAvatarArticulatedBodyState(), 90, target, { awake: true, energy01: 1, reducedMotion: true });
  assert.ok(Math.abs(tired.channels.leftShoulder) < Math.abs(awake.channels.leftShoulder));
  assert.ok(Math.abs(asleep.channels.leftShoulder) < Math.abs(tired.channels.leftShoulder));
  assert.ok(Math.abs(reduced.channels.leftShoulder) < Math.abs(awake.channels.leftShoulder));
});

test("large frame gaps are clamped, malformed channels are bounded and state stays finite", () => {
  const result = stepAvatarArticulatedBody(createAvatarArticulatedBodyState(), {
    leftShoulder: Number.POSITIVE_INFINITY, rightElbow: Number.NaN,
    headYaw: 10_000, torsoPitch: -10_000, breath: 0.8,
  }, 1000, { awake: true, energy01: 0.5 });
  assert.equal(result.substeps, 4);
  assert.ok(result.simulatedMs <= 66.667);
  assert.ok(everyNumberIsFinite(result.state));
  assert.ok(Object.values(result.channels).every((value) => typeof value === "number" && Math.abs(value) <= 1));
  assert.ok(result.maxConstraintError < 0.04);
});

test("renderer joint channels are recovered from the solved particle geometry, not copied from motor targets", () => {
  let state = createAvatarArticulatedBodyState();
  let result = null;
  for (let tick = 0; tick < 24; tick += 1) {
    const phase = tick < 8 ? 1 : tick < 16 ? -1 : 0.35;
    result = stepAvatarArticulatedBody(state, {
      leftShoulder: phase,
      rightHip: -phase * 0.7,
      torsoYaw: phase * 0.65,
      headYaw: -phase * 0.5,
    }, 1000 / 30, { awake: true, energy01: 0.85 });
    state = result.state;
  }
  assert.ok(result);
  const feedback = [
    Math.abs((result.channels.leftShoulder ?? 0) - result.state.joints.leftShoulder.value),
    Math.abs((result.channels.rightHip ?? 0) - result.state.joints.rightHip.value),
    Math.abs((result.channels.torsoYaw ?? 0) - result.state.joints.torsoYaw.value),
    Math.abs((result.channels.headYaw ?? 0) - result.state.joints.headYaw.value),
  ];
  assert.ok(Math.max(...feedback) > 0.001,
    "at least one renderer channel must carry the inertia/constraint response of the solved particles");
  assert.ok(feedback.every(Number.isFinite));
  assert.ok(everyNumberIsFinite(result.state));
});

test("same motor sequence and fixed clock produce the same physical state", () => {
  const target = (tick) => ({
    leftShoulder: Math.sin(tick * 0.07) * 0.6,
    rightShoulder: Math.cos(tick * 0.07) * 0.6,
    leftKnee: Math.sin(tick * 0.04) * 0.5,
    rightKnee: -Math.sin(tick * 0.04) * 0.5,
    torsoYaw: Math.sin(tick * 0.025) * 0.2,
    breath: (Math.sin(tick * 0.03) + 1) * 0.5,
  });
  const runSequence = () => {
    let state = createAvatarArticulatedBodyState();
    for (let tick = 0; tick < 240; tick += 1) {
      state = stepAvatarArticulatedBody(state, target(tick), 1000 / 30, {
        awake: true, energy01: 0.76,
      }).state;
    }
    return state;
  };
  assert.deepEqual(runSequence(), runSequence());
});

test("zero elapsed time does not advance the simulation clock or frame counter", () => {
  const before = createAvatarArticulatedBodyState();
  const result = stepAvatarArticulatedBody(before, { leftShoulder: 1 }, 0, { awake: true, energy01: 1 });
  assert.equal(result.state.tick, before.tick);
  assert.equal(result.state.elapsedMs, before.elapsedMs);
  assert.equal(result.substeps, 0);
  assert.equal(result.channels.leftShoulder, 0);
});
