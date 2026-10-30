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

  const bounds = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  bounds.getSize(size);
  const height = Number.isFinite(size.y) && size.y > 1e-5 ? size.y : 1;

  return {
    roleToNode,
    restLocalRotation,
    restWorldRotation,
    boneLength,
    height,
  };
}
