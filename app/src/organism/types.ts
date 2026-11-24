export const LATENT_DIM = 32;
export const VALUE_BINS = 51;

export const ACTIONS = ["respond", "explore", "verify", "rest", "reflect", "wait"] as const;
export type ActionKind = (typeof ACTIONS)[number];
export type OptionKind = ActionKind;

export type EmotionLabel =
  | "curiosity"
  | "calm"
  | "joy"
  | "anxiety"
  | "frustration"
  | "sadness"
  | "anger"
  | "protective";

export type Locale = "ru" | "en";
export type EvidenceKind = "FACT" | "MEASURED" | "ESTIMATED" | "HYPOTHESIS";
export type MemoryKind = "self" | "episode" | "semantic";

export interface Needs {
  energy: number;
  cognitiveLoad: number;
  uncertainty: number;
  socialNeed: number;
  novelty: number;
  identityCoherence: number;
  goalPressure: number;
  sleepPressure: number;
}

export interface EmotionState {
  label: EmotionLabel;
  valence: number;
  arousal: number;
  dominance: number;
  tendency: ActionKind;
  cause: string;
}

export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  text: string;
  salience: number;
  recencyTick: number;
  createdAt: number;
  emotion: EmotionLabel;
  option: OptionKind;
  predictionError: number;
  verified: boolean;
  touches: number;
}

export interface Belief {
  id: string;
  claim: string;
  kind: EvidenceKind;
  confidence: number;
  support: number;
  createdAt: number;
  updatedAt: number;
  source: string;
}

export interface Skill {
  id: string;
  name: string;
  pattern: string;
  uses: number;
  success: number;
  coalition: string[];
  lastTick: number;
}

export interface Goal {
  id: string;
  title: string;
  source: "intrinsic" | "homeostatic" | "learned";
  importance: number;
  urgency: number;
  progress: number;
  status: "active" | "done" | "paused";
}

export interface ChatTurn {
  id: string;
  role: "user" | "kurisu";
  text: string;
  at: number;
  tick: number;
  emotion?: EmotionLabel;
  option?: OptionKind;
  backend?: string;
  delivery?: "sending" | "sent" | "unknown";
}

export interface CandidateScore {
  action: ActionKind;
  score: number;
  confidence: number;
}

export interface DecisionTrace {
  tick: number;
  option: OptionKind;
  optionValue: number;
  action: ActionKind;
  candidates: CandidateScore[];
  predictionError: number;
  retrievedIds: string[];
  workspace: string[];
  reason: string;
}

export interface IdentityPublic {
  subjectId: string;
  name: string;
  fingerprint: string;
  createdAt: number;
  cycles: number;
  traits: Record<string, number>;
  traitNames: string[];
  trust: number;
}

export interface CanonicalWorldSnap {
  scene: string;
  featureDim: number;
  hiddenDim: number;
  predictionError01: number;
  modelSamples: number;
  latentConfidence01: number;
  entities: number;
  conflicts: number;
  workspaceIgnition01: number;
  workspaceRecurrence01: number;
  workspaceDiversity01: number;
  identityContinuity01: number;
  metacognitiveAccuracy01: number;
  evidenceCoverage01: number;
}

export type AvatarBrainExpressionV1 = "neutral" | "curious" | "focused" | "amused" | "concerned" | "tired" | "determined";
export type AvatarRenderProfileV1 = "2d" | "2.5d" | "3d";

export interface AvatarBrainAffectV1 {
  valence01: number; arousal01: number; dominance01: number; curiosity01: number;
  warmth01: number; stress01: number; confidence01: number; memoryRecall01: number;
}

export interface AvatarBrainChannelsV1 {
  eyeOpen: number; browRaise: number; browFurrow: number; mouthSmile: number;
  mouthOpen: number; cheekRaise: number; headTilt: number; headYaw: number;
  gazeX: number; gazeY: number; idleMotion: number; lipSyncGain: number;
}

export interface AvatarBrainProjectionV1 {
  schemaVersion: 1;
  profile: AvatarRenderProfileV1;
  expression: AvatarBrainExpressionV1;
  expressionWeight: number;
  affect: AvatarBrainAffectV1;
  channels: AvatarBrainChannelsV1;
  freshness01: number;
  reducedMotion: boolean;
  source: "organism-state";
  rendererHints: {
    live2d: Record<string, number>;
    layered2d: { parallax01: number; depthBreath01: number; faceRig01: number };
    spatial3d: { headPitch: number; headYaw: number; gazeDistance01: number; shoulderRelax01: number };
  };
  projectedAt: number;
}

export interface AvatarBrainEnvelopeV1 {
  schemaVersion: 1;
  stateVersion: number;
  frame: AvatarBrainProjectionV1;
}

export interface OrganismSnapshot {
  version: number;
  tick: number;
  at: number;
  awake: boolean;
  avatarBrain?: AvatarBrainEnvelopeV1 | null;
  needs: Needs;
  emotion: EmotionState;
  identity: IdentityPublic;
  lastAction: ActionKind;
  lastOption: OptionKind;
  lastReward: number;
  predictionError: number;
  valueEstimate: number;
  curiosity: number;
  memories: MemoryRecord[];
  beliefs: Belief[];
  skills: Skill[];
  goals: Goal[];
  chat: ChatTurn[];
  lastDecision: DecisionTrace | null;
  canonicalWorld: CanonicalWorldSnap;
  worldErrorEma: number;
  replayCount: number;
  learnSteps: number;
  languageCalls: number;
  locale: Locale;
  thoughts: string[];
}

const BOOT_TRAITS: Record<string, number> = {
  curiosity: 0.96,
  scientificRigor: 0.95,
  skepticism: 0.86,
  warmth: 0.63,
  sarcasm: 0.68,
  guardedness: 0.58,
  composure: 0.87,
};

export function emptySnapshot(): OrganismSnapshot {
  return {
    version: 1,
    tick: 0,
    at: 0,
    awake: true,
    avatarBrain: null,
    needs: {
      energy: 0.72,
      cognitiveLoad: 0.22,
      uncertainty: 0.4,
      socialNeed: 0.35,
      novelty: 0.45,
      identityCoherence: 0.92,
      goalPressure: 0.2,
      sleepPressure: 0.12,
    },
    emotion: {
      label: "calm",
      valence: 0.52,
      arousal: 0.22,
      dominance: 0.55,
      tendency: "wait",
      cause: "baseline",
    },
    identity: {
      subjectId: "kurisu",
      name: "Kurisu",
      fingerprint: "boot",
      createdAt: 0,
      cycles: 0,
      traits: { ...BOOT_TRAITS },
      traitNames: ["scientific curiosity", "intellectual independence", "sharp humor", "emotional depth", "truth-seeking", "skepticism", "capacity for revision"],
      trust: 0.28,
    },
    lastAction: "wait",
    lastOption: "wait",
    lastReward: 0,
    predictionError: 0.3,
    valueEstimate: 0,
    curiosity: 0.2,
    memories: [],
    beliefs: [],
    skills: [],
    goals: [],
    chat: [],
    lastDecision: null,
    canonicalWorld: {
      scene: "boot", featureDim: 0, hiddenDim: 0, predictionError01: 0.4, modelSamples: 0,
      latentConfidence01: 0, entities: 0, conflicts: 0, workspaceIgnition01: 0,
      workspaceRecurrence01: 0, workspaceDiversity01: 0, identityContinuity01: 0,
      metacognitiveAccuracy01: 0, evidenceCoverage01: 0,
    },
    worldErrorEma: 0.4,
    replayCount: 0,
    learnSteps: 0,
    languageCalls: 0,
    locale: "ru",
    thoughts: [],
  };
}
