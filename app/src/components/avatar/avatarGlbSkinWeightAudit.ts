export interface GlbSkinWeightJointCoverage {
  jointIndex: number;
  nodeIndex: number;
  boneName: string;
  weightedSampleCount: number;
  coverage01: number;
  averageWeight01: number;
  maxWeight01: number;
}

export interface GlbSkinWeightMeshAudit {
  nodeIndex: number;
  nodeName: string;
  meshIndex: number;
  meshName: string;
  skinIndex: number;
  vertexCount: number;
  sampledVertices: number;
  jointCoverage: GlbSkinWeightJointCoverage[];
  warnings: string[];
}

export interface GlbSkinWeightAudit {
  schemaVersion: 1;
  skinnedNodeCount: number;
  auditedNodeCount: number;
  totalSampledVertices: number;
  meshAudits: GlbSkinWeightMeshAudit[];
  warnings: string[];
  truncated: boolean;
}

export interface GlbSkinWeightAuditOptions {
  maxSamplesPerPrimitive?: number;
}

export function auditGlbSkinWeights(
  document: unknown,
  _binaryChunk: Uint8Array,
  _options: GlbSkinWeightAuditOptions = {},
): GlbSkinWeightAudit {
  const source = document && typeof document === "object" ? document as Record<string, unknown> : {};
  const nodes = Array.isArray(source.nodes) ? source.nodes : [];
  const meshes = Array.isArray(source.meshes) ? source.meshes : [];
  const skinned = nodes.flatMap((entry, nodeIndex) => {
    if (!entry || typeof entry !== "object") return [];
    const node = entry as Record<string, unknown>;
    if (!Number.isInteger(node.mesh) || !Number.isInteger(node.skin)) return [];
    const mesh = meshes[Number(node.mesh)] as Record<string, unknown> | undefined;
    return [{
      nodeIndex,
      nodeName: typeof node.name === "string" ? node.name : `node-${nodeIndex}`,
      meshIndex: Number(node.mesh),
      meshName: typeof mesh?.name === "string" ? mesh.name : `mesh-${node.mesh}`,
      skinIndex: Number(node.skin),
      vertexCount: 0,
      sampledVertices: 0,
      jointCoverage: [],
      warnings: ["skin-weight-audit-not-implemented"],
    }];
  });
  return {
    schemaVersion: 1,
    skinnedNodeCount: skinned.length,
    auditedNodeCount: 0,
    totalSampledVertices: 0,
    meshAudits: skinned,
    warnings: ["skin-weight-audit-not-implemented"],
    truncated: false,
  };
}
