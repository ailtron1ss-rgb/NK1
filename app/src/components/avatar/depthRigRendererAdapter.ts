import { orderDepthRigNodes, resolveDepthRigWorldPose, validateDepthRig, type DepthRigDefinition, type DepthRigPose } from "./depthRig.ts";

/**
 * Minimal renderer contract. A Three.js Object3D is compatible with this
 * surface, but keeping the adapter structural makes the pose boundary testable
 * without creating a second scene graph or importing a renderer into the rig.
 */
export interface DepthRigLayerTarget {
  matrix: { set(n11: number, n12: number, n13: number, n14: number, n21: number, n22: number, n23: number, n24: number, n31: number, n32: number, n33: number, n34: number, n41: number, n42: number, n43: number, n44: number): unknown };
  matrixAutoUpdate: boolean;
  matrixWorldNeedsUpdate: boolean;
  renderOrder: number;
  visible: boolean;
}

export interface DepthRigLayerBinding {
  nodeId: string;
  target: DepthRigLayerTarget;
  /** Local-space offset from the layer geometry origin to its authored pivot. */
  pivotOffset?: { x: number; y: number };
}

export interface DepthRigRenderResult {
  renderedNodeIds: string[];
  missingNodeIds: string[];
}

const finite = (value: number): boolean => Number.isFinite(value);

/**
 * Apply the canonical rig's composed affine transforms to renderer-owned
 * layer objects. The supplied layer target should be a plane/group whose
 * local geometry origin is known; pivotOffset moves that origin to the
 * artist-authored pivot before the world transform is applied.
 *
 * The matrix is written in Three.js Matrix4.set row-major argument order.
 * Callers retain ownership of textures, geometry, masks and scene lifecycle.
 */
export function applyDepthRigWorldPoseToLayers(
  rig: DepthRigDefinition,
  bindings: readonly DepthRigLayerBinding[],
  pose?: DepthRigPose,
): DepthRigRenderResult {
  const diagnostics = validateDepthRig(rig);
  if (diagnostics.length) throw new Error(`Invalid depth rig: ${diagnostics.map((item) => item.code).join(", ")}`);
  const world = resolveDepthRigWorldPose(rig, pose);
  const nodeIds = new Set(rig.nodes.map((node) => node.id));
  const seen = new Set<string>();
  for (const binding of bindings) {
    if (!binding || !nodeIds.has(binding.nodeId) || seen.has(binding.nodeId) || !binding.target) {
      throw new Error("Invalid or duplicate depth-rig renderer binding");
    }
    if (binding.pivotOffset && (!finite(binding.pivotOffset.x) || !finite(binding.pivotOffset.y))) {
      throw new Error("Invalid depth-rig renderer pivot offset");
    }
    seen.add(binding.nodeId);
  }

  const byId = new Map(bindings.map((binding) => [binding.nodeId, binding]));
  const renderedNodeIds: string[] = [];
  const missingNodeIds: string[] = [];
  for (const node of orderDepthRigNodes(rig)) {
    const binding = byId.get(node.id);
    if (!binding) {
      missingNodeIds.push(node.id);
      continue;
    }
    const transform = world.transforms[node.id];
    if (!transform || ![transform.a, transform.b, transform.c, transform.d, transform.tx, transform.ty, transform.z].every(finite)) {
      throw new Error(`Invalid world matrix for depth-rig node: ${node.id}`);
    }
    const pivot = binding.pivotOffset ?? { x: 0, y: 0 };
    const tx = transform.tx - transform.a * pivot.x - transform.c * pivot.y;
    const ty = transform.ty - transform.b * pivot.x - transform.d * pivot.y;
    binding.target.matrixAutoUpdate = false;
    binding.target.matrixWorldNeedsUpdate = true;
    binding.target.renderOrder = node.depthOrder;
    binding.target.visible = true;
    binding.target.matrix.set(
      transform.a, transform.c, 0, tx,
      transform.b, transform.d, 0, ty,
      0, 0, 1, transform.z,
      0, 0, 0, 1,
    );
    renderedNodeIds.push(node.id);
  }
  return { renderedNodeIds, missingNodeIds };
}
