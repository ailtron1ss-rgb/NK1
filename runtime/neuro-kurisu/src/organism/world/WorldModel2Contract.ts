export interface LatentWorldState {
  id: string;
  features: Record<string, number>;
  uncertainty01: number;
  observedAt: number;
  provenanceIds: string[];
}

export interface CausalEdgeHypothesis {
  id: string;
  cause: string;
  effect: string;
  action?: string;
  confidence01: number;
  evidenceCount: number;
  counterevidenceCount: number;
  lastUpdatedAt: number;
}

export interface WorldTransitionHypothesis {
  key: string;
  stateKey: string;
  action: string;
  samples: number;
  meanDelta: Record<string, number>;
  variance: Record<string, number>;
  rewardMean: number;
  rewardVariance: number;
  confidence01: number;
  lastUpdatedAt: number;
}

export interface CalibrationBucket {
  bucket: number;
  samples: number;
  predictedConfidence01: number;
  observedAccuracy01: number;
}

export interface FutureRollout {
  id: string;
  rootStateId: string;
  horizon: number;
  actions: string[];
  predictedStates: LatentWorldState[];
  expectedValue01: number;
  uncertainty01: number;
  createdAt: number;
}

export interface WorldModel2Contract {
  latentState: LatentWorldState | null;
  transitions: WorldTransitionHypothesis[];
  causalEdges: CausalEdgeHypothesis[];
  calibration: CalibrationBucket[];
  rollouts: FutureRollout[];
  modelVersion: number;
  learnedTransitions: number;
  readyForLearning: boolean;
}
