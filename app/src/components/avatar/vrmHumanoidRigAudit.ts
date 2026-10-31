/**
 * Conservative, renderer-independent humanoid rig discovery for imported VRM/GLB.
 *
 * This is a name-based audit, NOT a claim that arbitrary GLB bones implement the
 * VRM humanoid specification. A production VRM runtime should supply semantic
 * humanoid nodes directly; this adapter is a safe fallback for generic glTF.
 */
export type HumanoidRole =
  | "hips" | "spine" | "chest" | "upperChest" | "neck" | "head"
  | "leftShoulder" | "leftUpperArm" | "leftLowerArm" | "leftHand"
  | "rightShoulder" | "rightUpperArm" | "rightLowerArm" | "rightHand"
  | "leftUpperLeg" | "leftLowerLeg" | "leftFoot" | "leftToes"
  | "rightUpperLeg" | "rightLowerLeg" | "rightFoot" | "rightToes"
  | "leftEye" | "rightEye"
  | `left00`
  | `right00`;

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
  readonly capabilities: HumanoidRigCapabilities;
  readonly warnings: readonly string[];
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases: Readonly<Record<HumanoidRole, readonly string[]>> = {
  hips: ["hips", "pelvis", "root"],
  spine: ["spine", "spine1", "lowerback"],
  chest: ["chest", "spine2", "thorax"],
  upperChest: ["upperchest", "chest2", "spine3"],
  neck: ["neck"],
  head: ["head"],
  leftShoulder: ["leftshoulder", "shoulderl", "lshoulder", "claviclel"],
  leftUpperArm: ["leftupperarm", "upperarml", "lupperarm", "leftarm"],
  leftLowerArm: ["leftlowerarm", "leftforearm", "forearml", "lowerarml", "lforearm"],
  leftHand: ["lefthand", "handl", "lhand"],
  rightShoulder: ["rightshoulder", "shoulderr", "rshoulder", "clavicler"],
  rightUpperArm: ["rightupperarm", "upperarmr", "rupperarm", "rightarm"],
  rightLowerArm: ["rightlowerarm", "rightforearm", "forearmr", "lowerarmr", "rforearm"],
  rightHand: ["righthand", "handr", "rhand"],
  leftUpperLeg: ["leftupperleg", "upperlegl", "leftupleg", "thighl"],
  leftLowerLeg: ["leftlowerleg", "leftleg", "lowerlegl", "calfl"],
  leftFoot: ["leftfoot", "footl"],
  leftToes: ["lefttoes", "toesl", "lefttoe"],
  rightUpperLeg: ["rightupperleg", "upperlegr", "rightupleg", "thighr"],
  rightLowerLeg: ["rightlowerleg", "rightleg", "lowerlegr", "calfr"],
  rightFoot: ["rightfoot", "footr"],
  rightToes: ["righttoes", "toesr", "righttoe"],
  leftEye: ["lefteye", "eyel"],
  rightEye: ["righteye", "eyer"],
  ...Object.fromEntries((["left", "right"] as const).flatMap((side) =>
    (["Thumb", "Index", "Middle", "Ring", "Little"] as const).flatMap((finger) =>
      (["Proximal", "Intermediate", "Distal"] as const).map((segment) => {
        const role = `${side}${finger}${segment}` as HumanoidRole;
        const s = side === "left" ? "l" : "r";
        const f = finger.toLowerCase();
        const part = segment.toLowerCase();
        return [role, [`${side}${finger}${segment}`, `${f}${part}${s}`, `${s}${f}${part}`]];
      }),
    ),
  )),
} as Record<HumanoidRole, readonly string[]>;

const roles = Object.keys(aliases) as HumanoidRole[];
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

/** Resolve only unique semantic-looking bone names; ambiguous matches fail closed. */
export function auditHumanoidRig(input: readonly HumanoidNodeLike[]): HumanoidRigAudit {
  const candidates = input.filter((node) => node && typeof node.name === "string" && node.name.trim().length > 0);
  const normalized = candidates.map((node) => ({ node, name: normalize(node.name!) }));
  const nodes: Partial<Record<HumanoidRole, HumanoidNodeLike>> = {};
  const ambiguous: HumanoidRole[] = [];
  for (const role of roles) {
    const names = aliases[role];
    const matches = normalized.filter(({ name }) => names.some((alias) => name === normalize(alias)));
    if (matches.length === 1) nodes[role] = matches[0].node;
    else if (matches.length > 1) ambiguous.push(role);
  }
  const missingRequired = required.filter((role) => !nodes[role]);
  const leftFingerCount = roles.filter((role) => role.startsWith("left") && /Thumb|Index|Middle|Ring|Little/.test(role) && !!nodes[role]).length;
  const rightFingerCount = roles.filter((role) => role.startsWith("right") && /Thumb|Index|Middle|Ring|Little/.test(role) && !!nodes[role]).length;
  const torso = !!nodes.hips && !!nodes.spine;
  const head = !!nodes.head && !!nodes.neck;
  const bilateralArms = !!nodes.leftUpperArm && !!nodes.leftLowerArm && !!nodes.rightUpperArm && !!nodes.rightLowerArm;
  const bilateralHands = !!nodes.leftHand && !!nodes.rightHand;
  const bilateralLegs = !!nodes.leftUpperLeg && !!nodes.leftLowerLeg && !!nodes.rightUpperLeg && !!nodes.rightLowerLeg;
  const bilateralFeet = !!nodes.leftFoot && !!nodes.rightFoot;
  const hierarchyPairs: readonly [HumanoidRole, HumanoidRole][] = [
    ["hips", "spine"], ["spine", "chest"], ["chest", "neck"], ["neck", "head"],
    ["leftUpperArm", "leftLowerArm"], ["leftLowerArm", "leftHand"],
    ["rightUpperArm", "rightLowerArm"], ["rightLowerArm", "rightHand"],
    ["leftUpperLeg", "leftLowerLeg"], ["leftLowerLeg", "leftFoot"],
    ["rightUpperLeg", "rightLowerLeg"], ["rightLowerLeg", "rightFoot"],
  ];
  const brokenHierarchy = hierarchyPairs.filter(([a, b]) => nodes[a] && nodes[b] && !isAncestor(nodes[a]!, nodes[b]!));
  const warnings: string[] = [];
  if (ambiguous.length) warnings.push(`Ambiguous bone names: ${ambiguous.join(", ")}.`);
  if (missingRequired.length) warnings.push(`Missing required humanoid bones: ${missingRequired.join(", ")}.`);
  if (brokenHierarchy.length) warnings.push(`Unexpected parent hierarchy: ${brokenHierarchy.map(([a, b]) => `${a}→${b}`).join(", ")}.`);
  if (!leftFingerCount || !rightFingerCount) warnings.push("Finger articulation is unavailable or only partially mapped.");
  if (!nodes.leftEye || !nodes.rightEye) warnings.push("Eye-bone gaze is unavailable; use head/gaze fallback.");
  if (candidates.length && !candidates.some((node) => node.isBone)) warnings.push("No nodes are explicitly marked as bones; name matching alone is not proof of a deforming skeleton.");
  const hierarchyValid = brokenHierarchy.length === 0;
  const fullBodyHumanoid = missingRequired.length === 0 && ambiguous.length === 0 && hierarchyValid;
  return Object.freeze({
    schemaVersion: 1,
    mappingMethod: "conservative-name-heuristic",
    nodes: Object.freeze(nodes),
    missingRequired: Object.freeze(missingRequired),
    ambiguous: Object.freeze(ambiguous),
    capabilities: Object.freeze({
      torso, head, bilateralArms, bilateralHands, bilateralLegs, bilateralFeet,
      eyes: !!nodes.leftEye && !!nodes.rightEye,
      leftFingerCount, rightFingerCount,
      fingerArticulation: leftFingerCount === 15 && rightFingerCount === 15,
      locomotionSkeleton: torso && bilateralLegs && bilateralFeet && hierarchyValid,
      fullBodyHumanoid,
    }),
    warnings: Object.freeze(warnings),
  });
}
