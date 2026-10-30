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
  visit(avatarRoot, (node) => {
    if (!node.isBone && node.constructor?.name !== "Bone") return;
    const name = normalizeBoneName(String(node.name ?? ""));
    if (!name) return;
    if (avatarBones.has(name)) duplicateTargetBones.add(name);
    else avatarBones.set(name, node as BoneLike);
  });
  visit(avatarRoot, (node) => {
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
      if (!targetBone) errors.push(`missing-avatar-bone:${name}`);
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
  visit(avatarRoot, (node) => {
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
    const previous: ObjectNode[] = [];
    visit(avatarRoot, (node) => {
      if (node !== clone && node.userData?.nk1WardrobeSlot === slot) previous.push(node);
    });
    avatarRoot.add(clone);
    for (const old of previous) {
      old.visible = false;
      old.userData = { ...(old.userData ?? {}), nk1WardrobeReplaced: true };
    }
    return { applied: true, garmentRoot: clone, replaced: previous.length, errors: [] };
  } catch (error) {
    return {
      applied: false,
      garmentRoot: null,
      replaced: 0,
      errors: [error instanceof Error ? error.message : "garment-skeleton-remap-failed"],
    };
  }
}
