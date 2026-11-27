export type AvatarParticleVec3 = readonly [number, number, number];

export interface AvatarParticleNodeDefinition {
  id: string;
  position: AvatarParticleVec3;
  anchor?: boolean;
  inverseMass?: number;
  followStrength?: number;
  gravityScale?: number;
  maxDisplacement?: number;
}

export interface AvatarParticleConstraintDefinition {
  a: string;
  b: string;
  restLength?: number;
  stiffness?: number;
}

export interface AvatarParticleBodyDefinition {
  nodes: AvatarParticleNodeDefinition[];
  constraints: AvatarParticleConstraintDefinition[];
  fixedStepSeconds?: number;
  maxSubsteps?: number;
  solverIterations?: number;
  gravity?: AvatarParticleVec3;
  damping?: number;
}

export interface AvatarParticleTarget {
  id: string;
  position: AvatarParticleVec3;
}

export interface AvatarParticleSphereCollider {
  center: AvatarParticleVec3;
  radius: number;
}

export interface AvatarParticleStepInput {
  deltaSeconds: number;
  targets?: readonly AvatarParticleTarget[];
  colliders?: readonly AvatarParticleSphereCollider[];
  awake?: boolean;
  motion01?: number;
}

interface ParticleNodeState {
  id: string;
  x: number; y: number; z: number;
  px: number; py: number; pz: number;
  tx: number; ty: number; tz: number;
  inverseMass: number;
  followStrength: number;
  gravityScale: number;
  maxDisplacement: number;
}

interface ParticleConstraintState {
  a: number;
  b: number;
  restLength: number;
  stiffness: number;
}

export interface AvatarParticleBodyState {
  nodes: ParticleNodeState[];
  indexById: Map<string, number>;
  constraints: ParticleConstraintState[];
  fixedStepSeconds: number;
  maxSubsteps: number;
  solverIterations: number;
  gravity: AvatarParticleVec3;
  damping: number;
  accumulator: number;
  totalSteps: number;
  lastMaxDisplacement: number;
  lastConstraintError: number;
}

export interface AvatarParticleBodySnapshot {
  positions: Record<string, [number, number, number]>;
  previous: Record<string, [number, number, number]>;
  targets: Record<string, [number, number, number]>;
  stats: {
    particleCount: number;
    constraintCount: number;
    fixedStepSeconds: number;
    totalSteps: number;
    maxDisplacement: number;
    maxConstraintError: number;
  };
}

export interface AvatarParticleStepResult {
  steps: number;
  droppedTime: boolean;
  maxDisplacement: number;
  maxConstraintError: number;
}

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value);

const readVec3 = (value: unknown, errorCode: string): AvatarParticleVec3 => {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(finite)) {
    throw new Error(errorCode);
  }
  return [value[0], value[1], value[2]];
};

const distance = (a: AvatarParticleVec3, b: AvatarParticleVec3): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function sanitizeDefinition(definition: AvatarParticleBodyDefinition): AvatarParticleBodyDefinition {
  if (!definition || !Array.isArray(definition.nodes) || !definition.nodes.length || definition.nodes.length > 128) {
    throw new Error("particle-node-count-invalid");
  }
  if (!Array.isArray(definition.constraints) || definition.constraints.length > 512) {
    throw new Error("particle-constraint-count-invalid");
  }
  const ids = new Set<string>();
  const nodes = definition.nodes.map((node) => {
    if (!validId(node?.id)) throw new Error("particle-id-invalid");
    if (ids.has(node.id)) throw new Error("duplicate-particle-id");
    ids.add(node.id);
    const position = readVec3(node.position, "particle-position-invalid");
    const inverseMass = node.anchor === true ? 0 : (node.inverseMass ?? 1);
    const followStrength = node.followStrength ?? 82;
    const gravityScale = node.gravityScale ?? 1;
    const maxDisplacement = node.maxDisplacement ?? 0.045;
    if (!finite(inverseMass) || inverseMass < 0 || inverseMass > 100 ||
      !finite(followStrength) || followStrength < 0 || followStrength > 1000 ||
      !finite(gravityScale) || gravityScale < 0 || gravityScale > 4 ||
      !finite(maxDisplacement) || maxDisplacement <= 0 || maxDisplacement > 0.5) {
      throw new Error("particle-node-parameters-invalid");
    }
    return { ...node, position, inverseMass, followStrength, gravityScale, maxDisplacement };
  });
  const edges = new Set<string>();
  for (const edge of definition.constraints) {
    if (!ids.has(edge.a) || !ids.has(edge.b)) throw new Error("particle-constraint-node-missing");
    if (edge.a === edge.b) throw new Error("particle-constraint-self-edge");
    const key = [edge.a, edge.b].sort().join("\u0000");
    if (edges.has(key)) throw new Error("duplicate-particle-constraint");
    edges.add(key);
    if (edge.restLength !== undefined && (!finite(edge.restLength) || edge.restLength <= 0 || edge.restLength > 10)) {
      throw new Error("particle-rest-length-invalid");
    }
    if (edge.stiffness !== undefined && (!finite(edge.stiffness) || edge.stiffness < 0 || edge.stiffness > 1)) {
      throw new Error("particle-constraint-stiffness-invalid");
    }
  }
  return { ...definition, nodes };
}

export function createAvatarParticleBody(definition: AvatarParticleBodyDefinition): AvatarParticleBodyState {
  const safe = sanitizeDefinition(definition);
  const indexById = new Map<string, number>();
  const nodes: ParticleNodeState[] = safe.nodes.map((node, index) => {
    indexById.set(node.id, index);
    const [x, y, z] = node.position;
    return {
      id: node.id, x, y, z, px: x, py: y, pz: z, tx: x, ty: y, tz: z,
      inverseMass: node.inverseMass ?? 1,
      followStrength: node.followStrength ?? 82,
      gravityScale: node.gravityScale ?? 1,
      maxDisplacement: node.maxDisplacement ?? 0.045,
    };
  });
  const constraints = safe.constraints.map((edge) => {
    const a = indexById.get(edge.a)!;
    const b = indexById.get(edge.b)!;
    const aNode = nodes[a], bNode = nodes[b];
    const restLength = edge.restLength ?? Math.hypot(aNode.x - bNode.x, aNode.y - bNode.y, aNode.z - bNode.z);
    if (restLength < 1e-6 || !finite(restLength)) throw new Error("particle-rest-length-invalid");
    return { a, b, restLength, stiffness: edge.stiffness ?? 0.92 };
  });
  const fixedStepSeconds = definition.fixedStepSeconds ?? 1 / 120;
  const maxSubsteps = definition.maxSubsteps ?? 6;
  const solverIterations = definition.solverIterations ?? 6;
  const damping = definition.damping ?? 0.985;
  const gravity = readVec3(definition.gravity ?? [0, -0.25, 0], "particle-gravity-invalid");
  if (!finite(fixedStepSeconds) || fixedStepSeconds < 1 / 240 || fixedStepSeconds > 1 / 30 ||
    !Number.isSafeInteger(maxSubsteps) || maxSubsteps < 1 || maxSubsteps > 12 ||
    !Number.isSafeInteger(solverIterations) || solverIterations < 1 || solverIterations > 16 ||
    !finite(damping) || damping < 0 || damping > 1) {
    throw new Error("particle-solver-configuration-invalid");
  }
  return {
    nodes, indexById, constraints, fixedStepSeconds, maxSubsteps, solverIterations,
    gravity, damping, accumulator: 0, totalSteps: 0, lastMaxDisplacement: 0, lastConstraintError: 0,
  };
}

function applyTargets(state: AvatarParticleBodyState, targets: readonly AvatarParticleTarget[] = []): void {
  for (const target of targets) {
    const index = state.indexById.get(target.id);
    if (index === undefined) continue;
    const [x, y, z] = readVec3(target.position, "particle-target-invalid");
    const node = state.nodes[index];
    node.tx = x; node.ty = y; node.tz = z;
  }
}

function projectCollider(node: ParticleNodeState, collider: AvatarParticleSphereCollider): void {
  const center = readVec3(collider.center, "particle-collider-center-invalid");
  if (!finite(collider.radius) || collider.radius <= 0 || collider.radius > 2) {
    throw new Error("particle-collider-radius-invalid");
  }
  let dx = node.x - center[0], dy = node.y - center[1], dz = node.z - center[2];
  let length = Math.hypot(dx, dy, dz);
  if (length >= collider.radius) return;
  if (length < 1e-8) {
    dx = 0; dy = 1; dz = 0; length = 1;
  }
  const scale = collider.radius / length;
  node.x = center[0] + dx * scale;
  node.y = center[1] + dy * scale;
  node.z = center[2] + dz * scale;
}

function solveConstraints(state: AvatarParticleBodyState, colliders: readonly AvatarParticleSphereCollider[]): number {
  for (let iteration = 0; iteration < state.solverIterations; iteration += 1) {
    for (const edge of state.constraints) {
      const a = state.nodes[edge.a], b = state.nodes[edge.b];
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const length = Math.hypot(dx, dy, dz);
      if (length < 1e-8) continue;
      const totalMass = a.inverseMass + b.inverseMass;
      if (totalMass <= 0) continue;
      const correction = ((length - edge.restLength) / length) * edge.stiffness;
      const cx = dx * correction, cy = dy * correction, cz = dz * correction;
      const weightA = a.inverseMass / totalMass, weightB = b.inverseMass / totalMass;
      a.x += cx * weightA; a.y += cy * weightA; a.z += cz * weightA;
      b.x -= cx * weightB; b.y -= cy * weightB; b.z -= cz * weightB;
    }
    for (const node of state.nodes) {
      if (node.inverseMass === 0) {
        node.x = node.tx; node.y = node.ty; node.z = node.tz;
      } else {
        for (const collider of colliders) projectCollider(node, collider);
      }
    }
  }
  let maxError = 0;
  for (const edge of state.constraints) {
    const a = state.nodes[edge.a], b = state.nodes[edge.b];
    const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    maxError = Math.max(maxError, Math.abs(length - edge.restLength));
  }
  return maxError;
}

function integrate(state: AvatarParticleBodyState, input: AvatarParticleStepInput): void {
  const dt = state.fixedStepSeconds;
  const awake = input.awake !== false;
  const motion = clamp(input.motion01 ?? 0.35, 0, 1);
  const sleepGravityScale = awake ? 1 : 0.15;
  const damping = clamp(state.damping - (awake ? 0 : 0.035), 0.82, 0.9999);
  const dtSquared = dt * dt;
  for (const node of state.nodes) {
    if (node.inverseMass === 0) {
      node.x = node.tx; node.y = node.ty; node.z = node.tz;
      node.px = node.tx; node.py = node.ty; node.pz = node.tz;
      continue;
    }
    const oldX = node.x, oldY = node.y, oldZ = node.z;
    const vx = (node.x - node.px) * damping;
    const vy = (node.y - node.py) * damping;
    const vz = (node.z - node.pz) * damping;
    const follow = node.followStrength * (0.72 + motion * 0.28);
    const ax = (node.tx - node.x) * follow;
    const ay = (node.ty - node.y) * follow + state.gravity[1] * node.gravityScale * sleepGravityScale;
    const az = (node.tz - node.z) * follow;
    node.x += vx + ax * dtSquared;
    node.y += vy + ay * dtSquared;
    node.z += vz + az * dtSquared;
    node.px = oldX; node.py = oldY; node.pz = oldZ;
    const dx = node.x - node.tx, dy = node.y - node.ty, dz = node.z - node.tz;
    const displacement = Math.hypot(dx, dy, dz);
    if (displacement > node.maxDisplacement) {
      const scale = node.maxDisplacement / displacement;
      node.x = node.tx + dx * scale;
      node.y = node.ty + dy * scale;
      node.z = node.tz + dz * scale;
    }
  }
}

export function stepAvatarParticleBody(
  state: AvatarParticleBodyState,
  input: AvatarParticleStepInput,
): AvatarParticleStepResult {
  applyTargets(state, input.targets);
  const rawDelta = finite(input.deltaSeconds) ? Math.max(0, input.deltaSeconds) : 0;
  const cappedDelta = Math.min(rawDelta, 0.05);
  let droppedTime = rawDelta > cappedDelta;
  state.accumulator += cappedDelta;
  let steps = 0;
  while (state.accumulator + 1e-12 >= state.fixedStepSeconds && steps < state.maxSubsteps) {
    integrate(state, input);
    state.lastConstraintError = solveConstraints(state, input.colliders ?? []);
    state.accumulator -= state.fixedStepSeconds;
    state.totalSteps += 1;
    steps += 1;
  }
  if (state.accumulator >= state.fixedStepSeconds) {
    state.accumulator = 0;
    droppedTime = true;
  }
  let maxDisplacement = 0;
  for (const node of state.nodes) {
    if (![node.x, node.y, node.z, node.px, node.py, node.pz].every(finite)) {
      throw new Error("particle-state-non-finite");
    }
    maxDisplacement = Math.max(maxDisplacement, Math.hypot(node.x - node.tx, node.y - node.ty, node.z - node.tz));
  }
  state.lastMaxDisplacement = maxDisplacement;
  return {
    steps,
    droppedTime,
    maxDisplacement,
    maxConstraintError: state.lastConstraintError,
  };
}

export function resetAvatarParticleBody(
  state: AvatarParticleBodyState,
  targets: readonly AvatarParticleTarget[] = [],
): void {
  applyTargets(state, targets);
  for (const node of state.nodes) {
    node.x = node.tx; node.y = node.ty; node.z = node.tz;
    node.px = node.tx; node.py = node.ty; node.pz = node.tz;
  }
  state.accumulator = 0;
  state.lastMaxDisplacement = 0;
  state.lastConstraintError = 0;
}

export function snapshotAvatarParticleBody(state: AvatarParticleBodyState): AvatarParticleBodySnapshot {
  const positions: Record<string, [number, number, number]> = {};
  const previous: Record<string, [number, number, number]> = {};
  const targets: Record<string, [number, number, number]> = {};
  for (const node of state.nodes) {
    positions[node.id] = [node.x, node.y, node.z];
    previous[node.id] = [node.px, node.py, node.pz];
    targets[node.id] = [node.tx, node.ty, node.tz];
  }
  return {
    positions, previous, targets,
    stats: {
      particleCount: state.nodes.length,
      constraintCount: state.constraints.length,
      fixedStepSeconds: state.fixedStepSeconds,
      totalSteps: state.totalSteps,
      maxDisplacement: state.lastMaxDisplacement,
      maxConstraintError: state.lastConstraintError,
    },
  };
}
