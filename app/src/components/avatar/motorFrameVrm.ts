import type { RendererMotorCommandBatch } from "./motorFrameStream";

export type VrmMotorAxis = "x" | "y" | "z";
export interface VrmMotorBoneReference {
  name: string;
  x: number;
  y: number;
  z: number;
  node: { rotation: Record<VrmMotorAxis, number> };
}
export interface VrmMotorBoneUpdate {
  bone: VrmMotorBoneReference;
  component: VrmMotorAxis;
  value: number;
}
export interface VrmMotorProjection {
  ok: boolean;
  reason: string;
  frameTick: number | null;
  updates: VrmMotorBoneUpdate[];
}

const normalizedName = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Resolve a complete calibrated VRM command batch before any bone is mutated.
 * The adapter has no authority to create goals and rejects partial or ambiguous
 * bone mappings rather than applying only the subset that happened to resolve.
 */
export function resolveVrmMotorFrame(
  batch: RendererMotorCommandBatch,
  modelId: string | null,
  bones: readonly VrmMotorBoneReference[],
): VrmMotorProjection {
  const reject = (reason: string): VrmMotorProjection => ({
    ok: false, reason, frameTick: null, updates: [],
  });
  if (!modelId || !/^[a-z0-9][a-z0-9._:-]{1,95}$/i.test(modelId)
    || !batch || batch.version !== 1 || batch.renderer !== "vrm3d" || batch.modelId !== modelId) {
    return reject("vrm-motor-model-or-renderer-mismatch");
  }
  if (!Number.isSafeInteger(batch.frameTick) || batch.frameTick < 0
    || !Number.isFinite(batch.frameAtMs) || batch.frameAtMs < 0
    || !Array.isArray(batch.commands) || batch.commands.length < 1 || batch.commands.length > 128) {
    return reject("vrm-motor-frame-invalid");
  }
  const byName = new Map<string, VrmMotorBoneReference[]>();
  for (const bone of bones) {
    const key = normalizedName(bone.name);
    if (!key) continue;
    const entries = byName.get(key) ?? [];
    entries.push(bone);
    byName.set(key, entries);
  }
  const jointIds = new Set<string>();
  const channels = new Set<string>();
  const updates: VrmMotorBoneUpdate[] = [];
  for (const command of batch.commands) {
    if (!command || command.targetKind !== "humanoid-bone"
      || typeof command.jointId !== "string" || !/^[a-z0-9][a-z0-9._:-]{1,63}$/i.test(command.jointId)
      || typeof command.targetId !== "string" || !/^[a-z0-9][a-z0-9._:-]{1,63}$/i.test(command.targetId)
      || (command.component !== "x" && command.component !== "y" && command.component !== "z")
      || command.valueUnit !== "radians" || typeof command.value !== "number"
      || !Number.isFinite(command.value) || Math.abs(command.value) > Math.PI * 2 + 1e-5) {
      return reject("vrm-motor-command-invalid");
    }
    const targets = byName.get(normalizedName(command.targetId)) ?? [];
    if (targets.length !== 1) return reject(targets.length ? "vrm-motor-target-ambiguous" : "vrm-motor-target-not-found");
    if (jointIds.has(command.jointId)) return reject("vrm-motor-joint-duplicate");
    const channel = normalizedName(command.targetId) + ":" + command.component;
    if (channels.has(channel)) return reject("vrm-motor-target-channel-duplicate");
    jointIds.add(command.jointId);
    channels.add(channel);
    updates.push({ bone: targets[0], component: command.component, value: command.value });
  }
  return { ok: true, reason: "vrm-motor-frame-resolved-atomically", frameTick: batch.frameTick, updates };
}
