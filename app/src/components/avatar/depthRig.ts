/**
 * NK1 layered depth-rig contract.
 *
 * This is the data/pose boundary for a future authored 2.5D puppet. It does not
 * turn a flat PNG/SVG into a rig: production artwork must provide hidden-area
 * paint, pivots, masks and depth-ordered layers before a renderer can consume it.
 */
export type DepthRigRole =
  | "root" | "torso" | "neck" | "head" | "hair-back" | "hair-front"
  | "upper-arm-left" | "lower-arm-left" | "hand-left"
  | "upper-arm-right" | "lower-arm-right" | "hand-right"
  | "pelvis" | "upper-leg-left" | "lower-leg-left" | "foot-left"
  | "upper-leg-right" | "lower-leg-right" | "foot-right"
  | "garment" | "accessory" | "face-feature";

export interface DepthRigTransform {
  x: number;
  y: number;
  z: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface DepthRigNode {
  id: string;
  role: DepthRigRole;
  parentId: string | null;
  /** Draw order; lower values are behind higher values. */
  depthOrder: number;
  /** Pivot in normalized local artwork coordinates (0..1). */
  pivot: { x: number; y: number };
  rest: DepthRigTransform;
  /** Stable semantic tag used by garment/accessory attachment and occlusion. */
  slot?: string;
}

export interface DepthRigDefinition {
  version: 1;
  id: string;
  coordinateSystem: "normalized-y-down";
  nodes: readonly DepthRigNode[];
}

export interface DepthRigIntent {
  headYaw: number;
  headPitch: number;
  headRoll: number;
  torsoYaw: number;
  torsoLean: number;
  breath: number;
  gesture: "none" | "think" | "explain-left" | "explain-right" | "cross-arms" | "shrug";
  gestureIntensity: number;
}

export interface DepthRigDiagnostic {
  code: "invalid-id" | "duplicate-id" | "invalid-number" | "invalid-pivot"
    | "missing-parent" | "parent-cycle" | "missing-root" | "multiple-roots";
  nodeId?: string;
  message: string;
}

export interface DepthRigPose {
  rigId: string;
  /** Per-node additive deltas; renderers apply these over authored rest transforms. */
  deltas: Readonly<Record<string, Partial<DepthRigTransform>>>;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));

const finiteTransform = (t: DepthRigTransform | null | undefined): boolean => {
  if (!t || typeof t !== "object") return false;
  return [t.x, t.y, t.z, t.rotation, t.scaleX, t.scaleY].every(Number.isFinite);
};

export function validateDepthRig(rig: DepthRigDefinition): DepthRigDiagnostic[] {
  const diagnostics: DepthRigDiagnostic[] = [];
  if (!rig || rig.version !== 1 || rig.coordinateSystem !== "normalized-y-down"
    || typeof rig.id !== "string" || !rig.id.trim() || !Array.isArray(rig.nodes)) {
    return [{ code: "invalid-id", message: "Rig must have version 1, a non-empty id, normalized-y-down coordinates and a node array." }];
  }

  const byId = new Map<string, DepthRigNode>();
  for (const candidate of rig.nodes) {
    if (!candidate || typeof candidate !== "object") {
      diagnostics.push({ code: "invalid-id", message: "Every node must be an object." });
      continue;
    }
    const node = candidate;
    if (typeof node.id !== "string" || !node.id.trim()) {
      diagnostics.push({ code: "invalid-id", message: "Every node needs a non-empty id." });
      continue;
    }
    if (byId.has(node.id)) diagnostics.push({ code: "duplicate-id", nodeId: node.id, message: `Duplicate node id: ${node.id}` });
    else byId.set(node.id, node);
    if (!Number.isFinite(node.depthOrder) || !finiteTransform(node.rest)) {
      diagnostics.push({ code: "invalid-number", nodeId: node.id, message: "Depth order and rest transform must contain finite numbers." });
    }
    if (!node.pivot || typeof node.pivot !== "object"
      || !Number.isFinite(node.pivot.x) || !Number.isFinite(node.pivot.y)
      || node.pivot.x < 0 || node.pivot.x > 1 || node.pivot.y < 0 || node.pivot.y > 1) {
      diagnostics.push({ code: "invalid-pivot", nodeId: node.id, message: "Pivot coordinates must be finite and within 0..1." });
    }
  }

  const roots = rig.nodes.filter((node) => node && typeof node === "object" && node.parentId === null);
  if (roots.length === 0) diagnostics.push({ code: "missing-root", message: "Rig must contain one root node." });
  if (roots.length > 1) diagnostics.push({ code: "multiple-roots", message: "Rig must contain exactly one root node." });

  for (const node of rig.nodes) {
    if (!node || typeof node !== "object" || typeof node.id !== "string") continue;
    if (node.parentId !== null && !byId.has(node.parentId)) {
      diagnostics.push({ code: "missing-parent", nodeId: node.id, message: `Parent ${node.parentId} does not exist.` });
    }
  }

  // Three-colour DFS detects cycles without relying on input order.
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (id: string): void => {
    const current = state.get(id) ?? 0;
    if (current === 2) return;
    if (current === 1) {
      diagnostics.push({ code: "parent-cycle", nodeId: id, message: `Parent cycle reaches ${id}.` });
      return;
    }
    state.set(id, 1);
    const parentId = byId.get(id)?.parentId;
    if (parentId && byId.has(parentId)) visit(parentId);
    state.set(id, 2);
  };
  for (const id of byId.keys()) visit(id);
  return diagnostics;
}

export function orderDepthRigNodes(rig: DepthRigDefinition): DepthRigNode[] {
  const diagnostics = validateDepthRig(rig);
  if (diagnostics.length) throw new Error(`Invalid depth rig: ${diagnostics.map((d) => d.code).join(", ")}`);
  return [...rig.nodes].sort((a, b) => a.depthOrder - b.depthOrder || a.id.localeCompare(b.id));
}

/**
 * Convert shared semantic motor intent into small additive 2.5D transforms.
 * The values are deliberately bounded and conservative; artwork-specific
 * calibration belongs in the rig profile, not in the organism's emotion code.
 */
export function resolveDepthRigPose(rig: DepthRigDefinition, intent: DepthRigIntent): DepthRigPose {
  orderDepthRigNodes(rig); // Fail closed for malformed artist-authored rigs.
  const yaw = clamp(intent.headYaw, -1, 1);
  const pitch = clamp(intent.headPitch, -1, 1);
  const roll = clamp(intent.headRoll, -1, 1);
  const torsoYaw = clamp(intent.torsoYaw, -1, 1);
  const lean = clamp(intent.torsoLean, -1, 1);
  const breath = clamp(intent.breath, 0, 1);
  const intensity = clamp(intent.gestureIntensity, 0, 1);
  const deltas: Record<string, Partial<DepthRigTransform>> = {};

  for (const node of rig.nodes) {
    switch (node.role) {
      case "head":
        deltas[node.id] = { rotation: roll * 7, x: yaw * 0.018, y: pitch * 0.012 };
        break;
      case "neck":
        deltas[node.id] = { rotation: roll * 2.2, x: yaw * 0.006, y: pitch * 0.004 };
        break;
      case "torso":
        deltas[node.id] = { rotation: torsoYaw * 4, x: torsoYaw * 0.012, y: lean * 0.018 + Math.sin(breath * Math.PI) * 0.002 };
        break;
      case "hair-back":
      case "hair-front":
        deltas[node.id] = { rotation: -roll * (node.role === "hair-front" ? 1.8 : 3.2) - yaw * 1.2 };
        break;
      case "upper-arm-left":
        if (intent.gesture === "think") deltas[node.id] = { rotation: -18 * intensity };
        else if (intent.gesture === "explain-left") deltas[node.id] = { rotation: -32 * intensity };
        else if (intent.gesture === "cross-arms") deltas[node.id] = { rotation: 42 * intensity };
        else if (intent.gesture === "shrug") deltas[node.id] = { rotation: -22 * intensity };
        break;
      case "upper-arm-right":
        if (intent.gesture === "think") deltas[node.id] = { rotation: 24 * intensity };
        else if (intent.gesture === "explain-right") deltas[node.id] = { rotation: 32 * intensity };
        else if (intent.gesture === "cross-arms") deltas[node.id] = { rotation: -42 * intensity };
        else if (intent.gesture === "shrug") deltas[node.id] = { rotation: 22 * intensity };
        break;
      case "garment":
        deltas[node.id] = { rotation: -torsoYaw * 1.5, y: lean * 0.004 };
        break;
      default:
        break;
    }
  }
  return { rigId: rig.id, deltas };
}
