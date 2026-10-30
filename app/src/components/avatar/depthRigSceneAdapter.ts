import {
  orderDepthRigNodes,
  resolveDepthRigWorldPose,
  validateDepthRig,
  type DepthRigDefinition,
  type DepthRigPose,
  type DepthRigTransform,
} from "./depthRig";

export const NK1_DEPTH_RIG_ASSET_USER_DATA_KEY = "nk1DepthRigAssetV1";
export const NK1_DEPTH_RIG_SCENE_ADAPTER_ID = "nk1-depth-rig-scene-v1";

export interface DepthRigSceneAssetV1 {
  schemaVersion: 1;
  rig: DepthRigDefinition;
  /**
   * Scene-space authoring canvas. The origin is the canvas centre;
   * positive rest.y points down in the source artwork.
   */
  artwork: { width: number; height: number; units: "scene"; origin: "center" };
  /** Exact glTF object-name binding and local plane dimensions for every rig node. */
  layers: readonly { nodeId: string; objectName: string; width: number; height: number }[];
}

export interface DepthRigSceneNodeLike {
  name?: string;
  parent?: DepthRigSceneNodeLike | null;
  children?: readonly DepthRigSceneNodeLike[];
  position: { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown };
  rotation: { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown };
  scale: { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown };
  visible: boolean;
  renderOrder: number;
  matrixAutoUpdate?: boolean;
  matrixWorldNeedsUpdate?: boolean;
  matrix?: { clone?(): unknown; copy?(value: unknown): unknown };
  updateMatrix?(): void;
  updateMatrixWorld?(force?: boolean): void;
  updateWorldMatrix?(updateParents: boolean, updateChildren: boolean): void;
  traverse?(callback: (node: DepthRigSceneNodeLike) => void): void;
}

export interface PreparedDepthRigSceneV1 {
  readonly root: DepthRigSceneNodeLike;
  readonly asset: DepthRigSceneAssetV1;
  readonly bindings: ReadonlyMap<string, DepthRigSceneNodeLike>;
}

export interface DepthRigScenePreparation {
  ok: boolean;
  prepared?: PreparedDepthRigSceneV1;
  errors: string[];
}

export interface DepthRigSceneApplyReceipt {
  adapterId: typeof NK1_DEPTH_RIG_SCENE_ADAPTER_ID;
  executionId: string;
  stateRevision: number;
  rigId: string;
  appliedNodeIds: string[];
  readbackNodeIds: string[];
  verified: true;
  /** Scene-graph readback is not proof that a GPU frame was presented. */
  presentedFrameVerified: false;
}

export interface DepthRigSceneApplyResult {
  status: "applied" | "rejected" | "rolled-back";
  receipt?: DepthRigSceneApplyReceipt;
  errors: string[];
}

interface SceneNodeSnapshot {
  node: DepthRigSceneNodeLike;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  visible: boolean;
  renderOrder: number;
  matrixAutoUpdate: boolean | undefined;
  matrix: unknown;
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const close = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-6;
const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
};
const own = (value: object, key: string): boolean => Object.hasOwn(value, key);
const finitePositive = (value: unknown, max: number): value is number =>
  finite(value) && value > 0 && value <= max;

export function validateDepthRigSceneAssetV1(value: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isPlainRecord(value)) return { ok: false, errors: ["asset-not-plain-record"] };
  if (value.schemaVersion !== 1) errors.push("unsupported-asset-schema-version");
  if (!isPlainRecord(value.rig)) errors.push("rig-not-plain-record");
  if (!isPlainRecord(value.artwork)) errors.push("artwork-not-plain-record");
  if (!Array.isArray(value.layers) || value.layers.length === 0 || value.layers.length > 128) {
    errors.push("layer-count-out-of-range");
  }

  if (isPlainRecord(value.artwork)) {
    if (!finitePositive(value.artwork.width, 1000)) errors.push("invalid-artwork-width");
    if (!finitePositive(value.artwork.height, 1000)) errors.push("invalid-artwork-height");
    if (value.artwork.units !== "scene") errors.push("unsupported-artwork-units");
    if (value.artwork.origin !== "center") errors.push("unsupported-artwork-origin");
  }

  if (!isPlainRecord(value.rig)) return { ok: false, errors: [...errors, "invalid-rig"] };
  const rig = value.rig as unknown as DepthRigDefinition;
  if (!Array.isArray(rig.nodes) || rig.nodes.some((node, index) => !own(rig.nodes, String(index)) || !isPlainRecord(node))) {
    errors.push("rig-nodes-must-be-dense-plain-records");
  } else {
    for (const node of rig.nodes as readonly unknown[]) {
      if (!isPlainRecord(node)) continue;
      if (!isPlainRecord(node.pivot) || !isPlainRecord(node.rest)) errors.push("rig-node-transform-must-be-plain-record");
    }
    errors.push(...validateDepthRig(rig).map((entry) => entry.code + (entry.nodeId ? ":" + entry.nodeId : "")));
  }

  if (Array.isArray(value.layers)) {
    const nodeIds = new Set<string>();
    const objectNames = new Set<string>();
    for (let index = 0; index < value.layers.length; index += 1) {
      if (!own(value.layers, String(index)) || !isPlainRecord(value.layers[index])) {
        errors.push("invalid-layer-record:" + index);
        continue;
      }
      const layer = value.layers[index] as Record<string, unknown>;
      if (typeof layer.nodeId !== "string" || !layer.nodeId.trim() || layer.nodeId.length > 64) {
        errors.push("invalid-layer-node-id:" + index);
      } else if (nodeIds.has(layer.nodeId)) {
        errors.push("duplicate-layer-node-id:" + layer.nodeId);
      } else {
        nodeIds.add(layer.nodeId);
      }
      if (typeof layer.objectName !== "string" || !layer.objectName.trim() || layer.objectName.length > 128) {
        errors.push("invalid-layer-object-name:" + index);
      } else if (objectNames.has(layer.objectName)) {
        errors.push("duplicate-layer-object-name:" + layer.objectName);
      } else {
        objectNames.add(layer.objectName);
      }
      if (!finitePositive(layer.width, 1000)) errors.push("invalid-layer-width:" + index);
      if (!finitePositive(layer.height, 1000)) errors.push("invalid-layer-height:" + index);
    }

    if (Array.isArray(rig.nodes)) {
      const rigIds = new Set(rig.nodes.filter((node) => isPlainRecord(node) && typeof node.id === "string").map((node) => node.id as string));
      for (const id of rigIds) if (!nodeIds.has(id)) errors.push("missing-layer-binding:" + id);
      for (const id of nodeIds) if (!rigIds.has(id)) errors.push("unknown-layer-binding:" + id);
      if (nodeIds.size !== rig.nodes.length) errors.push("layer-binding-count-mismatch");
    }
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function collectSceneNodes(root: DepthRigSceneNodeLike): DepthRigSceneNodeLike[] {
  const nodes: DepthRigSceneNodeLike[] = [];
  if (typeof root.traverse === "function") {
    root.traverse((node) => nodes.push(node));
    return nodes;
  }
  const seen = new Set<DepthRigSceneNodeLike>();
  const visit = (node: DepthRigSceneNodeLike, depth: number): void => {
    if (depth > 128 || seen.has(node)) throw new Error("scene-hierarchy-cycle-or-depth-limit");
    seen.add(node);
    nodes.push(node);
    for (const child of node.children ?? []) visit(child, depth + 1);
  };
  visit(root, 0);
  return nodes;
}

/** Validate exact object names and parent links once, before the rig enters the live renderer. */
export function prepareDepthRigSceneV1(root: DepthRigSceneNodeLike, rawAsset: unknown): DepthRigScenePreparation {
  const validation = validateDepthRigSceneAssetV1(rawAsset);
  if (!validation.ok) return { ok: false, errors: validation.errors };
  if (!isPlainRecord(rawAsset)) return { ok: false, errors: ["asset-not-plain-record"] };

  let sceneNodes: DepthRigSceneNodeLike[];
  try {
    sceneNodes = collectSceneNodes(root);
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : "scene-traversal-failed"] };
  }

  const named = new Map<string, DepthRigSceneNodeLike[]>();
  for (const node of sceneNodes) {
    if (typeof node.name !== "string" || node.name.length === 0) continue;
    const current = named.get(node.name) ?? [];
    current.push(node);
    named.set(node.name, current);
  }

  const asset = rawAsset as unknown as DepthRigSceneAssetV1;
  const bindings = new Map<string, DepthRigSceneNodeLike>();
  const errors: string[] = [];
  // Resolve exact names first so manifest order cannot hide a parent binding.
  for (const layer of asset.layers) {
    const matches = named.get(layer.objectName) ?? [];
    if (matches.length !== 1) {
      errors.push(matches.length === 0 ? "missing-scene-object:" + layer.objectName : "ambiguous-scene-object:" + layer.objectName);
      continue;
    }
    bindings.set(layer.nodeId, matches[0]);
  }
  for (const layer of asset.layers) {
    const target = bindings.get(layer.nodeId);
    const rigNode = asset.rig.nodes.find((node) => node.id === layer.nodeId);
    if (!target || !rigNode) {
      errors.push("missing-bound-rig-node:" + layer.nodeId);
      continue;
    }
    if (rigNode.parentId === null) {
      if (target !== root && target.parent !== root) errors.push("root-scene-parent-mismatch:" + layer.nodeId);
    } else {
      const parentBinding = bindings.get(rigNode.parentId);
      if (!parentBinding || target.parent !== parentBinding) errors.push("scene-parent-mismatch:" + layer.nodeId);
    }
  }
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };
  return { ok: true, prepared: { root, asset, bindings }, errors: [] };
}

function safePoseForRig(rig: DepthRigDefinition, pose?: DepthRigPose | null): DepthRigPose {
  if (pose !== undefined && pose !== null
    && (!isPlainRecord(pose) || !own(pose, "rigId") || !own(pose, "deltas") || pose.rigId !== rig.id)) {
    throw new Error("pose-rig-id-mismatch-or-untrusted-record");
  }
  const rawDeltas = pose?.deltas ?? {};
  if (!isPlainRecord(rawDeltas)) throw new Error("pose-deltas-not-plain-record");
  const allowed = new Set(["x", "y", "z", "rotation", "scaleX", "scaleY"]);
  const knownIds = new Set(rig.nodes.map((node) => node.id));
  const deltas: Record<string, Partial<DepthRigTransform>> = {};
  for (const key of Object.keys(rawDeltas)) {
    if (!knownIds.has(key) || !own(rawDeltas, key)) throw new Error("pose-unknown-node:" + key);
    const rawDelta = rawDeltas[key];
    if (!isPlainRecord(rawDelta)) throw new Error("pose-delta-not-plain-record:" + key);
    const safe: Partial<DepthRigTransform> = {};
    for (const [field, value] of Object.entries(rawDelta)) {
      if (!allowed.has(field) || !finite(value)) throw new Error("invalid-pose-delta:" + key + ":" + field);
      if ((field === "scaleX" || field === "scaleY") && (Math.abs(value) < 0.01 || Math.abs(value) > 4)) {
        throw new Error("pose-scale-out-of-range:" + key + ":" + field);
      }
      if ((field === "x" || field === "y") && Math.abs(value) > 2) throw new Error("pose-offset-out-of-range:" + key + ":" + field);
      if (field === "z" && Math.abs(value) > 10) throw new Error("pose-depth-out-of-range:" + key);
      if (field === "rotation" && Math.abs(value) > 90) throw new Error("pose-rotation-out-of-range:" + key);
      (safe as Record<string, number>)[field] = value;
    }
    deltas[key] = safe;
  }
  return { rigId: rig.id, deltas };
}

function capture(node: DepthRigSceneNodeLike): SceneNodeSnapshot {
  return {
    node,
    position: [node.position.x, node.position.y, node.position.z],
    rotation: [node.rotation.x, node.rotation.y, node.rotation.z],
    scale: [node.scale.x, node.scale.y, node.scale.z],
    visible: node.visible,
    renderOrder: node.renderOrder,
    matrixAutoUpdate: node.matrixAutoUpdate,
    matrix: node.matrix?.clone?.(),
  };
}

function restore(snapshots: readonly SceneNodeSnapshot[]): void {
  for (const snapshot of snapshots) {
    snapshot.node.position.set(...snapshot.position);
    snapshot.node.rotation.set(...snapshot.rotation);
    snapshot.node.scale.set(...snapshot.scale);
    snapshot.node.visible = snapshot.visible;
    snapshot.node.renderOrder = snapshot.renderOrder;
    if (snapshot.matrixAutoUpdate !== undefined) snapshot.node.matrixAutoUpdate = snapshot.matrixAutoUpdate;
    if (snapshot.matrix !== undefined && snapshot.node.matrix?.copy) snapshot.node.matrix.copy(snapshot.matrix);
    else snapshot.node.updateMatrix?.();
    snapshot.node.matrixWorldNeedsUpdate = true;
  }
}

export function applyDepthRigPreparedScenePoseV1(
  prepared: PreparedDepthRigSceneV1,
  rawPose: DepthRigPose | null | undefined,
  context: { stateRevision: number; executionId: string },
): DepthRigSceneApplyResult {
  if (!prepared || !prepared.root || !prepared.asset) return { status: "rejected", errors: ["prepared-scene-required"] };
  if (!Number.isSafeInteger(context?.stateRevision) || context.stateRevision < 0) {
    return { status: "rejected", errors: ["invalid-state-revision"] };
  }
  if (typeof context.executionId !== "string" || context.executionId.length === 0 || context.executionId.length > 128) {
    return { status: "rejected", errors: ["invalid-execution-id"] };
  }

  let pose: DepthRigPose;
  try {
    pose = safePoseForRig(prepared.asset.rig, rawPose);
    resolveDepthRigWorldPose(prepared.asset.rig, pose);
  } catch (error) {
    return { status: "rejected", errors: [error instanceof Error ? error.message : "invalid-pose"] };
  }

  const snapshots: SceneNodeSnapshot[] = [];
  const appliedNodeIds: string[] = [];
  try {
    const byId = new Map(prepared.asset.layers.map((layer) => [layer.nodeId, layer]));
    for (const node of orderDepthRigNodes(prepared.asset.rig)) {
      const target = prepared.bindings.get(node.id);
      const layer = byId.get(node.id);
      if (!target || !layer) throw new Error("prepared-layer-disappeared:" + node.id);
      if ((node.parentId === null && target !== prepared.root && target.parent !== prepared.root)
        || (node.parentId !== null && target.parent !== prepared.bindings.get(node.parentId))) {
        throw new Error("scene-hierarchy-changed:" + node.id);
      }
      snapshots.push(capture(target));

      const delta = pose.deltas[node.id] ?? {};
      const x = (node.rest.x + (delta.x ?? 0)) * prepared.asset.artwork.width;
      const y = -(node.rest.y + (delta.y ?? 0)) * prepared.asset.artwork.height;
      const z = node.rest.z + (delta.z ?? 0);
      const angle = -(node.rest.rotation + (delta.rotation ?? 0)) * Math.PI / 180;
      const scaleX = node.rest.scaleX * (delta.scaleX ?? 1);
      const scaleY = node.rest.scaleY * (delta.scaleY ?? 1);
      if (![x, y, z, angle, scaleX, scaleY].every(Number.isFinite)) throw new Error("non-finite-local-transform:" + node.id);

      const pivotX = (node.pivot.x - 0.5) * layer.width;
      const pivotY = (0.5 - node.pivot.y) * layer.height;
      const a = Math.cos(angle) * scaleX;
      const b = Math.sin(angle) * scaleX;
      const c = -Math.sin(angle) * scaleY;
      const d = Math.cos(angle) * scaleY;
      const positionX = x - a * pivotX - c * pivotY;
      const positionY = y - b * pivotX - d * pivotY;

      target.position.set(positionX, positionY, z);
      target.rotation.set(0, 0, angle);
      target.scale.set(scaleX, scaleY, 1);
      target.visible = true;
      target.renderOrder = node.depthOrder;
      target.matrixAutoUpdate = true;
      target.updateMatrix?.();
      target.matrixWorldNeedsUpdate = true;
      appliedNodeIds.push(node.id);
    }

    prepared.root.updateWorldMatrix?.(true, true);
    prepared.root.updateMatrixWorld?.(true);

    for (const node of prepared.asset.rig.nodes) {
      const target = prepared.bindings.get(node.id)!;
      const layer = prepared.asset.layers.find((entry) => entry.nodeId === node.id)!;
      const delta = pose.deltas[node.id] ?? {};
      const x = (node.rest.x + (delta.x ?? 0)) * prepared.asset.artwork.width;
      const y = -(node.rest.y + (delta.y ?? 0)) * prepared.asset.artwork.height;
      const z = node.rest.z + (delta.z ?? 0);
      const angle = -(node.rest.rotation + (delta.rotation ?? 0)) * Math.PI / 180;
      const scaleX = node.rest.scaleX * (delta.scaleX ?? 1);
      const scaleY = node.rest.scaleY * (delta.scaleY ?? 1);
      const pivotX = (node.pivot.x - 0.5) * layer.width;
      const pivotY = (0.5 - node.pivot.y) * layer.height;
      const a = Math.cos(angle) * scaleX;
      const b = Math.sin(angle) * scaleX;
      const c = -Math.sin(angle) * scaleY;
      const d = Math.cos(angle) * scaleY;
      const expectedX = x - a * pivotX - c * pivotY;
      const expectedY = y - b * pivotX - d * pivotY;
      if (!close(target.position.x, expectedX) || !close(target.position.y, expectedY) || !close(target.position.z, z)
        || !close(target.rotation.x, 0) || !close(target.rotation.y, 0) || !close(target.rotation.z, angle)
        || !close(target.scale.x, scaleX) || !close(target.scale.y, scaleY) || !close(target.scale.z, 1)
        || target.visible !== true || target.renderOrder !== node.depthOrder) {
        throw new Error("postcondition-mismatch:" + node.id);
      }
    }

    const readbackNodeIds = orderDepthRigNodes(prepared.asset.rig).map((node) => node.id);
    return {
      status: "applied",
      errors: [],
      receipt: {
        adapterId: NK1_DEPTH_RIG_SCENE_ADAPTER_ID,
        executionId: context.executionId,
        stateRevision: context.stateRevision,
        rigId: prepared.asset.rig.id,
        appliedNodeIds,
        readbackNodeIds,
        verified: true,
        presentedFrameVerified: false,
      },
    };
  } catch (error) {
    try {
      restore(snapshots);
      prepared.root.updateWorldMatrix?.(true, true);
      prepared.root.updateMatrixWorld?.(true);
    } catch {
      return { status: "rolled-back", errors: ["apply-failed-and-rollback-failed"] };
    }
    const reason = error instanceof Error ? error.message.slice(0, 160) : "unknown-apply-error";
    return { status: "rolled-back", errors: [reason] };
  }
}

export function applyDepthRigScenePoseV1(
  root: DepthRigSceneNodeLike,
  rawAsset: unknown,
  pose: DepthRigPose | null | undefined,
  context: { stateRevision: number; executionId: string },
): DepthRigSceneApplyResult {
  const preparation = prepareDepthRigSceneV1(root, rawAsset);
  if (!preparation.ok || !preparation.prepared) return { status: "rejected", errors: preparation.errors };
  return applyDepthRigPreparedScenePoseV1(preparation.prepared, pose, context);
}
