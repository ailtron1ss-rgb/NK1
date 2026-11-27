import { Box3 } from "three";

type AvatarSceneMesh = {
  name: string;
  isMesh?: boolean;
  visible?: boolean;
  userData?: Record<string, unknown>;
};

type AvatarSceneRoot = {
  updateWorldMatrix(updateParents: boolean, updateChildren: boolean): void;
  traverse(callback: (node: AvatarSceneMesh) => void): void;
};

const createEmptyBounds = () => new Box3();
type AvatarBounds = ReturnType<typeof createEmptyBounds>;

/**
 * Studio/environment meshes are export helpers, not part of the avatar.
 * In particular, a large ENV_floor can otherwise dominate normalization
 * bounds and collapse a human-sized skinned character to a few pixels.
 */
export function isAvatarEnvironmentMesh(node: AvatarSceneMesh): boolean {
  if (node.isMesh !== true) return false;
  return node.userData?.nk1ExcludeFromAvatarBounds === true
    || /^ENV_/i.test(node.name.trim());
}

export interface AvatarSceneBoundsResult {
  bounds: AvatarBounds;
  excludedEnvironmentMeshes: string[];
}

/**
 * Hide environment-only mesh helpers and calculate a pose-aware world-space
 * bounding box from visible character meshes only. SkinnedMesh vertices are
 * sampled precisely through Box3.expandByObject(..., true).
 */
export function resolveAvatarSceneBounds(root: AvatarSceneRoot): AvatarSceneBoundsResult {
  root.updateWorldMatrix(true, true);
  const bounds = createEmptyBounds();
  const excludedEnvironmentMeshes: string[] = [];

  root.traverse((node) => {
    if (isAvatarEnvironmentMesh(node)) {
      node.visible = false;
      excludedEnvironmentMeshes.push(node.name.trim() || "(unnamed environment mesh)");
      return;
    }
    if (node.isMesh !== true || node.visible === false) return;
    bounds.expandByObject(node, true);
  });

  return { bounds, excludedEnvironmentMeshes };
}
