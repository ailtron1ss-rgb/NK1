import * as THREE from "three";
import type { DepthRigTransform } from "./depthRig";

export interface DepthRigApplyResult {
  ok: boolean;
  applied: number;
  errors: string[];
}

type NodeSnapshot = {
  node: any;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  visible: boolean;
  renderOrder: number;
};

const READBACK_EPSILON = 1e-5;
const close = (actual: number, expected: number) =>
  Number.isFinite(actual) && Math.abs(actual - expected) <= READBACK_EPSILON;

/**
 * Apply validated semantic transforms to an imported Three.js hierarchy.
 * Object3D.name must match the manifest node id. The operation is atomic:
 * imported nodes are resolved before mutation, then local Object3D transforms
 * are read back after matrix updates. A failed postcondition restores the
 * complete pre-apply local pose instead of leaving a partially moved rig.
 */
export function applyDepthRigTransforms(
  root: any,
  transforms: readonly DepthRigTransform[],
  expectedParents?: readonly { id: string; parentId: string | null }[],
): DepthRigApplyResult {
  const byName = new Map<string, any>();
  const duplicates = new Set<string>();
  root.traverse((node: any) => {
    if (!node.name) return;
    if (byName.has(node.name)) duplicates.add(node.name);
    else byName.set(node.name, node);
  });

  const errors: string[] = [];
  for (const name of duplicates) if (transforms.some((transform) => transform.id === name)) errors.push(`duplicate-scene-node:${name}`);
  const seen = new Set<string>();
  for (const transform of transforms) {
    if (seen.has(transform.id)) errors.push(`duplicate-transform:${transform.id}`);
    seen.add(transform.id);
    if (!byName.has(transform.id)) errors.push(`missing-scene-node:${transform.id}`);
  }
  if (expectedParents) {
    for (const expected of expectedParents) {
      if (!expected.parentId) continue; // the manifest root may sit under the importer/container wrapper
      const node = byName.get(expected.id);
      if (node && node.parent?.name !== expected.parentId) errors.push("parent-mismatch:" + expected.id);
    }
  }
  if (errors.length) return { ok: false, applied: 0, errors };

  const snapshots: NodeSnapshot[] = transforms.map((transform) => {
    const node = byName.get(transform.id)!;
    return {
      node,
      position: node.position.toArray() as [number, number, number],
      rotation: [node.rotation.x, node.rotation.y, node.rotation.z],
      scale: node.scale.toArray() as [number, number, number],
      visible: node.visible,
      renderOrder: node.renderOrder,
    };
  });

  const restore = () => {
    for (const snapshot of snapshots) {
      snapshot.node.position.set(...snapshot.position);
      snapshot.node.rotation.set(...snapshot.rotation);
      snapshot.node.scale.set(...snapshot.scale);
      snapshot.node.visible = snapshot.visible;
      snapshot.node.renderOrder = snapshot.renderOrder;
      snapshot.node.updateMatrix();
    }
    root.updateMatrixWorld?.(true);
  };

  try {
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
    root.updateMatrixWorld?.(true);

    for (const transform of transforms) {
      const node = byName.get(transform.id)!;
      const pivot = new THREE.Vector3(transform.pivot[0], transform.pivot[1], 0);
      const transformedPivot = pivot.clone().applyEuler(node.rotation).multiply(node.scale);
      const expectedPosition = new THREE.Vector3(...transform.position).add(pivot).sub(transformedPivot);
      const verified =
        close(node.position.x, expectedPosition.x) &&
        close(node.position.y, expectedPosition.y) &&
        close(node.position.z, expectedPosition.z) &&
        close(node.rotation.x, transform.rotation[0]) &&
        close(node.rotation.y, transform.rotation[1]) &&
        close(node.rotation.z, transform.rotation[2]) &&
        close(node.scale.x, transform.scale[0]) &&
        close(node.scale.y, transform.scale[1]) &&
        close(node.scale.z, transform.scale[2]) &&
        node.visible === transform.visible &&
        node.renderOrder === transform.renderOrder;
      if (!verified) {
        restore();
        return { ok: false, applied: 0, errors: [`postcondition-mismatch:${transform.id}`] };
      }
    }
  } catch (error) {
    try { restore(); } catch { /* retain the original apply failure */ }
    const detail = error instanceof Error ? error.message.slice(0, 160) : "unknown";
    return { ok: false, applied: 0, errors: [`apply-failed:${detail}`] };
  }

  return { ok: true, applied: transforms.length, errors: [] };
}
