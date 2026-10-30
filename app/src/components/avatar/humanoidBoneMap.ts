/**
 * Semantic humanoid vocabulary shared by VRM 0.x/1.0 and common DCC rigs.
 *
 * VRM extension node indices are authoritative when present. Name aliases are
 * only a fallback for non-VRM glTF/GLB skeletons and never imply IK support.
 */
export const HUMANOID_BONE_ROLES = [
  "hips", "spine", "chest", "upperchest", "neck", "head", "jaw",
  "lefteye", "righteye",
  "leftshoulder", "rightshoulder",
  "leftupperarm", "rightupperarm", "leftlowerarm", "rightlowerarm",
  "lefthand", "righthand",
  "leftthumbmetacarpal", "leftthumbproximal", "leftthumbdistal",
  "leftindexproximal", "leftindexintermediate", "leftindexdistal",
  "leftmiddleproximal", "leftmiddleintermediate", "leftmiddledistal",
  "leftringproximal", "leftringintermediate", "leftringdistal",
  "leftlittleproximal", "leftlittleintermediate", "leftlittledistal",
  "rightthumbmetacarpal", "rightthumbproximal", "rightthumbdistal",
  "rightindexproximal", "rightindexintermediate", "rightindexdistal",
  "rightmiddleproximal", "rightmiddleintermediate", "rightmiddledistal",
  "rightringproximal", "rightringintermediate", "rightringdistal",
  "rightlittleproximal", "rightlittleintermediate", "rightlittledistal",
  "leftupperleg", "rightupperleg", "leftlowerleg", "rightlowerleg",
  "leftfoot", "rightfoot", "lefttoes", "righttoes",
] as const;

export type AvatarBoneRole = (typeof HUMANOID_BONE_ROLES)[number] | "other";

const supportedRoles = new Set<string>(HUMANOID_BONE_ROLES);

export function normalizeHumanoidBoneName(value: unknown): string {
  return String(value ?? "").toLocaleLowerCase().replace(/[^a-z0-9]/gu, "");
}

const aliases: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(?:jbipc)?(?:hips|pelvis|roothips)$/, "hips"],
  [/^jbipcspine\\d*$/, "spine"],
  [/^jbipcneck$/, "neck"],
  [/^jbipchead$/, "head"],
  [/^(?:mixamorig)?(?:hips|pelvis|roothips)$/, "hips"],
  [/^(?:mixamorig)?spine$/, "spine"],
  [/^(?:mixamorig)?spine1$/, "chest"],
  [/^(?:mixamorig)?spine2$/, "upperchest"],
  [/^(?:mixamorig)?neck$/, "neck"],
  [/^(?:mixamorig)?head$/, "head"],
  [/^(?:mixamorig)?jaw$/, "jaw"],
  [/^(?:mixamorig)?lefteye$/, "lefteye"],
  [/^(?:mixamorig)?righteye$/, "righteye"],
  [/^(?:mixamorig)?leftshoulder$/, "leftshoulder"],
  [/^(?:mixamorig)?rightshoulder$/, "rightshoulder"],
  [/^(?:mixamorig)?leftarm$/, "leftupperarm"],
  [/^(?:mixamorig)?rightarm$/, "rightupperarm"],
  [/^(?:mixamorig)?leftforearm$/, "leftlowerarm"],
  [/^(?:mixamorig)?rightforearm$/, "rightlowerarm"],
  [/^(?:mixamorig)?lefthand$/, "lefthand"],
  [/^(?:mixamorig)?righthand$/, "righthand"],
  [/^(?:mixamorig)?leftupleg$/, "leftupperleg"],
  [/^(?:mixamorig)?rightupleg$/, "rightupperleg"],
  [/^(?:mixamorig)?leftleg$/, "leftlowerleg"],
  [/^(?:mixamorig)?rightleg$/, "rightlowerleg"],
  [/^(?:mixamorig)?leftfoot$/, "leftfoot"],
  [/^(?:mixamorig)?rightfoot$/, "rightfoot"],
  [/^(?:mixamorig)?lefttoebase$/, "lefttoes"],
  [/^(?:mixamorig)?righttoebase$/, "righttoes"],
];

function canonicalRole(name: string): string | null {
  if (supportedRoles.has(name)) return name;
  for (const [pattern, role] of aliases) if (pattern.test(name)) return role;

  // Blender .L/.R and common Mixamo/J_Bip naming variants.
  const side = name.endsWith("l") || name.endsWith("left") ? "left"
    : name.endsWith("r") || name.endsWith("right") ? "right" : "";
  const stripped = side ? name.replace(/(?:left|right|[lr])$/, "") : name;
  if (side) {
    const part = stripped.replace(/^(?:mixamorig|jbip[lr]?)/, "");
    const finger = part.match(/^(thumb|index|middle|ring|little)(metacarpal|proximal|intermediate|distal|[123])$/);
    if (finger) {
      const joint = finger[2] === "1" ? "proximal" : finger[2] === "2" ? "intermediate" : finger[2] === "3" ? "distal" : finger[2];
      return side + finger[1] + joint;
    }
    const suffixes: Record<string, string> = {
      shoulder: "shoulder", upperarm: "upperarm", arm: "upperarm",
      lowerarm: "lowerarm", forearm: "lowerarm", hand: "hand",
      upperleg: "upperleg", thigh: "upperleg", lowerleg: "lowerleg",
      leg: "lowerleg", foot: "foot", toes: "toes", toebase: "toes",
    };
    const mapped = suffixes[part];
    if (mapped) return side + mapped;
  }

  // VRM/Unity finger names are usually already canonical after punctuation removal.
  if (/^(left|right)(thumb|index|middle|ring|little)(metacarpal|proximal|intermediate|distal)$/.test(name)) {
    return name;
  }
  return null;
}

/** VRM 1.0 and VRM 0.x extension node-index to semantic role map. */
export function buildHumanoidRoleMap(extensionRoot: unknown): Map<number, AvatarBoneRole> {
  if (!extensionRoot || typeof extensionRoot !== "object") return new Map();
  const root = extensionRoot as Record<string, unknown>;
  const result = new Map<number, AvatarBoneRole>();
  const add = (node: unknown, role: unknown) => {
    if (!Number.isSafeInteger(node) || (node as number) < 0 || typeof role !== "string") return;
    const canonical = canonicalRole(normalizeHumanoidBoneName(role));
    if (canonical && supportedRoles.has(canonical)) result.set(node as number, canonical as AvatarBoneRole);
  };

  const modern = root.VRMC_vrm;
  if (modern && typeof modern === "object") {
    const humanoid = (modern as Record<string, unknown>).humanoid;
    const humanBones = humanoid && typeof humanoid === "object"
      ? (humanoid as Record<string, unknown>).humanBones : null;
    if (humanBones && typeof humanBones === "object" && !Array.isArray(humanBones)) {
      for (const [role, binding] of Object.entries(humanBones as Record<string, unknown>)) {
        if (binding && typeof binding === "object") add((binding as Record<string, unknown>).node, role);
      }
    }
  }

  const legacy = root.VRM;
  if (legacy && typeof legacy === "object") {
    const humanoid = (legacy as Record<string, unknown>).humanoid;
    const humanBones = humanoid && typeof humanoid === "object"
      ? (humanoid as Record<string, unknown>).humanBones : null;
    if (Array.isArray(humanBones)) {
      for (const binding of humanBones) {
        if (binding && typeof binding === "object") {
          const item = binding as Record<string, unknown>;
          add(item.node, item.bone);
        }
      }
    }
  }
  return result;
}

/** Return a canonical role when recognized; otherwise preserve normalized name. */
export function canonicalizeHumanoidBoneName(value: unknown): AvatarBoneRole | string {
  const name = normalizeHumanoidBoneName(value);
  if (!name) return "other";

  // J_Bip_L_UpperArm -> leftupperarm; J_Bip_R_LowerArm -> rightlowerarm.
  const jBip = name.match(/^jbip([lr])(.+)$/);
  if (jBip) {
    const side = jBip[1] === "l" ? "left" : "right";
    const part = jBip[2];
    const jBipAliases: Record<string, string> = {
      shoulder: "shoulder", upperarm: "upperarm", lowerarm: "lowerarm",
      hand: "hand", upperleg: "upperleg", lowerleg: "lowerleg",
      foot: "foot", toes: "toes",
    };
    const finger = part.match(/^(thumb|index|middle|ring|little)(metacarpal|proximal|intermediate|distal|[123])$/);
    if (finger) {
      const joint = finger[2] === "1" ? "proximal" : finger[2] === "2" ? "intermediate" : finger[2] === "3" ? "distal" : finger[2];
      return (side + finger[1] + joint) as AvatarBoneRole;
    }
    const mapped = jBipAliases[part];
    if (mapped) return (side + mapped) as AvatarBoneRole;
  }
  const canonical = canonicalRole(name);
  return canonical ? canonical as AvatarBoneRole : name;
}
