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
  language?: { calls?: number; backend?: string; degraded?: boolean; lastFailure?: string };
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


/** Hexis-imported goals remain proposals until reviewed, materialized and activated. */
export type HexisGoalProposalStatus = "pending" | "approved" | "rejected" | "materialized";

export interface HexisGoalRelationshipReceipt {
  sourceStageFound: boolean;
  candidateRelationships: number;
  projected: number;
  deferred: number;
  semanticEdgeIds: string[];
  at: number;
}

export interface HexisGoalProposal {
  id: string;
  stageId: string;
  exportId: string;
  sourceLineageId: string;
  sourceRef: string;
  title: string;
  description: string;
  importance: number;
  urgency: number;
  confidence: number;
  status: HexisGoalProposalStatus;
  canonicalGoalId?: string;
  goalRelationshipReceipt?: HexisGoalRelationshipReceipt;
  createdAt: number;
  decidedAt?: number;
  decisionReason?: string;
}

export interface HexisGoalProposalPrepareResponse {
  ok: boolean;
  stageId?: string;
  created?: number;
  duplicates?: number;
  proposals?: HexisGoalProposal[];
  error?: string;
}

export interface HexisGoalProposalListResponse {
  ok: boolean;
  proposals?: HexisGoalProposal[];
  error?: string;
}

export interface HexisGoalProposalDecisionResponse {
  ok: boolean;
  proposal?: HexisGoalProposal | null;
  error?: string;
}

export interface HexisGoalMaterializeResponse {
  ok: boolean;
  proposal?: HexisGoalProposal;
  project?: { id?: string; status?: string; pauseReason?: string; title?: string };
  error?: string;
}

export interface HexisGoalActivationResponse {
  ok: boolean;
  proposal?: HexisGoalProposal;
  project?: { id?: string; status?: string; pauseReason?: string; title?: string };
  receipt?: HexisGoalRelationshipReceipt;
  error?: string;
}

export type HexisHmxIntent = "port" | "duplicate" | "telepathy" | "analysis";
export type HexisHmxStrategy = "additive" | "authoritative" | "deliberative" | "analysis_only";
export type HexisHmxDecision = "accept" | "reject" | "apply";
export type HexisHmxStageStatus = "staged" | "accepted" | "rejected" | "applied";

export interface HexisHmxConflict {
  path: string;
  kind: string;
  detail: string;
}

export interface HexisHmxApplicationReceipt {
  version: 1;
  exportId: string;
  sourceLineageId: string;
  stageId: string;
  stageDigest: string;
  attempt: number;
  appliedAt: number;
  status: "applied" | "partial" | "noop";
  complete: boolean;
  candidateMemoryRecords: number;
  uniqueMemoryRecords: number;
  importedCount: number;
  deduplicatedCount: number;
  projectedRelationships: number;
  deferredRelationships: number;
  semanticEdgeIds: string[];
  memoryIds: string[];
  createdMemoryIds: string[];
  deferredSections: Record<string, number>;
  warnings: string[];
  digest: string;
}

export interface HexisHmxStage {
  stagingId: string;
  exportId: string;
  intent: HexisHmxIntent;
  strategy: HexisHmxStrategy;
  sourceSubjectId?: string;
  sourceLineageId?: string;
  sectionCounts: Record<string, number>;
  protectedSections: string[];
  status: HexisHmxStageStatus;
  conflicts: HexisHmxConflict[];
  createdAt: number;
  digest: string;
  lifecycleDigest: string;
  stagedSections: Record<string, unknown>;
  applicationAttempts: number;
  application?: HexisHmxApplicationReceipt;
}

export interface HexisHmxExportResponse {
  ok: boolean;
  document?: Record<string, unknown>;
  error?: string;
}

export interface HexisHmxStageResponse {
  ok: boolean;
  stage?: HexisHmxStage | null;
  error?: string;
}

export interface HexisHmxStageInput {
  document: Record<string, unknown>;
  intent: HexisHmxIntent;
  strategy: HexisHmxStrategy;
}

