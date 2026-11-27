import type { AvatarNeuroAdaptiveFrame, AvatarDynamicsRole } from "./avatarNeuroAdaptiveDynamics.ts";

export interface AvatarSecondaryParticleConstraint {
  a: number;
  b: number;
  restLength: number;
}

export interface AvatarSecondaryParticleState {
  role: AvatarDynamicsRole;
  vertexCount: number;
  rest: Float32Array;
  positions: Float32Array;
  previous: Float32Array;
  inverseMass: Float32Array;
  offsets: Float32Array;
  constraints: AvatarSecondaryParticleConstraint[];
  lambdas: Float32Array;
  /** Opposite-vertex links across manifold interior edges; a bounded distance-based bend approximation. */
  bendingConstraints: AvatarSecondaryParticleConstraint[];
  bendingLambdas: Float32Array;
  compliance: number;
  bendingCompliance: number;
  damping: number;
  maxOffset: number;
  completedSteps: number;
}

export interface AvatarSecondaryParticleInput {
  positions: ArrayLike<number>;
  indices?: ArrayLike<number> | null;
  pinnedMask: ArrayLike<number>;
  role: "hair" | "garment";
}

const FIXED_STEP_SECONDS = 1 / 60;
const MAX_FRAME_SECONDS = FIXED_STEP_SECONDS * 4;
const MAX_PARTICLES = 768;
const MAX_CONSTRAINTS = 4_096;
const MAX_BENDING_CONSTRAINTS = 4_096;
const SOLVER_ITERATIONS = 5;
const ROLE_LIMITS = Object.freeze({
  hair: { maxOffset: 0.022, compliance: 0.0000018, bendingCompliance: 0.000018, damping: 0.055 },
  garment: { maxOffset: 0.018, compliance: 0.0000035, bendingCompliance: 0.000035, damping: 0.075 },
});

const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : 0;

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

interface AvatarSecondaryParticleTopology {
  constraints: AvatarSecondaryParticleConstraint[];
  bendingConstraints: AvatarSecondaryParticleConstraint[];
}

/**
 * Build unique triangle-edge constraints and one opposite-vertex link for
 * each two-face manifold edge. Boundary and non-manifold edges are skipped:
 * they do not provide an unambiguous pair of adjacent faces.
 */
function buildTopology(
  positions: ArrayLike<number>,
  vertexCount: number,
  indices?: ArrayLike<number> | null,
): AvatarSecondaryParticleTopology | null {
  const edgeSet = new Set<string>();
  const constraints: AvatarSecondaryParticleConstraint[] = [];
  const adjacentFaces = new Map<string, { a: number; b: number; opposites: number[] }>();
  if (indices && indices.length % 3 !== 0) return null;
  const triangleCount = indices ? Math.floor(indices.length / 3) : Math.floor(vertexCount / 3);
  if (triangleCount < 2 || triangleCount > MAX_CONSTRAINTS) return null;

  const addEdge = (rawA: number, rawB: number, rawOpposite: number): boolean => {
    const a = Number(rawA);
    const b = Number(rawB);
    const opposite = Number(rawOpposite);
    if (![a, b, opposite].every(Number.isInteger)
      || a < 0 || b < 0 || opposite < 0
      || a >= vertexCount || b >= vertexCount || opposite >= vertexCount
      || a === b || a === opposite || b === opposite) return false;

    const key = edgeKey(a, b);
    const ax = Number(positions[a * 3]);
    const ay = Number(positions[a * 3 + 1]);
    const az = Number(positions[a * 3 + 2]);
    const bx = Number(positions[b * 3]);
    const by = Number(positions[b * 3 + 1]);
    const bz = Number(positions[b * 3 + 2]);
    if (![ax, ay, az, bx, by, bz].every(Number.isFinite)) return false;
    const length = Math.hypot(bx - ax, by - ay, bz - az);
    if (!Number.isFinite(length) || length < 1e-7) return true;

    const incident = adjacentFaces.get(key) ?? { a, b, opposites: [] };
    if (!incident.opposites.includes(opposite)) incident.opposites.push(opposite);
    adjacentFaces.set(key, incident);

    if (edgeSet.has(key)) return true;
    if (constraints.length >= MAX_CONSTRAINTS) return false;
    edgeSet.add(key);
    constraints.push({ a, b, restLength: length });
    return true;
  };

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const a = indices ? Number(indices[offset]) : offset;
    const b = indices ? Number(indices[offset + 1]) : offset + 1;
    const c = indices ? Number(indices[offset + 2]) : offset + 2;
    if (!addEdge(a, b, c) || !addEdge(b, c, a) || !addEdge(c, a, b)) return null;
  }

  const bendingConstraints: AvatarSecondaryParticleConstraint[] = [];
  const bendingSet = new Set<string>();
  for (const { opposites } of adjacentFaces.values()) {
    if (opposites.length !== 2 || opposites[0] === opposites[1]) continue;
    const a = opposites[0];
    const b = opposites[1];
    const key = edgeKey(a, b);
    if (bendingSet.has(key)) continue;
    const ax = Number(positions[a * 3]);
    const ay = Number(positions[a * 3 + 1]);
    const az = Number(positions[a * 3 + 2]);
    const bx = Number(positions[b * 3]);
    const by = Number(positions[b * 3 + 1]);
    const bz = Number(positions[b * 3 + 2]);
    if (![ax, ay, az, bx, by, bz].every(Number.isFinite)) return null;
    const restLength = Math.hypot(bx - ax, by - ay, bz - az);
    if (!Number.isFinite(restLength)) return null;
    if (restLength < 1e-7) continue;
    if (bendingConstraints.length >= MAX_BENDING_CONSTRAINTS) return null;
    bendingSet.add(key);
    bendingConstraints.push({ a, b, restLength });
  }

  return constraints.length >= 5 ? { constraints, bendingConstraints } : null;
}

/**
 * Creates a bounded XPBD surface made from the mesh's real vertices.
 * Pinned vertices are immovable attachment points; every triangle contributes
 * unique edge constraints, so the solver preserves the authored surface layout.
 */
export function createAvatarSecondaryParticleState(
  input: AvatarSecondaryParticleInput,
): AvatarSecondaryParticleState | null {
  if (!input || (input.role !== "hair" && input.role !== "garment")) return null;
  const source = input.positions;
  if (!source || source.length % 3 !== 0) return null;
  const vertexCount = source.length / 3;
  if (vertexCount < 6 || vertexCount > MAX_PARTICLES
    || !input.pinnedMask || input.pinnedMask.length !== vertexCount) return null;

  const rest = new Float32Array(source.length);
  for (let index = 0; index < source.length; index += 1) {
    const value = Number(source[index]);
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) return null;
    rest[index] = value;
  }

  const inverseMass = new Float32Array(vertexCount);
  let pinnedCount = 0;
  let movableCount = 0;
  for (let index = 0; index < vertexCount; index += 1) {
    const pin = Number(input.pinnedMask[index]);
    if (!Number.isFinite(pin)) return null;
    if (pin >= 0.5) {
      inverseMass[index] = 0;
      pinnedCount += 1;
    } else {
      inverseMass[index] = 1;
      movableCount += 1;
    }
  }
  if (pinnedCount < 2 || movableCount < 3) return null;

  const topology = buildTopology(rest, vertexCount, input.indices);
  if (!topology) return null;
  const limits = ROLE_LIMITS[input.role];
  return {
    role: input.role,
    vertexCount,
    rest,
    positions: new Float32Array(rest),
    previous: new Float32Array(rest),
    inverseMass,
    offsets: new Float32Array(rest.length),
    constraints: topology.constraints,
    lambdas: new Float32Array(topology.constraints.length),
    bendingConstraints: topology.bendingConstraints,
    bendingLambdas: new Float32Array(topology.bendingConstraints.length),
    compliance: limits.compliance,
    bendingCompliance: limits.bendingCompliance,
    damping: limits.damping,
    maxOffset: limits.maxOffset,
    completedSteps: 0,
  };
}

function bodyDrive(frame: AvatarNeuroAdaptiveFrame): [number, number, number] {
  const channels = frame.bodyChannels ?? {};
  const channel = (name: string): number => clamp(Number(channels[name] ?? 0), -1, 1);
  const activity = clamp(
    0.12 + clamp(frame.energy, 0, 1) * 0.18 + clamp(frame.arousal, 0, 1) * 0.16
      + clamp(frame.curiosity, 0, 1) * 0.12 + clamp(frame.novelty, 0, 1) * 0.14
      + clamp(frame.predictionError, 0, 1) * 0.12,
    0,
    1,
  );
  const awakeScale = frame.awake === true ? 1 : 0.06;
  const qualityScale = frame.quality === "low" ? 0.35 : frame.quality === "high" ? 1 : 0.7;
  const scale = awakeScale * qualityScale;
  const yaw = channel("headYaw") * 0.3 + channel("torsoYaw") * 0.5 + channel("rootYaw") * 0.2;
  const gait = clamp((Math.abs(channel("leftAnkle")) + Math.abs(channel("rightAnkle"))
    + Math.abs(channel("leftKnee")) + Math.abs(channel("rightKnee"))) * 0.25, 0, 1);
  const breath = Math.max(0, channel("breath"));
  return [
    clamp((yaw * 0.75 + (channel("rightAnkle") - channel("leftAnkle")) * 0.12) * scale, -1, 1),
    clamp((-0.10 + breath * 0.16) * scale, -1, 1),
    clamp((-activity * 0.34 - gait * 0.46 + channel("torsoPitch") * 0.08) * scale, -1, 1),
  ];
}

function constrainOffset(
  state: AvatarSecondaryParticleState,
  vertex: number,
  maxOffset = state.maxOffset,
): void {
  const offset = vertex * 3;
  const dx = state.positions[offset] - state.rest[offset];
  const dy = state.positions[offset + 1] - state.rest[offset + 1];
  const dz = state.positions[offset + 2] - state.rest[offset + 2];
  const distance = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(distance) || distance <= maxOffset || distance < 1e-9) return;
  const scale = maxOffset / distance;
  state.positions[offset] = state.rest[offset] + dx * scale;
  state.positions[offset + 1] = state.rest[offset + 1] + dy * scale;
  state.positions[offset + 2] = state.rest[offset + 2] + dz * scale;
}

function solveDistanceConstraints(
  state: AvatarSecondaryParticleState,
  constraints: readonly AvatarSecondaryParticleConstraint[],
  lambdas: Float32Array,
  alpha: number,
): void {
  for (let index = 0; index < constraints.length; index += 1) {
    const constraint = constraints[index];
    const a = constraint.a * 3;
    const b = constraint.b * 3;
    const dx = state.positions[b] - state.positions[a];
    const dy = state.positions[b + 1] - state.positions[a + 1];
    const dz = state.positions[b + 2] - state.positions[a + 2];
    const length = Math.hypot(dx, dy, dz);
    if (!Number.isFinite(length) || length < 1e-8) continue;
    const wa = state.inverseMass[constraint.a];
    const wb = state.inverseMass[constraint.b];
    const denominator = wa + wb + alpha;
    if (denominator <= 0) continue;
    const deltaLambda = (-(length - constraint.restLength) - alpha * lambdas[index]) / denominator;
    lambdas[index] += deltaLambda;
    const nx = dx / length;
    const ny = dy / length;
    const nz = dz / length;
    state.positions[a] -= wa * nx * deltaLambda;
    state.positions[a + 1] -= wa * ny * deltaLambda;
    state.positions[a + 2] -= wa * nz * deltaLambda;
    state.positions[b] += wb * nx * deltaLambda;
    state.positions[b + 1] += wb * ny * deltaLambda;
    state.positions[b + 2] += wb * nz * deltaLambda;
  }
}

/** Advance real vertex particles with fixed-step Verlet integration and XPBD constraints. */
export function stepAvatarSecondaryParticleState(
  state: AvatarSecondaryParticleState,
  frame: AvatarNeuroAdaptiveFrame,
): Float32Array {
  if (!state || !frame || !Number.isFinite(frame.deltaSeconds)) return state?.offsets ?? new Float32Array();
  const totalSeconds = clamp(frame.deltaSeconds, 0, MAX_FRAME_SECONDS);
  if (totalSeconds <= 0) return state.offsets;
  const substeps = Math.max(1, Math.min(4, Math.ceil(totalSeconds / FIXED_STEP_SECONDS)));
  const stepSeconds = totalSeconds / substeps;
  const [ax, ay, az] = bodyDrive(frame);
  const damping = Math.pow(1 - state.damping, stepSeconds / FIXED_STEP_SECONDS);
  const qualityMotionScale = frame.quality === "low" ? 0.35 : frame.quality === "balanced" ? 0.7 : 1;
  const effectiveMaxOffset = state.maxOffset * qualityMotionScale;
  const solverIterations = frame.quality === "low" ? 2 : frame.quality === "high" ? SOLVER_ITERATIONS : 3;

  for (let step = 0; step < substeps; step += 1) {
    for (let vertex = 0; vertex < state.vertexCount; vertex += 1) {
      const offset = vertex * 3;
      if (state.inverseMass[vertex] === 0) {
        state.positions[offset] = state.rest[offset];
        state.positions[offset + 1] = state.rest[offset + 1];
        state.positions[offset + 2] = state.rest[offset + 2];
        state.previous[offset] = state.rest[offset];
        state.previous[offset + 1] = state.rest[offset + 1];
        state.previous[offset + 2] = state.rest[offset + 2];
        continue;
      }
      const x = state.positions[offset];
      const y = state.positions[offset + 1];
      const z = state.positions[offset + 2];
      const vx = (x - state.previous[offset]) * damping;
      const vy = (y - state.previous[offset + 1]) * damping;
      const vz = (z - state.previous[offset + 2]) * damping;
      state.previous[offset] = x;
      state.previous[offset + 1] = y;
      state.previous[offset + 2] = z;
      state.positions[offset] = x + vx + ax * stepSeconds * stepSeconds;
      state.positions[offset + 1] = y + vy + ay * stepSeconds * stepSeconds;
      state.positions[offset + 2] = z + vz + az * stepSeconds * stepSeconds;
    }

    state.lambdas.fill(0);
    state.bendingLambdas.fill(0);
    const alpha = state.compliance / Math.max(1e-8, stepSeconds * stepSeconds);
    const bendingAlpha = state.bendingCompliance / Math.max(1e-8, stepSeconds * stepSeconds);
    for (let iteration = 0; iteration < solverIterations; iteration += 1) {
      solveDistanceConstraints(state, state.constraints, state.lambdas, alpha);
      solveDistanceConstraints(state, state.bendingConstraints, state.bendingLambdas, bendingAlpha);
      for (let vertex = 0; vertex < state.vertexCount; vertex += 1) {
        if (state.inverseMass[vertex] !== 0) constrainOffset(state, vertex, effectiveMaxOffset);
      }
    }
  }

  for (let vertex = 0; vertex < state.vertexCount; vertex += 1) {
    const offset = vertex * 3;
    state.offsets[offset] = state.positions[offset] - state.rest[offset];
    state.offsets[offset + 1] = state.positions[offset + 1] - state.rest[offset + 1];
    state.offsets[offset + 2] = state.positions[offset + 2] - state.rest[offset + 2];
  }
  state.completedSteps += substeps;
  return state.offsets;
}

export function resetAvatarSecondaryParticleState(state: AvatarSecondaryParticleState): void {
  if (!state) return;
  state.positions.set(state.rest);
  state.previous.set(state.rest);
  state.offsets.fill(0);
  state.lambdas.fill(0);
  state.bendingLambdas.fill(0);
  state.completedSteps = 0;
}
