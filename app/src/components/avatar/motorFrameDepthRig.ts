import { resolveDepthRigWorldPose, type DepthRigDefinition, type DepthRigPose, type DepthRigTransform } from "./depthRig";
import type { RendererMotorCommandBatch } from "./motorFrameStream";

export interface DepthRigMotorPoseOverlay {
  ok: boolean;
  reason: string;
  pose: DepthRigPose | null;
  frameTick: number | null;
  appliedCommandCount: number;
}

/**
 * Overlay calibrated, model-bound MotorFrame commands on top of the semantic
 * pose. The base semantic pose remains useful for unsupported channels, while
 * only explicitly bound depth-rig node components are replaced by measured
 * motor state. No targetAngleRad or browser-generated goal is consumed here.
 */
export function overlayMotorFrameOnDepthRigPose(
  rig: DepthRigDefinition,
  semanticPose: DepthRigPose,
  batch: RendererMotorCommandBatch,
): DepthRigMotorPoseOverlay {
  const reject = (reason: string): DepthRigMotorPoseOverlay => ({
    ok: false, reason, pose: null, frameTick: null, appliedCommandCount: 0,
  });
  if (!rig || rig.version !== 1 || typeof rig.id !== "string" || !Array.isArray(rig.nodes)
    || !semanticPose || semanticPose.rigId !== rig.id || !semanticPose.deltas
    || typeof semanticPose.deltas !== "object" || Array.isArray(semanticPose.deltas)) {
    return reject("depth-rig-semantic-pose-invalid");
  }
  if (!batch || batch.version !== 1 || batch.renderer !== "depth2d" || batch.modelId !== rig.id) {
    return reject("motor-profile-does-not-match-depth-rig");
  }
  if (!Number.isSafeInteger(batch.frameTick) || batch.frameTick < 0
    || !Number.isFinite(batch.frameAtMs) || batch.frameAtMs < 0
    || !Array.isArray(batch.commands) || batch.commands.length === 0 || batch.commands.length > 128) {
    return reject("motor-frame-batch-invalid");
  }

  const knownNodes = new Set(rig.nodes.map((node) => node.id));
  const deltas: Record<string, Partial<DepthRigTransform>> = {};
  for (const [nodeId, delta] of Object.entries(semanticPose.deltas)) {
    if (!knownNodes.has(nodeId) || !delta || typeof delta !== "object" || Array.isArray(delta)) {
      return reject("semantic-pose-contains-unknown-node");
    }
    deltas[nodeId] = { ...delta };
  }

  const jointIds = new Set<string>();
  const channels = new Set<string>();
  for (const command of batch.commands) {
    if (!command || command.targetKind !== "depth-rig-node"
      || typeof command.jointId !== "string" || command.jointId.length < 2 || command.jointId.length > 64
      || typeof command.targetId !== "string" || !knownNodes.has(command.targetId)
      || (command.component !== "x" && command.component !== "y" && command.component !== "z" && command.component !== "rotation")
      || typeof command.value !== "number" || !Number.isFinite(command.value)) {
      return reject("motor-command-target-or-value-invalid");
    }
    const component: "x" | "y" | "z" | "rotation" = command.component;
    const expectedUnit = component === "rotation" ? "degrees" : "normalized";
    if (command.valueUnit !== expectedUnit) return reject("motor-command-unit-mismatch");
    if (jointIds.has(command.jointId)) return reject("motor-frame-joint-duplicate");
    const channelKey = command.targetId + ":" + component;
    if (channels.has(channelKey)) return reject("motor-frame-target-channel-duplicate");
    const limit = component === "x" || component === "y" ? 2
      : component === "z" ? 10 : 90;
    if (Math.abs(command.value) > limit) return reject("motor-command-value-out-of-range");

    jointIds.add(command.jointId);
    channels.add(channelKey);
    const current = deltas[command.targetId] ?? {};
    deltas[command.targetId] = { ...current, [component]: command.value };
  }

  const pose: DepthRigPose = { rigId: rig.id, deltas };
  try {
    resolveDepthRigWorldPose(rig, pose);
  } catch {
    return reject("motor-overlaid-depth-rig-pose-invalid");
  }
  return {
    ok: true,
    reason: "calibrated-motor-frame-overlaid",
    pose,
    frameTick: batch.frameTick,
    appliedCommandCount: batch.commands.length,
  };
}
