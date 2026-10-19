export interface BackendMemory {
  id: string;
  kind: string;
  summary: string;
  salience: number;
  confidence: number;
  predictionError: number;
  createdAt: number;
  retrievedAt?: number;
  retrievalCount?: number;
  reward01?: number;
}

export interface BackendGoal {
  id: string;
  title: string;
  reason?: string;
  source: string;
  status: string;
  importance: number;
  urgency: number;
  confidence: number;
  progress: number;
  createdAt: number;
  updatedAt: number;
}

export interface BackendSkill {
  id: string;
  action: string;
  context: string;
  uses: number;
  successes: number;
  failures: number;
  successRate: number;
  confidence: number;
  status: string;
  lastUsedAt: number;
}

export interface BackendUiSnapshot {
  ok: boolean;
  version: string;
  organismCore: string;
  schemaVersion: number;
  at: number;
  tick: number;
  awake: boolean;
  state: {
    needs: {
      energy: number;
      cognitiveLoad: number;
      uncertainty: number;
      socialNeed: number;
      novelty: number;
      identityCoherence: number;
      goalPressure: number;
      sleepPressure: number;
    };
    predictionError: number;
    selfPredictionError: number;
    attentionBudget: number;
    lastAction: string;
    lastReward01: number;
    autonomyScore: number;
    predictedNextAction: string;
    lastPredictionConfidence: number;
    worldContextVersion: number;
  };
  emotion: {
    label: string;
    valence: number;
    arousal: number;
    dominance: number;
    tendency: string;
    cause: string;
  };
  identity: {
    subjectId: string;
    name: string;
    fingerprint: string;
    createdAt: number;
    cycles: number;
    traits: Record<string, number>;
    trust: number;
    traitNames: string[];
  };
  lastDecision: {
    tick: number;
    action: string;
    predictedNextAction: string;
    selectedScore: number;
    candidates: Array<{ action: string; score: number; confidence: number }>;
    workspace: string[];
    reason: string;
  } | null;
  memories: BackendMemory[];
  beliefs: Array<{ id: string; claim: string; kind: string; confidence: number; support: number; source: string }>;
  skills: BackendSkill[];
  goals: BackendGoal[];
  world: {
    featureDim: number;
    hiddenDim: number;
    predictionError01: number;
    modelSamples: number;
    lastLatentConfidence01: number;
    scene: string;
    entities: number;
    conflicts: number;
  };
  workspace: { selected: string[]; ignition01: number; recurrence01: number; diversity01: number };
  learning: { steps: number; evidenceDebt: number; learningDelta01: number; predictionError01: number };
  consciousness: { identityContinuity01: number; metacognitiveAccuracy01: number; workspaceIgnition01: number; evidenceCoverage01: number };
  body: { battery01: number; cognitiveCapacity01: number; thermalStrain01: number; cpuLoad01: number; ramPressure01: number };
  voice: { speaking: boolean; listening: boolean; ttsAvailable: boolean; sttAvailable: boolean };
}

export interface ChatBackendResponse {
  ok: boolean;
  cycle?: {
    state?: BackendUiSnapshot["state"] & { tick?: number };
    decision?: {
      selected?: { action?: string; score?: number; confidence?: number } | null;
      candidates?: Array<{ action: string; score: number; confidence: number }>;
    };
    workspace?: { selected?: string[]; content?: Record<string, unknown>; recurrentCycles?: number };
  };
  language?: { text?: string; calls?: number; backend?: string; latencyMs?: number };
  worldAction?: string;
  explanation?: string;
  voice?: { spoken?: boolean };
}
