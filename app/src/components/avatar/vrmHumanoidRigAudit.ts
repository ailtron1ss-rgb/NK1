/**
 * Conservative, renderer-independent humanoid rig discovery for imported VRM/GLB.
 *
 * Generic GLB uses a conservative Bone-name fallback; VRM uses its validated
 * extension node-index map. Neither audit mode is a production VRM runtime or
 * proof that the imported rig can be retargeted and actuated.
 *
 * For generic GLB, only explicit Bone nodes can be mapped by name. For VRM, the
 * extension's validated glTF node-index map is authoritative; VRM humanoid nodes
 * are not required to be skin joints or Three.js Bone instances.
 */
export type HumanoidRole =
  | "hips" | "spine" | "chest" | "upperChest" | "neck" | "head"
  | "leftShoulder" | "leftUpperArm" | "leftLowerArm" | "leftHand"
  | "rightShoulder" | "rightUpperArm" | "rightLowerArm" | "rightHand"
  | "leftUpperLeg" | "leftLowerLeg" | "leftFoot" | "leftToes"
  | "rightUpperLeg" | "rightLowerLeg" | "rightFoot" | "rightToes"
  | "leftEye" | "rightEye" | "jaw"
  | `leftThumb${"Metacarpal" | "Proximal" | "Intermediate" | "Distal"}`
  | `rightThumb${"Metacarpal" | "Proximal" | "Intermediate" | "Distal"}`
  | `left${"Index" | "Middle" | "Ring" | "Little"}${"Proximal" | "Intermediate" | "Distal"}`
  | `right${"Index" | "Middle" | "Ring" | "Little"}${"Proximal" | "Intermediate" | "Distal"}`;

export interface HumanoidNodeLike {
  readonly name?: string;
  readonly parent?: HumanoidNodeLike | null;
  readonly isBone?: boolean;
  /** Semantic role assigned by a validated VRM extension node index. */
  readonly humanoidRole?: HumanoidRole;
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
export interface HumanoidRigAuditOptions {
  /** When present, explicit VRM node bindings are authoritative; do not fall back to names. */
  readonly vrmVersion?: "0.x" | "1.0";
  readonly allowNameHeuristic?: boolean;
  readonly mappingWarnings?: readonly string[];
}
export interface HumanoidRigAudit {
  readonly schemaVersion: 1;
  readonly mappingMethod: "conservative-name-heuristic" | "explicit-vrm-0.x" | "explicit-vrm-1.0";
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
  ["leftEye", ["lefteye", "eyel"]], ["rightEye", ["righteye", "eyer"]], ["jaw", ["jaw"]],
];
for (const [role, names] of baseAliases) aliases.set(role, names);
for (const side of ["left", "right"] as const) {
  for (const finger of ["Thumb", "Index", "Middle", "Ring", "Little"] as const) {
    const segments = finger === "Thumb"
      ? ["Metacarpal", "Proximal", "Intermediate", "Distal"] as const
      : ["Proximal", "Intermediate", "Distal"] as const;
    for (const segment of segments) {
      const role = (side + finger + segment) as HumanoidRole;
      const shortSide = side === "left" ? "l" : "r";
      const shortFinger = finger.toLowerCase();
      const part = segment.toLowerCase();
      aliases.set(role, [side + finger + segment, shortFinger + part + shortSide, shortSide + shortFinger + part]);
    }
  }
}
const roles = Array.from(aliases.keys());
export function isHumanoidRole(value: unknown): value is HumanoidRole {
  return typeof value === "string" && aliases.has(value as HumanoidRole);
}
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

/** Resolve explicit VRM node bindings first; otherwise use a conservative Bone-name fallback. */
export function auditHumanoidRig(
  input: readonly HumanoidNodeLike[],
  options: HumanoidRigAuditOptions = {},
): HumanoidRigAudit {
  if (!Array.isArray(input)) throw new TypeError("humanoid-rig-input-must-be-an-array");
  if (input.length > MAX_HUMANOID_AUDIT_NODES) throw new RangeError("humanoid-rig-node-limit-exceeded");
  const sceneNodes = Array.from(new Set(input.filter(
    (node) => node && typeof node === "object" && (
      // In explicit VRM mode retain unnamed non-humanoid ancestors too: they
      // may legally sit between two humanoid nodes in the glTF scene tree.
      !!options.vrmVersion
      || (typeof node.name === "string" && node.name.trim().length > 0)
      || node.isBone === true
      || isHumanoidRole(node.humanoidRole)
    ),
  )));
  const boneNodes = sceneNodes.filter((node) => node.isBone === true);
  const explicitNodes = sceneNodes.filter((node) => isHumanoidRole(node.humanoidRole));
  const namedBones = boneNodes.filter((node) => typeof node.name === "string" && node.name.trim().length > 0);
  const normalizedBones = namedBones.map((node) => ({ node, name: normalize(node.name!) }));
  const normalizedNonBones = sceneNodes
    .filter((node) => node.isBone !== true && !isHumanoidRole(node.humanoidRole)
      && typeof node.name === "string" && node.name.trim().length > 0)
    .map((node) => ({ node, name: normalize(node.name!) }));
  const allowNameHeuristic = options.allowNameHeuristic !== false && !options.vrmVersion;

  const nodes: Partial<Record<HumanoidRole, HumanoidNodeLike>> = {};
  const ambiguous: HumanoidRole[] = [];
  const nonBoneMatches: HumanoidRole[] = [];
  for (const role of roles) {
    const explicitMatches = explicitNodes.filter((node) => node.humanoidRole === role);
    if (explicitMatches.length === 1) {
      nodes[role] = explicitMatches[0];
      continue;
    }
    if (explicitMatches.length > 1) {
      ambiguous.push(role);
      continue;
    }
    if (!allowNameHeuristic) continue;
    const boneMatches = normalizedBones.filter(({ name }) => (aliases.get(role) ?? []).some((alias) => name === normalize(alias)));
    const nonBoneRoleMatches = normalizedNonBones.filter(({ name }) => (aliases.get(role) ?? []).some((alias) => name === normalize(alias)));
    if (boneMatches.length === 1) nodes[role] = boneMatches[0].node;
    else if (boneMatches.length > 1) ambiguous.push(role);
    else if (nonBoneRoleMatches.length > 0) nonBoneMatches.push(role);
  }

  const requiredRoles = options.vrmVersion === "0.x" ? [...required, "chest", "neck"] as HumanoidRole[] : required;
  const missingRequired = requiredRoles.filter((role) => !nodes[role]);
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
  const structuralErrors: string[] = [];
  if (nodes.chest) hierarchyPairs.push(["spine", "chest"]);
  if (nodes.upperChest) {
    if (nodes.chest) hierarchyPairs.push(["chest", "upperChest"]);
    else structuralErrors.push("upperChest requires chest");
  }
  const torsoHeadAnchor: HumanoidRole = nodes.upperChest ? "upperChest" : nodes.chest ? "chest" : "spine";
  if (nodes.neck) hierarchyPairs.push([torsoHeadAnchor, "neck"]);
  const headParent: HumanoidRole = nodes.neck ? "neck" : torsoHeadAnchor;
  hierarchyPairs.push([headParent, "head"]);

  const armAnchor: HumanoidRole = nodes.upperChest ? "upperChest" : nodes.chest ? "chest" : "spine";
  for (const side of ["left", "right"] as const) {
    const shoulderRole = (side + "Shoulder") as HumanoidRole;
    const upperArmRole = (side + "UpperArm") as HumanoidRole;
    if (nodes[shoulderRole]) hierarchyPairs.push([armAnchor, shoulderRole], [shoulderRole, upperArmRole]);
    else hierarchyPairs.push([armAnchor, upperArmRole]);
  }

  const brokenHierarchy = hierarchyPairs.filter(([ancestorRole, childRole]) =>
    nodes[ancestorRole] && nodes[childRole] && !isAncestor(nodes[ancestorRole]!, nodes[childRole]!),
  );
  const parentCyclesDetected = hasParentCycles(options.vrmVersion
    ? sceneNodes
    : sceneNodes.filter((node) => node.isBone === true));

  const optionalHierarchyPairs: [HumanoidRole, HumanoidRole][] = [];
  if (nodes.leftEye) optionalHierarchyPairs.push(["head", "leftEye"]);
  if (nodes.rightEye) optionalHierarchyPairs.push(["head", "rightEye"]);
  if (nodes.jaw) optionalHierarchyPairs.push(["head", "jaw"]);
  if (nodes.leftToes) optionalHierarchyPairs.push(["leftFoot", "leftToes"]);
  if (nodes.rightToes) optionalHierarchyPairs.push(["rightFoot", "rightToes"]);
  const brokenOptionalHierarchy = optionalHierarchyPairs.filter(([ancestorRole, childRole]) =>
    nodes[ancestorRole] && nodes[childRole] && !isAncestor(nodes[ancestorRole]!, nodes[childRole]!),
  );

  const fingerHierarchyPairs: [HumanoidRole, HumanoidRole][] = [];
  const missingFingerParents: string[] = [];
  let allFingerChainsMapped = true;
  const fingerNames = ["Thumb", "Index", "Middle", "Ring", "Little"] as const;
  const fingerSegments = (side: "left" | "right", finger: typeof fingerNames[number]): HumanoidRole[] => {
    const segments = finger === "Thumb" && options.vrmVersion === "1.0"
      ? ["Metacarpal", "Proximal", "Distal"]
      : ["Proximal", "Intermediate", "Distal"];
    return segments.map((segment) => (side + finger + segment) as HumanoidRole);
  };
  const countFingerSegments = (side: "left" | "right") =>
    fingerNames.flatMap((finger) => fingerSegments(side, finger)).filter((role) => !!nodes[role]).length;
  const leftFingerCount = countFingerSegments("left");
  const rightFingerCount = countFingerSegments("right");
  for (const side of ["left", "right"] as const) {
    const handRole = (side + "Hand") as HumanoidRole;
    for (const finger of fingerNames) {
      const segments = fingerSegments(side, finger);
      if (!nodes[handRole]) allFingerChainsMapped = false;
      let parentRole = handRole;
      for (const childRole of segments) {
        if (nodes[childRole]) {
          if (!nodes[parentRole]) missingFingerParents.push(childRole + " requires " + parentRole);
          else fingerHierarchyPairs.push([parentRole, childRole]);
        } else {
          allFingerChainsMapped = false;
        }
        parentRole = childRole;
      }
    }
  }
  const brokenFingerHierarchy = fingerHierarchyPairs.filter(([ancestorRole, childRole]) =>
    !isAncestor(nodes[ancestorRole]!, nodes[childRole]!),
  );

  const warnings: string[] = [];
  if (ambiguous.length) warnings.push("Ambiguous bone names: " + ambiguous.join(", ") + ".");
  if (missingRequired.length) warnings.push("Missing required humanoid bones: " + missingRequired.join(", ") + ".");
  if (brokenHierarchy.length) warnings.push("Unexpected parent hierarchy: " + brokenHierarchy.map(([a, b]) => a + "→" + b).join(", ") + ".");
  if (structuralErrors.length) warnings.push("Invalid optional humanoid dependencies: " + structuralErrors.join(", ") + ".");
  if (brokenOptionalHierarchy.length) warnings.push("Unexpected optional bone hierarchy: " + brokenOptionalHierarchy.map(([a, b]) => a + "→" + b).join(", ") + ".");
  if (parentCyclesDetected) warnings.push("Cyclic parent hierarchy detected; rig mapping is not trusted.");
  if (nonBoneMatches.length) warnings.push("Name matches excluded because those nodes are not bones: " + nonBoneMatches.join(", ") + ".");
  if (options.mappingWarnings?.length) warnings.push(...options.mappingWarnings);
  if (!explicitNodes.length && sceneNodes.length && boneNodes.length === 0 && allowNameHeuristic) {
    warnings.push("No nodes are explicitly marked as bones; name matching alone is not proof of a deforming skeleton.");
  }
  if (!nodes.neck) warnings.push("Neck articulation is unavailable; head mapping may use the spine/chest fallback.");
  if (leftFingerCount !== 15 || rightFingerCount !== 15 || !allFingerChainsMapped || brokenFingerHierarchy.length || missingFingerParents.length) {
    warnings.push("Finger articulation is unavailable or its version-specific hand-to-tip hierarchy is not confirmed.");
  }
  if (missingFingerParents.length) warnings.push("Finger parent dependency missing: " + missingFingerParents.join(", ") + ".");
  if (!nodes.leftEye || !nodes.rightEye || brokenOptionalHierarchy.some(([, role]) => role === "leftEye" || role === "rightEye")) warnings.push("Eye-bone gaze is unavailable or its parent hierarchy is invalid; use head/gaze fallback.");

  const hierarchyValid = brokenHierarchy.length === 0 && structuralErrors.length === 0 && !parentCyclesDetected;
  const fingerArticulation = leftFingerCount === 15 && rightFingerCount === 15
    && allFingerChainsMapped && missingFingerParents.length === 0
    && brokenFingerHierarchy.length === 0 && !parentCyclesDetected;
  const locomotionSkeleton = torso && bilateralLegs && bilateralFeet && hierarchyValid;
  const fullBodyHumanoid = missingRequired.length === 0 && ambiguous.length === 0
    && hierarchyValid && torso && head && bilateralArms && bilateralHands && bilateralLegs && bilateralFeet;

  return Object.freeze({
    schemaVersion: 1,
    mappingMethod: options.vrmVersion === "0.x" ? "explicit-vrm-0.x"
      : options.vrmVersion === "1.0" ? "explicit-vrm-1.0" : "conservative-name-heuristic",
    nodes: Object.freeze(nodes),
    missingRequired: Object.freeze(missingRequired),
    ambiguous: Object.freeze(ambiguous),
    nonBoneMatches: Object.freeze(nonBoneMatches),
    capabilities: Object.freeze({
      torso, head, bilateralArms, bilateralHands, bilateralLegs, bilateralFeet,
      eyes: !!nodes.leftEye && !!nodes.rightEye
        && !brokenOptionalHierarchy.some(([, role]) => role === "leftEye" || role === "rightEye"),
      leftFingerCount, rightFingerCount, fingerArticulation,
      locomotionSkeleton, fullBodyHumanoid,
    }),
    warnings: Object.freeze(warnings),
  });
}
