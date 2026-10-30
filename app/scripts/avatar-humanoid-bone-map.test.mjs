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
  assert.match(stage, /n\.includes\("leftupperarm"\)/);
  assert.match(stage, /n\.includes\("rightupperarm"\)/);
});
