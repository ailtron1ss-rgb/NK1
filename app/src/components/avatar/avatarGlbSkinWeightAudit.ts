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
  weightedSampleVertices: number;
  unweightedSampleVertices: number;
  averageWeightSum01: number;
  maxWeightSum01: number;
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
  maxSkinnedNodes?: number;
}

interface AccessorLayout {
  count: number;
  componentType: number;
  normalized: boolean;
  baseOffset: number;
  stride: number;
  componentBytes: number;
  viewEnd: number;
}

interface JointStats {
  weightedSampleCount: number;
  weightSum: number;
  maxWeight: number;
}

const COMPONENT_BYTES: Readonly<Record<number, number>> = Object.freeze({
  5121: 1,
  5123: 2,
  5125: 4,
  5126: 4,
});
const MAX_SAMPLE_BUDGET = 8192;
const DEFAULT_SAMPLE_BUDGET = 2048;
const MAX_SKINNED_NODES = 256;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function componentReader(data: DataView, offset: number, componentType: number): number {
  switch (componentType) {
    case 5121: return data.getUint8(offset);
    case 5123: return data.getUint16(offset, true);
    case 5125: return data.getUint32(offset, true);
    case 5126: return data.getFloat32(offset, true);
    default: return Number.NaN;
  }
}

function accessorLayout(
  document: Record<string, unknown>,
  binaryLength: number,
  accessorIndex: number,
  allowedComponents: readonly number[],
  role: "joints" | "weights",
): AccessorLayout | string {
  const accessors = Array.isArray(document.accessors) ? document.accessors : [];
  const views = Array.isArray(document.bufferViews) ? document.bufferViews : [];
  const accessorValue = accessors[accessorIndex];
  if (!isRecord(accessorValue)) return "invalid-accessor";
  if (accessorValue.type !== "VEC4") return "invalid-accessor-type";
  if (accessorValue.sparse !== undefined) return "unsupported-sparse-accessor";

  const count = nonNegativeInteger(accessorValue.count);
  const componentType = nonNegativeInteger(accessorValue.componentType);
  const viewIndex = nonNegativeInteger(accessorValue.bufferView);
  if (count === null || count < 1 || componentType === null || viewIndex === null) return "invalid-accessor-layout";
  if (!allowedComponents.includes(componentType)) return "invalid-accessor-component-type";
  if (role === "joints" && accessorValue.normalized === true) return "normalized-joint-indices-unsupported";

  const componentBytes = COMPONENT_BYTES[componentType];
  if (!componentBytes) return "invalid-accessor-component-type";
  const bufferView = views[viewIndex];
  if (!isRecord(bufferView)) return "invalid-buffer-view";
  if (bufferView.buffer !== undefined && bufferView.buffer !== 0) return "unsupported-buffer-index";

  const viewOffset = nonNegativeInteger(bufferView.byteOffset) ?? 0;
  const viewLength = nonNegativeInteger(bufferView.byteLength);
  const accessorOffset = nonNegativeInteger(accessorValue.byteOffset) ?? 0;
  if (viewLength === null) return "invalid-buffer-view-length";

  const elementBytes = componentBytes * 4;
  const strideValue = bufferView.byteStride;
  const stride = strideValue === undefined ? elementBytes : nonNegativeInteger(strideValue);
  if (stride === null || stride < elementBytes || stride % componentBytes !== 0) return "invalid-buffer-stride";

  const baseOffset = viewOffset + accessorOffset;
  const viewEnd = viewOffset + viewLength;
  const lastByte = baseOffset + (count - 1) * stride + elementBytes;
  if (baseOffset < viewOffset || lastByte > viewEnd || lastByte > binaryLength) return "accessor-out-of-bounds";

  return {
    count,
    componentType,
    normalized: accessorValue.normalized === true,
    baseOffset,
    stride,
    componentBytes,
    viewEnd,
  };
}

function readVector4(
  data: DataView,
  layout: AccessorLayout,
  vertexIndex: number,
): [number, number, number, number] | null {
  const offset = layout.baseOffset + vertexIndex * layout.stride;
  const values: number[] = [];
  for (let component = 0; component < 4; component += 1) {
    const value = componentReader(data, offset + component * layout.componentBytes, layout.componentType);
    if (!Number.isFinite(value)) return null;
    values.push(value);
  }
  return values as [number, number, number, number];
}

function decodeWeight(value: number, layout: AccessorLayout): number | null {
  let decoded = value;
  if (layout.normalized) {
    if (layout.componentType === 5121) decoded = value / 255;
    else if (layout.componentType === 5123) decoded = value / 65535;
    else if (layout.componentType === 5125) decoded = value / 4294967295;
  }
  if (!Number.isFinite(decoded) || decoded < 0 || decoded > 1.00001) return null;
  return Math.min(1, decoded);
}

function sampleIndices(count: number, budget: number): number[] {
  const size = Math.min(count, budget);
  if (size <= 0) return [];
  if (size === count) return Array.from({ length: count }, (_, index) => index);
  const result: number[] = [];
  const seen = new Set<number>();
  for (let index = 0; index < size; index += 1) {
    const selected = Math.floor(index * (count - 1) / Math.max(1, size - 1));
    if (!seen.has(selected)) {
      seen.add(selected);
      result.push(selected);
    }
  }
  return result;
}

function toCoverage(
  jointStats: Map<number, JointStats>,
  jointNodes: readonly number[],
  nodes: readonly unknown[],
  sampledVertices: number,
): GlbSkinWeightJointCoverage[] {
  return [...jointStats.entries()]
    .map(([jointIndex, stats]) => {
      const nodeIndex = jointNodes[jointIndex];
      const node = nodes[nodeIndex];
      const boneName = isRecord(node) && typeof node.name === "string"
        ? node.name
        : "joint-" + jointIndex;
      return {
        jointIndex,
        nodeIndex,
        boneName,
        weightedSampleCount: stats.weightedSampleCount,
        coverage01: sampledVertices > 0 ? stats.weightedSampleCount / sampledVertices : 0,
        averageWeight01: sampledVertices > 0 ? stats.weightSum / sampledVertices : 0,
        maxWeight01: stats.maxWeight,
      };
    })
    .sort((left, right) => right.averageWeight01 - left.averageWeight01 || left.jointIndex - right.jointIndex);
}

/**
 * Read-only bounded sampler for glTF JOINTS_n and WEIGHTS_n accessors.
 * It reports per-mesh joint coverage without changing the asset or inferring
 * weights for missing/malformed attributes.
 */
export function auditGlbSkinWeights(
  rawDocument: unknown,
  binaryChunk: Uint8Array,
  options: GlbSkinWeightAuditOptions = {},
): GlbSkinWeightAudit {
  const empty: GlbSkinWeightAudit = {
    schemaVersion: 1,
    skinnedNodeCount: 0,
    auditedNodeCount: 0,
    totalSampledVertices: 0,
    meshAudits: [],
    warnings: [],
    truncated: false,
  };
  if (!isRecord(rawDocument) || !(binaryChunk instanceof Uint8Array)) {
    return { ...empty, warnings: ["invalid-glb-audit-input"] };
  }

  const nodes = Array.isArray(rawDocument.nodes) ? rawDocument.nodes : [];
  const meshes = Array.isArray(rawDocument.meshes) ? rawDocument.meshes : [];
  const skins = Array.isArray(rawDocument.skins) ? rawDocument.skins : [];
  const data = new DataView(binaryChunk.buffer, binaryChunk.byteOffset, binaryChunk.byteLength);
  const requestedSamples = nonNegativeInteger(options.maxSamplesPerPrimitive) ?? DEFAULT_SAMPLE_BUDGET;
  const maxSamples = Math.max(1, Math.min(MAX_SAMPLE_BUDGET, requestedSamples));
  const requestedNodes = nonNegativeInteger(options.maxSkinnedNodes) ?? MAX_SKINNED_NODES;
  const maxNodes = Math.max(1, Math.min(MAX_SKINNED_NODES, requestedNodes));

  const skinnedNodeIndices = nodes.flatMap((entry, nodeIndex) => {
    if (!isRecord(entry)) return [];
    return Number.isInteger(entry.mesh) && Number.isInteger(entry.skin) ? [nodeIndex] : [];
  });
  const visited = skinnedNodeIndices.slice(0, maxNodes);
  const globalWarnings = new Set<string>();
  const meshAudits: GlbSkinWeightMeshAudit[] = [];
  let totalSampledVertices = 0;
  let auditedNodeCount = 0;

  for (const nodeIndex of visited) {
    const node = nodes[nodeIndex] as Record<string, unknown>;
    const meshIndex = Number(node.mesh);
    const skinIndex = Number(node.skin);
    const meshValue = meshes[meshIndex];
    const skinValue = skins[skinIndex];
    const mesh = isRecord(meshValue) ? meshValue : null;
    const skin = isRecord(skinValue) ? skinValue : null;
    const jointNodes = skin && Array.isArray(skin.joints)
      ? skin.joints.map((value) => nonNegativeInteger(value))
      : null;
    const meshWarnings = new Set<string>();
    const jointStats = new Map<number, JointStats>();
    let vertexCount = 0;
    let sampledVertices = 0;
    let weightedSampleVertices = 0;
    let unweightedSampleVertices = 0;
    let totalWeightSum = 0;
    let maxWeightSum = 0;
    let successfulPrimitiveCount = 0;

    if (!mesh || !skin || !jointNodes || jointNodes.length === 0 || jointNodes.some((value) => value === null)) {
      meshWarnings.add("invalid-mesh-or-skin-reference");
    } else {
      const validJointNodes = jointNodes as number[];
      const primitives = Array.isArray(mesh.primitives) ? mesh.primitives : [];
      for (const primitiveValue of primitives) {
        const primitive = isRecord(primitiveValue) ? primitiveValue : null;
        const attributes = primitive && isRecord(primitive.attributes) ? primitive.attributes : null;
        if (!attributes || !Number.isInteger(attributes.JOINTS_0) || !Number.isInteger(attributes.WEIGHTS_0)) {
          meshWarnings.add("missing-joint-weight-attributes");
          continue;
        }

        const jointSets: Array<[string, string]> = [["JOINTS_0", "WEIGHTS_0"]];
        const hasJoint1 = attributes.JOINTS_1 !== undefined;
        const hasWeight1 = attributes.WEIGHTS_1 !== undefined;
        if (hasJoint1 !== hasWeight1) meshWarnings.add("incomplete-secondary-joint-attributes");
        if (hasJoint1 && hasWeight1) jointSets.push(["JOINTS_1", "WEIGHTS_1"]);

        const layouts: Array<{ joints: AccessorLayout; weights: AccessorLayout }> = [];
        let failed = false;
        for (const [jointName, weightName] of jointSets) {
          const joints = accessorLayout(rawDocument, binaryChunk.byteLength, Number(attributes[jointName]), [5121, 5123], "joints");
          const weights = accessorLayout(rawDocument, binaryChunk.byteLength, Number(attributes[weightName]), [5121, 5123, 5125, 5126], "weights");
          if (typeof joints === "string" || typeof weights === "string") {
            if (typeof joints === "string") meshWarnings.add(joints);
            if (typeof weights === "string") meshWarnings.add(weights);
            failed = true;
            break;
          }
          if (joints.count !== weights.count) {
            meshWarnings.add("joint-weight-count-mismatch");
            failed = true;
            break;
          }
          if (layouts.length > 0 && layouts[0].joints.count !== joints.count) {
            meshWarnings.add("joint-weight-count-mismatch");
            failed = true;
            break;
          }
          layouts.push({ joints, weights });
        }
        if (failed || layouts.length === 0) continue;

        const primitiveVertexCount = layouts[0].joints.count;
        vertexCount += primitiveVertexCount;
        const indices = sampleIndices(primitiveVertexCount, maxSamples);
        for (const vertexIndex of indices) {
          const perVertex = new Map<number, number>();
          let malformedVertex = false;
          for (const layout of layouts) {
            const jointValues = readVector4(data, layout.joints, vertexIndex);
            const weightValues = readVector4(data, layout.weights, vertexIndex);
            if (!jointValues || !weightValues) {
              malformedVertex = true;
              break;
            }
            for (let influence = 0; influence < 4; influence += 1) {
              const weight = decodeWeight(weightValues[influence], layout.weights);
              if (weight === null) {
                malformedVertex = true;
                break;
              }
              if (weight <= 0) continue;
              const jointIndex = jointValues[influence];
              if (!Number.isInteger(jointIndex) || jointIndex < 0 || jointIndex >= validJointNodes.length) {
                meshWarnings.add("joint-index-out-of-range");
                continue;
              }
              perVertex.set(jointIndex, (perVertex.get(jointIndex) ?? 0) + weight);
            }
            if (malformedVertex) break;
          }
          if (malformedVertex) {
            meshWarnings.add("invalid-skin-weight-value");
            continue;
          }
          sampledVertices += 1;
          const vertexWeightSum = [...perVertex.values()].reduce((sum, value) => sum + value, 0);
          totalWeightSum += vertexWeightSum;
          maxWeightSum = Math.max(maxWeightSum, vertexWeightSum);
          if (vertexWeightSum > 0) weightedSampleVertices += 1;
          else unweightedSampleVertices += 1;
          if (vertexWeightSum > 1.01) meshWarnings.add("skin-weight-sum-exceeds-one");
          for (const [jointIndex, weight] of perVertex) {
            const stats = jointStats.get(jointIndex) ?? { weightedSampleCount: 0, weightSum: 0, maxWeight: 0 };
            stats.weightedSampleCount += 1;
            stats.weightSum += weight;
            stats.maxWeight = Math.max(stats.maxWeight, weight);
            jointStats.set(jointIndex, stats);
          }
        }
        successfulPrimitiveCount += 1;
      }
    }

    if (successfulPrimitiveCount > 0 && sampledVertices > 0) auditedNodeCount += 1;
    totalSampledVertices += sampledVertices;
    const validJointNodes = jointNodes?.filter((value): value is number => value !== null) ?? [];
    const jointCoverage = toCoverage(jointStats, validJointNodes, nodes, sampledVertices);
    const averageWeightSum01 = sampledVertices > 0 ? totalWeightSum / sampledVertices : 0;

    for (const warning of meshWarnings) globalWarnings.add(warning);
    meshAudits.push({
      nodeIndex,
      nodeName: typeof node.name === "string" ? node.name : "node-" + nodeIndex,
      meshIndex,
      meshName: mesh && typeof mesh.name === "string" ? mesh.name : "mesh-" + meshIndex,
      skinIndex,
      vertexCount,
      sampledVertices,
      weightedSampleVertices,
      unweightedSampleVertices,
      averageWeightSum01,
      maxWeightSum01,
      jointCoverage,
      warnings: [...meshWarnings],
    });
  }

  const truncated = skinnedNodeIndices.length > visited.length;
  if (truncated) globalWarnings.add("skinned-node-audit-limit-reached");
  if (skinnedNodeIndices.length === 0) globalWarnings.add("no-skinned-mesh-nodes");
  return {
    schemaVersion: 1,
    skinnedNodeCount: skinnedNodeIndices.length,
    auditedNodeCount,
    totalSampledVertices,
    meshAudits,
    warnings: [...globalWarnings],
    truncated,
  };
}
