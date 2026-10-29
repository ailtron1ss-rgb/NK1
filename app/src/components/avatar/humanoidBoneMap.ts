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

export function buildHumanoidRoleMap(extensionRoot: unknown): Map<number, AvatarBoneRole | string> {
  if (!extensionRoot || typeof extensionRoot !== "object") return new Map();
  const root = extensionRoot as Record<string, unknown>;
  const result = new Map<number, AvatarBoneRole | string>();
  const add = (node: unknown, role: unknown) => {
    if (!Number.isSafeInteger(node) || (node as number) < 0 || typeof role !== "string") return;
    const canonical = canonicalizeHumanoidBoneName(role);
    if (canonical !== "other") result.set(node as number, canonical);
  };

  // VRM 1.0: extensions.VRMC_vrm.humanoid.humanBones is a role-keyed object.
  const modern = root.VRMC_vrm;
  if (modern && typeof modern === "object") {
    const humanoid = (modern as Record<string, unknown>).humanoid;
    const humanBones = humanoid && typeof humanoid === "object"
      ? (humanoid as Record<string, unknown>).humanBones
      : null;
    if (humanBones && typeof humanBones === "object" && !Array.isArray(humanBones)) {
      for (const [role, binding] of Object.entries(humanBones as Record<string, unknown>)) {
        if (binding && typeof binding === "object") add((binding as Record<string, unknown>).node, role);
      }
    }
  }

  // VRM 0.x: extensions.VRM.humanoid.humanBones is an array of { bone, node }.
  const legacy = root.VRM;
  if (legacy && typeof legacy === "object") {
    const humanoid = (legacy as Record<string, unknown>).humanoid;
    const humanBones = humanoid && typeof humanoid === "object"
      ? (humanoid as Record<string, unknown>).humanBones
      : null;
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

export function canonicalizeHumanoidBoneName(value: unknown): AvatarBoneRole | string {
  const name = normalizeHumanoidBoneName(value);
  if (!name) return "other";

  if (name.endsWith("head") || /^(?:jbipc|j?bipc?)head$/.test(name)) return "head";
  if (name.endsWith("neck") || /^(?:jbipc|j?bipc?)neck$/.test(name)) return "neck";
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
