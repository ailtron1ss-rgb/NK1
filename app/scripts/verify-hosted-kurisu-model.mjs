import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { KURISU_HYBRID_MODEL } from "../src/components/avatar/avatarModelCatalog.ts";
import { preflightAvatarModel } from "../src/components/avatar/avatarModelPreflight.ts";
import { auditAvatarSecondaryAssetDescriptor } from "../src/components/avatar/avatarSecondaryAssetAudit.ts";

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
    materialNames,
    skinnedMeshes: secondaryAudit.skinnedMeshCount,
    morphMeshes: secondaryAudit.morphMeshCount,
    recognizedSecondaryBones: secondaryAudit.recognizedBoneCount,
    unclassifiedBoneNames: secondaryAudit.unclassifiedBoneNames,
    byRole: secondaryAudit.byRole,
    namedMorphTargets: secondaryAudit.morphTargetCount,
    rawMorphTargetCount,
    morphChannels: secondaryAudit.morphChannels,
    taggedNeuralMaterials: secondaryAudit.taggedNeuralMaterialCount,
    warnings: secondaryAudit.warnings,
  },
}));
