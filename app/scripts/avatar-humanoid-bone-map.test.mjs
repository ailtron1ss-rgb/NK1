import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildHumanoidRoleMap, canonicalizeHumanoidBoneName, normalizeHumanoidBoneName } from "../src/components/avatar/humanoidBoneMap.ts";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("maps VRM humanoid bone names into the motor adapter vocabulary", () => {
  assert.equal(canonicalizeHumanoidBoneName("J_Bip_C_Head"), "head");
  assert.equal(canonicalizeHumanoidBoneName("J_Bip_C_Neck"), "neck");
  assert.equal(canonicalizeHumanoidBoneName("J_Bip_L_UpperArm"), "leftupperarm");
  assert.equal(canonicalizeHumanoidBoneName("J_Bip_R_UpperArm"), "rightupperarm");
  assert.equal(canonicalizeHumanoidBoneName("J_Bip_L_LowerArm"), "leftlowerarm");
  assert.equal(canonicalizeHumanoidBoneName("J_Bip_R_LowerArm"), "rightlowerarm");
});

test("maps common Blender and Mixamo aliases without inventing roles for unknown bones", () => {
  assert.equal(canonicalizeHumanoidBoneName("mixamorig:LeftArm"), "leftupperarm");
  assert.equal(canonicalizeHumanoidBoneName("mixamorigRightArm"), "rightupperarm");
  assert.equal(canonicalizeHumanoidBoneName("upper_arm.L"), "leftupperarm");
  assert.equal(canonicalizeHumanoidBoneName("upper_arm.R"), "rightupperarm");
  assert.equal(canonicalizeHumanoidBoneName("mixamorig:Head"), "head");
  assert.equal(canonicalizeHumanoidBoneName("SomeCustomProp"), "somecustomprop");
  assert.equal(normalizeHumanoidBoneName(null), "");
});

test("reads VRM 1.0 humanoid node roles even when imported node names are custom", () => {
  const roles = buildHumanoidRoleMap({
    VRMC_vrm: {
      humanoid: {
        humanBones: {
          head: { node: 5 },
          leftUpperArm: { node: 8 },
          rightUpperArm: { node: 11 },
          leftLowerArm: { node: 9 },
        },
      },
    },
  });
  assert.equal(roles.get(5), "head");
  assert.equal(roles.get(8), "leftupperarm");
  assert.equal(roles.get(11), "rightupperarm");
  assert.equal(roles.get(9), "leftlowerarm");
});

test("reads legacy VRM 0.x humanoid node roles and ignores invalid entries", () => {
  const roles = buildHumanoidRoleMap({
    VRM: {
      humanoid: {
        humanBones: [
          { bone: "head", node: 2 },
          { bone: "leftUpperArm", node: 7 },
          { bone: "rightUpperArm", node: 10 },
          { bone: "leftLowerArm", node: 8 },
          { bone: "unknown-custom-role", node: 12 },
          { bone: "rightLowerArm", node: -1 },
        ],
      },
    },
  });
  assert.equal(roles.get(2), "head");
  assert.equal(roles.get(7), "leftupperarm");
  assert.equal(roles.get(10), "rightupperarm");
  assert.equal(roles.get(8), "leftlowerarm");
  assert.equal(roles.has(12), false);
  assert.equal(roles.has(-1), false);
});

test("the active 3D stage uses the canonicalized bone roles", async () => {
  const stage = await readFile(path.join(appRoot, "src/components/Avatar3DStage.tsx"), "utf8");
  assert.match(stage, /canonicalizeHumanoidBoneName\(node\.name\)/);
  assert.match(stage, /vrm\?\.humanoid\?\.getNormalizedBoneNode\?\.\(boneName\)/);
  assert.match(stage, /bonesOf\(root,gltf,vrm\)/);
  assert.match(stage, /vrm\?\.humanoid\?\.getNormalizedBoneNode\?\.\(boneName\)/);
  assert.match(stage, /bonesOf\(root,gltf,vrm\)/);
  assert.match(stage, /n\.includes\("leftupperarm"\)/);
  assert.match(stage, /n\.includes\("rightupperarm"\)/);
});


test("canonicalizes full-body VRM and common DCC aliases", () => {
  const cases = [
    ["J_Bip_C_Hips", "hips"], ["J_Bip_C_Spine", "spine"],
    ["J_Bip_C_Head", "head"], ["J_Bip_L_Shoulder", "leftshoulder"],
    ["J_Bip_L_Hand", "lefthand"], ["J_Bip_R_Hand", "righthand"],
    ["mixamorig:LeftUpLeg", "leftupperleg"],
    ["mixamorig:RightLeg", "rightlowerleg"],
    ["mixamorig:LeftFoot", "leftfoot"],
    ["mixamorig:RightToeBase", "righttoes"],
    ["thumb_proximal.L", "leftthumbproximal"],
    ["index_intermediate.R", "rightindexintermediate"],
    ["J_Bip_L_Index3", "leftindexdistal"],
  ];
  for (const [source, expected] of cases) {
    assert.equal(canonicalizeHumanoidBoneName(source), expected, source);
  }
});

test("maps the complete VRM 1.0 body, feet and finger roles by node index", () => {
  const roles = buildHumanoidRoleMap({
    VRMC_vrm: { humanoid: { humanBones: {
      hips: { node: 0 }, spine: { node: 1 }, chest: { node: 2 },
      leftUpperLeg: { node: 10 }, rightFoot: { node: 21 },
      leftHand: { node: 30 }, leftIndexIntermediate: { node: 33 },
      rightLittleDistal: { node: 48 }, leftToes: { node: 50 },
    } } },
  });
  assert.equal(roles.get(0), "hips");
  assert.equal(roles.get(2), "chest");
  assert.equal(roles.get(10), "leftupperleg");
  assert.equal(roles.get(21), "rightfoot");
  assert.equal(roles.get(30), "lefthand");
  assert.equal(roles.get(33), "leftindexintermediate");
  assert.equal(roles.get(48), "rightlittledistal");
  assert.equal(roles.get(50), "lefttoes");
});

test("maps legacy VRM 0.x finger chains and rejects unknown role names", () => {
  const roles = buildHumanoidRoleMap({
    VRM: { humanoid: { humanBones: [
      { bone: "leftThumbProximal", node: 4 },
      { bone: "rightMiddleIntermediate", node: 8 },
      { bone: "leftLittleDistal", node: 12 },
      { bone: "customAccessory", node: 16 },
    ] } },
  });
  assert.equal(roles.get(4), "leftthumbproximal");
  assert.equal(roles.get(8), "rightmiddleintermediate");
  assert.equal(roles.get(12), "leftlittledistal");
  assert.equal(roles.has(16), false);
});
