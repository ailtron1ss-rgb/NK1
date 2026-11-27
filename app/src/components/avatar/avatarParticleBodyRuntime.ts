import * as THREE from "three";
import {
  createAvatarParticleBody,
  stepAvatarParticleBody,
  type AvatarParticleBodyState,
  type AvatarParticleTarget,
} from "./avatarParticleBody.ts";

interface HumanoidNodeDefinition {
  id: string;
  vrmName: string;
  aliases: string[];
  parentId: string | null;
  anchor?: boolean;
  maxDisplacement?: number;
  followStrength?: number;
  gravityScale?: number;
}

interface AvatarParticleBoneBinding {
  id: string;
  node: THREE.Object3D;
  parent: THREE.Object3D;
  basePosition: THREE.Vector3;
  depth: number;
}

export interface AvatarParticleBodyRuntime {
  root: THREE.Object3D;
  state: AvatarParticleBodyState;
  bindings: AvatarParticleBoneBinding[];
  targets: AvatarParticleTarget[];
}

export interface AvatarParticleBodyRuntimeInput {
  deltaSeconds: number;
  awake: boolean;
  motion01: number;
}

export interface AvatarParticleBodyRuntimeResult {
  particleCount: number;
  constraintCount: number;
  simulationSteps: number;
  maxDisplacement: number;
  maxConstraintError: number;
  droppedTime: boolean;
}

const HUMANOID_NODES: readonly HumanoidNodeDefinition[] = [
  { id: "hips", vrmName: "hips", aliases: ["hips", "pelvis"], parentId: null, anchor: true, maxDisplacement: 0.004, followStrength: 180, gravityScale: 0 },
  { id: "spine", vrmName: "spine", aliases: ["spine"], parentId: "hips", maxDisplacement: 0.009, followStrength: 125 },
  { id: "chest", vrmName: "chest", aliases: ["chest"], parentId: "spine", maxDisplacement: 0.012, followStrength: 105 },
  { id: "upperChest", vrmName: "upperChest", aliases: ["upperchest"], parentId: "chest", maxDisplacement: 0.012, followStrength: 100 },
  { id: "neck", vrmName: "neck", aliases: ["neck"], parentId: "upperChest", maxDisplacement: 0.012, followStrength: 84 },
  { id: "head", vrmName: "head", aliases: ["head"], parentId: "neck", maxDisplacement: 0.014, followStrength: 78 },
  { id: "leftShoulder", vrmName: "leftShoulder", aliases: ["leftshoulder"], parentId: "upperChest", maxDisplacement: 0.012, followStrength: 110 },
  { id: "leftUpperArm", vrmName: "leftUpperArm", aliases: ["leftupperarm", "leftarm"], parentId: "leftShoulder", maxDisplacement: 0.014, followStrength: 100 },
  { id: "leftLowerArm", vrmName: "leftLowerArm", aliases: ["leftlowerarm", "leftforearm"], parentId: "leftUpperArm", maxDisplacement: 0.017, followStrength: 88 },
  { id: "leftHand", vrmName: "leftHand", aliases: ["lefthand"], parentId: "leftLowerArm", maxDisplacement: 0.018, followStrength: 78 },
  { id: "rightShoulder", vrmName: "rightShoulder", aliases: ["rightshoulder"], parentId: "upperChest", maxDisplacement: 0.012, followStrength: 110 },
  { id: "rightUpperArm", vrmName: "rightUpperArm", aliases: ["rightupperarm", "rightarm"], parentId: "rightShoulder", maxDisplacement: 0.014, followStrength: 100 },
  { id: "rightLowerArm", vrmName: "rightLowerArm", aliases: ["rightlowerarm", "rightforearm"], parentId: "rightUpperArm", maxDisplacement: 0.017, followStrength: 88 },
  { id: "rightHand", vrmName: "rightHand", aliases: ["righthand"], parentId: "rightLowerArm", maxDisplacement: 0.018, followStrength: 78 },
  { id: "leftUpperLeg", vrmName: "leftUpperLeg", aliases: ["leftupperleg", "leftthigh"], parentId: "hips", maxDisplacement: 0.012, followStrength: 120 },
  { id: "leftLowerLeg", vrmName: "leftLowerLeg", aliases: ["leftlowerleg", "leftcalf"], parentId: "leftUpperLeg", maxDisplacement: 0.014, followStrength: 105 },
  { id: "leftFoot", vrmName: "leftFoot", aliases: ["leftfoot"], parentId: "leftLowerLeg", maxDisplacement: 0.014, followStrength: 92 },
  { id: "leftToes", vrmName: "leftToes", aliases: ["lefttoes", "lefttoe"], parentId: "leftFoot", maxDisplacement: 0.012, followStrength: 90 },
  { id: "rightUpperLeg", vrmName: "rightUpperLeg", aliases: ["rightupperleg", "rightthigh"], parentId: "hips", maxDisplacement: 0.012, followStrength: 120 },
  { id: "rightLowerLeg", vrmName: "rightLowerLeg", aliases: ["rightlowerleg", "rightcalf"], parentId: "rightUpperLeg", maxDisplacement: 0.014, followStrength: 105 },
  { id: "rightFoot", vrmName: "rightFoot", aliases: ["rightfoot"], parentId: "rightLowerLeg", maxDisplacement: 0.014, followStrength: 92 },
  { id: "rightToes", vrmName: "rightToes", aliases: ["righttoes", "righttoe"], parentId: "rightFoot", maxDisplacement: 0.012, followStrength: 90 },
];

function normalizedBoneName(name: unknown): string {
  return typeof name === "string" ? name.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
}

function nodeDepth(node: THREE.Object3D, root: THREE.Object3D): number {
  let depth = 0;
  let current: THREE.Object3D | null = node;
  while (current && current !== root && depth < 256) {
    depth += 1;
    current = current.parent;
  }
  return depth;
}

function resolveHumanoidNode(
  definition: HumanoidNodeDefinition,
  humanoid: any,
  byName: ReadonlyMap<string, THREE.Object3D>,
): THREE.Object3D | null {
  if (humanoid && typeof humanoid.getNormalizedBoneNode === "function") {
    try {
      const normalized = humanoid.getNormalizedBoneNode(definition.vrmName);
      if (normalized?.isObject3D === true) return normalized as THREE.Object3D;
    } catch {
      // Continue with a conservative normalized name lookup for nonstandard VRM builds.
    }
  }
  for (const alias of definition.aliases) {
    const node = byName.get(alias);
    if ((node as any)?.isBone === true) return node;
  }
  return null;
}

/**
 * Bind one bounded particle to each available humanoid joint. The actual VRM/GLB
 * SkinnedMesh remains the visible body; particle positions add inertial motion to
 * the real bone transforms while distance constraints preserve limb lengths.
 */
export function createAvatarParticleBodyRuntime(
  root: THREE.Object3D,
  humanoid?: unknown,
): AvatarParticleBodyRuntime | null {
  if (!root || typeof root.updateWorldMatrix !== "function") return null;
  root.updateWorldMatrix(true, true);
  const byName = new Map<string, THREE.Object3D>();
  root.traverse((node) => {
    if ((node as any).isBone === true && !byName.has(normalizedBoneName(node.name))) {
      byName.set(normalizedBoneName(node.name), node);
    }
  });

  const resolved = new Map<string, THREE.Object3D>();
  for (const definition of HUMANOID_NODES) {
    const node = resolveHumanoidNode(definition, humanoid, byName);
    if (node && node.parent) resolved.set(definition.id, node);
  }
  if (!resolved.has("hips") || resolved.size < 8) return null;

  const bindings: AvatarParticleBoneBinding[] = HUMANOID_NODES
    .filter((definition) => resolved.has(definition.id))
    .map((definition) => {
      const node = resolved.get(definition.id)!;
      return {
        id: definition.id,
        node,
        parent: node.parent!,
        basePosition: node.position.clone(),
        depth: nodeDepth(node, root),
      };
    })
    .sort((a, b) => a.depth - b.depth);

  root.updateWorldMatrix(true, true);
  const rootLocal = new THREE.Vector3();
  const definitions = HUMANOID_NODES
    .filter((definition) => resolved.has(definition.id))
    .map((definition) => {
      const node = resolved.get(definition.id)!;
      node.getWorldPosition(rootLocal);
      root.worldToLocal(rootLocal);
      const binding = bindings.find((entry) => entry.id === definition.id)!;
      return {
        id: definition.id,
        position: [rootLocal.x, rootLocal.y, rootLocal.z] as [number, number, number],
        anchor: definition.anchor === true,
        maxDisplacement: definition.maxDisplacement,
        followStrength: definition.followStrength,
        gravityScale: definition.gravityScale,
        binding,
      };
    });

  const availableIds = new Set(definitions.map((definition) => definition.id));
  const constraints: Array<{ a: string; b: string; stiffness: number }> = [];
  for (const definition of HUMANOID_NODES) {
    if (!availableIds.has(definition.id) || !definition.parentId) continue;
    let parentId: string | null = definition.parentId;
    while (parentId && !availableIds.has(parentId)) {
      parentId = HUMANOID_NODES.find((candidate) => candidate.id === parentId)?.parentId ?? null;
    }
    if (parentId) constraints.push({ a: parentId, b: definition.id, stiffness: 0.96 });
  }

  const state = createAvatarParticleBody({
    fixedStepSeconds: 1 / 120,
    maxSubsteps: 6,
    solverIterations: 7,
    gravity: [0, -0.16, 0],
    damping: 0.988,
    nodes: definitions.map(({ binding: _binding, ...definition }) => definition),
    constraints,
  });
  return {
    root,
    state,
    bindings,
    targets: definitions.map(({ id, position }) => ({ id, position })),
  };
}

export function resetAvatarParticleBodyPose(runtime: AvatarParticleBodyRuntime | null): void {
  if (!runtime) return;
  for (const binding of runtime.bindings) {
    binding.node.position.copy(binding.basePosition);
  }
  runtime.root.updateWorldMatrix(true, true);
}

export function stepAvatarParticleBodyPose(
  runtime: AvatarParticleBodyRuntime | null,
  input: AvatarParticleBodyRuntimeInput,
): AvatarParticleBodyRuntimeResult | null {
  if (!runtime) return null;
  runtime.root.updateWorldMatrix(true, true);
  const scratch = new THREE.Vector3();
  for (const binding of runtime.bindings) {
    binding.node.getWorldPosition(scratch);
    runtime.root.worldToLocal(scratch);
    const target = runtime.targets.find((entry) => entry.id === binding.id);
    if (target) target.position = [scratch.x, scratch.y, scratch.z];
  }
  const result = stepAvatarParticleBody(runtime.state, {
    deltaSeconds: input.deltaSeconds,
    targets: runtime.targets,
    awake: input.awake,
    motion01: input.motion01,
  });
  const snapshot = snapshotAvatarParticleBody(runtime.state);
  for (const binding of runtime.bindings) {
    const position = snapshot.positions[binding.id];
    if (!position) continue;
    scratch.set(position[0], position[1], position[2]);
    runtime.root.localToWorld(scratch);
    binding.parent.updateWorldMatrix(true, false);
    binding.parent.worldToLocal(scratch);
    binding.node.position.copy(scratch);
  }
  runtime.root.updateWorldMatrix(true, true);
  return {
    particleCount: runtime.state.nodes.length,
    constraintCount: runtime.state.constraints.length,
    simulationSteps: result.steps,
    maxDisplacement: result.maxDisplacement,
    maxConstraintError: result.maxConstraintError,
    droppedTime: result.droppedTime,
  };
}
