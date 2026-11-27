import {
  AVATAR_NEUROADAPTIVE_MORPH_CHANNELS,
  resolveAvatarDynamicsBoneRole,
  type AvatarDynamicsRole,
} from "./avatarNeuroAdaptiveDynamics.ts";

const MAX_SCENE_NODES = 50_000;
const MAX_AUDIT_BONES = 20_000;
const MAX_AUDIT_MORPHS = 4_096;
const MAX_AUDIT_MATERIALS = 4_096;

export interface AvatarSecondaryBoneDescriptor {
  id: string;
  name: string;
  parentId?: string | null;
}

export interface AvatarSecondaryMaterialDescriptor {
  name?: string;
  userData?: unknown;
  extras?: unknown;
  emissive?: { r?: unknown; g?: unknown; b?: unknown } | null;
  emissiveMap?: unknown;
  emissiveTexture?: unknown;
  emissiveFactor?: readonly unknown[];
}

export interface AvatarSecondaryAssetDescriptor {
  bones?: readonly AvatarSecondaryBoneDescriptor[];
  morphTargetNames?: readonly string[];
  materials?: readonly AvatarSecondaryMaterialDescriptor[];
  skinnedMeshCount?: number;
  morphMeshCount?: number;
}

export interface AvatarSecondaryRoleAudit {
  boneCount: number;
  chainRoots: number;
  maxChainDepth: number;
}

export interface AvatarSecondaryMorphChannel {
  channel: keyof typeof AVATAR_NEUROADAPTIVE_MORPH_CHANNELS;
  targetName: string;
}

export interface AvatarSecondaryAssetAudit {
  schemaVersion: 1;
  totalBoneCount: number;
  recognizedBoneCount: number;
  unclassifiedBoneCount: number;
  byRole: {
    hair: AvatarSecondaryRoleAudit;
    garment: AvatarSecondaryRoleAudit;
    sleeve: AvatarSecondaryRoleAudit;
    neuralFiber: AvatarSecondaryRoleAudit;
  };
  skinnedMeshCount: number;
  morphMeshCount: number;
  morphTargetCount: number;
  morphChannels: readonly AvatarSecondaryMorphChannel[];
  taggedNeuralMaterialCount: number;
  secondaryPhysicsReady: boolean;
  warnings: readonly string[];
  truncated: boolean;
}

type SceneNodeLike = {
  name?: unknown;
  isBone?: unknown;
  isSkinnedMesh?: unknown;
  children?: unknown;
  parent?: unknown;
  morphTargetDictionary?: unknown;
  material?: unknown;
};

const ROLE_KEYS: Readonly<Record<AvatarDynamicsRole, keyof AvatarSecondaryAssetAudit["byRole"]>> = Object.freeze({
  hair: "hair",
  garment: "garment",
  sleeve: "sleeve",
  "neural-fiber": "neuralFiber",
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function emptyRoleAudit(): AvatarSecondaryRoleAudit {
  return { boneCount: 0, chainRoots: 0, maxChainDepth: 0 };
}

/** A tag is explicit; ordinary emissive trim is never promoted to NK1 neural fabric. */
export function isAvatarNeuralFabricMaterialTagged(material: unknown): boolean {
  if (!isRecord(material)) return false;
  const name = typeof material.name === "string" ? material.name : "";
  const userData = isRecord(material.userData) ? material.userData : null;
  const extras = isRecord(material.extras) ? material.extras : null;
  const layer = String(userData?.nk1DynamicLayer ?? extras?.nk1DynamicLayer ?? "").toLowerCase();
  return layer === "neural"
    || /^nk1[_-]neural[_-]/i.test(name)
    || /^(nk1synapse|nk1neuralfiber)/i.test(name);
}

export function hasAvatarNeuralFabricEmission(material: unknown): boolean {
  if (!isRecord(material)) return false;
  if (material.emissiveMap || material.emissiveTexture) return true;
  const emissive = isRecord(material.emissive) ? material.emissive : null;
  if (emissive && [emissive.r, emissive.g, emissive.b].some(
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
  )) return true;
  if (Array.isArray(material.emissiveFactor) && material.emissiveFactor.some(
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
  )) return true;
  return false;
}

function normalizeBones(input: unknown): AvatarSecondaryBoneDescriptor[] {
  if (!Array.isArray(input)) return [];
  const result: AvatarSecondaryBoneDescriptor[] = [];
  const ids = new Set<string>();
  for (const entry of input.slice(0, MAX_AUDIT_BONES)) {
    if (!isRecord(entry) || typeof entry.id !== "string" || !entry.id
      || typeof entry.name !== "string" || !entry.name.trim()
      || ids.has(entry.id)) continue;
    ids.add(entry.id);
    result.push({
      id: entry.id.slice(0, 128),
      name: entry.name.slice(0, 256),
      ...(typeof entry.parentId === "string" ? { parentId: entry.parentId.slice(0, 128) } : {}),
    });
  }
  return result;
}

function normalizeNames(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const names = new Set<string>();
  for (const entry of input.slice(0, MAX_AUDIT_MORPHS)) {
    if (typeof entry === "string" && entry.trim()) names.add(entry.slice(0, 256));
  }
  return [...names];
}

/**
 * Shared descriptor audit for both the live Three.js scene and the hosted GLB
 * verifier. Parent IDs are explicit so duplicate bone names remain distinct.
 */
export function auditAvatarSecondaryAssetDescriptor(
  input: AvatarSecondaryAssetDescriptor = {},
): AvatarSecondaryAssetAudit {
  const bones = normalizeBones(input.bones);
  const morphNames = normalizeNames(input.morphTargetNames);
  const materials = Array.isArray(input.materials)
    ? input.materials.slice(0, MAX_AUDIT_MATERIALS)
    : [];
  const byRole = {
    hair: emptyRoleAudit(),
    garment: emptyRoleAudit(),
    sleeve: emptyRoleAudit(),
    neuralFiber: emptyRoleAudit(),
  };
  const roleById = new Map<string, AvatarDynamicsRole>();
  const boneById = new Map(bones.map((bone) => [bone.id, bone]));
  const classified: Array<{ bone: AvatarSecondaryBoneDescriptor; role: AvatarDynamicsRole }> = [];

  for (const bone of bones) {
    const resolved = resolveAvatarDynamicsBoneRole(bone.name);
    if (!resolved) continue;
    roleById.set(bone.id, resolved.role);
    classified.push({ bone, role: resolved.role });
    byRole[ROLE_KEYS[resolved.role]].boneCount += 1;
  }

  for (const { bone, role } of classified) {
    const parentRole = bone.parentId ? roleById.get(bone.parentId) : undefined;
    if (parentRole !== role) byRole[ROLE_KEYS[role]].chainRoots += 1;

    let depth = 1;
    let parentId = bone.parentId ?? null;
    const seen = new Set<string>([bone.id]);
    while (parentId && depth < 32 && !seen.has(parentId)) {
      seen.add(parentId);
      if (roleById.get(parentId) !== role) break;
      depth += 1;
      parentId = boneById.get(parentId)?.parentId ?? null;
    }
    const bucket = byRole[ROLE_KEYS[role]];
    bucket.maxChainDepth = Math.max(bucket.maxChainDepth, depth);
  }

  const morphsByNormalizedName = new Map<string, string>();
  for (const name of morphNames) morphsByNormalizedName.set(normalize(name), name);
  const morphChannels: AvatarSecondaryMorphChannel[] = [];
  for (const [channel, aliases] of Object.entries(AVATAR_NEUROADAPTIVE_MORPH_CHANNELS)) {
    const targetName = aliases.map((alias) => morphsByNormalizedName.get(alias)).find(Boolean);
    if (targetName) morphChannels.push({ channel: channel as AvatarSecondaryMorphChannel["channel"], targetName });
  }

  const materialSet = new Set<unknown>();
  let taggedNeuralMaterialCount = 0;
  for (const material of materials) {
    if (!material || materialSet.has(material)) continue;
    materialSet.add(material);
    if (isAvatarNeuralFabricMaterialTagged(material) && hasAvatarNeuralFabricEmission(material)) {
      taggedNeuralMaterialCount += 1;
    }
  }

  const recognizedBoneCount = classified.length;
  const warnings: string[] = [];
  if (recognizedBoneCount === 0) warnings.push("no-secondary-bone-chains");
  if (byRole.hair.boneCount === 0) warnings.push("no-hair-secondary-bones");
  if (byRole.garment.boneCount === 0) warnings.push("no-garment-secondary-bones");
  if (morphChannels.length === 0) warnings.push("no-neuroadaptive-morphs");
  if (taggedNeuralMaterialCount === 0) warnings.push("no-tagged-neural-fabric");

  const truncated = Array.isArray(input.bones) && input.bones.length > MAX_AUDIT_BONES
    || Array.isArray(input.morphTargetNames) && input.morphTargetNames.length > MAX_AUDIT_MORPHS
    || Array.isArray(input.materials) && input.materials.length > MAX_AUDIT_MATERIALS;
  if (truncated) warnings.push("asset-audit-limit-reached");

  return Object.freeze({
    schemaVersion: 1,
    totalBoneCount: bones.length,
    recognizedBoneCount,
    unclassifiedBoneCount: Math.max(0, bones.length - recognizedBoneCount),
    byRole,
    skinnedMeshCount: typeof input.skinnedMeshCount === "number" && Number.isFinite(input.skinnedMeshCount)
      ? Math.max(0, Math.floor(input.skinnedMeshCount)) : 0,
    morphMeshCount: typeof input.morphMeshCount === "number" && Number.isFinite(input.morphMeshCount)
      ? Math.max(0, Math.floor(input.morphMeshCount)) : 0,
    morphTargetCount: morphNames.length,
    morphChannels: Object.freeze(morphChannels),
    taggedNeuralMaterialCount,
    secondaryPhysicsReady: recognizedBoneCount > 0 || morphChannels.length > 0,
    warnings: Object.freeze(warnings),
    truncated,
  });
}

/** Inspect an imported Three.js scene without mutating nodes, bones or materials. */
export function auditAvatarSecondaryScene(root: unknown): AvatarSecondaryAssetAudit {
  if (!isRecord(root)) return auditAvatarSecondaryAssetDescriptor();
  const stack: unknown[] = [root];
  const visited = new Set<object>();
  const nodes: Array<{ node: SceneNodeLike; parent: SceneNodeLike | null; id: string }> = [];
  let truncated = false;

  while (stack.length > 0) {
    const value = stack.pop();
    if (!isRecord(value) || visited.has(value)) continue;
    visited.add(value);
    if (nodes.length >= MAX_SCENE_NODES) {
      truncated = true;
      break;
    }
    const node = value as SceneNodeLike;
    const id = "scene-node-" + nodes.length;
    const parent = isRecord(node.parent) ? node.parent as SceneNodeLike : null;
    nodes.push({ node, parent, id });
    if (Array.isArray(node.children)) {
      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        stack.push(node.children[index]);
      }
    }
  }

  const idByNode = new Map<object, string>(nodes.map(({ node, id }) => [node as object, id]));
  const bones: AvatarSecondaryBoneDescriptor[] = [];
  const morphNames = new Set<string>();
  const materials: unknown[] = [];
  const materialSet = new Set<unknown>();
  let skinnedMeshCount = 0;
  let morphMeshCount = 0;

  for (const { node, parent, id } of nodes) {
    if (node.isBone === true && typeof node.name === "string") {
      bones.push({
        id,
        name: node.name,
        ...(parent?.isBone === true && idByNode.has(parent as object)
          ? { parentId: idByNode.get(parent as object) }
          : {}),
      });
    }
    if (node.isSkinnedMesh === true) skinnedMeshCount += 1;
    if (isRecord(node.morphTargetDictionary)) {
      const names = Object.keys(node.morphTargetDictionary).slice(0, MAX_AUDIT_MORPHS);
      if (names.length > 0) morphMeshCount += 1;
      for (const name of names) morphNames.add(name);
    }
    const attached = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    for (const material of attached) {
      if (!material || materialSet.has(material)) continue;
      materialSet.add(material);
      materials.push(material);
      if (materials.length >= MAX_AUDIT_MATERIALS) break;
    }
  }

  const report = auditAvatarSecondaryAssetDescriptor({
    bones,
    morphTargetNames: [...morphNames],
    materials: materials as AvatarSecondaryMaterialDescriptor[],
    skinnedMeshCount,
    morphMeshCount,
  });
  if (!truncated) return report;
  return Object.freeze({
    ...report,
    truncated: true,
    warnings: Object.freeze([...report.warnings.filter((warning) => warning !== "asset-audit-limit-reached"), "asset-audit-limit-reached"]),
  });
}
