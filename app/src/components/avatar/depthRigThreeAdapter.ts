import * as THREE from "three";
import type { DepthRigTransform } from "./depthRig";

export interface DepthRigApplyResult {
  ok: boolean;
  applied: number;
  errors: string[];
}

/**
 * Apply validated semantic transforms to an imported Three.js hierarchy.
 * Object3D.name must match the manifest node id. The operation is atomic:
 * ambiguous or missing names are reported before any scene node is mutated.
 */
export function applyDepthRigTransforms(
  root: any,
  transforms: readonly DepthRigTransform[],
): DepthRigApplyResult {
  const byName = new Map<string, any>();
  const duplicates = new Set<string>();
  root.traverse((node: any) => {
    if (!node.name) return;
    if (byName.has(node.name)) duplicates.add(node.name);
    else byName.set(node.name, node);
  });

  const errors: string[] = [];
  for (const name of duplicates) errors.push(`duplicate-scene-node:${name}`);
  const seen = new Set<string>();
  for (const transform of transforms) {
    if (seen.has(transform.id)) errors.push(`duplicate-transform:${transform.id}`);
    seen.add(transform.id);
    if (!byName.has(transform.id)) errors.push(`missing-scene-node:${transform.id}`);
  }
  if (errors.length) return { ok: false, applied: 0, errors };

  for (const transform of transforms) {
    const node = byName.get(transform.id)!;
    node.rotation.set(...transform.rotation);
    node.scale.set(...transform.scale);
    const pivot = new THREE.Vector3(transform.pivot[0], transform.pivot[1], 0);
    const transformedPivot = pivot.clone().applyEuler(node.rotation).multiply(node.scale);
    node.position.set(...transform.position).add(pivot).sub(transformedPivot);
    node.visible = transform.visible;
    node.renderOrder = transform.renderOrder;
    node.updateMatrix();
  }
  return { ok: true, applied: transforms.length, errors: [] };
}
