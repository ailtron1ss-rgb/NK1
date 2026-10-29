/**
 * Normalize common Blender, Mixamo, and VRM humanoid node names into the
 * small semantic vocabulary used by NK1's current generic 3D motor adapter.
 * This is name-based compatibility, not a substitute for VRM's humanoid API.
 */
export type AvatarBoneRole =
  | "head"
  | "neck"
  | "leftupperarm"
  | "rightupperarm"
  | "leftlowerarm"
  | "rightlowerarm"
  | "spine"
  | "hips"
  | "other";

export function normalizeHumanoidBoneName(value: unknown): string {
  return String(value ?? "").toLocaleLowerCase().replace(/[^a-z0-9]/gu, "");
}

export function canonicalizeHumanoidBoneName(value: unknown): AvatarBoneRole | string {
  const name = normalizeHumanoidBoneName(value);
  if (!name) return "other";

  if (name === "head" || /^(?:jbipc|j?bipc?)head$/.test(name)) return "head";
  if (name === "neck" || /^(?:jbipc|j?bipc?)neck$/.test(name)) return "neck";
  if (name === "spine" || /^(?:jbipc|j?bipc?)spine\d*$/.test(name)) return "spine";
  if (name === "hips" || name === "pelvis" || /^(?:jbipc|j?bipc?)hips$/.test(name)) return "hips";

  if (
    /leftupperarm$/.test(name) ||
    /leftshoulder$/.test(name) ||
    /upperarml$/.test(name) ||
    /leftarm$/.test(name) ||
    /^jbipl(?:upperarm|shoulder)$/.test(name)
  ) return "leftupperarm";

  if (
    /rightupperarm$/.test(name) ||
    /rightshoulder$/.test(name) ||
    /upperarmr$/.test(name) ||
    /rightarm$/.test(name) ||
    /^jbipr(?:upperarm|shoulder)$/.test(name)
  ) return "rightupperarm";

  if (
    /leftlowerarm$/.test(name) ||
    /lowerarml$/.test(name) ||
    /leftforearm$/.test(name) ||
    /^jbipllowerarm$/.test(name)
  ) return "leftlowerarm";

  if (
    /rightlowerarm$/.test(name) ||
    /lowerarmr$/.test(name) ||
    /rightforearm$/.test(name) ||
    /^jbiprlowerarm$/.test(name)
  ) return "rightlowerarm";

  return name;
}
