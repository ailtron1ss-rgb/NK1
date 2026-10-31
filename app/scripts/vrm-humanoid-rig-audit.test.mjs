import test from "node:test";
import assert from "node:assert/strict";
import { auditHumanoidRig } from "../src/components/avatar/vrmHumanoidRigAudit.ts";

function buildHumanoidRig() {
  const nodes = new Map();
  const add = (name, parentName = null, isBone = true) => {
    const node = { name, isBone, parent: parentName ? nodes.get(parentName) : null };
    nodes.set(name, node);
    return node;
  };
  add("Hips");
  add("Spine", "Hips");
  add("Chest", "Spine");
  add("Neck", "Chest");
  add("Head", "Neck");
  add("LeftShoulder", "Chest");
  add("LeftUpperArm", "LeftShoulder");
  add("LeftLowerArm", "LeftUpperArm");
  add("LeftHand", "LeftLowerArm");
  add("RightShoulder", "Chest");
  add("RightUpperArm", "RightShoulder");
  add("RightLowerArm", "RightUpperArm");
  add("RightHand", "RightLowerArm");
  add("LeftUpperLeg", "Hips");
  add("LeftLowerLeg", "LeftUpperLeg");
  add("LeftFoot", "LeftLowerLeg");
  add("RightUpperLeg", "Hips");
  add("RightLowerLeg", "RightUpperLeg");
  add("RightFoot", "RightLowerLeg");
  return nodes;
}
const values = (nodes) => Array.from(nodes.values());

test("reports only articulated capabilities proven by unique bone names and connected hierarchy", () => {
  const audit = auditHumanoidRig(values(buildHumanoidRig()));
  assert.equal(audit.mappingMethod, "conservative-name-heuristic");
  assert.equal(audit.capabilities.torso, true);
  assert.equal(audit.capabilities.head, true);
  assert.equal(audit.capabilities.bilateralArms, true);
  assert.equal(audit.capabilities.bilateralHands, true);
  assert.equal(audit.capabilities.bilateralLegs, true);
  assert.equal(audit.capabilities.bilateralFeet, true);
  assert.equal(audit.capabilities.locomotionSkeleton, true);
  assert.equal(audit.capabilities.fullBodyHumanoid, true);
  assert.equal(audit.capabilities.fingerArticulation, false);
  assert.deepEqual(audit.nonBoneMatches, []);
});

test("refuses missing and ambiguous bones and exposes them as explicit capability gaps", () => {
  const nodes = buildHumanoidRig();
  nodes.delete("RightFoot");
  const missing = auditHumanoidRig(values(nodes));
  assert.ok(missing.missingRequired.includes("rightFoot"));
  assert.equal(missing.capabilities.locomotionSkeleton, false);
  const ambiguousNodes = values(buildHumanoidRig());
  ambiguousNodes.push({ name: "LeftUpperArm", isBone: true, parent: null });
  const ambiguous = auditHumanoidRig(ambiguousNodes);
  assert.ok(ambiguous.ambiguous.includes("leftUpperArm"));
  assert.equal(ambiguous.nodes.leftUpperArm, undefined);
  assert.equal(ambiguous.capabilities.bilateralArms, false);
});

test("name matches on ordinary scene nodes never become bones or full-body capability", () => {
  const ordinaryNodes = values(buildHumanoidRig()).map(({ name, parent }) => ({ name, parent, isBone: false }));
  const audit = auditHumanoidRig(ordinaryNodes);
  assert.equal(audit.capabilities.fullBodyHumanoid, false);
  assert.equal(audit.capabilities.locomotionSkeleton, false);
  assert.equal(audit.nodes.hips, undefined);
  assert.ok(audit.missingRequired.includes("hips"));
  assert.ok(audit.nonBoneMatches.includes("hips"));
  assert.ok(audit.warnings.some((warning) => warning.includes("not bones")));
  assert.ok(audit.warnings.some((warning) => warning.includes("not proof of a deforming skeleton")));
});

test("a non-bone duplicate cannot override or make a unique real bone ambiguous", () => {
  const nodes = values(buildHumanoidRig());
  nodes.push({ name: "Hips", isBone: false, parent: null });
  const audit = auditHumanoidRig(nodes);
  assert.equal(audit.nodes.hips?.isBone, true);
  assert.equal(audit.ambiguous.includes("hips"), false);
  assert.equal(audit.capabilities.fullBodyHumanoid, true);
});

test("detects disconnected torso and limb hierarchy instead of trusting role names", () => {
  const nodes = buildHumanoidRig();
  nodes.get("LeftLowerArm").parent = nodes.get("Hips");
  nodes.get("RightUpperLeg").parent = nodes.get("Spine");
  const audit = auditHumanoidRig(values(nodes));
  assert.equal(audit.capabilities.fullBodyHumanoid, false);
  assert.equal(audit.capabilities.locomotionSkeleton, false);
  assert.ok(audit.warnings.some((warning) => warning.includes("Unexpected parent hierarchy")));
});

test("rejects cyclic bone parent graphs even when named roles can still be reached", () => {
  const nodes = buildHumanoidRig();
  nodes.get("Spine").parent = nodes.get("Head");
  const audit = auditHumanoidRig(values(nodes));
  assert.equal(audit.capabilities.fullBodyHumanoid, false);
  assert.equal(audit.capabilities.locomotionSkeleton, false);
  assert.ok(audit.warnings.some((warning) => warning.includes("Cyclic parent hierarchy")));
});

test("supports an optional chest/neck fallback without inventing missing joints", () => {
  const nodes = buildHumanoidRig();
  nodes.delete("Chest");
  nodes.delete("Neck");
  nodes.get("LeftShoulder").parent = nodes.get("Spine");
  nodes.get("RightShoulder").parent = nodes.get("Spine");
  nodes.get("Head").parent = nodes.get("Spine");
  const audit = auditHumanoidRig(values(nodes));
  assert.equal(audit.capabilities.fullBodyHumanoid, true);
  assert.equal(audit.capabilities.head, true);
  assert.ok(audit.warnings.some((warning) => warning.includes("Neck articulation is unavailable")));
});

test("maps optional eyes and all 30 finger segments only when their parent chains are complete", () => {
  const nodes = buildHumanoidRig();
  for (const [side, hand] of [["Left", "LeftHand"], ["Right", "RightHand"]]) {
    for (const finger of ["Thumb", "Index", "Middle", "Ring", "Little"]) {
      const proximal = side + finger + "Proximal";
      const intermediate = side + finger + "Intermediate";
      const distal = side + finger + "Distal";
      addToMap(nodes, side + "Eye", side === "Left" ? "Head" : "Head");
      addToMap(nodes, proximal, hand);
      addToMap(nodes, intermediate, proximal);
      addToMap(nodes, distal, intermediate);
    }
  }
  const audit = auditHumanoidRig(values(nodes));
  assert.equal(audit.capabilities.eyes, true);
  assert.equal(audit.capabilities.leftFingerCount, 15);
  assert.equal(audit.capabilities.rightFingerCount, 15);
  assert.equal(audit.capabilities.fingerArticulation, true);
  const broken = buildHumanoidRig();
  for (const [side, hand] of [["Left", "LeftHand"], ["Right", "RightHand"]]) {
    for (const finger of ["Thumb", "Index", "Middle", "Ring", "Little"]) {
      const proximal = side + finger + "Proximal";
      const intermediate = side + finger + "Intermediate";
      const distal = side + finger + "Distal";
      addToMap(broken, proximal, hand);
      addToMap(broken, intermediate, proximal);
      addToMap(broken, distal, intermediate);
    }
  }
  broken.get("LeftIndexIntermediate").parent = broken.get("LeftHand");
  assert.equal(auditHumanoidRig(values(broken)).capabilities.fingerArticulation, false);
});

test("deduplicates repeated object references and rejects malformed input containers", () => {
  const nodes = buildHumanoidRig();
  const hips = nodes.get("Hips");
  const audit = auditHumanoidRig([...values(nodes), hips]);
  assert.equal(audit.ambiguous.includes("hips"), false);
  assert.throws(() => auditHumanoidRig(null), /array/);
});

function addToMap(nodes, name, parentName) {
  const node = { name, isBone: true, parent: nodes.get(parentName) ?? null };
  nodes.set(name, node);
  return node;
}
