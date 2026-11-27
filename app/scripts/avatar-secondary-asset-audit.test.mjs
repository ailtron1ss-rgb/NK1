import assert from "node:assert/strict";
import test from "node:test";
import {
  auditAvatarSecondaryAssetDescriptor,
  auditAvatarSecondaryScene,
  isAvatarNeuralFabricMaterialTagged,
} from "../src/components/avatar/avatarSecondaryAssetAudit.ts";

function node(name, options = {}) {
  const value = {
    name,
    isBone: options.isBone === true,
    isMesh: options.isMesh === true || options.isSkinnedMesh === true,
    isSkinnedMesh: options.isSkinnedMesh === true,
    children: [],
    parent: null,
    ...(options.morphTargetDictionary ? { morphTargetDictionary: options.morphTargetDictionary } : {}),
    ...(options.material ? { material: options.material } : {}),
    ...(options.userData ? { userData: options.userData } : {}),
  };
  return value;
}

function attach(parent, child) {
  child.parent = parent;
  parent.children.push(child);
  return child;
}

test("audit reports actual secondary bone chains, authored morphs and tagged neural fabric", () => {
  const root = node("Scene");
  const hairRoot = attach(root, node("HairLockL_Root", { isBone: true }));
  const hairMid = attach(hairRoot, node("HairLockL_Mid", { isBone: true }));
  attach(hairMid, node("HairLockL_Tip", { isBone: true }));
  const coatRoot = attach(root, node("CoatPanelR_Root", { isBone: true }));
  const coatMid = attach(coatRoot, node("CoatPanelR_Mid", { isBone: true }));
  attach(coatMid, node("CoatPanelR_Hem", { isBone: true }));
  attach(root, node("leftSleeveFollow", { isBone: true }));
  attach(root, node("NK1_NeuralFiber_02", { isBone: true }));
  attach(root, node("head", { isBone: true }));
  attach(root, node("jaw", { isBone: true }));
  const mesh = attach(root, node("CharacterMesh", {
    isSkinnedMesh: true,
    morphTargetDictionary: {
      NK1_Cloth_Sway: 0,
      NK1_Hair_Sway: 1,
      NK1_Tissue_Breath: 2,
      NK1_Neural_Pulse: 3,
      happy: 4,
      jawOpen: 5,
    },
    material: {
      name: "NK1_NEURAL_Seam",
      emissive: { r: 0.1, g: 0.2, b: 0.3 },
      emissiveIntensity: 0.8,
    },
  }));
  mesh.material.emissiveMap = null;

  const report = auditAvatarSecondaryScene(root);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.totalBoneCount, 10);
  assert.equal(report.recognizedBoneCount, 6);
  assert.equal(report.byRole.hair.boneCount, 2);
  assert.equal(report.byRole.hair.chainRoots, 1);
  assert.equal(report.byRole.hair.maxChainDepth, 2);
  assert.equal(report.byRole.garment.boneCount, 2);
  assert.equal(report.byRole.garment.chainRoots, 1);
  assert.equal(report.byRole.sleeve.boneCount, 1);
  assert.equal(report.byRole.neuralFiber.boneCount, 1);
  assert.equal(report.skinnedMeshCount, 1);
  assert.equal(report.morphMeshCount, 1);
  assert.deepEqual(report.morphChannels.map((item) => item.channel), ["cloth", "hair", "tissue", "neural"]);
  assert.equal(report.morphTargetCount, 6);
  assert.equal(report.taggedNeuralMaterialCount, 1);
  assert.equal(report.secondaryPhysicsReady, true);
  assert.equal(report.warnings.length, 0);
});

test("audit fails honestly when a model has only its primary skeleton and facial morphs", () => {
  const root = node("Scene");
  attach(root, node("Hips", { isBone: true }));
  attach(root, node("Spine", { isBone: true }));
  attach(root, node("Head", { isBone: true }));
  attach(root, node("Bone.001", { isBone: true }));
  attach(root, node("jawOpen", { isSkinnedMesh: true, morphTargetDictionary: { jawOpen: 0, happy: 1 }, material: { name: "Silver", emissive: { r: 1, g: 1, b: 1 } } }));

  const report = auditAvatarSecondaryScene(root);
  assert.equal(report.recognizedBoneCount, 0);
  assert.equal(report.secondaryPhysicsReady, false);
  assert.deepEqual(report.morphChannels, []);
  assert.equal(report.taggedNeuralMaterialCount, 0);
  assert.deepEqual(report.unclassifiedBoneNames, ["Bone.001"]);
  assert.ok(report.warnings.includes("no-secondary-bone-chains"));
  assert.ok(report.warnings.includes("no-neuroadaptive-morphs"));
  assert.ok(report.warnings.includes("no-tagged-neural-fabric"));
});

test("audit keeps duplicate-named bones distinct and ignores detached or cyclic scene nodes safely", () => {
  const root = node("Scene");
  const first = attach(root, node("HairLockL_Mid", { isBone: true }));
  const second = attach(root, node("HairLockL_Mid", { isBone: true }));
  attach(first, node("HairLockL_Tip", { isBone: true }));
  // A malformed parent cycle must not make traversal unbounded.
  second.children.push(root);
  root.parent = second;

  const report = auditAvatarSecondaryScene(root);
  assert.equal(report.byRole.hair.boneCount, 3);
  assert.equal(report.byRole.hair.chainRoots, 2);
});

test("hosted GLB descriptor audit resolves skin-joint ancestry, explicit node extras and material extras", () => {
  const report = auditAvatarSecondaryAssetDescriptor({
    bones: [
      { id: "hair-mid", name: "Bone.002", parentId: "hair-root", metadata: { role: "hair", chainId: "fringe-left", side: "left" } },
      { id: "hair-tip", name: "Bone.003", parentId: "hair-mid", metadata: { role: "hair", chainId: "fringe-left", side: "left", distalWeight: 1 } },
      { id: "coat-mid", name: "Node_42", parentId: "coat-root", metadata: { role: "garment", chainId: "coat-right", side: "right" } },
    ],
    morphTargetNames: ["NK1_Cloth_Sway", "NK1_Hair_Sway", "happy"],
    materials: [
      { name: "Trim", extras: { nk1DynamicLayer: "neural" }, emissiveFactor: [0.1, 0.2, 0.3] },
      { name: "Other", emissiveFactor: [1, 1, 1] },
    ],
    skinnedMeshCount: 2,
    morphMeshCount: 1,
  });
  assert.equal(report.byRole.hair.boneCount, 2);
  assert.equal(report.byRole.hair.chainRoots, 1);
  assert.equal(report.byRole.hair.maxChainDepth, 2);
  assert.equal(report.byRole.garment.chainRoots, 1);
  assert.deepEqual(report.morphChannels.map((item) => item.channel), ["cloth", "hair"]);
  assert.equal(report.taggedNeuralMaterialCount, 1);
  assert.equal(report.skinnedMeshCount, 2);
  assert.equal(report.morphMeshCount, 1);
});

test("live Three.js scene audit reads explicit nk1Secondary metadata from node userData", () => {
  const root = node("Scene");
  const pinnedRoot = attach(root, node("Bone.Root", { isBone: true, userData: { nk1Secondary: { role: "hair", chainId: "bang-left", side: "left", pinned: true } } }));
  const mid = attach(pinnedRoot, node("Bone.001", { isBone: true, userData: { nk1Secondary: { role: "hair", chainId: "bang-left", side: "left" } } }));
  attach(mid, node("Bone.002", { isBone: true, userData: { nk1Secondary: { role: "hair", chainId: "bang-left", side: "left", distalWeight: 1 } } }));
  const report = auditAvatarSecondaryScene(root);
  assert.equal(report.byRole.hair.boneCount, 2);
  assert.equal(report.byRole.hair.chainRoots, 1);
  assert.equal(report.byRole.hair.maxChainDepth, 2);
  assert.equal(report.secondaryPhysicsReady, true);
});

test("scene audit reports separate hair, clothing and sleeve mesh parts without claiming they are simulated", () => {
  const root = node("Scene");
  attach(root, node("HAIR_front_strand_L", { isSkinnedMesh: true }));
  attach(root, node("HAIR_long_lock_R", { isSkinnedMesh: true }));
  attach(root, node("CLOTH_labcoat_main", { isSkinnedMesh: true }));
  attach(root, node("CLOTH_skirt", { isSkinnedMesh: true }));
  attach(root, node("CLOTH_upper_sleeve_L", { isSkinnedMesh: true }));
  attach(root, node("ACCESSORY_red_hairclip", { isSkinnedMesh: true }));
  const report = auditAvatarSecondaryScene(root);
  assert.equal(report.byMeshRole.hair.meshNodeCount, 2);
  assert.equal(report.byMeshRole.hair.skinnedMeshNodeCount, 2);
  assert.equal(report.byMeshRole.garment.meshNodeCount, 2);
  assert.equal(report.byMeshRole.sleeve.meshNodeCount, 1);
  assert.deepEqual(report.byMeshRole.hair.meshNames, ["HAIR_front_strand_L", "HAIR_long_lock_R"]);
  assert.equal(report.recognizedBoneCount, 0);
  assert.equal(report.secondaryPhysicsReady, false);
});

test("neural-fabric material tag requires an explicit NK1 layer or semantic name", () => {
  assert.equal(isAvatarNeuralFabricMaterialTagged({ name: "NK1_NEURAL_Piping" }), true);
  assert.equal(isAvatarNeuralFabricMaterialTagged({ name: "NK1SynapseGlow" }), true);
  assert.equal(isAvatarNeuralFabricMaterialTagged({ name: "MetalTrim", userData: { nk1DynamicLayer: "neural" } }), true);
  assert.equal(isAvatarNeuralFabricMaterialTagged({ name: "MetalTrim", emissive: { r: 1, g: 1, b: 1 } }), false);
  assert.equal(isAvatarNeuralFabricMaterialTagged({ name: "NK1_NEURAL" }), false);
});

test("3D stage publishes an audit for the imported model and exposes it in an accessible details panel", async () => {
  const { readFile } = await import("node:fs/promises");
  const stage = await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8");
  assert.match(stage, /auditAvatarSecondaryScene\(root\)/);
  assert.match(stage, /setSecondaryAudit\(/);
  assert.match(stage, /secondaryAudit\.byRole\.hair/);
  assert.match(stage, /secondaryAudit\.byMeshRole\.hair/);
  assert.match(stage, /secondaryAudit\.byMeshRole\.garment/);
  assert.match(stage, /secondaryAudit\.byMeshRole\.sleeve/);
  assert.match(stage, /secondaryAudit\.morphChannels/);
  assert.match(stage, /metadata:bone\.node\?\.userData\?\.nk1Secondary/);
  assert.match(stage, /<details/);
  assert.match(stage, /Аудит физики/);
  assert.match(stage, /secondaryAudit\.secondaryPhysicsReady/);
  assert.match(stage, /нужны размеченные кости или morph-каналы/);
});
