import * as THREE from "three";
import type { Box3 } from "three";

export interface AvatarModelFitBounds {
  bounds: Box3;
  source: "skinned-meshes" | "character-meshes";
  includedMeshes: number;
  excludedEnvironmentMeshes: number;
}

const ENVIRONMENT_NAME = /(^|_)(?:env_)?(?:floor|ground|background|backdrop|stagefloor)(?:_|$)/;

function isFiniteBox(bounds: Box3): boolean {
  if (bounds.isEmpty()) return false;
  return [
    bounds.min.x, bounds.min.y, bounds.min.z,
    bounds.max.x, bounds.max.y, bounds.max.z,
  ].every(Number.isFinite);
}

function isEnvironmentMesh(node: any, bounds: Box3): boolean {
  const normalizedName = String(node.name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  if (ENVIRONMENT_NAME.test(normalizedName)) return true;

  // Generic fallback for unnamed/poorly named giant floor or backdrop planes.
  // A character surface is not hundreds of metres wide with almost no thickness.
  const size = new THREE.Vector3();
  bounds.getSize(size);
  const largest = Math.max(size.x, size.y, size.z);
  const smallest = Math.min(size.x, size.y, size.z);
  return largest > 10 && smallest < 0.01;
}

/**
 * Resolve character-only fit bounds so room floors, stages, cameras and lights
 * cannot shrink a rigged avatar to a dot. Prefer skinned meshes when available;
 * static/VRM-less assets fall back to visible character meshes.
 */
export function resolveAvatarModelFitBounds(root: any): AvatarModelFitBounds {
  if (!root || typeof root.traverse !== "function") {
    throw new Error("Avatar model has no usable character mesh bounds.");
  }

  root.updateMatrixWorld?.(true);
  const skinnedMeshes: any[] = [];
  const characterMeshes: any[] = [];
  let excludedEnvironmentMeshes = 0;

  root.traverse((node: any) => {
    if (!node?.isMesh || !node.geometry || node.visible === false) return;

    const bounds = new THREE.Box3().setFromObject(node);
    if (!isFiniteBox(bounds)) return;
    if (isEnvironmentMesh(node, bounds)) {
      excludedEnvironmentMeshes += 1;
      return;
    }

    if (node.isSkinnedMesh) skinnedMeshes.push(node);
    characterMeshes.push(node);
  });

  const source = skinnedMeshes.length > 0 ? "skinned-meshes" : "character-meshes";
  const included = skinnedMeshes.length > 0 ? skinnedMeshes : characterMeshes;
  const bounds = new THREE.Box3();

  for (const node of included) {
    bounds.union(new THREE.Box3().setFromObject(node));
  }

  if (!isFiniteBox(bounds)) {
    throw new Error("Avatar model has no usable character mesh bounds.");
  }

  return {
    bounds,
    source,
    includedMeshes: included.length,
    excludedEnvironmentMeshes,
  };
}
