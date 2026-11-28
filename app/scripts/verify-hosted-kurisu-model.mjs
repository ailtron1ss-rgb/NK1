import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { KURISU_HYBRID_MODEL } from "../src/components/avatar/avatarModelCatalog.ts";
import { preflightAvatarModel } from "../src/components/avatar/avatarModelPreflight.ts";
import { auditAvatarSecondaryAssetDescriptor } from "../src/components/avatar/avatarSecondaryAssetAudit.ts";
import { auditGlbSkinWeights } from "../src/components/avatar/avatarGlbSkinWeightAudit.ts";

const response = await fetch(KURISU_HYBRID_MODEL.url, {
  method: "GET",
  mode: "cors",
  credentials: "omit",
  cache: "no-store",
  signal: AbortSignal.timeout(20_000),
});
assert.equal(response.ok, true, `Hosted Kurisu model returned HTTP ${response.status}`);
assert.match(response.headers.get("content-type") ?? "", /^model\/gltf-binary(?:;|$)/i);
const bytes = new Uint8Array(await response.arrayBuffer());
assert.equal(bytes.byteLength, KURISU_HYBRID_MODEL.sizeBytes, "Hosted asset size must match the pinned catalog");
const sha256 = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
assert.equal(sha256, KURISU_HYBRID_MODEL.sha256, "Hosted asset content must match its pinned SHA-256");
const preflight = preflightAvatarModel(bytes, KURISU_HYBRID_MODEL.filename);
assert.equal(preflight.format, "glb");
assert.equal(preflight.hasBinaryChunk, true);

const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const jsonLength = view.getUint32(12, true);
const document = JSON.parse(new TextDecoder("utf-8", { fatal: true })
  .decode(bytes.subarray(20, 20 + jsonLength)).trim());
const binHeaderOffset = 20 + jsonLength;
assert.ok(binHeaderOffset + 8 <= bytes.byteLength, "Hosted GLB must contain a BIN chunk header");
const binaryChunkLength = view.getUint32(binHeaderOffset, true);
const binaryChunkType = view.getUint32(binHeaderOffset + 4, true);
assert.equal(binaryChunkType, 0x004E4942, "Hosted GLB BIN chunk must follow its JSON chunk");
assert.ok(binHeaderOffset + 8 + binaryChunkLength <= bytes.byteLength, "Hosted GLB BIN chunk must fit in the file");
const binaryChunk = bytes.subarray(binHeaderOffset + 8, binHeaderOffset + 8 + binaryChunkLength);
const morphTargets = (document.meshes ?? []).reduce((sum, mesh) =>
  sum + (mesh.primitives ?? []).reduce((n, primitive) => n + (primitive.targets?.length ?? 0), 0), 0);
assert.ok((document.nodes?.length ?? 0) > 0, "Hosted model must contain scene nodes");
assert.ok((document.skins?.length ?? 0) > 0, "Hosted model must contain a humanoid skin");
assert.ok(morphTargets >= 10, "Hosted model must retain face and blink morph targets");
assert.ok((document.animations ?? []).some((animation) => /rig_kurisu/i.test(animation.name ?? "")), "Hosted model must retain the named Kurisu humanoid clip");

const gltfNodes = Array.isArray(document.nodes) ? document.nodes : [];
const jointIndices = new Set();
for (const skin of (document.skins ?? [])) {
  for (const index of (Array.isArray(skin?.joints) ? skin.joints : [])) {
    if (Number.isInteger(index) && index >= 0 && index < gltfNodes.length) jointIndices.add(index);
  }
}
const parentByIndex = new Map();
for (const [index, node] of gltfNodes.entries()) {
  for (const child of (Array.isArray(node?.children) ? node.children : [])) {
    if (Number.isInteger(child) && child >= 0 && child < gltfNodes.length && !parentByIndex.has(child)) {
      parentByIndex.set(child, index);
    }
  }
}
const bones = [...jointIndices].map((index) => {
  const parent = parentByIndex.get(index);
  return {
    id: `gltf-node-${index}`,
    name: typeof gltfNodes[index]?.name === "string" ? gltfNodes[index].name : `node-${index}`,
    ...(Number.isInteger(parent) && jointIndices.has(parent) ? { parentId: `gltf-node-${parent}` } : {}),
    ...(gltfNodes[index]?.extras?.nk1Secondary !== undefined ? { metadata: gltfNodes[index].extras.nk1Secondary } : {}),
  };
});
const skinJointNames = [...jointIndices].sort((a, b) => a - b).map((index) => ({
  index,
  name: typeof gltfNodes[index]?.name === "string" ? gltfNodes[index].name : `node-${index}`,
  parent: Number.isInteger(parentByIndex.get(index)) && typeof gltfNodes[parentByIndex.get(index)]?.name === "string"
    ? gltfNodes[parentByIndex.get(index)].name
    : null,
}));
const meshNodeInventory = gltfNodes.flatMap((node, nodeIndex) => {
  if (!Number.isInteger(node?.mesh)) return [];
  const mesh = document.meshes?.[node.mesh];
  return [{
    nodeIndex,
    nodeName: typeof node?.name === "string" ? node.name : `node-${nodeIndex}`,
    meshIndex: node.mesh,
    meshName: typeof mesh?.name === "string" ? mesh.name : `mesh-${node.mesh}`,
    skinIndex: Number.isInteger(node?.skin) ? node.skin : null,
  }];
}).slice(0, 128);
const materialNames = (document.materials ?? []).slice(0, 128).map((material, index) =>
  typeof material?.name === "string" ? material.name : `material-${index}`);
const meshNames = (document.meshes ?? []).slice(0, 128).map((mesh, index) =>
  typeof mesh?.name === "string" ? mesh.name : `mesh-${index}`);

const morphTargetNames = new Set();
let rawMorphTargetCount = 0;
let morphMeshCount = 0;
const meshHasMorphs = (mesh) => (mesh?.primitives ?? []).some((primitive) =>
  Array.isArray(primitive?.targets) && primitive.targets.length > 0);
for (const mesh of (document.meshes ?? [])) {
  if (meshHasMorphs(mesh)) morphMeshCount += 1;
  for (const name of (Array.isArray(mesh?.extras?.targetNames) ? mesh.extras.targetNames : [])) {
    if (typeof name === "string" && name.trim()) morphTargetNames.add(name);
  }
  for (const primitive of (mesh?.primitives ?? [])) {
    rawMorphTargetCount += Array.isArray(primitive?.targets) ? primitive.targets.length : 0;
    for (const name of (Array.isArray(primitive?.extras?.targetNames) ? primitive.extras.targetNames : [])) {
      if (typeof name === "string" && name.trim()) morphTargetNames.add(name);
    }
  }
}
const secondaryAudit = auditAvatarSecondaryAssetDescriptor({
  bones,
  meshParts: meshNodeInventory.map((entry) => ({
    id: "gltf-node-" + entry.nodeIndex,
    name: entry.nodeName,
    skinned: Number.isInteger(entry.skinIndex),
  })),
  morphTargetNames: [...morphTargetNames],
  materials: (document.materials ?? []).map((material) => ({
    name: material?.name,
    extras: material?.extras,
    emissiveFactor: material?.emissiveFactor,
    emissiveTexture: material?.emissiveTexture,
  })),
  skinnedMeshCount: gltfNodes.filter((node) => Number.isInteger(node?.mesh) && Number.isInteger(node?.skin)).length,
  morphMeshCount: gltfNodes.filter((node) => Number.isInteger(node?.mesh) && meshHasMorphs(document.meshes?.[node.mesh])).length,
});
const skinWeightAudit = auditGlbSkinWeights(document, binaryChunk, {
  maxSamplesPerPrimitive: 2048,
  maxSkinnedNodes: 128,
});
const secondaryVertexSwayMeshNames = [
  "HAIR_long_lock_L", "HAIR_long_lock_R",
  "HAIR_front_strand_L", "HAIR_front_strand_R",
  "HAIR_layer_L1", "HAIR_layer_L2", "HAIR_layer_R1", "HAIR_layer_R2",
  "CLOTH_skirt", "CLOTH_tie_blade", "CLOTH_labcoat_main",
];
const secondaryVertexSwayAssetAudit = secondaryVertexSwayMeshNames.map((name) => {
  const node = meshNodeInventory.find((entry) => entry.nodeName === name);
  assert.ok(node, `Expected v5 secondary-sway mesh node ${name}`);
  assert.ok(Number.isInteger(node.skinIndex), `Secondary-sway mesh ${name} must be skinned`);
  const mesh = document.meshes?.[node.meshIndex];
  const primitives = Array.isArray(mesh?.primitives) ? mesh.primitives : [];
  assert.ok(primitives.length > 0, `Secondary-sway mesh ${name} must have primitives`);
  assert.ok(primitives.some((primitive) => Number.isInteger(primitive?.attributes?.POSITION)),
    `Secondary-sway mesh ${name} must have a POSITION accessor`);
  const materialIndices = primitives.map((primitive) => primitive?.material).filter(Number.isInteger);
  const usesUnlit = materialIndices.some((index) =>
    Boolean(document.materials?.[index]?.extensions?.KHR_materials_unlit));
  assert.equal(usesUnlit, false, `Secondary-sway mesh ${name} must keep a PBR-compatible material`);
  const skinAudit = skinWeightAudit.meshAudits.find((entry) => entry.nodeName === name);
  assert.ok(skinAudit, `Secondary-sway mesh ${name} must be included in the skin-weight audit`);
  assert.ok(skinAudit.localBounds && skinAudit.localBounds.size[1] > 0.0001,
    `Secondary-sway mesh ${name} must have finite non-zero vertical bounds`);
  assert.ok(skinAudit.weightedSampleVertices > 0,
    `Secondary-sway mesh ${name} must contain sampled weighted vertices`);
  assert.equal(skinAudit.unweightedSampleVertices, 0,
    `Secondary-sway mesh ${name} must not introduce unweighted samples`);
  return {
    name,
    nodeIndex: node.nodeIndex,
    meshIndex: node.meshIndex,
    skinIndex: node.skinIndex,
    primitiveCount: primitives.length,
    materialIndices,
    sampledVertices: skinAudit.sampledVertices,
    verticalExtent: skinAudit.localBounds.size[1],
    jointCoverage: skinAudit.jointCoverage.slice(0, 4),
  };
});
const garmentSkinWeightInventory = skinWeightAudit.meshAudits
  .filter((mesh) => /cloth|coat|sleeve|skirt|tie|hair/i.test(mesh.nodeName + " " + mesh.meshName))
  .map((mesh) => ({
    node: mesh.nodeName,
    mesh: mesh.meshName,
    sampledVertices: mesh.sampledVertices,
    vertexCount: mesh.vertexCount,
    boundsSampledVertices: mesh.boundsSampledVertices,
    localBounds: mesh.localBounds,
    nodeTransformBounds: mesh.nodeTransformBounds,
    weightedSampleVertices: mesh.weightedSampleVertices,
    unweightedSampleVertices: mesh.unweightedSampleVertices,
    averageWeightSum01: mesh.averageWeightSum01,
    maxWeightSum01: mesh.maxWeightSum01,
    jointCoverage: mesh.jointCoverage.slice(0, 8),
    warnings: mesh.warnings,
  }));

console.log("HOSTED_KURISU_ASSET=PASS", JSON.stringify({
  id: KURISU_HYBRID_MODEL.id,
  bytes: bytes.byteLength,
  sha256,
  nodes: document.nodes.length,
  meshes: document.meshes.length,
  morphTargets,
  animations: (document.animations ?? []).length,
  secondaryAssetAudit: {
    skinJoints: bones.length,
    skinJointNames,
    meshNodeInventory,
    meshNames,
    secondaryVertexSwayAssetAudit,
    materialNames,
    skinnedMeshes: secondaryAudit.skinnedMeshCount,
    morphMeshes: secondaryAudit.morphMeshCount,
    recognizedSecondaryBones: secondaryAudit.recognizedBoneCount,
    unclassifiedBoneNames: secondaryAudit.unclassifiedBoneNames,
    byRole: secondaryAudit.byRole,
    byMeshRole: secondaryAudit.byMeshRole,
    totalMeshNodeCount: secondaryAudit.totalMeshNodeCount,
    namedMorphTargets: secondaryAudit.morphTargetCount,
    rawMorphTargetCount,
    morphChannels: secondaryAudit.morphChannels,
    taggedNeuralMaterials: secondaryAudit.taggedNeuralMaterialCount,
    skinWeightAudit: {
      skinnedNodeCount: skinWeightAudit.skinnedNodeCount,
      auditedNodeCount: skinWeightAudit.auditedNodeCount,
      totalSampledVertices: skinWeightAudit.totalSampledVertices,
      warnings: skinWeightAudit.warnings,
      truncated: skinWeightAudit.truncated,
      garmentAndHairMeshes: garmentSkinWeightInventory,
    },
    warnings: secondaryAudit.warnings,
  },
}));
