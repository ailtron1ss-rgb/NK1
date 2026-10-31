import test from "node:test";
import assert from "node:assert/strict";
import { auditHumanoidRig } from "../src/components/avatar/vrmHumanoidRigAudit.ts";
import {
  buildVrmHumanoidAuditNodes,
  parseVrmHumanoidNodeMap,
} from "../src/components/avatar/vrmHumanoidNodeMap.ts";

function makeScene() {
  const nodes = [];
  const byName = new Map();
  const add = (name, parentName = "SceneRoot") => {
    const node = { name: "scene-node-" + name, isBone: false, parent: parentName ? byName.get(parentName) : null };
    nodes.push(node);
    byName.set(name, node);
    return node;
  };
  const root = { name: "SceneRoot", isBone: false, parent: null };
  nodes.push(root);
  byName.set("SceneRoot", root);
  add("hips");
  add("spine", "hips");
  add("chest", "spine");
  add("neck", "chest");
  add("head", "neck");
  add("leftShoulder", "chest");
  add("leftUpperArm", "leftShoulder");
  add("leftLowerArm", "leftUpperArm");
  add("leftHand", "leftLowerArm");
  add("rightShoulder", "chest");
  add("rightUpperArm", "rightShoulder");
  add("rightLowerArm", "rightUpperArm");
  add("rightHand", "rightLowerArm");
  add("leftUpperLeg", "hips");
  add("leftLowerLeg", "leftUpperLeg");
  add("leftFoot", "leftLowerLeg");
  add("rightUpperLeg", "hips");
  add("rightLowerLeg", "rightUpperLeg");
  add("rightFoot", "rightLowerLeg");
  return { nodes, byName };
}

const requiredVrm1 = [
  "hips", "spine", "head",
  "leftUpperArm", "leftLowerArm", "leftHand",
  "rightUpperArm", "rightLowerArm", "rightHand",
  "leftUpperLeg", "leftLowerLeg", "leftFoot",
  "rightUpperLeg", "rightLowerLeg", "rightFoot",
];

function nodeMapFor(scene, roles) {
  const nodeIndex = new Map(scene.nodes.map((node, index) => [node, index]));
  const associations = new Map(scene.nodes.map((node, index) => [node, { nodes: index }]));
  associations.delete(scene.byName.get("SceneRoot")); // GLTFLoader's synthetic root has no glTF node index.
  const humanBones = Object.fromEntries(roles.map((role) => [role, { node: nodeIndex.get(scene.byName.get(role)) }]));
  return { nodeIndex, associations, humanBones };
}

function auditFromScene(scene, roles, extension) {
  const map = parseVrmHumanoidNodeMap(extension, scene.nodes.length);
  assert.equal(map.status, "valid");
  const bound = buildVrmHumanoidAuditNodes(scene.nodes, nodeMapFor(scene, roles).associations, map);
  return { map, bound, audit: auditHumanoidRig(bound.nodes, {
    vrmVersion: map.version,
    allowNameHeuristic: false,
    mappingWarnings: bound.unresolvedRoles.map((role) => "VRM node index was not found in the loaded scene: " + role),
  }) };
}

test("parses VRMC_vrm 1.0 node-index map and accepts explicitly mapped non-Bone nodes", () => {
  const scene = makeScene();
  const roles = requiredVrm1;
  const { humanBones } = nodeMapFor(scene, roles);
  const extension = { VRMC_vrm: { specVersion: "1.0", humanoid: { humanBones } } };
  const { map, bound, audit } = auditFromScene(scene, roles, extension);
  assert.equal(map.status, "valid");
  assert.equal(map.version, "1.0");
  assert.equal(bound.unresolvedRoles.length, 0);
  assert.equal(bound.nodes.every((node) => node.isBone === false), true);
  assert.equal(audit.mappingMethod, "explicit-vrm-1.0");
  assert.equal(audit.capabilities.fullBodyHumanoid, true);
  assert.equal(audit.nodes.hips?.isBone, false);
  assert.equal(audit.nodes.leftUpperArm?.isBone, false);
  assert.equal(audit.nodes.neck, undefined);
  assert.equal(audit.nodes.chest, undefined);
});

test("legacy VRM 0.x node map applies its stricter required chest and neck roles", () => {
  const scene = makeScene();
  const roles = [...requiredVrm1, "chest", "neck"];
  const nodeIndex = new Map(scene.nodes.map((node, index) => [node, index]));
  const humanBones = roles.map((bone) => ({ bone, node: nodeIndex.get(scene.byName.get(bone)) }));
  const extension = { VRM: { humanoid: { humanBones } } };
  const map = parseVrmHumanoidNodeMap(extension, scene.nodes.length);
  assert.equal(map.status, "valid");
  assert.equal(map.version, "0.x");
  const bound = buildVrmHumanoidAuditNodes(scene.nodes, new Map(scene.nodes.map((node, index) => [node, { nodes: index }])), map);
  const audit = auditHumanoidRig(bound.nodes, { vrmVersion: map.version, allowNameHeuristic: false });
  assert.equal(audit.mappingMethod, "explicit-vrm-0.x");
  assert.equal(audit.capabilities.fullBodyHumanoid, true);
  assert.ok(!audit.missingRequired.includes("chest"));
  assert.ok(!audit.missingRequired.includes("neck"));
});

test("VRM 0.x map without chest and neck is incomplete even when the generic fallback could skip them", () => {
  const scene = makeScene();
  const roles = requiredVrm1;
  const nodeIndex = new Map(scene.nodes.map((node, index) => [node, index]));
  const extension = { VRM: { humanoid: { humanBones: roles.map((bone) => ({ bone, node: nodeIndex.get(scene.byName.get(bone)) })) } } };
  const map = parseVrmHumanoidNodeMap(extension, scene.nodes.length);
  assert.equal(map.status, "valid");
  const bound = buildVrmHumanoidAuditNodes(scene.nodes, new Map(scene.nodes.map((node, index) => [node, { nodes: index }])), map);
  const audit = auditHumanoidRig(bound.nodes, { vrmVersion: map.version, allowNameHeuristic: false });
  assert.equal(audit.capabilities.fullBodyHumanoid, false);
  assert.ok(audit.missingRequired.includes("chest"));
  assert.ok(audit.missingRequired.includes("neck"));
});

test("rejects reused node indices because one glTF node cannot represent two humanoid roles", () => {
  const extension = { VRMC_vrm: { specVersion: "1.0", humanoid: { humanBones: {
    hips: { node: 0 }, spine: { node: 0 },
  } } } };
  const result = parseVrmHumanoidNodeMap(extension, 2);
  assert.equal(result.status, "invalid");
  assert.match(result.reason, /not-unique/);
});

test("rejects malformed, unsupported and out-of-range VRM node references", () => {
  assert.equal(parseVrmHumanoidNodeMap({ VRMC_vrm: { specVersion: "0.9", humanoid: { humanBones: {} } } }, 1).status, "invalid");
  assert.equal(parseVrmHumanoidNodeMap({ VRMC_vrm: { specVersion: "1.0", humanoid: { humanBones: { hips: { node: 4 } } } } }, 1).status, "invalid");
  assert.equal(parseVrmHumanoidNodeMap({ VRMC_vrm: { specVersion: "1.0", humanoid: { humanBones: { hips: { node: -1 } } } } }, 1).status, "invalid");
  assert.equal(parseVrmHumanoidNodeMap({ VRM: { humanoid: { humanBones: [{ bone: "hips", node: 0 }, { bone: "Hips", node: 0 }] } } }, 1).status, "invalid");
  assert.equal(parseVrmHumanoidNodeMap({ VRM: { humanoid: { humanBones: {} } } }, 1).status, "invalid");
  assert.equal(parseVrmHumanoidNodeMap({ VRMC_vrm: { specVersion: "1.0", humanoid: { humanBones: {} } }, VRM: { humanoid: { humanBones: [] } } }, 1).status, "invalid");
  assert.equal(parseVrmHumanoidNodeMap({}, 1).status, "absent");
});

test("present but invalid VRM metadata cannot silently fall back to plausible node names", () => {
  const scene = makeScene();
  const boneLikeNames = scene.nodes.map((node) => ({ ...node, name: node.name.replace("scene-node-", ""), isBone: true }));
  const result = parseVrmHumanoidNodeMap({ VRMC_vrm: { specVersion: "bad" } }, scene.nodes.length);
  assert.equal(result.status, "invalid");
  const audit = auditHumanoidRig(boneLikeNames, { allowNameHeuristic: false, mappingWarnings: [result.reason] });
  assert.equal(audit.capabilities.fullBodyHumanoid, false);
  assert.ok(audit.missingRequired.includes("hips"));
  assert.ok(audit.warnings.includes(result.reason));
});

test("reports VRM node indices missing from the active loaded scene", () => {
  const scene = makeScene();
  const roles = requiredVrm1;
  const { humanBones } = nodeMapFor(scene, roles);
  const extension = { VRMC_vrm: { specVersion: "1.0", humanoid: { humanBones } } };
  const map = parseVrmHumanoidNodeMap(extension, scene.nodes.length + 1);
  assert.equal(map.status, "valid");
  const associations = new Map(scene.nodes.filter((node) => node !== scene.byName.get("leftHand")).map((node) => [node, { nodes: scene.nodes.indexOf(node) }]));
  const bound = buildVrmHumanoidAuditNodes(scene.nodes, associations, map);
  assert.ok(bound.unresolvedRoles.includes("leftHand"));
});

test("node-index adapter preserves non-humanoid parent nodes between mapped humanoid roles", () => {
  const scene = makeScene();
  const between = { name: "", isBone: false, parent: scene.byName.get("spine") };
  const upper = scene.byName.get("leftUpperArm");
  upper.parent = between;
  scene.nodes.push(between);
  const roles = requiredVrm1;
  const { humanBones } = nodeMapFor(scene, roles);
  const extension = { VRMC_vrm: { specVersion: "1.0", humanoid: { humanBones } } };
  const { audit } = auditFromScene(scene, roles, extension);
  assert.equal(audit.capabilities.fullBodyHumanoid, true);
});

test("ignores a synthetic loader scene root that has no glTF node association", () => {
  const scene = makeScene();
  const roles = requiredVrm1;
  const { humanBones, associations } = nodeMapFor(scene, roles);
  const extension = { VRMC_vrm: { specVersion: "1.0", humanoid: { humanBones } } };
  const { audit, bound } = auditFromScene(scene, roles, extension);
  assert.equal(bound.nodes.some((node) => node.name === "scene-node-SceneRoot"), false);
  assert.equal(bound.unresolvedRoles.length, 0);
  assert.equal(audit.capabilities.fullBodyHumanoid, true);
  assert.ok(associations.has(scene.byName.get("hips")));
});
test("does not fabricate role nodes when parser associations are unavailable", () => {
  const scene = makeScene();
  const roles = requiredVrm1;
  const { humanBones } = nodeMapFor(scene, roles);
  const map = parseVrmHumanoidNodeMap({ VRMC_vrm: { specVersion: "1.0", humanoid: { humanBones } } }, scene.nodes.length);
  const bound = buildVrmHumanoidAuditNodes(scene.nodes, undefined, map);
  assert.equal(bound.nodes.length, 0);
  assert.equal(bound.unresolvedRoles.length, roles.length);
  const audit = auditHumanoidRig(bound.nodes, { vrmVersion: "1.0", allowNameHeuristic: false });
  assert.equal(audit.capabilities.fullBodyHumanoid, false);
});

function addFingerRoles(scene, side, vrmVersion) {
  const add = (name, parent) => {
    const node = { name: "scene-node-" + name, isBone: false, parent: scene.byName.get(parent) };
    scene.nodes.push(node);
    scene.byName.set(name, node);
  };
  for (const finger of ["Thumb", "Index", "Middle", "Ring", "Little"]) {
    const segments = finger === "Thumb" && vrmVersion === "1.0"
      ? ["Metacarpal", "Proximal", "Distal"]
      : ["Proximal", "Intermediate", "Distal"];
    let parent = side.toLowerCase() + "Hand";
    for (const segment of segments) {
      const role = side.toLowerCase() + finger + segment;
      add(role, parent);
      parent = role;
    }
  }
}

test("VRM 1.0 uses thumb metacarpal/proximal/distal while the other fingers use three phalanges", () => {
  const scene = makeScene();
  addFingerRoles(scene, "Left", "1.0");
  addFingerRoles(scene, "Right", "1.0");
  const roles = [...requiredVrm1, ...scene.nodes.map((node) => node.name.replace("scene-node-", "")).filter((name) => /^(left|right)(Thumb|Index|Middle|Ring|Little)/.test(name))];
  const { humanBones } = nodeMapFor(scene, roles);
  const extension = { VRMC_vrm: { specVersion: "1.0", humanoid: { humanBones } } };
  const { audit, map } = auditFromScene(scene, roles, extension);
  assert.equal(map.status, "valid");
  assert.equal(map.nodeRoleByIndex.size - requiredVrm1.length, 30);
  assert.equal(audit.capabilities.leftFingerCount, 15);
  assert.equal(audit.capabilities.rightFingerCount, 15);
  assert.equal(audit.capabilities.fingerArticulation, true);
  assert.ok(audit.nodes.leftThumbMetacarpal);
  assert.equal(audit.nodes.leftThumbIntermediate, undefined);
});

test("VRM 0.x keeps its legacy thumb proximal/intermediate/distal chain", () => {
  const scene = makeScene();
  addFingerRoles(scene, "Left", "0.x");
  addFingerRoles(scene, "Right", "0.x");
  const roles = [...requiredVrm1, "chest", "neck", ...scene.nodes.map((node) => node.name.replace("scene-node-", "")).filter((name) => /^(left|right)(Thumb|Index|Middle|Ring|Little)/.test(name))];
  const nodeIndex = new Map(scene.nodes.map((node, index) => [node, index]));
  const extension = { VRM: { humanoid: { humanBones: roles.map((bone) => ({ bone, node: nodeIndex.get(scene.byName.get(bone)) })) } } };
  const map = parseVrmHumanoidNodeMap(extension, scene.nodes.length);
  assert.equal(map.status, "valid");
  const bound = buildVrmHumanoidAuditNodes(scene.nodes, nodeMapFor(scene, []).associations, map);
  const audit = auditHumanoidRig(bound.nodes, { vrmVersion: map.version, allowNameHeuristic: false });
  assert.equal(audit.capabilities.leftFingerCount, 15);
  assert.equal(audit.capabilities.rightFingerCount, 15);
  assert.equal(audit.capabilities.fingerArticulation, true);
  assert.ok(audit.nodes.leftThumbIntermediate);
  assert.equal(audit.nodes.leftThumbMetacarpal, undefined);
});

test("VRM thumb role names cannot cross version boundaries", () => {
  const vrm1 = parseVrmHumanoidNodeMap({ VRMC_vrm: { specVersion: "1.0", humanoid: { humanBones: { leftThumbIntermediate: { node: 0 } } } } }, 1);
  const vrm0 = parseVrmHumanoidNodeMap({ VRM: { humanoid: { humanBones: [{ bone: "leftThumbMetacarpal", node: 0 }] } } }, 1);
  assert.equal(vrm1.status, "invalid");
  assert.match(vrm1.reason, /not-a-vrm-1.0/);
  assert.equal(vrm0.status, "invalid");
  assert.match(vrm0.reason, /not-a-vrm-0.x/);
});
