/**
 * Conservative, renderer-independent humanoid rig discovery for imported VRM/GLB.
 *
 * This is a name-based audit, NOT a claim that arbitrary GLB bones implement the
 * VRM humanoid specification. A production VRM runtime should supply semantic
 * humanoid nodes directly; this adapter is a safe fallback for generic glTF.
 *
 * Only nodes explicitly marked as bones are eligible for role mapping. Names on
 * ordinary Object3D/Group/mesh nodes are reported as rejected evidence and never
 * count as an articulated skeleton.
 */
export type HumanoidRole =
  | "hips" | "spine" | "chest" | "upperChest" | "neck" | "head"
  | "leftShoulder" | "leftUpperArm" | "leftLowerArm" | "leftHand"
  | "rightShoulder" | "rightUpperArm" | "rightLowerArm" | "rightHand"
  | "leftUpperLeg" | "leftLowerLeg" | "leftFoot" | "leftToes"
  | "rightUpperLeg" | "rightLowerLeg" | "rightFoot" | "rightToes"
  | "leftEye" | "rightEye"
  | `left${"Thumb" | "Index" | "Middle" | "Ring" | "Little"}${"Proximal" | "Intermediate" | "Distal"}`
  | `right${"Thumb" | "Index" | "Middle" | "Ring" | "Little"}${"Proximal" | "Intermediate" | "Distal"}`;

export interface HumanoidNodeLike {
  readonly name?: string;
  readonly parent?: HumanoidNodeLike | null;
  readonly isBone?: boolean;
}
export interface HumanoidRigCapabilities {
  readonly torso: boolean;
  readonly head: boolean;
  readonly bilateralArms: boolean;
  readonly bilateralHands: boolean;
  readonly bilateralLegs: boolean;
  readonly bilateralFeet: boolean;
  readonly eyes: boolean;
  readonly leftFingerCount: number;
  readonly rightFingerCount: number;
  readonly fingerArticulation: boolean;
  readonly locomotionSkeleton: boolean;
  readonly fullBodyHumanoid: boolean;
}
export interface HumanoidRigAudit {
  readonly schemaVersion: 1;
  readonly mappingMethod: "conservative-name-heuristic";
  readonly nodes: Readonly<Partial<Record<HumanoidRole, HumanoidNodeLike>>>;
  readonly missingRequired: readonly HumanoidRole[];
  readonly ambiguous: readonly HumanoidRole[];
  readonly nonBoneMatches: readonly HumanoidRole[];
  readonly capabilities: HumanoidRigCapabilities;
  readonly warnings: readonly string[];
}

const MAX_HUMANOID_AUDIT_NODES = 50_000;
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases = new Map<HumanoidRole, readonly string[]>();
const baseAliases: readonly (readonly [HumanoidRole, readonly string[]])[] = [
  ["hips", ["hips", "pelvis", "root"]], ["spine", ["spine", "spine1", "lowerback"]],
  ["chest", ["chest", "spine2", "thorax"]], ["upperChest", ["upperchest", "chest2", "spine3"]],
  ["neck", ["neck"]], ["head", ["head"]],
  ["leftShoulder", ["leftshoulder", "shoulderl", "lshoulder", "claviclel"]],
  ["leftUpperArm", ["leftupperarm", "upperarml", "lupperarm", "leftarm"]],
  ["leftLowerArm", ["leftlowerarm", "leftforearm", "forearml", "lowerarml", "lforearm"]],
  ["leftHand", ["lefthand", "handl", "lhand"]],
  ["rightShoulder", ["rightshoulder", "shoulderr", "rshoulder", "clavicler"]],
  ["rightUpperArm", ["rightupperarm", "upperarmr", "rupperarm", "rightarm"]],
  ["rightLowerArm", ["rightlowerarm", "rightforearm", "forearmr", "lowerarmr", "rforearm"]],
  ["rightHand", ["righthand", "handr", "rhand"]],
  ["leftUpperLeg", ["leftupperleg", "upperlegl", "leftupleg", "thighl"]],
  ["leftLowerLeg", ["leftlowerleg", "leftleg", "lowerlegl", "calfl"]],
  ["leftFoot", ["leftfoot", "footl"]], ["leftToes", ["lefttoes", "toesl", "lefttoe"]],
  ["rightUpperLeg", ["rightupperleg", "upperlegr", "rightupleg", "thighr"]],
  ["rightLowerLeg", ["rightlowerleg", "rightleg", "lowerlegr", "calfr"]],
  ["rightFoot", ["rightfoot", "footr"]], ["rightToes", ["righttoes", "toesr", "righttoe"]],
  ["leftEye", ["lefteye", "eyel"]], ["rightEye", ["righteye", "eyer"]],
];
for (const [role, names] of baseAliases) aliases.set(role, names);
for (const side of ["left", "right"] as const) {
  for (const finger of ["Thumb", "Index", "Middle", "Ring", "Little"] as const) {
    for (const segment of ["Proximal", "Intermediate", "Distal"] as const) {
      const role = (side + finger + segment) as HumanoidRole;
      const s = side === "left" ? "l" : "r";
      const f = finger.toLowerCase();
      const part = segment.toLowerCase();
      aliases.set(role, [side + finger + segment, f + part + s, s + f + part]);
    }
  }
}
const roles = Array.from(aliases.keys());
const required: readonly HumanoidRole[] = [
  "hips", "spine", "head",
  "leftUpperArm", "leftLowerArm", "leftHand",
  "rightUpperArm", "rightLowerArm", "rightHand",
  "leftUpperLeg", "leftLowerLeg", "leftFoot",
  "rightUpperLeg", "rightLowerLeg", "rightFoot",
];

function isAncestor(ancestor: HumanoidNodeLike, node: HumanoidNodeLike): boolean {
  let current = node.parent ?? null;
  const seen = new Set<HumanoidNodeLike>();
  while (current && !seen.has(current)) {
    if (current === ancestor) return true;
    seen.add(current);
    current = current.parent ?? null;
  }
  return false;
}

/** Detect parent cycles in O(n) across the complete bone forest. */
function hasParentCycles(nodes: readonly HumanoidNodeLike[]): boolean {
  const state = new Map<HumanoidNodeLike, 1 | 2>();
  for (const start of nodes) {
    if (state.has(start)) continue;
    const path: HumanoidNodeLike[] = [];
    let current: HumanoidNodeLike | null = start;
    while (current && !state.has(current)) {
      state.set(current, 1);
      path.push(current);
      current = current.parent ?? null;
    }
    // State 1 can only belong to the current unfinished walk; completed walks
    // are state 2, so this detects a cycle without re-walking every ancestor.
    if (current && state.get(current) === 1) return true;
    for (const visited of path) state.set(visited, 2);
  }
  return false;
}

/** Resolve only unique explicit bone names and a connected humanoid hierarchy. */
export function auditHumanoidRig(input: readonly HumanoidNodeLike[]): HumanoidRigAudit {
  if (!Array.isArray(input)) throw new TypeError("humanoid-rig-input-must-be-an-array");
  if (input.length > MAX_HUMANOID_AUDIT_NODES) throw new RangeError("humanoid-rig-node-limit-exceeded");
  const namedNodes = Array.from(new Set(input.filter(
    (node) => node && typeof node.name === "string" && node.name.trim().length > 0,
  )));
  const boneNodes = namedNodes.filter((node) => node.isBone === true);
  const normalizedBones = boneNodes.map((node) => ({ node, name: normalize(node.name!) }));
  const normalizedNonBones = namedNodes
    .filter((node) => node.isBone !== true)
    .map((node) => ({ node, name: normalize(node.name!) }));

  const nodes: Partial<Record<HumanoidRole, HumanoidNodeLike>> = {};
  const ambiguous: HumanoidRole[] = [];
  const nonBoneMatches: HumanoidRole[] = [];
  for (const role of roles) {
    const boneMatches = normalizedBones.filter(({ name }) => (aliases.get(role) ?? []).some((alias) => name === normalize(alias)));
    const nonBoneRoleMatches = normalizedNonBones.filter(({ name }) => (aliases.get(role) ?? []).some((alias) => name === normalize(alias)));
    if (boneMatches.length === 1) nodes[role] = boneMatches[0].node;
    else if (boneMatches.length > 1) ambiguous.push(role);
    else if (nonBoneRoleMatches.length > 0) nonBoneMatches.push(role);
  }

  const missingRequired = required.filter((role) => !nodes[role]);
  const leftFingerCount = roles.filter((role) => role.startsWith("left") && /Thumb|Index|Middle|Ring|Little/.test(role) && !!nodes[role]).length;
  const rightFingerCount = roles.filter((role) => role.startsWith("right") && /Thumb|Index|Middle|Ring|Little/.test(role) && !!nodes[role]).length;
  const torso = !!nodes.hips && !!nodes.spine;
  const head = !!nodes.head;
  const bilateralArms = !!nodes.leftUpperArm && !!nodes.leftLowerArm && !!nodes.rightUpperArm && !!nodes.rightLowerArm;
  const bilateralHands = !!nodes.leftHand && !!nodes.rightHand;
  const bilateralLegs = !!nodes.leftUpperLeg && !!nodes.leftLowerLeg && !!nodes.rightUpperLeg && !!nodes.rightLowerLeg;
  const bilateralFeet = !!nodes.leftFoot && !!nodes.rightFoot;

  const hierarchyPairs: [HumanoidRole, HumanoidRole][] = [
    ["hips", "spine"],
    ["leftUpperArm", "leftLowerArm"], ["leftLowerArm", "leftHand"],
    ["rightUpperArm", "rightLowerArm"], ["rightLowerArm", "rightHand"],
    ["hips", "leftUpperLeg"], ["leftUpperLeg", "leftLowerLeg"], ["leftLowerLeg", "leftFoot"],
    ["hips", "rightUpperLeg"], ["rightUpperLeg", "rightLowerLeg"], ["rightLowerLeg", "rightFoot"],
  ];
  if (nodes.spine && nodes.chest) hierarchyPairs.push(["spine", "chest"]);
  if (nodes.upperChest) hierarchyPairs.push([nodes.chest ? "chest" : "spine", "upperChest"]);
  if (nodes.neck) hierarchyPairs.push([nodes.chest ? "chest" : "spine", "neck"]);
  const headParent: HumanoidRole = nodes.neck ? "neck" : nodes.chest ? "chest" : "spine";
  hierarchyPairs.push([headParent, "head"]);

  const armAnchor: HumanoidRole = nodes.upperChest ? "upperChest" : nodes.chest ? "chest" : "spine";
  for (const side of ["left", "right"] as const) {
    const shoulderRole = (side + "Shoulder") as HumanoidRole;
    const upperArmRole = (side + "UpperArm") as HumanoidRole;
    if (nodes[shoulderRole]) {
      hierarchyPairs.push([armAnchor, shoulderRole], [shoulderRole, upperArmRole]);
    } else {
      hierarchyPairs.push([armAnchor, upperArmRole]);
    }
  }

  const brokenHierarchy = hierarchyPairs.filter(([ancestorRole, childRole]) =>
    nodes[ancestorRole] && nodes[childRole] && !isAncestor(nodes[ancestorRole]!, nodes[childRole]!),
  );
  const parentCyclesDetected = hasParentCycles(boneNodes);

  const fingerHierarchyPairs: [HumanoidRole, HumanoidRole][] = [];
  let allFingerChainsMapped = true;
  for (const side of ["left", "right"] as const) {
    const handRole = (side + "Hand") as HumanoidRole;
    for (const finger of ["Thumb", "Index", "Middle", "Ring", "Little"] as const) {
      const proximal = (side + finger + "Proximal") as HumanoidRole;
      const intermediate = (side + finger + "Intermediate") as HumanoidRole;
      const distal = (side + finger + "Distal") as HumanoidRole;
      if (!nodes[handRole] || !nodes[proximal] || !nodes[intermediate] || !nodes[distal]) {
        allFingerChainsMapped = false;
        continue;
      }
      fingerHierarchyPairs.push([handRole, proximal], [proximal, intermediate], [intermediate, distal]);
    }
  }
  const brokenFingerHierarchy = fingerHierarchyPairs.filter(([ancestorRole, childRole]) =>
    !isAncestor(nodes[ancestorRole]!, nodes[childRole]!),
  );

  const warnings: string[] = [];
  if (ambiguous.length) warnings.push("Ambiguous bone names: " + ambiguous.join(", ") + ".");
  if (missingRequired.length) warnings.push("Missing required humanoid bones: " + missingRequired.join(", ") + ".");
  if (brokenHierarchy.length) warnings.push("Unexpected parent hierarchy: " + brokenHierarchy.map(([a, b]) => a + "→" + b).join(", ") + ".");
  if (parentCyclesDetected) warnings.push("Cyclic parent hierarchy detected; rig mapping is not trusted.");
  if (nonBoneMatches.length) warnings.push("Name matches excluded because those nodes are not bones: " + nonBoneMatches.join(", ") + ".");
  if (namedNodes.length && boneNodes.length === 0) warnings.push("No nodes are explicitly marked as bones; name matching alone is not proof of a deforming skeleton.");
  if (!nodes.neck) warnings.push("Neck articulation is unavailable; head mapping may use the spine/chest fallback.");
  if (leftFingerCount !== 15 || rightFingerCount !== 15 || !allFingerChainsMapped || brokenFingerHierarchy.length) {
    warnings.push("Finger articulation is unavailable or its complete hand-to-tip hierarchy is not confirmed.");
  }
  if (!nodes.leftEye || !nodes.rightEye) warnings.push("Eye-bone gaze is unavailable; use head/gaze fallback.");

  const hierarchyValid = brokenHierarchy.length === 0 && !parentCyclesDetected;
  const fingerArticulation = leftFingerCount === 15 && rightFingerCount === 15
    && allFingerChainsMapped && brokenFingerHierarchy.length === 0 && !parentCyclesDetected;
  const locomotionSkeleton = torso && bilateralLegs && bilateralFeet && hierarchyValid;
  const fullBodyHumanoid = missingRequired.length === 0 && ambiguous.length === 0
    && hierarchyValid && torso && head && bilateralArms && bilateralHands && bilateralLegs && bilateralFeet;

  return Object.freeze({
    schemaVersion: 1,
    mappingMethod: "conservative-name-heuristic",
    nodes: Object.freeze(nodes),
    missingRequired: Object.freeze(missingRequired),
    ambiguous: Object.freeze(ambiguous),
    nonBoneMatches: Object.freeze(nonBoneMatches),
    capabilities: Object.freeze({
      torso, head, bilateralArms, bilateralHands, bilateralLegs, bilateralFeet,
      eyes: !!nodes.leftEye && !!nodes.rightEye,
      leftFingerCount, rightFingerCount, fingerArticulation,
      locomotionSkeleton, fullBodyHumanoid,
    }),
    warnings: Object.freeze(warnings),
  });
}
