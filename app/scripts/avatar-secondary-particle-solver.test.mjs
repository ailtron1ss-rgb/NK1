import assert from "node:assert/strict";
import test from "node:test";
import * as particleSolver from "../src/components/avatar/avatarSecondaryParticleSolver.ts";
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

test("body surface collider projects an embedded surface particle back outside the torso shell", () => {
  const createCollider = particleSolver.createAvatarBodySurfaceCollider;
  const project = particleSolver.projectPointOutsideBodySurface;
  assert.equal(typeof createCollider, "function",
    "secondary dynamics must expose a bounded indexed body-surface collider");
  assert.equal(typeof project, "function");

  const positions = new Float32Array([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
  ]);
  const indices = new Uint16Array([
    0, 2, 1,
    0, 1, 3,
    1, 2, 3,
    2, 0, 3,
  ]);
  const buildDiagnostics = {};
  const collider = createCollider({ positions, indices, cellSize: 0.2, diagnostics: buildDiagnostics });
  assert.ok(collider);
  assert.equal(buildDiagnostics.reason, "ready");
  assert.equal(buildDiagnostics.vertexCount, 4);
  assert.equal(buildDiagnostics.validTriangles, 4);
  const embedded = { x: 0.25, y: 0.25, z: 0.25 };
  const contact = project(embedded, collider, 0.05);
  assert.ok(contact, "an embedded particle must be projected out of the closed torso surface");
  assert.equal(contact.correction, 0.05, "deep penetration must be recovered through a bounded per-step correction");
  const correctedDistance = Math.hypot(
    contact.position.x - embedded.x,
    contact.position.y - embedded.y,
    contact.position.z - embedded.z,
  );
  assert.ok(Math.abs(correctedDistance - contact.correction) < 1e-6);
  assert.ok([contact.position.x, contact.position.y, contact.position.z].every(Number.isFinite));
});

test("body surface collider ignores distant particles and rejects malformed triangle data", () => {
  const createCollider = particleSolver.createAvatarBodySurfaceCollider;
  const project = particleSolver.projectPointOutsideBodySurface;
  assert.equal(typeof createCollider, "function");
  assert.equal(typeof project, "function");
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const collider = createCollider({
    positions,
    indices: new Uint16Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3]),
    cellSize: 0.2,
  });
  assert.ok(collider);
  assert.equal(project({ x: 4, y: 4, z: 4 }, collider, 0.05), null);
  const rejectedDiagnostics = {};
  assert.equal(createCollider({ positions: new Float32Array([0, 0, 0]), diagnostics: rejectedDiagnostics }), null);
  assert.equal(rejectedDiagnostics.reason, "vertex-count-out-of-range");
  assert.equal(createCollider({ positions, indices: new Uint16Array([0, 1, 99]) }), null);
  assert.equal(createCollider({ positions: new Float32Array([0, 0, Number.NaN]), indices: new Uint16Array([0, 0, 0]) }), null);
});

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
  assert.ok(state.bendingConstraints.length >= 1, "interior manifold edges must create opposite-vertex links");
  assert.equal(state.bendingConstraints.length, state.bendingLambdas.length);
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
  const maxVertexOffset = (state) => {
    let maximum = 0;
    for (let vertex = 0; vertex < state.vertexCount; vertex += 1) {
      const offset = vertex * 3;
      maximum = Math.max(maximum, Math.hypot(
        state.offsets[offset],
        state.offsets[offset + 1],
        state.offsets[offset + 2],
      ));
    }
    return maximum;
  };
  assert.ok(maxVertexOffset(asleep) < maxVertexOffset(awake));
  assert.ok(maxVertexOffset(low) <= low.maxOffset * 0.35 + 1e-6,
    "low quality must use the reduced per-vertex displacement envelope");
  assert.ok(maxVertexOffset(low) < maxVertexOffset(awake),
    "low quality motion must remain below the high quality motion envelope");
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


test("interior manifold edges create unique opposite-vertex bend links", () => {
  const mesh = grid();
  const state = createAvatarSecondaryParticleState({
    positions: mesh.positions,
    indices: mesh.indices,
    pinnedMask: mesh.pins,
    role: "garment",
  });
  assert.ok(state);
  const pairs = state.bendingConstraints.map(({ a, b }) => a < b ? `${a}:${b}` : `${b}:${a}`);
  assert.equal(new Set(pairs).size, pairs.length, "a vertex pair may be constrained only once");
  assert.ok(state.bendingConstraints.every((constraint) =>
    Number.isInteger(constraint.a) && Number.isInteger(constraint.b)
    && constraint.a !== constraint.b
    && Number.isFinite(constraint.restLength) && constraint.restLength > 0));
});

test("non-manifold shared edges fail closed for bending instead of guessing adjacent faces", () => {
  const positions = new Float32Array([
    0, 0, 0,
    1, 0, 0,
    0.5, 1, 0,
    0.5, -1, 0,
    0.5, 0, 1,
    1.5, 0, 1,
  ]);
  // Three faces share edge 0–1 (non-manifold); a fourth disjoint face keeps
  // the six-vertex surface eligible for the particle solver.
  const indices = new Uint16Array([0, 1, 2, 1, 0, 3, 0, 1, 4, 2, 3, 5]);
  const pinnedMask = new Float32Array([1, 1, 0, 0, 0, 0]);
  const state = createAvatarSecondaryParticleState({ positions, indices, pinnedMask, role: "hair" });
  assert.ok(state);
  assert.equal(state.bendingConstraints.length, 0,
    "three faces sharing an edge do not define one unambiguous opposite-vertex pair");
});

test("bending links respond to a local out-of-plane deformation and reset clears their multipliers", () => {
  const mesh = grid();
  const state = createAvatarSecondaryParticleState({
    positions: mesh.positions,
    indices: mesh.indices,
    pinnedMask: mesh.pins,
    role: "garment",
  });
  assert.ok(state);
  const vertex = 5;
  state.positions[vertex * 3 + 2] = 0.012;
  state.previous.set(state.positions);
  const still = frame({
    awake: false,
    energy: 0,
    arousal: 0,
    curiosity: 0,
    novelty: 0,
    predictionError: 0,
    bodyChannels: {},
  });
  stepAvatarSecondaryParticleState(state, still);
  assert.ok(state.bendingLambdas.some((value) => Math.abs(value) > 1e-10),
    "the bending pass must apply a correction to a local fold");
  resetAvatarSecondaryParticleState(state);
  assert.ok(state.bendingLambdas.every((value) => value === 0));
});

test("XPBD particle pins preserve fractional attachment weights and clamp the normalized range", () => {
  const mesh = grid();
  const pins = new Float32Array(mesh.pins);
  pins[0] = 0.25;
  pins[1] = 0.75;
  pins[2] = -0.5;
  pins[3] = 1.5;
  const state = createAvatarSecondaryParticleState({
    positions: mesh.positions,
    indices: mesh.indices,
    pinnedMask: pins,
    role: "garment",
  });
  assert.ok(state);
  assert.equal(state.inverseMass[0], 0.75, "25% pin weight leaves 75% inverse mass");
  assert.equal(state.inverseMass[1], 0.25, "75% pin weight leaves 25% inverse mass");
  assert.equal(state.inverseMass[2], 1, "negative pin weights clamp to fully movable");
  assert.equal(state.inverseMass[3], 0, "pin weights above one clamp to fully fixed");
});
