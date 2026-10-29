import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { canonicalizeHumanoidBoneName, normalizeHumanoidBoneName } from "../src/components/avatar/humanoidBoneMap.ts";

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

test("the active 3D stage uses the canonicalized bone roles", async () => {
  const stage = await readFile(path.join(appRoot, "src/components/Avatar3DStage.tsx"), "utf8");
  assert.match(stage, /canonicalizeHumanoidBoneName\(node\.name\)/);
  assert.match(stage, /n\.includes\("leftupperarm"\)/);
  assert.match(stage, /n\.includes\("rightupperarm"\)/);
});
