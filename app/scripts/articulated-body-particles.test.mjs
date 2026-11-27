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
  assert.equal(state.particleCount, 22);
  assert.equal(AVATAR_ARTICULATED_BODY_PARTICLE_COUNT, 22);
  assert.equal(state.segments.length, 21);
  assert.equal(AVATAR_ARTICULATED_BODY_SEGMENT_COUNT, 21);
  assert.ok(state.particles.head.position.y > state.particles.chest.position.y);
  assert.ok(state.particles.leftHandPoint.position.x < state.particles.chest.position.x);
  assert.ok(state.particles.rightAnklePoint.position.y < state.particles.rightKneePoint.position.y);
  assert.ok(state.particles.leftToePoint.position.z > state.particles.leftHeelPoint.position.z);
  assert.ok(state.particles.rightToePoint.position.z > state.particles.rightHeelPoint.position.z);
  assert.ok(state.segments.some((segment) => segment.from === "leftHeelPoint" && segment.to === "leftToePoint"));
  assert.ok(state.segments.some((segment) => segment.from === "rightHeelPoint" && segment.to === "rightToePoint"));
  assert.ok(state.segments.every((segment) => segment.restLength > 0.02));
});

test("motor targets create inertial joint motion and move corresponding body particles", () => {
  const initial = createAvatarArticulatedBodyState();
  const first = stepAvatarArticulatedBody(initial, {
    leftShoulder: 0.8, leftElbow: 0.55, rightHip: -0.6, rightKnee: 0.45,
    headYaw: 0.5, torsoPitch: -0.3,
  }, 1000 / 30, { awake: true, energy01: 0.9 });
  assert.ok(first.channels.leftShoulder > 0 && first.channels.leftShoulder < 0.8);
  assert.ok(Number.isFinite(first.channels.leftElbow) && Math.abs(first.channels.leftElbow) <= 1,
    "particle-derived elbow output must remain finite and normalized");
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


test("stance heel and toe cannot penetrate below the support plane or rebound", () => {
  const previous = createAvatarArticulatedBodyState();
  for (const id of ["leftHeelPoint", "leftToePoint"]) {
    previous.particles[id].position.y = -1.2;
    previous.particles[id].velocity.y = -4;
  }
  const result = stepAvatarArticulatedBody(
    previous,
    {},
    1000 / 30,
    { awake: true, energy01: 0.7, groundY: -0.9, footRadius: 0.04 },
  );
  for (const id of ["leftHeelPoint", "leftToePoint"]) {
    assert.ok(
      result.state.particles[id].position.y >= -0.8601,
      id + " centre must remain at or above floor + foot radius",
    );
    assert.ok(result.state.particles[id].velocity.y <= 0.001,
      id + " must not rebound upward after downward penetration correction");
  }
  assert.equal(result.contacts.leftFoot, true);
  assert.ok(Number.isFinite(result.contacts.maxCorrection));
});

test("ground friction reduces horizontal slip only while the foot is in contact", () => {
  const previous = createAvatarArticulatedBodyState();
  for (const id of ["leftHeelPoint", "leftToePoint"]) {
    previous.particles[id].position.y = -0.86;
    previous.particles[id].velocity.x = 1.5;
  }
  const grounded = stepAvatarArticulatedBody(
    previous,
    {},
    1000 / 60,
    { awake: true, energy01: 1, groundY: -0.9, footRadius: 0.04, footFriction: 0.8 },
  );
  const ungrounded = stepAvatarArticulatedBody(
    previous,
    {},
    1000 / 60,
    { awake: true, energy01: 1, groundEnabled: false },
  );
  assert.equal(grounded.contacts.leftFoot, true);
  assert.ok(
    Math.abs(grounded.state.particles.leftToePoint.velocity.x)
      < Math.abs(ungrounded.state.particles.leftToePoint.velocity.x),
    "contact friction must reduce toe slip compared with a free foot",
  );
});

test("a lifted swing foot clears the ground contact band instead of being snapped down", () => {
  let state = createAvatarArticulatedBodyState();
  let result = null;
  for (let tick = 0; tick < 48; tick += 1) {
    result = stepAvatarArticulatedBody(
      state,
      { leftHip: 1, leftKnee: 1 },
      1000 / 30,
      { awake: true, energy01: 0.85, groundY: -0.9, footRadius: 0.04 },
    );
    state = result.state;
    assert.ok(state.particles.leftToePoint.position.y >= -0.8601,
      "the swing toe must never penetrate the support surface at tick " + tick
        + "; actualY=" + state.particles.leftToePoint.position.y);
  }
  assert.ok(result);
  assert.equal(result.contacts.leftFoot, false,
    "the stance contact must release after the toe actually clears the floor");
  assert.ok(state.particles.leftToePoint.target.y > -0.75,
    "the semantic swing target must clear the support band; targetY=" + state.particles.leftToePoint.target.y);
  assert.ok(state.particles.leftToePoint.position.y > -0.85,
    "the simulated swing toe must clear the contact band with a 1cm gap; actualY="
      + state.particles.leftToePoint.position.y + " targetY="
      + state.particles.leftToePoint.target.y);
});


function hingeFlexionRadians(state, parentId, jointId, childId) {
  const parent = state.particles[parentId].position;
  const joint = state.particles[jointId].position;
  const child = state.particles[childId].position;
  const a = { x: parent.x - joint.x, y: parent.y - joint.y, z: parent.z - joint.z };
  const b = { x: child.x - joint.x, y: child.y - joint.y, z: child.z - joint.z };
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  const magnitude = Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z);
  const internal = Math.acos(Math.max(-1, Math.min(1, dot / Math.max(magnitude, 1e-9))));
  return Math.PI - internal;
}

function alignParticleAlong(source, joint, destination) {
  const dx = source.x - joint.x, dy = source.y - joint.y, dz = source.z - joint.z;
  const sourceLength = Math.hypot(dx, dy, dz);
  const destinationLength = Math.hypot(destination.x - joint.x, destination.y - joint.y, destination.z - joint.z);
  return {
    x: joint.x + dx / sourceLength * destinationLength,
    y: joint.y + dy / sourceLength * destinationLength,
    z: joint.z + dz / sourceLength * destinationLength,
  };
}

test("elbow hinge cannot fold beyond the anatomical flexion limit", () => {
  const previous = createAvatarArticulatedBodyState();
  const shoulder = previous.particles.leftShoulderPoint.position;
  const elbow = previous.particles.leftElbowPoint.position;
  const wrist = previous.particles.leftWristPoint;
  const oldWrist = { ...wrist.position };
  wrist.position = alignParticleAlong(shoulder, elbow, wrist.position);
  const wristShift = {
    x: wrist.position.x - oldWrist.x,
    y: wrist.position.y - oldWrist.y,
    z: wrist.position.z - oldWrist.z,
  };
  const hand = previous.particles.leftHandPoint;
  hand.position = {
    x: hand.position.x + wristShift.x,
    y: hand.position.y + wristShift.y,
    z: hand.position.z + wristShift.z,
  };
  wrist.velocity = { x: 0, y: 0, z: 0 };
  hand.velocity = { x: 0, y: 0, z: 0 };
  assert.ok(hingeFlexionRadians(previous, "leftShoulderPoint", "leftElbowPoint", "leftWristPoint") > 179 * Math.PI / 180,
    "elbow fixture must begin beyond the allowed hinge range");
  for (const id of ["leftShoulderPoint", "leftElbowPoint", "leftWristPoint", "leftHandPoint"]) {
    previous.particles[id].mass = 20;
  }
  const result = stepAvatarArticulatedBody(previous, {}, 1000 / 60, { awake: true, energy01: 1 });
  const flexion = hingeFlexionRadians(result.state, "leftShoulderPoint", "leftElbowPoint", "leftWristPoint");
  assert.ok(flexion <= 150 * Math.PI / 180 + 0.02,
    "left elbow flexion must stay at or below 150 degrees; got " + (flexion * 180 / Math.PI).toFixed(2));
  assert.ok(result.jointLimits.correctionDegrees.leftElbow > 0);
  assert.ok(result.jointLimits.flexionDegrees.leftElbow <= 150.02);
  const wristHandLength = Math.hypot(
    result.state.particles.leftHandPoint.position.x - result.state.particles.leftWristPoint.position.x,
    result.state.particles.leftHandPoint.position.y - result.state.particles.leftWristPoint.position.y,
    result.state.particles.leftHandPoint.position.z - result.state.particles.leftWristPoint.position.z,
  );
  const expectedHandLength = previous.segments.find((x) => x.from === "leftWristPoint" && x.to === "leftHandPoint").restLength;
  assert.ok(Math.abs(wristHandLength - expectedHandLength) < 0.02);
});

test("knee hinge cannot hyperflex while the foot chain follows the lower leg", () => {
  const previous = createAvatarArticulatedBodyState();
  const hip = previous.particles.rightHipPoint.position;
  const knee = previous.particles.rightKneePoint.position;
  const ankle = previous.particles.rightAnklePoint;
  const oldAnkle = { ...ankle.position };
  ankle.position = alignParticleAlong(hip, knee, ankle.position);
  assert.ok(hingeFlexionRadians(previous, "rightHipPoint", "rightKneePoint", "rightAnklePoint") > 179 * Math.PI / 180,
    "knee fixture must begin beyond the allowed hinge range");
  const shift = {
    x: ankle.position.x - oldAnkle.x,
    y: ankle.position.y - oldAnkle.y,
    z: ankle.position.z - oldAnkle.z,
  };
  for (const id of ["rightHipPoint", "rightKneePoint", "rightAnklePoint", "rightHeelPoint", "rightToePoint"]) {
    previous.particles[id].mass = 20;
  }
  for (const id of ["rightHeelPoint", "rightToePoint"]) {
    const point = previous.particles[id];
    point.position = { x: point.position.x + shift.x, y: point.position.y + shift.y, z: point.position.z + shift.z };
  }
  const result = stepAvatarArticulatedBody(previous, {}, 1000 / 60, { awake: true, energy01: 1, groundEnabled: false });
  const flexion = hingeFlexionRadians(result.state, "rightHipPoint", "rightKneePoint", "rightAnklePoint");
  assert.ok(flexion <= 150 * Math.PI / 180 + 0.02,
    "right knee flexion must stay at or below 150 degrees; got " + (flexion * 180 / Math.PI).toFixed(2));
  assert.ok(result.jointLimits.correctionDegrees.rightKnee > 0);
  assert.ok(result.jointLimits.flexionDegrees.rightKnee <= 150.02);
  const lowerLegLength = Math.hypot(
    result.state.particles.rightAnklePoint.position.x - result.state.particles.rightKneePoint.position.x,
    result.state.particles.rightAnklePoint.position.y - result.state.particles.rightKneePoint.position.y,
    result.state.particles.rightAnklePoint.position.z - result.state.particles.rightKneePoint.position.z,
  );
  assert.ok(Math.abs(lowerLegLength - previous.segments.find(x => x.from === "rightKneePoint" && x.to === "rightAnklePoint").restLength) < 0.02,
    "knee hinge projection must preserve the lower-leg segment length");
});

test("elbow and knee hinge limits are symmetric and expose finite correction diagnostics", () => {
  const previous = createAvatarArticulatedBodyState();
  const fixtures = [
    { key: "rightElbow", parent: "rightShoulderPoint", joint: "rightElbowPoint", child: "rightWristPoint", distal: ["rightHandPoint"] },
    { key: "leftKnee", parent: "leftHipPoint", joint: "leftKneePoint", child: "leftAnklePoint", distal: ["leftHeelPoint", "leftToePoint"] },
  ];
  for (const fixture of fixtures) {
    const joint = previous.particles[fixture.joint];
    const child = previous.particles[fixture.child];
    const oldPosition = { ...child.position };
    child.position = alignParticleAlong(previous.particles[fixture.parent].position, joint.position, child.position);
    const shift = {
      x: child.position.x - oldPosition.x,
      y: child.position.y - oldPosition.y,
      z: child.position.z - oldPosition.z,
    };
    for (const id of [fixture.parent, fixture.joint, fixture.child, ...fixture.distal]) {
      previous.particles[id].mass = 20;
      previous.particles[id].velocity = { x: 0, y: 0, z: 0 };
    }
    for (const id of fixture.distal) {
      const point = previous.particles[id];
      point.position = { x: point.position.x + shift.x, y: point.position.y + shift.y, z: point.position.z + shift.z };
    }
  }
  const result = stepAvatarArticulatedBody(previous, {}, 1000 / 60, {
    awake: true, energy01: 1, groundEnabled: false,
  });
  for (const key of ["leftElbow", "rightElbow", "leftKnee", "rightKnee"]) {
    assert.ok(result.jointLimits.flexionDegrees[key] <= 150.02,
      key + " must stay within 150 degrees; got " + result.jointLimits.flexionDegrees[key]);
    assert.ok(Number.isFinite(result.jointLimits.flexionDegrees[key]));
    assert.ok(Number.isFinite(result.jointLimits.correctionDegrees[key]));
  }
  assert.ok(result.jointLimits.correctionDegrees.rightElbow > 0);
  assert.ok(result.jointLimits.correctionDegrees.leftKnee > 0);
  assert.ok(result.jointLimits.maxCorrectionDeg > 0);
  assert.ok(everyNumberIsFinite(result.state));
});
