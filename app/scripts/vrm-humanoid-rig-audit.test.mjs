import test from "node:test";
import assert from "node:assert/strict";
import { auditHumanoidRig } from "../src/components/avatar/vrmHumanoidRigAudit.ts";

function chain(names) {
  let parent = null;
  const nodes = {};
  for (const name of names) {
    nodes[name] = { name, isBone: true, parent };
    parent = nodes[name];
  }
  return nodes;
}
const coreNames = [
  "Hips", "Spine", "Chest", "Neck", "Head",
  "LeftUpperArm", "LeftLowerArm", "LeftHand", "RightUpperArm", "RightLowerArm", "RightHand",
  "LeftUpperLeg", "LeftLowerLeg", "LeftFoot", "RightUpperLeg", "RightLowerLeg", "RightFoot",
];

test("reports the exact supported body capabilities instead of assuming every GLB is humanoid", () => {
  const nodes = chain(coreNames);
  const audit = auditHumanoidRig(Object.values(nodes));
  assert.equal(audit.mappingMethod, "conservative-name-heuristic");
  assert.equal(audit.capabilities.torso, true);
  assert.equal(audit.capabilities.bilateralArms, true);
  assert.equal(audit.capabilities.bilateralHands, true);
  assert.equal(audit.capabilities.bilateralLegs, true);
  assert.equal(audit.capabilities.bilateralFeet, true);
  assert.equal(audit.capabilities.locomotionSkeleton, true);
  assert.equal(audit.capabilities.fullBodyHumanoid, true);
  assert.equal(audit.capabilities.fingerArticulation, false);
});

test("refuses missing and ambiguous bones and exposes them as explicit capability gaps", () => {
  const missing = auditHumanoidRig(chain(coreNames.filter((name) => name !== "RightFoot")) && Object.values(chain(coreNames.filter((name) => name !== "RightFoot"))));
  assert.ok(missing.missingRequired.includes("rightFoot"));
  assert.equal(missing.capabilities.locomotionSkeleton, false);
  const ambiguousNodes = [...Object.values(chain(coreNames)), { name: "LeftUpperArm", isBone: true, parent: null }];
  const ambiguous = auditHumanoidRig(ambiguousNodes);
  assert.ok(ambiguous.ambiguous.includes("leftUpperArm"));
  assert.equal(ambiguous.nodes.leftUpperArm, undefined);
  assert.equal(ambiguous.capabilities.bilateralArms, false);
});

test("detects broken parent hierarchy instead of treating name matches as a valid rig", () => {
  const nodes = chain(coreNames);
  nodes.LeftLowerArm.parent = null;
  const audit = auditHumanoidRig(Object.values(nodes));
  assert.equal(audit.capabilities.fullBodyHumanoid, false);
  assert.ok(audit.warnings.some((warning) => warning.includes("Unexpected parent hierarchy")));
});

test("maps optional eyes and all 30 finger segments when explicitly named", () => {
  const names = [...coreNames, "LeftEye", "RightEye"];
  for (const side of ["Left", "Right"]) for (const finger of ["Thumb", "Index", "Middle", "Ring", "Little"]) for (const segment of ["Proximal", "Intermediate", "Distal"]) names.push(side + finger + segment);
  const nodes = chain(names);
  const audit = auditHumanoidRig(Object.values(nodes));
  assert.equal(audit.capabilities.eyes, true);
  assert.equal(audit.capabilities.leftFingerCount, 15);
  assert.equal(audit.capabilities.rightFingerCount, 15);
  assert.equal(audit.capabilities.fingerArticulation, true);
});

test("does not infer a deforming skeleton from ordinary scene nodes", () => {
  const audit = auditHumanoidRig(Object.values(chain(coreNames)).map(({ name, parent }) => ({ name, parent, isBone: false })));
  assert.ok(audit.warnings.some((warning) => warning.includes("not proof of a deforming skeleton")));
});
