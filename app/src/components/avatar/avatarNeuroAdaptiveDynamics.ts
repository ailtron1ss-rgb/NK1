export type AvatarDynamicsQuality = "low" | "balanced" | "high";
export type AvatarDynamicsRole = "hair" | "garment" | "sleeve" | "neural-fiber";

export interface AvatarDynamicsBone {
  key?: string;
  name: string;
}

export interface AvatarNeuroAdaptiveFrame {
  deltaSeconds: number;
  awake: boolean;
  energy: number;
  arousal: number;
  cognitiveLoad: number;
  uncertainty: number;
  curiosity: number;
  novelty: number;
  predictionError: number;
  action: string;
  quality: AvatarDynamicsQuality;
  bodyChannels?: Readonly<Record<string, number>>;
}

export interface AvatarDynamicsBoneRole {
  role: AvatarDynamicsRole;
  maxAngle: number;
  distalWeight: number;
  side: -1 | 0 | 1;
}

export interface AvatarDynamicsOffset {
  x: number;
  y: number;
  z: number;
  role: AvatarDynamicsRole;
}

interface SpringAxis {
  position: number;
  velocity: number;
}

interface BoneState {
  name: string;
  role: AvatarDynamicsRole;
  phase: number;
  elapsed: number;
  x: SpringAxis;
  y: SpringAxis;
  z: SpringAxis;
}

const FIXED_STEP_SECONDS = 1 / 60;
const MAX_FRAME_SECONDS = 4 * FIXED_STEP_SECONDS;
const MAX_TRACKED_BONES = 256;
const QUALITY_SCALE: Readonly<Record<AvatarDynamicsQuality, number>> = Object.freeze({
  low: 0.35,
  balanced: 0.7,
  high: 1,
});

const clamp = (value: unknown, min: number, max: number, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
const clamp01 = (value: unknown): number => clamp(value, 0, 1);
const clampSigned = (value: unknown): number => clamp(value, -1, 1);
const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

function stablePhase(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 6283) / 1000;
}

/** Only authored secondary chains are eligible; face and primary skeleton are excluded. */
export function resolveAvatarDynamicsBoneRole(boneName: unknown): AvatarDynamicsBoneRole | null {
  if (typeof boneName !== "string" || !boneName.trim()) return null;
  const name = normalize(boneName);
  if (!name || /^(root|armature|skeleton|hips|pelvis|spine|chest|neck|head|jaw|eye|face)/.test(name)) return null;
  if (/(anchor|pinned|pinroot|base|root|attach)$/.test(name)) return null;

  const rawName = boneName.toLowerCase();
  const leftSide = rawName.includes("left") || /(?:[_\-.]l$|(?:tip|lock|strand|fringe)l$|(?:hairlock|hairfringe|strand|fringe|coatpanel|skirtpanel|mantletail|ribbon|sleeve|cuff)l(?:[_\-.]|$))/.test(rawName);
  const rightSide = rawName.includes("right") || /(?:[_\-.]r$|(?:tip|lock|strand|fringe)r$|(?:hairlock|hairfringe|strand|fringe|coatpanel|skirtpanel|mantletail|ribbon|sleeve|cuff)r(?:[_\-.]|$))/.test(rawName);
  const side: -1 | 0 | 1 = leftSide ? -1 : rightSide ? 1 : 0;
  if (/(neural|synapse|filament|conduit|neurofiber)/.test(name)) {
    return { role: "neural-fiber", maxAngle: 0.035, distalWeight: 0.35, side };
  }
  if (/(hair|fringe|bang|strand|lock|tress)/.test(name)) {
    const distal = /(tip|end|distal|loose)/.test(name) ? 1 : /(root|anchor|base)/.test(name) ? 0.2 : 0.58;
    return { role: "hair", maxAngle: 0.06, distalWeight: distal, side };
  }
  if (/(sleeve|cuff|glovefabric|softshoulder)/.test(name)) {
    return { role: "sleeve", maxAngle: 0.055, distalWeight: /(tip|end|cuff)/.test(name) ? 0.85 : 0.4, side };
  }
  if (/(garment|cloth|fabric|coat|skirt|mantle|cape|ribbon|panel|hem|sash|tie|lapel|jacket|dress)/.test(name)) {
    const distal = /(tip|end|hem|tail|flap|loose)/.test(name) ? 1 : /(root|anchor|base)/.test(name) ? 0.2 : 0.6;
    return { role: "garment", maxAngle: 0.09, distalWeight: distal, side };
  }
  return null;
}

function readChannel(frame: AvatarNeuroAdaptiveFrame, name: string): number {
  return clampSigned(frame.bodyChannels?.[name]);
}

function resolveNeuralActivation(frame: AvatarNeuroAdaptiveFrame): number {
  const cognitive = clamp01(frame.cognitiveLoad) * 0.12 + clamp01(frame.uncertainty) * 0.12;
  const exploratory = clamp01(frame.curiosity) * 0.24 + clamp01(frame.novelty) * 0.18;
  const arousal = clamp01(frame.arousal) * 0.18 + clamp01(frame.predictionError) * 0.16;
  const energy = clamp01(frame.energy) * 0.1;
  return clamp01(cognitive + exploratory + arousal + energy);
}

function resolveTarget(
  bone: AvatarDynamicsBoneRole,
  elapsed: number,
  phase: number,
  frame: AvatarNeuroAdaptiveFrame,
): { x: number; y: number; z: number } {
  const awakeScale = frame.awake === true ? 1 : 0.12;
  const energy = clamp01(frame.energy);
  const activation = resolveNeuralActivation(frame);
  const quality = QUALITY_SCALE[frame.quality] ?? QUALITY_SCALE.balanced;
  const poseScale = awakeScale * quality;
  const motion = poseScale * (0.2 + energy * 0.35 + activation * 0.45);
  const headYaw = readChannel(frame, "headYaw");
  const headPitch = readChannel(frame, "headPitch");
  const torsoYaw = readChannel(frame, "torsoYaw");
  const torsoPitch = readChannel(frame, "torsoPitch");
  const rootYaw = readChannel(frame, "rootYaw");
  const breath = Math.max(0, readChannel(frame, "breath"));
  const gait = clamp01(
    (Math.abs(readChannel(frame, "leftAnkle")) + Math.abs(readChannel(frame, "rightAnkle"))
      + Math.abs(readChannel(frame, "leftKnee")) + Math.abs(readChannel(frame, "rightKnee"))) / 4,
  );
  const wave = Math.sin(elapsed * 5.4 + phase);
  const slowWave = Math.sin(elapsed * 2.7 + phase * 0.71);
  const side = bone.side;
  const distal = bone.distalWeight;

  switch (bone.role) {
    case "hair":
      return {
        x: (-headPitch * 0.14 * poseScale + wave * 0.026 * motion) * distal,
        y: (-headYaw * 0.15 * poseScale - rootYaw * 0.055 * poseScale + slowWave * 0.008 * motion) * distal,
        z: (-headYaw * 0.07 * poseScale + wave * 0.018 * motion + side * gait * 0.009 * poseScale) * distal,
      };
    case "sleeve": {
      const shoulder = readChannel(frame, side < 0 ? "leftShoulder" : "rightShoulder");
      const wrist = readChannel(frame, side < 0 ? "leftWrist" : "rightWrist");
      return {
        x: (-torsoPitch * 0.035 * poseScale + breath * 0.012 * poseScale + wave * 0.009 * motion) * distal,
        y: (-torsoYaw * 0.045 * poseScale + wrist * 0.025 * poseScale) * distal,
        z: (shoulder * 0.075 * poseScale + side * gait * 0.012 * poseScale + slowWave * 0.008 * motion) * distal,
      };
    }
    case "garment":
      return {
        x: (-torsoPitch * 0.11 * poseScale + breath * 0.018 * poseScale + wave * (0.012 + gait * 0.018) * motion) * distal,
        y: (-torsoYaw * 0.12 * poseScale - rootYaw * 0.08 * poseScale + slowWave * 0.014 * motion) * distal,
        z: (side * gait * 0.025 * poseScale + torsoYaw * 0.035 * poseScale + wave * 0.012 * motion) * distal,
      };
    case "neural-fiber":
      return {
        x: (headPitch * 0.012 + torsoPitch * 0.01 + wave * 0.004 * activation) * poseScale * distal,
        y: (headYaw * 0.012 + torsoYaw * 0.012) * poseScale * distal,
        z: side * slowWave * 0.004 * activation * poseScale * distal,
      };
  }
}

function integrateAxis(axis: SpringAxis, target: number, omega: number, step: number, limit: number): void {
  const acceleration = (target - axis.position) * omega * omega - 2 * omega * axis.velocity;
  axis.velocity += acceleration * step;
  axis.position += axis.velocity * step;
  if (axis.position > limit) {
    axis.position = limit;
    if (axis.velocity > 0) axis.velocity = 0;
  } else if (axis.position < -limit) {
    axis.position = -limit;
    if (axis.velocity < 0) axis.velocity = 0;
  }
}

/** Deterministic secondary physics; cognition supplies signals, not a render-loop ML inference. */
export class AvatarNeuroAdaptiveDynamics {
  private readonly states = new Map<string, BoneState>();

  reset(): void {
    this.states.clear();
  }

  snapshot(): { activeBones: number } {
    return { activeBones: this.states.size };
  }

  step(
    bones: readonly AvatarDynamicsBone[],
    frame: AvatarNeuroAdaptiveFrame,
  ): ReadonlyMap<string, AvatarDynamicsOffset> {
    const output = new Map<string, AvatarDynamicsOffset>();
    if (!Array.isArray(bones) || !frame || typeof frame !== "object") return output;
    const candidates = bones.slice(0, MAX_TRACKED_BONES);
    const activeKeys = new Set<string>();
    const requestedDelta = clamp(frame.deltaSeconds, 0, MAX_FRAME_SECONDS);
    const substeps = requestedDelta > 0
      ? Math.max(1, Math.min(4, Math.ceil(requestedDelta / FIXED_STEP_SECONDS)))
      : 0;
    const stepSeconds = substeps ? requestedDelta / substeps : 0;

    for (const [index, bone] of candidates.entries()) {
      if (!bone || typeof bone.name !== "string") continue;
      const key = typeof bone.key === "string" && bone.key.length > 0
        ? bone.key.slice(0, 128)
        : normalize(bone.name) + ":" + index;
      const role = resolveAvatarDynamicsBoneRole(bone.name);
      if (!role) continue;
      activeKeys.add(key);
      let state = this.states.get(key);
      if (!state || state.name !== normalize(bone.name) || state.role !== role.role) {
        state = {
          name: normalize(bone.name),
          role: role.role,
          phase: stablePhase(key + ":" + bone.name),
          elapsed: 0,
          x: { position: 0, velocity: 0 },
          y: { position: 0, velocity: 0 },
          z: { position: 0, velocity: 0 },
        };
        if (this.states.size >= MAX_TRACKED_BONES) {
          const oldest = this.states.keys().next().value;
          if (oldest !== undefined) this.states.delete(oldest);
        }
        this.states.set(key, state);
      }
      if (stepSeconds > 0) {
        state.elapsed += stepSeconds * substeps;
        const target = resolveTarget(role, state.elapsed, state.phase, frame);
        const omega = role.role === "neural-fiber" ? 13 : role.role === "garment" ? 7.5 : 9.5;
        for (let substep = 0; substep < substeps; substep += 1) {
          integrateAxis(state.x, target.x, omega, stepSeconds, role.maxAngle);
          integrateAxis(state.y, target.y, omega, stepSeconds, role.maxAngle);
          integrateAxis(state.z, target.z, omega, stepSeconds, role.maxAngle);
        }
      }
      output.set(key, {
        x: state.x.position,
        y: state.y.position,
        z: state.z.position,
        role: role.role,
      });
    }

    for (const key of this.states.keys()) {
      if (!activeKeys.has(key)) this.states.delete(key);
    }
    return output;
  }
}

export interface AvatarNeuroAdaptiveMorphWeight {
  name: string;
  index: number;
  value: number;
}

const MORPH_CHANNELS = Object.freeze({
  cloth: ["nk1clothsway", "clothsway"],
  hair: ["nk1hairsway", "hairsway"],
  tissue: ["nk1tissuebreath", "softtissuebreath"],
  neural: ["nk1neuralpulse", "neuralpulse"],
} as const);

/** Only explicitly authored secondary morphs are mapped; facial channels are never touched. */
export function resolveNeuroAdaptiveMorphWeights(
  dictionary: unknown,
  frame: AvatarNeuroAdaptiveFrame,
): AvatarNeuroAdaptiveMorphWeight[] {
  if (!dictionary || typeof dictionary !== "object" || Array.isArray(dictionary)) return [];
  const entries = Object.entries(dictionary as Record<string, unknown>);
  if (entries.length > 256) return [];
  const byName = new Map<string, { name: string; index: unknown }>();
  for (const [name, index] of entries) byName.set(normalize(name), { name, index });
  const activation = resolveNeuralActivation(frame);
  const weights: AvatarNeuroAdaptiveMorphWeight[] = [];
  const targets: ReadonlyArray<[keyof typeof MORPH_CHANNELS, number]> = [
    ["cloth", clamp01(Math.abs(readChannel(frame, "torsoYaw")) * 0.45 + Math.abs(readChannel(frame, "rootYaw")) * 0.3 + activation * 0.18)],
    ["hair", clamp01(Math.abs(readChannel(frame, "headYaw")) * 0.42 + Math.abs(readChannel(frame, "headPitch")) * 0.28 + activation * 0.2)],
    ["tissue", clamp01(Math.max(0, readChannel(frame, "breath")) * 0.7 + clamp01(frame.energy) * 0.12)],
    ["neural", activation],
  ];
  for (const [channel, value] of targets) {
    const aliases = MORPH_CHANNELS[channel];
    const match = aliases.map((alias) => byName.get(alias)).find(Boolean);
    if (!match || !Number.isInteger(match.index) || (match.index as number) < 0) continue;
    weights.push({ name: match.name, index: match.index as number, value: frame.awake ? value : value * 0.12 });
  }
  return weights;
}

/** Emission multiplier for explicitly tagged neural-fabric materials only. */
export function resolveNeuroAdaptiveNeuralMultiplier(frame: AvatarNeuroAdaptiveFrame): number {
  const activation = resolveNeuralActivation(frame) * (frame.awake ? 1 : 0.18);
  return clamp(0.82 + activation * 0.76, 0.75, 1.65, 1);
}
