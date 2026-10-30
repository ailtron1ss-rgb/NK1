import type { BodyCapabilities, JointPose } from "./bodyMotorController.ts";

type EulerLike = { x: number; y: number; z: number; set?: (x: number, y: number, z: number) => void };
type NodeLike = { name?: string; rotation?: EulerLike; children?: NodeLike[]; traverse?: (fn: (node: NodeLike) => void) => void };

type ChannelBinding = { node: NodeLike; axis: "x" | "y" | "z" };
const normalize = (value: unknown): string => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const CHANNELS: Record<string, { aliases: string[]; axis: "x" | "y" | "z" }> = {
  headYaw: { aliases: ["head", "mixamorighead", "jbipchead"], axis: "y" },
  headPitch: { aliases: ["head", "mixamorighead"], axis: "x" },
  headRoll: { aliases: ["head", "mixamorighead"], axis: "z" },
  neckYaw: { aliases: ["neck", "mixamorigneck", "jbipcneck"], axis: "y" },
  neckPitch: { aliases: ["neck", "mixamorigneck", "jbipcneck"], axis: "x" },
  spinePitch: { aliases: ["spine", "chest", "upperchest", "mixamorigspine", "jbipcspine", "jbipcchest", "jbipcupperchest"], axis: "x" },
  leftShoulderPitch: { aliases: ["leftupperarm", "leftarm", "leftshoulder", "mixamorigleftarm", "jbiplupperarm"], axis: "x" },
  leftShoulderRoll: { aliases: ["leftupperarm", "leftarm", "leftshoulder", "mixamorigleftarm", "jbiplupperarm"], axis: "z" },
  leftElbowFlex: { aliases: ["leftlowerarm", "leftforearm", "mixamorigleftforearm", "jbipllowerarm"], axis: "x" },
  rightShoulderPitch: { aliases: ["rightupperarm", "rightarm", "rightshoulder", "mixamorigrightarm", "jbiprupperarm"], axis: "x" },
  rightShoulderRoll: { aliases: ["rightupperarm", "rightarm", "rightshoulder", "mixamorigrightarm", "jbiprupperarm"], axis: "z" },
  rightElbowFlex: { aliases: ["rightlowerarm", "rightforearm", "mixamorigrightforearm", "jbiprlowerarm"], axis: "x" },
  leftHipFlex: { aliases: ["leftupperleg", "leftupleg", "mixamorigleftupleg", "jbiplupperleg"], axis: "x" },
  leftKneeFlex: { aliases: ["leftlowerleg", "leftleg", "mixamorigleftleg", "jbipllowerleg"], axis: "x" },
  rightHipFlex: { aliases: ["rightupperleg", "rightupleg", "mixamorigrightupleg", "jbiprupperleg"], axis: "x" },
  rightKneeFlex: { aliases: ["rightlowerleg", "rightleg", "mixamorigrightleg", "jbipr lowerleg".replace(/ /g, "")], axis: "x" },
};

export interface VrmMotorApplyResult {
  applied: Record<string, number>;
  unsupported: string[];
  executionStatus: "applied" | "partial" | "unsupported";
}

export interface VrmMotorAdapter {
  capabilities: BodyCapabilities;
  applyPose(pose: JointPose): VrmMotorApplyResult;
}

/**
 * Adapts NK1 canonical joint channels to a loaded VRM/GLB humanoid-like skeleton.
 * The caller restores the animation/bind pose before each mixer update; this adapter
 * then adds the bounded NK1 offsets over that frame's current mixer result.
 */
export function createVrmMotorAdapter(root: NodeLike): VrmMotorAdapter {
  const nodes: NodeLike[] = [];
  if (typeof root.traverse === "function") root.traverse((node) => nodes.push(node));
  else {
    const visit = (node: NodeLike) => { nodes.push(node); for (const child of node.children ?? []) visit(child); };
    visit(root);
  }

  const bindings: Record<string, ChannelBinding> = {};
  for (const [channel, definition] of Object.entries(CHANNELS)) {
    const aliases = new Set(definition.aliases.map(normalize));
    const node = nodes.find((candidate) => aliases.has(normalize(candidate.name)) && candidate.rotation);
    if (node?.rotation) bindings[channel] = { node, axis: definition.axis };
  }

  const capabilities: BodyCapabilities = {
    joints: Object.keys(bindings).sort(),
    expressions: [],
    supportsIk: false,
    supportsWorldInteraction: false,
    supportsClothingLayers: false,
  };

  return {
    capabilities,
    applyPose(pose) {
      const applied: Record<string, number> = {};
      const unsupported: string[] = [];
      const updates = new Map<NodeLike, { x: number; y: number; z: number }>();
      for (const [channel, value] of Object.entries(pose)) {
        const binding = bindings[channel];
        if (!binding || !Number.isFinite(value) || !binding.node.rotation) {
          unsupported.push(channel);
          continue;
        }
        const rotation = binding.node.rotation;
        const current = updates.get(binding.node) ?? { x: rotation.x, y: rotation.y, z: rotation.z };
        current[binding.axis] += value;
        updates.set(binding.node, current);
        applied[channel] = value;
      }
      for (const [node, rotation] of updates) {
        const target = node.rotation!;
        if (typeof target.set === "function") target.set(rotation.x, rotation.y, rotation.z);
        else { target.x = rotation.x; target.y = rotation.y; target.z = rotation.z; }
      }
      const orderedUnsupported = unsupported.sort();
      return {
        applied,
        unsupported: orderedUnsupported,
        executionStatus: Object.keys(applied).length === 0 ? "unsupported" : orderedUnsupported.length ? "partial" : "applied",
      };
    },
  };
}
