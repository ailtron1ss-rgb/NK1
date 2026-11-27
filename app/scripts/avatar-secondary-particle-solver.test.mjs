import assert from "node:assert/strict";
import test from "node:test";
import {
  createAvatarSecondaryParticleState,
  resetAvatarSecondaryParticleState,
  stepAvatarSecondaryParticleState,
} from "../src/components/avatar/avatarSecondaryParticleSolver.ts";

function grid(width = 4, height = 4) {
  const positions = [];
  const indices = [];
  const pins = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      positions.push(x * 0.08, y * 0.08, 0);
      pins.push(y === height - 1 ? 1 : 0);
    }
  }
  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const a = y * width + x;
      const b = a + 1;
      const c = a + width;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint16Array(indices), pins: new Float32Array(pins) };
}

function frame(overrides = {}) {
  return {
    deltaSeconds: 1 / 60,
    awake: true,
    energy: 0.9,
    arousal: 0.7,
    cognitiveLoad: 0.4,
    uncertainty: 0.2,
    curiosity: 0.8,
    novelty: 0.7,
    predictionError: 0.3,
    action: "inspect",
    quality: "high",
    bodyChannels: {
      headYaw: 0.4,
      torsoYaw: 0.3,
      rootYaw: 0.2,
      leftAnkle: -0.4,
      rightAnkle: 0.5,
      leftKnee: -0.2,
      rightKnee: 0.4,
      breath: 0.6,
    },
    ...overrides,
  };
}

test("XPBD surface particles use real mesh vertices and pin the authored attachment row", () => {
  const mesh = grid();
  const state = createAvatarSecondaryParticleState({
    positions: mesh.positions,
    indices: mesh.indices,
    pinnedMask: mesh.pins,
    role: "garment",
  });
  assert.ok(state);
  assert.equal(state.vertexCount, 16);
  assert.ok(state.constraints.length >= 30);
  assert.equal(state.inverseMass[12], 0);
  assert.equal(state.inverseMass[15], 0);
  assert.equal(state.inverseMass[0], 1);

  for (let index = 0; index < 90; index += 1) {
    stepAvatarSecondaryParticleState(state, frame());
  }
  assert.ok(state.completedSteps >= 90);
  assert.ok(state.offsets.some((value) => Math.abs(value) > 1e-7), "free particles must move");
  for (let vertex = 0; vertex < state.vertexCount; vertex += 1) {
    const offset = vertex * 3;
    const magnitude = Math.hypot(state.offsets[offset], state.offsets[offset + 1], state.offsets[offset + 2]);
    assert.ok(Number.isFinite(magnitude));
    assert.ok(magnitude <= state.maxOffset + 1e-6);
    if (state.inverseMass[vertex] === 0) assert.equal(magnitude, 0, "pinned vertices stay at their attachment");
  }
});

test("XPBD particles are deterministic for the same mesh, pin map and organism frames", () => {
  const mesh = grid();
  const make = () => createAvatarSecondaryParticleState({
    positions: mesh.positions,
    indices: mesh.indices,
    pinnedMask: mesh.pins,
    role: "hair",
  });
  const a = make();
  const b = make();
  assert.ok(a && b);
  for (let index = 0; index < 40; index += 1) {
    const tick = frame({ deltaSeconds: 1 / 60 + (index % 2) * 0.002 });
    stepAvatarSecondaryParticleState(a, tick);
    stepAvatarSecondaryParticleState(b, tick);
  }
  assert.deepEqual([...a.offsets], [...b.offsets]);
  assert.ok(a.offsets.some((value) => value !== 0));
});

test("sleep and low device quality reduce motion without unpinning the attachment", () => {
  const mesh = grid();
  const make = () => createAvatarSecondaryParticleState({
    positions: mesh.positions,
    indices: mesh.indices,
    pinnedMask: mesh.pins,
    role: "hair",
  });
  const awake = make();
  const asleep = make();
  const low = make();
  assert.ok(awake && asleep && low);
  for (let index = 0; index < 60; index += 1) {
    stepAvatarSecondaryParticleState(awake, frame());
    stepAvatarSecondaryParticleState(asleep, frame({ awake: false }));
    stepAvatarSecondaryParticleState(low, frame({ quality: "low" }));
  }
  const magnitude = (state) => Math.hypot(...state.offsets);
  assert.ok(magnitude(asleep) < magnitude(awake));
  assert.ok(magnitude(low) < magnitude(awake));
  assert.equal(asleep.inverseMass[12], 0);
});

test("fixed stepping is capped and reset restores the exact rest surface", () => {
  const mesh = grid();
  const state = createAvatarSecondaryParticleState({
    positions: mesh.positions,
    indices: mesh.indices,
    pinnedMask: mesh.pins,
    role: "garment",
  });
  assert.ok(state);
  stepAvatarSecondaryParticleState(state, frame({ deltaSeconds: 10 }));
  assert.equal(state.completedSteps, 4, "a stalled tab must not trigger a catch-up spiral");
  assert.ok(state.offsets.some((value) => value !== 0));
  resetAvatarSecondaryParticleState(state);
  assert.deepEqual([...state.positions], [...mesh.positions]);
  assert.deepEqual([...state.previous], [...mesh.positions]);
  assert.ok(state.offsets.every((value) => value === 0));
  assert.equal(state.completedSteps, 0);
});

test("invalid, oversized or under-constrained meshes fail closed", () => {
  const mesh = grid();
  assert.equal(createAvatarSecondaryParticleState({
    positions: new Float32Array([0, 0, 0]),
    pinnedMask: new Float32Array([1]),
    role: "garment",
  }), null);
  assert.equal(createAvatarSecondaryParticleState({
    positions: new Float32Array(769 * 3),
    pinnedMask: new Float32Array(769),
    role: "hair",
  }), null);
  assert.equal(createAvatarSecondaryParticleState({
    positions: mesh.positions,
    indices: new Uint16Array([0, 1, 99]),
    pinnedMask: mesh.pins,
    role: "hair",
  }), null);
  assert.equal(createAvatarSecondaryParticleState({
    positions: mesh.positions,
    indices: mesh.indices,
    pinnedMask: new Float32Array(16),
    role: "unknown",
  }), null);
  assert.equal(createAvatarSecondaryParticleState({
    positions: mesh.positions,
    indices: mesh.indices,
    pinnedMask: new Float32Array(16).fill(0),
    role: "garment",
  }), null);
});
