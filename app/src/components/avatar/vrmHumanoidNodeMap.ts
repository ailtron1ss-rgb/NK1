import { isHumanoidRole, type HumanoidNodeLike, type HumanoidRole } from "./vrmHumanoidRigAudit.ts";

export type VrmHumanoidVersion = "0.x" | "1.0";
export type VrmHumanoidNodeMap =
  | { readonly status: "absent" }
  | {
      readonly status: "invalid";
      readonly version?: VrmHumanoidVersion;
      readonly reason: string;
    }
  | {
      readonly status: "valid";
      readonly version: VrmHumanoidVersion;
      readonly nodeRoleByIndex: ReadonlyMap<number, HumanoidRole>;
      readonly unsupportedRoles: readonly string[];
    };

export interface GltfSceneNodeLike {
  readonly name?: string;
  readonly parent?: GltfSceneNodeLike | null;
  readonly isBone?: boolean;
}
export interface GltfNodeAssociationLike {
  readonly nodes?: unknown;
}
export interface VrmHumanoidAuditNodes {
  readonly nodes: readonly HumanoidNodeLike[];
  readonly unresolvedRoles: readonly HumanoidRole[];
}

const MAX_GLTF_NODES = 50_000;
type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toHumanoidRole(value: string): HumanoidRole | undefined {
  if (isHumanoidRole(value)) return value;
  const lowerFirst = value.length ? value[0].toLowerCase() + value.slice(1) : value;
  return isHumanoidRole(lowerFirst) ? lowerFirst : undefined;
}

function invalid(reason: string, version?: VrmHumanoidVersion): VrmHumanoidNodeMap {
  return Object.freeze({ status: "invalid", reason, ...(version ? { version } : {}) });
}

/**
 * Read the normative glTF-node-index map from VRMC_vrm (1.0) or the legacy
 * VRM (0.x) extension. A present-but-invalid extension never falls back to names.
 */
export function parseVrmHumanoidNodeMap(extensions: unknown, nodeCount: number): VrmHumanoidNodeMap {
  if (!isRecord(extensions)) return { status: "absent" };
  const hasVrm1 = Object.prototype.hasOwnProperty.call(extensions, "VRMC_vrm");
  const hasVrm0 = Object.prototype.hasOwnProperty.call(extensions, "VRM");
  if (!hasVrm1 && !hasVrm0) return { status: "absent" };
  if (hasVrm1 && hasVrm0) return invalid("multiple-vrm-humanoid-extensions-present");
  if (!Number.isInteger(nodeCount) || nodeCount < 1 || nodeCount > MAX_GLTF_NODES) {
    return invalid("invalid-or-over-budget-gltf-node-count", hasVrm1 ? "1.0" : "0.x");
  }

  const version: VrmHumanoidVersion = hasVrm1 ? "1.0" : "0.x";
  const extension = extensions[hasVrm1 ? "VRMC_vrm" : "VRM"];
  if (!isRecord(extension)) return invalid("vrm-extension-must-be-an-object", version);

  let entries: readonly [string, unknown][];
  if (version === "1.0") {
    if (extension.specVersion !== "1.0") return invalid("unsupported-vrmc-vrm-spec-version", version);
    const humanoid = extension.humanoid;
    if (!isRecord(humanoid) || !isRecord(humanoid.humanBones)) {
      return invalid("vrmc-vrm-human-bones-map-is-missing", version);
    }
    entries = Object.entries(humanoid.humanBones);
  } else {
    const humanoid = extension.humanoid;
    if (!isRecord(humanoid) || !Array.isArray(humanoid.humanBones)) {
      return invalid("legacy-vrm-human-bones-array-is-missing", version);
    }
    const legacyEntries: [string, unknown][] = [];
    for (const item of humanoid.humanBones) {
      if (!isRecord(item) || typeof item.bone !== "string") {
        return invalid("legacy-vrm-human-bone-entry-is-malformed", version);
      }
      const boneName = item.bone;
      if (legacyEntries.some(([bone]) => bone.toLowerCase() === boneName.toLowerCase())) {
        return invalid("duplicate-legacy-vrm-humanoid-role", version);
      }
      legacyEntries.push([boneName, { node: item.node }]);
    }
    entries = legacyEntries;
  }

  const nodeRoleByIndex = new Map<number, HumanoidRole>();
  const usedNodeIndices = new Set<number>();
  const seenRoles = new Set<string>();
  const unsupportedRoles: string[] = [];
  for (const [rawRole, entry] of entries) {
    const roleKey = rawRole.toLowerCase();
    if (seenRoles.has(roleKey)) return invalid("duplicate-vrm-humanoid-role", version);
    seenRoles.add(roleKey);

    if (!isRecord(entry)) return invalid("vrm-human-bone-entry-must-be-an-object", version);
    const nodeIndex = entry.node;
    if (!Number.isInteger(nodeIndex) || (nodeIndex as number) < 0 || (nodeIndex as number) >= nodeCount) {
      return invalid("vrm-human-bone-node-index-out-of-range", version);
    }
    const index = nodeIndex as number;
    if (usedNodeIndices.has(index)) return invalid("vrm-humanoid-node-index-is-not-unique", version);
    usedNodeIndices.add(index);

    const role = toHumanoidRole(rawRole);
    const lowerRole = rawRole.toLowerCase();
    if (version === "1.0" && /^(left|right)thumbintermediate$/.test(lowerRole)) {
      return invalid("thumb-intermediate-is-not-a-vrm-1.0-humanoid-role", version);
    }
    if (version === "0.x" && /^(left|right)thumbmetacarpal$/.test(lowerRole)) {
      return invalid("thumb-metacarpal-is-not-a-vrm-0.x-humanoid-role", version);
    }
    if (role) nodeRoleByIndex.set(index, role);
    else unsupportedRoles.push(rawRole);
  }

  return Object.freeze({
    status: "valid",
    version,
    nodeRoleByIndex,
    unsupportedRoles: Object.freeze(unsupportedRoles),
  });
}

/**
 * Bind VRM node indices to the actual Three.js scene objects via GLTFLoader's
 * parser associations. Parent links are rebuilt over wrappers so the audit
 * never mixes wrapped and raw Object3D references.
 */
export function buildVrmHumanoidAuditNodes(
  sceneNodes: readonly GltfSceneNodeLike[],
  associations: { get(node: object): unknown } | null | undefined,
  mapping: Extract<VrmHumanoidNodeMap, { status: "valid" }>,
): VrmHumanoidAuditNodes {
  type MutableAuditNode = {
    readonly name?: string;
    readonly isBone: boolean;
    readonly humanoidRole?: HumanoidRole;
    parent: MutableAuditNode | null;
  };
  const wrapperByObject = new Map<GltfSceneNodeLike, MutableAuditNode>();
  const resolvedIndices = new Set<number>();

  for (const sceneNode of sceneNodes) {
    if (!sceneNode || typeof sceneNode !== "object" || wrapperByObject.has(sceneNode)) continue;
    const associationValue = associations?.get(sceneNode as object);
    const nodeIndex = isRecord(associationValue) ? associationValue.nodes : undefined;
    // Only GLTF node associations establish a normative node index. Loader
    // synthetic scene roots and mesh/primitive groups must not masquerade as
    // source nodes or interrupt ancestry between humanoid node references.
    if (!Number.isInteger(nodeIndex) || (nodeIndex as number) < 0) continue;
    const validIndex = nodeIndex as number;
    const role = mapping.nodeRoleByIndex.get(validIndex);
    if (role) resolvedIndices.add(validIndex);
    wrapperByObject.set(sceneNode, {
      ...(typeof sceneNode.name === "string" ? { name: sceneNode.name } : {}),
      isBone: sceneNode.isBone === true,
      ...(role ? { humanoidRole: role } : {}),
      parent: null,
    });
  }

  for (const [sceneNode, wrapper] of wrapperByObject) {
    wrapper.parent = sceneNode.parent ? wrapperByObject.get(sceneNode.parent) ?? null : null;
  }

  const unresolvedRoles = Array.from(mapping.nodeRoleByIndex.entries())
    .filter(([nodeIndex]) => !resolvedIndices.has(nodeIndex))
    .map(([, role]) => role);
  return Object.freeze({
    nodes: Object.freeze(Array.from(wrapperByObject.values())),
    unresolvedRoles: Object.freeze(unresolvedRoles),
  });
}
