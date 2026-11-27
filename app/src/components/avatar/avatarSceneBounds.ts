import { Box3 } from "three";
import type { Object3D } from "three";

type AvatarSceneMesh = Object3D & {
  isMesh?: boolean;
};

/**
 * Studio/environment meshes are export helpers, not part of the avatar.
 * In particular, a large ENV_floor can otherwise dominate normalization
 * bounds and collapse a human-sized skinned character to a few pixels.
 */
export function isAvatarEnvironmentMesh(node: Object3D): boolean {
  const mesh = node as AvatarSceneMesh;
  if (mesh.isMesh !== true) return false;
  return mesh.userData?.nk1ExcludeFromAvatarBounds === true
    || /^ENV_/i.test(mesh.name.trim());
}

export interface AvatarSceneBoundsResult {
  bounds: Box3;
  excludedEnvironmentMeshes: string[];
}

/**
 * Hide environment-only mesh helpers and calculate a pose-aware world-space
 * bounding box from visible character meshes only. SkinnedMesh vertices are
 * sampled precisely through Box3.expandByObject(..., true).
 */
export function resolveAvatarSceneBounds(root: Object3D): AvatarSceneBoundsResult {
  root.updateWorldMatrix(true, true);
  const bounds = new Box3();
  const excludedEnvironmentMeshes: string[] = [];

  root.traverse((node) => {
    const mesh = node as AvatarSceneMesh;
    if (isAvatarEnvironmentMesh(node)) {
      mesh.visible = false;
      excludedEnvironmentMeshes.push(mesh.name.trim() || "(unnamed environment mesh)");
      return;
    }
    if (mesh.isMesh !== true || mesh.visible === false) return;
    bounds.expandByObject(mesh, true);
  });

  return { bounds, excludedEnvironmentMeshes };
}
