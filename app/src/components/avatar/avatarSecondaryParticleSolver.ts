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
  /** 0 for hard pins, 1 for free vertices, and fractional values for soft attachments. */
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
  bodyCollisionCount: number;
  maxBodyCollisionCorrection: number;
}

export interface AvatarSecondaryParticleInput {
  positions: ArrayLike<number>;
  indices?: ArrayLike<number> | null;
  /** Per-vertex pin weight in [0, 1]: 0 is free, 1 is fixed, intermediate values are soft pins. */
  pinnedMask: ArrayLike<number>;
  role: "hair" | "garment";
}

export interface AvatarBodySurfacePoint {
  x: number;
  y: number;
  z: number;
}

export interface AvatarBodySurfaceCollider {
  positions: Float32Array;
  indices: Uint32Array;
  center: AvatarBodySurfacePoint;
  min: AvatarBodySurfacePoint;
  max: AvatarBodySurfacePoint;
  cellSize: number;
  cells: ReadonlyMap<string, readonly number[]>;
}

export interface AvatarBodySurfaceColliderInput {
  positions: ArrayLike<number>;
  indices?: ArrayLike<number> | null;
  cellSize?: number;
}

export interface AvatarBodySurfaceProjection {
  position: AvatarBodySurfacePoint;
  normal: AvatarBodySurfacePoint;
  correction: number;
}

const MAX_BODY_SURFACE_VERTICES = 2_048;
const MAX_BODY_SURFACE_TRIANGLES = 4_096;
const MAX_BODY_SURFACE_GRID_ENTRIES = 32_768;
const MAX_BODY_SURFACE_TRIANGLE_CELLS = 256;
const MAX_BODY_SURFACE_CORRECTION = 0.05;

const bodyCellKey = (x: number, y: number, z: number): string => `${x},${y},${z}`;
const bodyDot = (a: AvatarBodySurfacePoint, b: AvatarBodySurfacePoint): number =>
  a.x * b.x + a.y * b.y + a.z * b.z;
const bodySub = (a: AvatarBodySurfacePoint, b: AvatarBodySurfacePoint): AvatarBodySurfacePoint =>
  ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const bodyCross = (a: AvatarBodySurfacePoint, b: AvatarBodySurfacePoint): AvatarBodySurfacePoint =>
  ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const bodyLength = (value: AvatarBodySurfacePoint): number =>
  Math.hypot(value.x, value.y, value.z);
const bodyScale = (value: AvatarBodySurfacePoint, scale: number): AvatarBodySurfacePoint =>
  ({ x: value.x * scale, y: value.y * scale, z: value.z * scale });
const bodyAdd = (a: AvatarBodySurfacePoint, b: AvatarBodySurfacePoint): AvatarBodySurfacePoint =>
  ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

function closestPointOnBodyTriangle(
  point: AvatarBodySurfacePoint,
  a: AvatarBodySurfacePoint,
  b: AvatarBodySurfacePoint,
  c: AvatarBodySurfacePoint,
): AvatarBodySurfacePoint {
  const ab = bodySub(b, a);
  const ac = bodySub(c, a);
  const ap = bodySub(point, a);
  const d1 = bodyDot(ab, ap), d2 = bodyDot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;

  const bp = bodySub(point, b);
  const d3 = bodyDot(ab, bp), d4 = bodyDot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;

  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return bodyAdd(a, bodyScale(ab, d1 / (d1 - d3)));

  const cp = bodySub(point, c);
  const d5 = bodyDot(ab, cp), d6 = bodyDot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;

  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return bodyAdd(a, bodyScale(ac, d2 / (d2 - d6)));

  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    return bodyAdd(b, bodyScale(bodySub(c, b), (d4 - d3) / ((d4 - d3) + (d5 - d6))));
  }

  const denominator = 1 / (va + vb + vc);
  const v = vb * denominator, w = vc * denominator;
  return bodyAdd(a, bodyAdd(bodyScale(ab, v), bodyScale(ac, w)));
}

/**
 * Build a bounded triangle grid for a deformed torso surface. Coordinates are
 * supplied in the same local space used by the secondary particle mesh.
 */
export function createAvatarBodySurfaceCollider(
  input: AvatarBodySurfaceColliderInput,
): AvatarBodySurfaceCollider | null {
  if (!input?.positions || input.positions.length % 3 !== 0) return null;
  const vertexCount = input.positions.length / 3;
  if (vertexCount < 4 || vertexCount > MAX_BODY_SURFACE_VERTICES) return null;
  if (input.indices && input.indices.length % 3 !== 0) return null;
  const rawIndices = input.indices ?? Array.from({ length: vertexCount }, (_, index) => index);
  const triangleCount = rawIndices.length / 3;
  if (!Number.isInteger(triangleCount) || triangleCount < 4 || triangleCount > MAX_BODY_SURFACE_TRIANGLES) return null;

  const positions = new Float32Array(vertexCount * 3);
  const min = { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY };
  const max = { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: Number.NEGATIVE_INFINITY };
  const center = { x: 0, y: 0, z: 0 };
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const offset = vertex * 3;
    const x = Number(input.positions[offset]), y = Number(input.positions[offset + 1]), z = Number(input.positions[offset + 2]);
    if (![x, y, z].every(Number.isFinite) || Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) > 1_000_000) return null;
    positions[offset] = x; positions[offset + 1] = y; positions[offset + 2] = z;
    min.x = Math.min(min.x, x); min.y = Math.min(min.y, y); min.z = Math.min(min.z, z);
    max.x = Math.max(max.x, x); max.y = Math.max(max.y, y); max.z = Math.max(max.z, z);
    center.x += x / vertexCount; center.y += y / vertexCount; center.z += z / vertexCount;
  }

  const indices = new Uint32Array(rawIndices.length);
  for (let offset = 0; offset < rawIndices.length; offset += 1) {
    const index = Number(rawIndices[offset]);
    if (!Number.isInteger(index) || index < 0 || index >= vertexCount) return null;
    indices[offset] = index;
  }

  const cellSize = typeof input.cellSize === "number" && Number.isFinite(input.cellSize)
    ? Math.max(0.04, Math.min(0.3, input.cellSize))
    : 0.12;
  const cells = new Map<string, number[]>();
  let gridEntries = 0;
  let validTriangles = 0;
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const ia = indices[offset], ib = indices[offset + 1], ic = indices[offset + 2];
    const a = ia * 3, b = ib * 3, c = ic * 3;
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
    const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
    const cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];
    const ab = { x: bx - ax, y: by - ay, z: bz - az };
    const ac = { x: cx - ax, y: cy - ay, z: cz - az };
    if (bodyLength(bodyCross(ab, ac)) < 1e-8) continue;

    const x0 = Math.floor((Math.min(ax, bx, cx) - min.x) / cellSize);
    const x1 = Math.floor((Math.max(ax, bx, cx) - min.x) / cellSize);
    const y0 = Math.floor((Math.min(ay, by, cy) - min.y) / cellSize);
    const y1 = Math.floor((Math.max(ay, by, cy) - min.y) / cellSize);
    const z0 = Math.floor((Math.min(az, bz, cz) - min.z) / cellSize);
    const z1 = Math.floor((Math.max(az, bz, cz) - min.z) / cellSize);
    const coverage = (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1);
    if (!Number.isFinite(coverage) || coverage <= 0 || coverage > MAX_BODY_SURFACE_TRIANGLE_CELLS) return null;

    for (let x = x0; x <= x1; x += 1) {
      for (let y = y0; y <= y1; y += 1) {
        for (let z = z0; z <= z1; z += 1) {
          const key = bodyCellKey(x, y, z);
          const bucket = cells.get(key) ?? [];
          if (bucket.length === 0) cells.set(key, bucket);
          bucket.push(triangle);
          gridEntries += 1;
          if (gridEntries > MAX_BODY_SURFACE_GRID_ENTRIES) return null;
        }
      }
    }
    validTriangles += 1;
  }
  if (validTriangles < 4 || cells.size === 0) return null;
  return { positions, indices, center, min, max, cellSize, cells };
}

/** Project a particle to the outward side of its closest torso triangle. */
export function projectPointOutsideBodySurface(
  point: AvatarBodySurfacePoint,
  collider: AvatarBodySurfaceCollider,
  minimumDistance: number,
): AvatarBodySurfaceProjection | null {
  if (!collider || !point || ![point.x, point.y, point.z, minimumDistance].every(Number.isFinite)
    || minimumDistance <= 0) return null;
  const { min, max, cellSize, positions, indices, cells, center } = collider;
  const broadMargin = Math.max(minimumDistance, cellSize * 0.2);
  if (point.x < min.x - broadMargin || point.x > max.x + broadMargin
    || point.y < min.y - broadMargin || point.y > max.y + broadMargin
    || point.z < min.z - broadMargin || point.z > max.z + broadMargin) return null;

  const cx = Math.floor((point.x - min.x) / cellSize);
  const cy = Math.floor((point.y - min.y) / cellSize);
  const cz = Math.floor((point.z - min.z) / cellSize);
  const candidates = new Set<number>();
  for (let x = cx - 2; x <= cx + 2; x += 1) {
    for (let y = cy - 2; y <= cy + 2; y += 1) {
      for (let z = cz - 2; z <= cz + 2; z += 1) {
        for (const triangle of cells.get(bodyCellKey(x, y, z)) ?? []) candidates.add(triangle);
      }
    }
  }
  if (candidates.size === 0) {
    const insideBounds = point.x >= min.x && point.x <= max.x
      && point.y >= min.y && point.y <= max.y
      && point.z >= min.z && point.z <= max.z;
    if (!insideBounds) return null;
    for (let triangle = 0; triangle < indices.length / 3; triangle += 1) candidates.add(triangle);
  }

  let closestDistanceSquared = Number.POSITIVE_INFINITY;
  let closestPoint: AvatarBodySurfacePoint | null = null;
  let closestNormal: AvatarBodySurfacePoint | null = null;
  for (const triangle of candidates) {
    const offset = triangle * 3;
    const ai = indices[offset] * 3, bi = indices[offset + 1] * 3, ci = indices[offset + 2] * 3;
    const a = { x: positions[ai], y: positions[ai + 1], z: positions[ai + 2] };
    const b = { x: positions[bi], y: positions[bi + 1], z: positions[bi + 2] };
    const c = { x: positions[ci], y: positions[ci + 1], z: positions[ci + 2] };
    const ab = bodySub(b, a), ac = bodySub(c, a);
    let normal = bodyCross(ab, ac);
    const normalLength = bodyLength(normal);
    if (!Number.isFinite(normalLength) || normalLength < 1e-8) continue;
    normal = bodyScale(normal, 1 / normalLength);
    const nearest = closestPointOnBodyTriangle(point, a, b, c);
    const radial = bodySub(nearest, center);
    if (bodyDot(normal, radial) < 0) normal = bodyScale(normal, -1);
    const separation = bodySub(point, nearest);
    const distanceSquared = bodyDot(separation, separation);
    if (!Number.isFinite(distanceSquared) || distanceSquared >= closestDistanceSquared) continue;
    closestDistanceSquared = distanceSquared;
    closestPoint = nearest;
    closestNormal = normal;
  }

  if (!closestPoint || !closestNormal) return null;
  const signedDistance = bodyDot(bodySub(point, closestPoint), closestNormal);
  if (!Number.isFinite(signedDistance) || signedDistance >= minimumDistance) return null;
  const correction = Math.min(minimumDistance - signedDistance, MAX_BODY_SURFACE_CORRECTION);
  if (!Number.isFinite(correction) || correction <= 0) return null;
  return {
    position: bodyAdd(point, bodyScale(closestNormal, correction)),
    normal: closestNormal,
    correction,
  };
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
    // Pin weights are normalized: 0 is free, 1 is hard-pinned, and the
    // interval between them gives the vertex a proportional inverse mass.
    const inverseMassWeight = 1 - clamp(pin, 0, 1);
    inverseMass[index] = inverseMassWeight;
    if (inverseMassWeight === 0) pinnedCount += 1;
    else movableCount += 1;
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
    bodyCollisionCount: 0,
    maxBodyCollisionCorrection: 0,
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
