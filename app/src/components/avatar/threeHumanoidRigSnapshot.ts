import * as THREE from "three";
import type { HumanoidRigProfileInput, HumanoidRole, Quat } from "./humanoidRetarget";

export interface HumanoidBoneNode {
  node: THREE.Object3D;
  name: HumanoidRole;
}

/**
 * Capture semantic rest transforms from a loaded Three.js rig.
 *
 * Both source and target must be sampled against the same frameRoot (normally
 * the avatar stage scene). World rotations are expressed relative to that
 * frame, not relative to each model's independently transformed GLTF root.
 * Call this before playing any animation and after updateMatrixWorld(true).
 */
export function captureHumanoidRigSnapshot(
  root: THREE.Object3D,
  bones: readonly HumanoidBoneNode[],
  frameRoot: THREE.Object3D = root,
): HumanoidRigProfileInput {
  root.updateMatrixWorld(true);
  frameRoot.updateMatrixWorld(true);

  const frameWorld = new THREE.Quaternion();
  frameRoot.getWorldQuaternion(frameWorld);
  const inverseFrameWorld = frameWorld.clone().invert();

  const roleToNode = new Map<HumanoidRole, number>();
  const restLocalRotation = new Map<HumanoidRole, Quat>();
  const restWorldRotation = new Map<HumanoidRole, Quat>();
  const boneLength = new Map<HumanoidRole, number>();
  const seenNodes = new Set<THREE.Object3D>();

  bones.forEach(({ node, name }, index) => {
    if (!node || !name || seenNodes.has(node) || roleToNode.has(name)) return;
    seenNodes.add(node);

    const local = node.quaternion.clone().normalize();
    const world = new THREE.Quaternion();
    node.getWorldQuaternion(world);
    world.premultiply(inverseFrameWorld).normalize();

    roleToNode.set(name, index);
    restLocalRotation.set(name, [local.x, local.y, local.z, local.w]);
    restWorldRotation.set(name, [world.x, world.y, world.z, world.w]);

    const child = node.children.find((candidate) => candidate instanceof THREE.Bone);
    if (child) {
      const length = child.position.length();
      if (Number.isFinite(length) && length > 1e-5) boneLength.set(name, length);
    }
  });

  // Measure height in the rig root's local up-axis, not world AABB Y.
  // A rotated avatar must not appear artificially shorter to the retarget scaler.
  const inverseRootWorld = root.matrixWorld.clone().invert();
  const localBounds = new THREE.Box3();
  const nodeToRoot = new THREE.Matrix4();
  root.traverse((candidate) => {
    const geometry = (candidate as THREE.Mesh).geometry;
    if (!(candidate as THREE.Mesh).isMesh || !geometry) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    nodeToRoot.copy(inverseRootWorld).multiply(candidate.matrixWorld);
    const box = geometry.boundingBox;
    for (let mask = 0; mask < 8; mask += 1) {
      const corner = new THREE.Vector3(
        mask & 1 ? box.max.x : box.min.x,
        mask & 2 ? box.max.y : box.min.y,
        mask & 4 ? box.max.z : box.min.z,
      );
      localBounds.expandByPoint(corner.applyMatrix4(nodeToRoot));
    }
  });
  let minBoneY = 0;
  let maxBoneY = 0;
  const worldPosition = new THREE.Vector3();
  for (const { node } of bones) {
    if (!node) continue;
    node.getWorldPosition(worldPosition);
    root.worldToLocal(worldPosition);
    minBoneY = Math.min(minBoneY, worldPosition.y);
    maxBoneY = Math.max(maxBoneY, worldPosition.y);
  }
  const minY = Math.min(minBoneY, localBounds.isEmpty() ? 0 : localBounds.min.y);
  const maxY = Math.max(maxBoneY, localBounds.isEmpty() ? 0 : localBounds.max.y);
  const measuredHeight = maxY - minY;
  const height = Number.isFinite(measuredHeight) && measuredHeight > 1e-5 ? measuredHeight : 1;

  return {
    roleToNode,
    restLocalRotation,
    restWorldRotation,
    boneLength,
    height,
  };
}
