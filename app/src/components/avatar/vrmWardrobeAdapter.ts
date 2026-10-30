import type { WardrobeSwitchPlan } from "./wardrobePack.ts";

type BoneLike = { name?: string; isBone?: boolean; userData?: Record<string, unknown>; parent?: unknown };
type SkeletonLike = { bones: BoneLike[]; boneInverses: unknown[]; constructor: new (bones: BoneLike[], inverses: unknown[]) => unknown };
type SkinnedMeshLike = {
  isSkinnedMesh?: boolean;
  name?: string;
  skeleton: SkeletonLike;
  bindMatrix: unknown;
  bind: (skeleton: unknown, bindMatrix: unknown) => void;
  clone: (recursive?: boolean) => SkinnedMeshLike;
  userData?: Record<string, unknown>;
};
type ObjectNode = {
  name?: string;
  children?: ObjectNode[];
  userData?: Record<string, unknown>;
  isSkinnedMesh?: boolean;
  isBone?: boolean;
  skeleton?: SkeletonLike;
  bindMatrix?: unknown;
  bind?: (skeleton: unknown, bindMatrix: unknown) => void;
  clone?: (recursive?: boolean) => ObjectNode;
  add?: (child: ObjectNode) => void;
  remove?: (child: ObjectNode) => void;
  traverse?: (callback: (node: ObjectNode) => void) => void;
  visible?: boolean;
};

export interface VrmGarmentRigInspection {
  compatible: boolean;
  garmentMeshCount: number;
  mappedBoneCount: number;
  mappings: Array<{ sourceName: string; targetName: string }>;
  errors: string[];
}
export interface VrmGarmentAttachmentResult {
  applied: boolean;
  garmentRoot: ObjectNode | null;
  replaced: number;
  errors: string[];
}

const normalizeBoneName = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]/g, "");

function bindPoseMatches(source: unknown, target: unknown): boolean {
  const sourceElements = (source as { elements?: unknown })?.elements;
  const targetElements = (target as { elements?: unknown })?.elements;
  if (Array.isArray(sourceElements) && Array.isArray(targetElements)) {
    return sourceElements.length === targetElements.length &&
      sourceElements.every((value, index) =>
        typeof value === "number" && typeof targetElements[index] === "number" &&
        Math.abs(value - (targetElements[index] as number)) <= 1e-4);
  }
  const sourceBone = (source as { bone?: unknown })?.bone;
  const targetBone = (target as { bone?: unknown })?.bone;
  return typeof sourceBone === "string" && typeof targetBone === "string" &&
    normalizeBoneName(sourceBone) === normalizeBoneName(targetBone);
}

function visit(root: ObjectNode, callback: (node: ObjectNode) => void): void {
  if (typeof root.traverse === "function") root.traverse(callback);
  else {
    const walk = (node: ObjectNode): void => {
      callback(node);
      for (const child of node.children ?? []) walk(child);
    };
    walk(root);
  }
}

/** Wardrobe roots carry their own skinned bones; they must never redefine the avatar's target rig. */
function visitBaseAvatarRig(root: ObjectNode, callback: (node: ObjectNode) => void): void {
  const walk = (node: ObjectNode, isRoot: boolean): void => {
    if (!isRoot && (
      node.userData?.nk1WardrobeSlot !== undefined ||
      node.userData?.nk1WardrobeAssetId !== undefined
    )) return;
    callback(node);
    for (const child of node.children ?? []) walk(child, false);
  };
  walk(root, true);
}

/** Stable base-body descriptors, intentionally excluding already attached wardrobe subtrees. */
export function collectVrmAvatarRigIdentityDescriptors(root: ObjectNode): string[] {
  const descriptors: string[] = [];
  visitBaseAvatarRig(root, (node) => {
    if (!node.isBone && node.constructor?.name !== "Bone") return;
    const ancestry: string[] = [];
    let current: any = node;
    while (current && current !== root) {
      const name = normalizeBoneName(String(current.name ?? ""));
      if (name) ancestry.push(name);
      current = current.parent;
    }
    if (ancestry.length) descriptors.push(ancestry.reverse().join("/"));
  });
  return descriptors.sort();
}

/**
 * Inspect a garment against the actual loaded avatar skeleton.
 * Matching is by normalized, unique bone names; partial rigs fail closed.
 */
export function inspectVrmGarmentRig(
  garmentRoot: ObjectNode,
  avatarRoot: ObjectNode,
): VrmGarmentRigInspection {
  const errors: string[] = [];
  const avatarBones = new Map<string, BoneLike>();
  const duplicateTargetBones = new Set<string>();
  const targetInverses = new Map<string, unknown>();
  visitBaseAvatarRig(avatarRoot, (node) => {
    if (!node.isBone && node.constructor?.name !== "Bone") return;
    const name = normalizeBoneName(String(node.name ?? ""));
    if (!name) return;
    if (avatarBones.has(name)) duplicateTargetBones.add(name);
    else avatarBones.set(name, node as BoneLike);
  });
  visitBaseAvatarRig(avatarRoot, (node) => {
    const skeleton = node.isSkinnedMesh ? node.skeleton as SkeletonLike | undefined : undefined;
    if (!skeleton) return;
    skeleton.bones.forEach((bone, index) => {
      const name = normalizeBoneName(String(bone.name ?? ""));
      const inverse = skeleton.boneInverses[index];
      if (name && inverse !== undefined && !targetInverses.has(name)) targetInverses.set(name, inverse);
    });
  });
  if (duplicateTargetBones.size) {
    errors.push(...[...duplicateTargetBones].map((name) => `avatar-duplicate-bone:${name}`));
  }

  const garmentMeshes: SkinnedMeshLike[] = [];
  visit(garmentRoot, (node) => {
    if (node.isSkinnedMesh && node.skeleton && typeof node.bind === "function") {
      garmentMeshes.push(node as unknown as SkinnedMeshLike);
    }
  });
  if (!garmentMeshes.length) errors.push("garment-has-no-skinned-meshes");

  const mappings = new Map<string, BoneLike>();
  for (const mesh of garmentMeshes) {
    const sourceBones = mesh.skeleton.bones;
    if (!sourceBones.length) errors.push(`empty-garment-skeleton:${mesh.name ?? "unnamed"}`);
    for (const sourceBone of sourceBones) {
      const name = normalizeBoneName(String(sourceBone.name ?? ""));
      if (!name) {
        errors.push(`unnamed-garment-bone:${mesh.name ?? "unnamed"}`);
        continue;
      }
      const targetBone = avatarBones.get(name);
      const targetInverse = targetInverses.get(name);
      const sourceIndex = sourceBones.indexOf(sourceBone);
      const sourceInverse = mesh.skeleton.boneInverses[sourceIndex];
      if (!targetBone) errors.push(`missing-avatar-bone:${name}`);
      else if (targetInverse === undefined || sourceInverse === undefined) errors.push(`missing-bind-inverse:${name}`);
      else if (!bindPoseMatches(sourceInverse, targetInverse)) errors.push(`bind-pose-mismatch:${name}`);
      else mappings.set(name, targetBone);
    }
  }
  return {
    compatible: errors.length === 0,
    garmentMeshCount: garmentMeshes.length,
    mappedBoneCount: mappings.size,
    mappings: [...mappings].map(([sourceName, target]) => ({
      sourceName,
      targetName: String(target.name ?? ""),
    })),
    errors: [...new Set(errors)],
  };
}

/**
 * Attach a garment only after the byte-verification/switch-plan gate.
 * All skeletons are remapped before the live avatar is modified; a failed
 * remap leaves the current outfit untouched. Garment roots are tagged by slot
 * so a successful replacement can hide the previous garment atomically.
 */
export function attachVerifiedVrmGarment(input: {
  garmentRoot: ObjectNode;
  avatarRoot: ObjectNode;
  slot: string;
  assetId: string;
  plan: WardrobeSwitchPlan;
}): VrmGarmentAttachmentResult {
  const { garmentRoot, avatarRoot, slot, assetId, plan } = input;
  if (plan.status !== "ready" || !plan.expectedAssetIds.includes(assetId)) {
    return { applied: false, garmentRoot: null, replaced: 0, errors: ["wardrobe-plan-not-authorized-for-asset"] };
  }
  if (!slot || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(slot)) {
    return { applied: false, garmentRoot: null, replaced: 0, errors: ["invalid-wardrobe-slot"] };
  }
  const inspection = inspectVrmGarmentRig(garmentRoot, avatarRoot);
  if (!inspection.compatible) {
    return { applied: false, garmentRoot: null, replaced: 0, errors: inspection.errors };
  }
  if (typeof garmentRoot.clone !== "function" || typeof avatarRoot.add !== "function") {
    return { applied: false, garmentRoot: null, replaced: 0, errors: ["renderer-object-cannot-be-cloned-or-attached"] };
  }

  const clone = garmentRoot.clone(true);
  const targetBones = new Map<string, BoneLike>();
  const targetInverses = new Map<string, unknown>();
  visitBaseAvatarRig(avatarRoot, (node) => {
    const skeleton = node.isSkinnedMesh ? node.skeleton as SkeletonLike | undefined : undefined;
    if (skeleton) skeleton.bones.forEach((bone, index) => {
      const key = normalizeBoneName(String(bone.name ?? ""));
      const inverse = skeleton.boneInverses[index];
      if (key && inverse !== undefined && !targetInverses.has(key)) targetInverses.set(key, inverse);
    });
  });
  visitBaseAvatarRig(avatarRoot, (node) => {
    if (node.isBone || node.constructor?.name === "Bone") {
      const key = normalizeBoneName(String(node.name ?? ""));
      if (key && !targetBones.has(key)) targetBones.set(key, node as BoneLike);
    }
  });
  const meshes: SkinnedMeshLike[] = [];
  visit(clone, (node) => {
    if (node.isSkinnedMesh && node.skeleton && typeof node.bind === "function") {
      meshes.push(node as unknown as SkinnedMeshLike);
    }
  });

  const previous: Array<{ node: ObjectNode; visible: boolean | undefined; userData: Record<string, unknown> }> = [];
  visit(avatarRoot, (node) => {
    if (node !== clone && node.userData?.nk1WardrobeSlot === slot) {
      previous.push({ node, visible: node.visible, userData: { ...(node.userData ?? {}) } });
    }
  });

  try {
    for (const mesh of meshes) {
      const mappedBones = mesh.skeleton.bones.map((bone) => {
        const target = targetBones.get(normalizeBoneName(String(bone.name ?? "")));
        if (!target) throw new Error(`missing-avatar-bone:${normalizeBoneName(String(bone.name ?? ""))}`);
        return target;
      });
      const inverses = mappedBones.map((bone) => {
        const inverse = targetInverses.get(normalizeBoneName(String(bone.name ?? "")));
        if (inverse === undefined) throw new Error(`missing-bind-inverse:${normalizeBoneName(String(bone.name ?? ""))}`);
        return inverse;
      });
      const remapped = new mesh.skeleton.constructor(mappedBones, inverses);
      mesh.bind(remapped, mesh.bindMatrix);
    }
    clone.userData = { ...(clone.userData ?? {}), nk1WardrobeSlot: slot, nk1WardrobeAssetId: assetId };
    avatarRoot.add(clone);
    for (const old of previous) {
      old.node.visible = false;
      old.node.userData = { ...(old.node.userData ?? {}), nk1WardrobeReplaced: true };
    }
    return { applied: true, garmentRoot: clone, replaced: previous.length, errors: [] };
  } catch (error) {
    avatarRoot.remove?.(clone);
    for (const snapshot of previous) {
      snapshot.node.visible = snapshot.visible;
      snapshot.node.userData = { ...snapshot.userData };
    }
    return {
      applied: false,
      garmentRoot: null,
      replaced: 0,
      errors: [error instanceof Error ? error.message : "garment-skeleton-remap-failed"],
    };
  }
}
