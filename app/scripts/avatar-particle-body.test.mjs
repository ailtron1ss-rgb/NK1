import assert from "node:assert/strict";
import test from "node:test";
import {
  createAvatarParticleBody,
  resetAvatarParticleBody,
  snapshotAvatarParticleBody,
  stepAvatarParticleBody,
} from "../src/components/avatar/avatarParticleBody.ts";

const rigConfig = () => ({
  fixedStepSeconds: 1 / 120,
  maxSubsteps: 6,
  solverIterations: 7,
  gravity: [0, -0.18, 0],
  damping: 0.985,
  nodes: [
    { id: "hips", position: [0, 0, 0], anchor: true },
    { id: "spine", position: [0, 0.3, 0], maxDisplacement: 0.025, followStrength: 115 },
    { id: "chest", position: [0, 0.6, 0], maxDisplacement: 0.03, followStrength: 90 },
    { id: "head", position: [0, 0.9, 0], maxDisplacement: 0.04, followStrength: 72 },
  ],
  constraints: [
    { a: "hips", b: "spine", stiffness: 0.95 },
    { a: "spine", b: "chest", stiffness: 0.92 },
    { a: "chest", b: "head", stiffness: 0.88 },
  ],
});

function target(id, x, y, z) { return { id, position: [x, y, z] }; }

test("particle rig rejects duplicate, missing and non-finite particle topology", () => {
  assert.throws(() => createAvatarParticleBody({
    nodes: [{ id: "same", position: [0, 0, 0] }, { id: "same", position: [1, 0, 0] }],
    constraints: [],
  }), /duplicate-particle-id/);
  assert.throws(() => createAvatarParticleBody({
    nodes: [{ id: "a", position: [0, 0, 0] }],
    constraints: [{ a: "a", b: "missing" }],
  }), /particle-constraint-node-missing/);
  assert.throws(() => createAvatarParticleBody({
    nodes: [{ id: "a", position: [0, Number.NaN, 0] }],
    constraints: [],
  }), /particle-position-invalid/);
});

test("a body particle rig is deterministic for the same fixed-step input stream", () => {
  const a = createAvatarParticleBody(rigConfig());
  const b = createAvatarParticleBody(rigConfig());
  for (let frame = 0; frame < 240; frame += 1) {
    const phase = frame / 60;
    const targets = [
      target("hips", 0, 0, 0),
      target("spine", Math.sin(phase) * 0.01, 0.3, 0),
      target("chest", Math.sin(phase + 0.2) * 0.012, 0.6, 0),
      target("head", Math.sin(phase + 0.4) * 0.016, 0.9, 0),
    ];
    stepAvatarParticleBody(a, { deltaSeconds: 1 / 60, targets, awake: true, motion01: 0.5 });
    stepAvatarParticleBody(b, { deltaSeconds: 1 / 60, targets, awake: true, motion01: 0.5 });
  }
  assert.deepEqual(snapshotAvatarParticleBody(a), snapshotAvatarParticleBody(b));
});

test("hips remain anchored while upper-body particles absorb small inertial motion", () => {
  const rig = createAvatarParticleBody(rigConfig());
  const targets = [
    target("hips", 0, 0, 0),
    target("spine", 0.02, 0.3, 0),
    target("chest", 0.025, 0.6, 0),
    target("head", 0.03, 0.9, 0),
  ];
  for (let i = 0; i < 18; i += 1) {
    stepAvatarParticleBody(rig, { deltaSeconds: 1 / 60, targets, awake: true, motion01: 0.65 });
  }
  const state = snapshotAvatarParticleBody(rig);
  assert.deepEqual(state.positions.hips, [0, 0, 0]);
  assert.notDeepEqual(state.positions.head, targets[3].position);
  assert.ok(Math.hypot(
    state.positions.head[0] - targets[3].position[0],
    state.positions.head[1] - targets[3].position[1],
    state.positions.head[2] - targets[3].position[2],
  ) <= 0.040001, "particle displacement must remain within its per-node anatomical envelope");
});

test("distance constraints preserve articulated segment lengths during pose changes", () => {
  const rig = createAvatarParticleBody(rigConfig());
  const targets = [
    target("hips", 0, 0, 0),
    target("spine", 0.08, 0.3, 0),
    target("chest", 0.08, 0.6, 0),
    target("head", 0.08, 0.9, 0),
  ];
  for (let i = 0; i < 36; i += 1) {
    stepAvatarParticleBody(rig, { deltaSeconds: 1 / 60, targets, awake: true, motion01: 0.4 });
  }
  const state = snapshotAvatarParticleBody(rig);
  for (const pair of [["hips", "spine"], ["spine", "chest"], ["chest", "head"]]) {
    const [a, b] = pair.map((id) => state.positions[id]);
    const length = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    assert.ok(Math.abs(length - 0.3) < 0.035, `segment ${pair.join("->")} must retain its anatomical length`);
  }
});

test("sphere colliders keep non-anchored body particles outside the collision volume", () => {
  const rig = createAvatarParticleBody({
    nodes: [
      { id: "anchor", position: [0, 0, 0], anchor: true },
      { id: "hand", position: [0.01, 0, 0], maxDisplacement: 0.2, followStrength: 0 },
    ],
    constraints: [{ a: "anchor", b: "hand", restLength: 0.01, stiffness: 0.3 }],
  });
  for (let i = 0; i < 4; i += 1) {
    stepAvatarParticleBody(rig, {
      deltaSeconds: 1 / 60,
      targets: [target("anchor", 0, 0, 0), target("hand", 0.01, 0, 0)],
      colliders: [{ center: [0.01, 0, 0], radius: 0.035 }],
    });
  }
  const hand = snapshotAvatarParticleBody(rig).positions.hand;
  assert.ok(Math.hypot(hand[0] - 0.01, hand[1], hand[2]) >= 0.0349);
});

test("large frame gaps are bounded by a fixed-step catch-up budget and never create NaN", () => {
  const rig = createAvatarParticleBody(rigConfig());
  const result = stepAvatarParticleBody(rig, {
    deltaSeconds: 1.5,
    targets: [
      target("hips", 0, 0, 0),
      target("spine", 0, 0.3, 0),
      target("chest", 0, 0.6, 0),
      target("head", 0, 0.9, 0),
    ],
  });
  assert.equal(result.steps, 6);
  assert.equal(result.droppedTime, true);
  for (const point of Object.values(snapshotAvatarParticleBody(rig).positions)) {
    assert.ok(point.every(Number.isFinite));
  }
});

test("reset snaps every particle to the current canonical pose and clears accumulated velocity", () => {
  const rig = createAvatarParticleBody(rigConfig());
  const moved = [
    target("hips", 0, 0, 0),
    target("spine", 0.02, 0.3, 0),
    target("chest", 0.03, 0.6, 0),
    target("head", 0.04, 0.9, 0),
  ];
  for (let i = 0; i < 24; i += 1) stepAvatarParticleBody(rig, { deltaSeconds: 1 / 60, targets: moved });
  resetAvatarParticleBody(rig, moved);
  const state = snapshotAvatarParticleBody(rig);
  assert.deepEqual(state.positions.head, moved[3].position);
  assert.deepEqual(state.previous.head, moved[3].position);
});
