import type { OrganismBodyState, OrganismBodyEvent } from '../body/EmbodiedBody.ts';
import { RELEASE_CONTRACT } from '../system/ReleaseContract.ts';

export type GoalSource = 'intrinsic' | 'external' | 'learned' | 'homeostatic';
export type OrganismGoalStatus = 'candidate' | 'active' | 'paused' | 'completed' | 'abandoned';
export type ActionKind = 'respond' | 'explore' | 'verify' | 'rest' | 'reflect' | 'wait' | 'defer';
export interface CognitiveProposal { summary:string; hypotheses:string[]; uncertainty:number; suggestedAction: ActionKind | null; evidenceNeeded:string[]; source:'llm'|'local-fallback'; at:number; }

export interface OrganismNeeds {
  energy: number;
  cognitiveLoad: number;
  uncertainty: number;
  socialNeed: number;
  novelty: number;
  identityCoherence: number;
  goalPressure: number;
}

export interface SubjectIdentityRecord {
  subjectId: string;
  createdAt: number;
  lastTransferAt: number;
  transferCount: number;
  fingerprint: string;
}

export interface OrganismState {
  version: typeof RELEASE_CONTRACT.stateSchema;
  tick: number;
  at: number;
  needs: OrganismNeeds;
  predictionError: number;
  attentionBudget: number;
  lastAction: ActionKind | 'none';
  lastActionSuccess: number | null;
  autonomyScore: number;
  selfPredictionError: number;
  predictedNextAction: ActionKind | 'none';
  lastPredictionConfidence: number;
  worldContextVersion: number;
}

export interface OrganismGoal {
  id: string;
  title: string;
  reason: string;
  source: GoalSource;
  status: OrganismGoalStatus;
  importance: number;
  urgency: number;
  confidence: number;
  progress: number;
  createdAt: number;
  updatedAt: number;
  parentId?: string;
}

export interface IntentCandidate {
  id: string;
  goalId?: string;
  action: ActionKind;
  score: number;
  predictedUtility: number;
  predictedNeedRelief: number;
  predictedCost: number;
  confidence: number;
  generatedAt: number;
  /** Exact world-model prediction ticket used to score this action before execution. */
  worldPredictionId?: string;
}

export interface WorkspaceFrame {
  tick: number;
  broadcastId: string;
  selected: string[];
  content: Record<string, unknown>;
  recurrentCycles: number;
}

export interface WorldContext {
  tick: number;
  location: string;
  energy: number;
  attention: number;
  uncertainty: number;
  facts: string[];
  objects: Array<{ id: string; label: string; location: string; value: number; valueKnown?: boolean; visible: boolean; visibilityKnown?: boolean; collected: boolean; collectionKnown?: boolean; confidence01?: number; evidenceKind?: 'observed'|'model-output'|'derived'|'conflict'|'unresolved'; sourceId?: string; x?: number; y?: number; z?: number; coordinateFrameId?: string }>;
  events: string[];
}

export interface PredictedActionOutcome {
  action: ActionKind;
  utility: number;
  confidence: number;
  reasons: string[];
  nextState: Pick<OrganismNeeds, 'energy' | 'cognitiveLoad' | 'uncertainty' | 'novelty'>;
  worldEvidence?: string[];
}

export interface DecisionAgencyEvidence {
  version: 1;
  tick: number;
  source: 'canonical-governed-candidates';
  selectionOwner: 'OrganismCore-canonical-arbiters';
  affectsSelection: false;
  attentionBudget01: number;
  attentionWidth: number;
  candidateCount: number;
  surfacedCandidateIds: string[];
  omittedCandidateIds: string[];
  selectedAction: ActionKind | 'none';
  selectedCandidateId: string | null;
  selectedBelongsToCandidates: boolean;
  affordances: Array<{
    candidateId: string;
    action: ActionKind;
    goalId?: string;
    score01: number;
    predictedUtility01: number;
    confidence01: number;
    estimatedCost01: number;
    selected: boolean;
    userRequested: boolean;
    worldPredictionTicketPresent: boolean;
    reasons: string[];
    worldEvidence: string[];
  }>;
  competition: {
    contest: 'selection-not-in-candidates' | 'single-candidate' | 'selected-below-best-score' | 'close-contest' | 'decisive';
    selectedScore01: number;
    bestAlternativeAction: ActionKind | null;
    bestAlternativeScore01: number | null;
    selectedVsBestAlternativeMargin: number;
    rankedTop: Array<{ candidateId: string; action: ActionKind; score01: number; selected: boolean }>;
  };
}

export interface OrganismDecisionTrace {
  id: string;
  tick: number;
  createdAt: number;
  candidates: IntentCandidate[];
  selected: IntentCandidate | null;
  stateBefore: OrganismState;
  /** State immediately after the associated outcome. This makes replay counterfactual/temporal learning explicit instead of inferring it from the old state. */
  stateAfter?: OrganismState;
  reasoningSignals: Record<string, number>;
  worldContextKey?: string;
  /** R19 operation-level semantic proof: hashes + invariant checks for the selected decision. */
  semanticEvidence?: import('../system/DecisionSemanticEvidence.ts').DecisionSemanticEvidence;
  /** WILL-inspired read-only affordance and competition evidence; never a second selector. */
  agencyEvidence?: DecisionAgencyEvidence;
  userRequestedAction: ActionKind | null;
  autonomousOverride: boolean;
  predictedOutcomes: PredictedActionOutcome[];
  outcome?: { success:number; reward?:number; surprise?:number; notes?:string; at:number };
}

export interface WorldTransitionForOrganism {
  action: string;
  before: WorldContext;
  after: WorldContext;
  reward: number;
  surprise: number;
  at: number;
}

/** P290 — provenance carried from reality arbitration into long-lived learning. */
export interface LearningProvenance {
  source: 'external' | 'simulation';
  evidence01: number;
  verified01: number;
  independent01: number;
  consequence01: number;
  learningScale01: number;
  neuralUpdateScale01: number;
  worldModelUpdateScale01: number;
  memoryPromotionScale01: number;
  identityUpdateScale01: number;
  /** Exact gated outcome signals when the runtime has already resolved provenance. */
  reward01?: number;
  success01?: number;
  surprise01?: number;
}

export interface OrganismObservation {
  text?: string;
  surprise?: number;
  success?: number;
  reward?: number;
  worldEvent?: { type: string; importance?: number; payload?: Record<string, unknown> };
  worldContext?: WorldContext;
  socialSignal?: number;
  novelty?: number;
  externalGoal?: { title: string; importance?: number; urgency?: number };
  embodiment?: { bodyEnergy01:number; cognitiveCapacity01:number; thermalStrain01:number; sensoryFreshness01:number; awake:boolean; battery01:number; cpuLoad01:number; ramPressure01:number };
  vision?: { features:number[]; width?:number; height?:number; rawRgb?:number[]; confidence01?:number; sceneLabel?:string; objects?:Array<{label:string;kind?:import('../body/P35SemanticWorldBody.ts').P35EntityKind;confidence01?:number;x?:number;y?:number;z?:number}>; relations?:Array<{from:string;relation:import('../body/P35SemanticWorldBody.ts').P35Relation;to:string;confidence01?:number}> };
  audio?: { samples:number[]; sampleRate?:number; confidence01?:number; events?:Array<{label:string;confidence01?:number}> };
}


export interface ConsolidatedMemory {
  id: string;
  kind: 'episode'|'pattern'|'self-model'|'goal-learning';
  summary: string;
  salience: number;
  evidence: string[];
  createdAt: number;
}


export interface CausalExperimentRecord {
  id: string;
  control: string;
  treatment: string;
  metric: string;
  controlValue: number;
  treatmentValue: number;
  delta: number;
  standardizedEffect: number;
  interpretation: string;
  at: number;
}

export interface ConsciousnessFacet {
  intrinsic: import('../cognition/IntrinsicMotivationEngine.ts').IntrinsicDriveState;
  p31: import('../cognition/P31FunctionalConsciousness.ts').ConsciousnessFunctionalState;
  p32: import('../cognition/P32CausalSelfModel.ts').CausalSelfModelState;
  p33: import('../cognition/P33PersonhoodCore.ts').PersonhoodCoreState;
  p34: import('../cognition/P34CausalPersonhood.ts').P34CausalPersonhoodState;
  activeInference: import('../world/ActiveInferenceEngine.ts').ActiveInferenceState;
  identityContinuity: import('../cognition/IdentityContinuity.ts').IdentityContinuityState;
  metacognition: import('../cognition/MetaCognitiveMonitor.ts').MetaCognitiveState;
  workspaceIgnition: import('../cognition/WorkspaceIgnitionMetrics.ts').WorkspaceIgnitionState;
  consciousnessEvidence: import('../cognition/ConsciousnessEvidenceLedger.ts').ConsciousnessEvidenceSnapshot;
  causalExperiments: CausalExperimentRecord[];
  researchQuestionsCompleted: string[];
}

export interface LearningFacet {
  selfAuthorship: import('../cognition/SelfAuthorship.ts').SelfAuthorshipState;
  sensorimotor: import('../cognition/SensorimotorLoop.ts').SensorimotorState;
  valueRevisionLog: import('../cognition/ValuePlasticity.ts').ValueRevision[];
  longitudinal: { cycles: number; lastBenchmarkAt: number; lastScore: number };
  neuromodulation: import('../cognition/NeuromodulationSystem.ts').NeuromodulationState;
  lifelong: import('../learning/LifelongDevelopmentSystem.ts').LifelongDevelopmentState;
  adaptivePolicy: import('../learning/AdaptivePolicyEngine.ts').AdaptivePolicyState;
  p23: import('../learning/P23LearningEngine.ts').P23LearningState;
  p26: import('../learning/P26TrueLearningEngine.ts').P26TrueLearningState;
  p28: import('../learning/P28PlasticitySubstrate.ts').P28PlasticityState;
  p29: import('../learning/P29LearningGovernance.ts').LearningGovernanceState;
  p30: import('../learning/P30ContinualIntelligence.ts').P30ContinualState;
  p36: import('../learning/P36AutonomousSelfDevelopment.ts').SelfDevelopmentState;
  p38: import('../learning/P38AutonomousCausalResearch.ts').P38ResearchState;
  p39: import('../learning/P39ContinuousArtificialLife.ts').P39LifeState;
  p40ModelEcology: import('../learning/P40ModelEcology.ts').P40ModelEcologyState;
  p44PredictiveWorld: import('../world/P44EmbodiedPredictiveSelfWorld.ts').P44State;
  developmentalSynthesis?: import('../learning/DevelopmentalSynthesisEngine.ts').DevelopmentalSynthesisState;
  developmentalExecutive?: import('../learning/DevelopmentalExecutiveEngine.ts').DevelopmentalExecutiveState;
  metaDevelopmental?: import('../learning/MetaDevelopmentalStrategyEngine.ts').MetaDevelopmentalState;
  personalCurriculum?: import('../learning/PersonalCurriculumEngine.ts').PersonalCurriculumState;
  developmentalPortfolio?: import('../learning/DevelopmentalPortfolioEngine.ts').DevelopmentalPortfolioState;
  lifeCourseNavigator?: import('../learning/LifeCourseNavigator.ts').LifeCourseNavigatorState;
  personalWorldline?: import('../learning/PersonalWorldlineEngine.ts').PersonalWorldlineState;
  integratedLifeTrajectory?: import('../learning/IntegratedLifeTrajectoryEngine.ts').IntegratedLifeTrajectoryState;
  cognitiveOrganismContinuity?: import('../learning/CognitiveOrganismContinuityEngine.ts').CognitiveOrganismContinuityState;
  autonomousCognitiveLife?: import('../learning/AutonomousCognitiveLifeEngine.ts').AutonomousCognitiveLifeState;
  verifiedAutonomousLife?: import('../learning/VerifiedAutonomousLifeEngine.ts').VerifiedAutonomousLifeState;
  researchGradeOrganism?: import('../learning/ResearchGradeOrganismEngine.ts').ResearchGradeState;
  operationalLife?: import('../learning/OperationalLifeEngine.ts').OperationalLifeState;
  autonomousScientificBrain?: import('../learning/AutonomousScientificBrainSubstrate.ts').AutonomousScientificBrainState;
}

export interface EmbodimentFacet {
  multimodal: import('../body/MultimodalPerception.ts').MultimodalState;
  toolAudit: import('../system/ActionGateway.ts').ActionAuditRecord[];
  body: OrganismBodyState;
  bodyEvents: OrganismBodyEvent[];
  sleepSessions: Array<{ startedAt:number; endedAt:number|null; reason:string; durationMs?:number }>;
  lastSensorAt: number;
  sensorFailures: number;
  sensorDiagnostics?: { diagnostics: import('../body/AndroidEmbodimentBridge.ts').AndroidTelemetryDiagnostics | null; sampleCount:number; sensorFailures:number };
  perceptionRouting: import('../body/PerceptionRouter.ts').PerceptionRoutingState;
  p35: import('../body/P35SemanticWorldBody.ts').P35SemanticWorldBodyState;
  p37: import('../body/P37EmbodiedSensorium.ts').P37SemanticWorldState;
  p40SemanticIntelligence: import('../cognition/P40SemanticIntelligence.ts').P40SemanticIntelligenceState;
  p41SemanticPerception: import('../cognition/P41SemanticPerception.ts').P41PerceptionState;
  p41NativePerception: import('../cognition/P41NativePerception.ts').P41NativePerceptionState;
  p41TemporalPerception: import('../cognition/P41TemporalPerceptionModel.ts').P41TemporalPerceptionState;
  p42Experience: import('../cognition/P42UnifiedEmbodiedExperience.ts').P42State;
  p43Imagery: import('../cognition/P43EmbodiedImageryWorkspace.ts').P43State;
  perceptualEvidence: import('../body/PerceptualEvidenceCompiler.ts').PerceptualEvidenceState;
  cameraEvidence: import('../body/CameraEvidenceProcessor.ts').CameraEvidenceState;
  deviceEvidence?: import('../body/DeviceEvidenceLedger.ts').DeviceEvidenceState;
  embodiedAction?: import('../body/EmbodiedActionExecutor.ts').EmbodiedActionResult;
  embodiedRecovery?: import('../body/EmbodiedRecoveryController.ts').EmbodiedRecoveryState;
}

export interface MemoryFacet {
  eventLog: import('../memory/EventSourcing.ts').OrganismEvent[];
  autobiographicalMemories: import('../memory/MultiTimescaleMemory.ts').MemoryRecord[];
  selfModel: import('../cognition/SelfModelV2.ts').SelfModelV2;
  attention: import('../cognition/AttentionSchema.ts').OrganismAttentionState;
  socialModel: import('../cognition/SocialWorldModel.ts').SocialPrediction[];
  adaptiveValues: import('../cognition/ValuePlasticity.ts').AdaptiveValueWeights;
  workspace: import('../cognition/RecurrentWorkspaceV2.ts').WorkspaceStateV2;
  semanticGraph: import('../memory/SemanticMemoryGraph.ts').SemanticGraphState;
  experiments: import('../cognition/IntrinsicExperimentGenerator.ts').IntrinsicExperiment[];
  counterfactuals: import('../world/CounterfactualEngine.ts').CounterfactualBranch[];
  lastRetrievedMemoryIds: string[];
}

export interface DevelopmentalCognitionFacet {
  perception: import('../cognition/PerceptionEngine.ts').PerceptionState;
  cognitiveField: import('../cognition/CognitiveField.ts').CognitiveFieldState;
  contradictions: import('../cognition/ContradictionReservoir.ts').ContradictionReservoirState;
  budget: import('../cognition/CognitiveBudgetManager.ts').CognitiveBudgetState;
  immune: import('../cognition/CognitiveImmuneSystem.ts').CognitiveImmuneState;
  sources: import('../memory/SourceMonitor.ts').SourceMonitorState;
  skills: import('../learning/ProceduralSkillLibrary.ts').SkillLibraryState;
  scientific: import('../learning/ScientificMethodEngine.ts').ScientificMethodState;
  residualWorld: import('../world/LearnedResidualWorldModel.ts').LearnedResidualWorldState;
  contextualWorld: import('../world/ContextualWorldModel.ts').ContextualWorldState;
  p27: import('./../cognition/P27NeuralWorldFoundation.ts').P27NeuralWorldState;
  brainSubstrate?: import('../cognition/BrainSubstrate.ts').BrainSubstrateState;
  centralBrain?: import('../cognition/CentralBrainSubstrate.ts').CentralBrainState;
  predictiveSelfAgency?: import('../cognition/PredictiveSelfAgencySubstrate.ts').PredictiveSelfAgencyState;
  globalWorkspace?: import('../cognition/GlobalWorkspaceSubstrateV2.ts').GlobalWorkspaceSubstrateState;
  metacognitiveNeural?: import('../cognition/MetacognitiveNeuralSubstrate.ts').MetacognitiveNeuralState;
  socialPredictiveNeural?: import('../cognition/SocialPredictiveNeuralSubstrate.ts').SocialPredictiveState;
  centralSubjectDynamics?: import('../cognition/CentralSubjectDynamics.ts').CentralSubjectState;
}

export interface EvolutionFacet {
  selfProjects: import('../cognition/evolution/SelfProjectEngine.ts').SelfProjectState;
  agency: import('../cognition/evolution/AgencyDeliberationEngine.ts').AgencyDeliberationState;
  valueEvolution: import('../cognition/evolution/ValueEvolutionEngine.ts').ValueEvolutionState;
  identityTrajectory: import('../cognition/evolution/IdentityTrajectoryEngine.ts').IdentityTrajectorySnapshot;
  narrative: import('../cognition/evolution/AutobiographicalNarrative.ts').AutobiographicalNarrativeState;
  network: import('../cognition/CognitiveNetworkBus.ts').CognitiveNetworkState;
  developmentalAttractors: import('../cognition/evolution/DevelopmentalAttractorField.ts').DevelopmentalAttractorFieldState;
  authoredProjectHistory: string[];
  longitudinalMilestones: Array<{ id:string; title:string; at:number; evidence:string[] }>;
}


export interface AdvancedDevelopmentFacet {
  memoryFabric: import('../memory/MemoryFabric.ts').MemoryFabricSnapshot;
  memoryLifecycleAuthority?: import('../memory/CanonicalMemoryLifecycleAuthority.ts').CanonicalMemoryLifecycleState;
  memoryResidencyDiagnostics?: { counts:{hot:number;warm:number;cold:number}; targetItems:number; materializedVectors:number };
  memoryOS: import('../developmental/MemoryOS2.ts').MemoryOSState2;
  /** Hexis-specific source lineage, distinct from cognition.sources. */
  hexisSourceMonitor?: import('../memory/SourceMonitor.ts').SourceMonitorState;
  worldModel2: import('../developmental/WorldModel2.ts').WorldModel2State;
  unifiedLatentWorldState: import('../world/UnifiedLatentWorldState.ts').UnifiedLatentWorldStateSnapshot;
  groundedWorld: import('../world/GroundedWorldState.ts').GroundedWorldStateSnapshot;
  regret: import('../developmental/RegretEngine.ts').RegretState;
  semanticScars: import('../developmental/SemanticScarEngine.ts').SemanticScarState;
  valueProvenance: import('../developmental/ValueProvenance.ts').ValueProvenanceState;
  commitmentRepair: import('../developmental/CommitmentRepair.ts').CommitmentRepairState;
  modelSwitch: import('../developmental/ModelSwitchContinuity.ts').ModelSwitchState;
  microDreams: import('../developmental/MicroDreamEngine.ts').MicroDreamState;
  developmentalForks: import('../developmental/DevelopmentalForks.ts').DevelopmentalForkState;
  relationshipSelf: import('../developmental/RelationshipSelf.ts').RelationshipSelfState;
  multiHypothesisPersonality: import('../developmental/MultiHypothesisPersonality.ts').PersonalityHypothesisState;
  futureSimulator: import('../developmental/FutureSimulator.ts').FutureSimulatorState;
  longTermSocialMind: import('../developmental/LongTermSocialMind.ts').LongTermSocialMindState;
  selfGovernance: import('../cognition/evolution/SelfGovernanceEngine.ts').SelfGovernanceState;
  futureSelf: import('../cognition/evolution/FutureSelfModel.ts').FutureSelfState;
  consequenceAttribution: Array<import('../cognition/evolution/SelfGovernanceEngine.ts').ConsequenceRecord>;
  unifiedMemory: import('../developmental/UnifiedMemorySystem.ts').MemoryDevelopmentState;
  socialDevelopment: import('../developmental/SocialDevelopmentSystem.ts').SocialDevelopmentState;
  socialMind: import('../cognition/SocialMindKernel.ts').SocialMindState;
  longitudinal: import('../learning/LongitudinalOrganismEngine.ts').LongitudinalOrganismState;
  adaptiveDevelopment: import('../learning/AdaptiveDevelopmentEngine.ts').AdaptiveDevelopmentState;
  temporalContinuity: import('../learning/TemporalContinuityEngine.ts').TemporalContinuityState;
  advancedResilience: import('../learning/AdvancedResilienceEngine.ts').AdvancedResilienceState;
  p24: import('../developmental/P24WorldIdentityEngine.ts').P24WorldIdentityState;
  p25: import('../learning/P25ScientificDevelopmentEngine.ts').P25ScientificDevelopmentState;
  p47: import('../developmental/P47TemporalMemoryMind.ts').P47State;
  p48Awareness: import('../cognition/P48FunctionalAwarenessCore.ts').P48State;
  p49TemporalLife: import('../developmental/P49TemporalLifeEngine.ts').P49State;
  p50CausalSelfWorld: import('../world/P50CausalSelfWorldEngine.ts').P50State;
  p51GroundedCausalWorkspace: import('../world/P51GroundedCausalWorkspace.ts').P51State;
  p52CounterfactualDevelopment: import('../world/P52CounterfactualDevelopmentMind.ts').P52DevelopmentalState;
  p53DevelopmentalSelfModification: import('../developmental/P53DevelopmentalSelfModificationLab.ts').P53State;
  p54LongHorizonEvidence: import('../developmental/P54LongHorizonEvidence.ts').P54State;
  p55DevelopmentalForkUniverse: import('../developmental/P55DevelopmentalForkUniverse.ts').P55State;
  p56IntegratedDevelopmentalMind: import('../developmental/P56IntegratedDevelopmentalMind.ts').P56State;
  p57RealityFirstObservatory: import('../system/P57RealityFirstObservatory.ts').P57State;
  p58CognitiveKernel: import('../cognition/P58CognitiveKernel.ts').P58State;
  p59MemoryOperatingSystem: import('../developmental/P59MemoryOperatingSystem.ts').P59State;
  p60IdentityGuardian: import('../system/P60IdentityGuardian.ts').P60State;
  p61IntegratedMind: import('../cognition/P61IntegratedMindKernel.ts').P61State;
  p62MemoryFabric: import('../memory/P62MemoryFabric.ts').P62State;
  p63DevelopmentalOperatingSystem: import('../developmental/P63DevelopmentalOperatingSystem.ts').P63State;
  p64IntegratedOrganismDynamics: import('../cognition/P64IntegratedOrganismDynamics.ts').P64State;
  p65EpistemicLedger: import('../memory/P65EpistemicLedger.ts').P65State;
  p66InteroceptiveHomeostasis: import('../cognition/P66InteroceptiveHomeostasis.ts').P66State;
  predictiveAllostasis: import('../cognition/PredictiveAllostasisSubstrate.ts').PredictiveAllostasisState;
  p67AutonomousGoalGenesis: import('../developmental/P67AutonomousGoalGenesis.ts').P67State;
  p68GoalEcology: import('../developmental/P68GoalEcology.ts').P68State;
  p69ConstitutionalArbiter: import('../cognition/P69ConstitutionalArbiter.ts').P69State;
  p70MemoryLifecycleGovernor: import('../developmental/P70MemoryLifecycleGovernor.ts').P70State;
  p71SelfConsistency: import('../cognition/P71SelfConsistencyModel.ts').P71State;
  p72LifeCycle: import('../system/P72LifeCycleOrchestrator.ts').P72State;
  p73CapabilityLedger: import('../system/P73CapabilityEvolutionLedger.ts').P73State;
  p74IntegratedOrganismKernel: import('../cognition/P74IntegratedOrganismKernel.ts').P74State;
  p75MemoryContinuumOS: import('../developmental/P75MemoryContinuumOS.ts').P75State;
  p76IdentityLifeOS: import('../system/P76IdentityLifeOS.ts').P76State;
  p77RealityExperimentOS: import('../system/P77RealityExperimentOS.ts').P77State;
  p78AutobiographicalSelfContinuity: import('../developmental/P78AutobiographicalSelfContinuity.ts').P78State;
  p79EmbodiedSituationModel: import('../world/P79EmbodiedSituationModel.ts').P79State;
  p80UnifiedSelfState: import('../cognition/P80UnifiedSelfState.ts').P80State;
  p81PredictiveAttention: import('../cognition/P81PredictiveAttention.ts').P81State;
  p82RealityProgress: import('../system/P82RealityProgressController.ts').P82State;
  p83PersistentRealityModel: import('../world/P83PersistentRealityModel.ts').PersistentRealityModelState;
  hippocampal?: import('../memory/HippocampalMemorySubstrate.ts').HippocampalMemoryState;
  hippocampalFormation?: import('../memory/HippocampalFormationCircuit.ts').HippocampalFormationState;
  consolidationController?: import('../memory/MemoryConsolidationController.ts').MemoryConsolidationState;
  consolidationFeedback?: { action:string; predictionError01:number; learningDelta01:number; retention01:number; reinforcementGate01:number };
  worldModelEnsemble?: import('../system/WorldModelEnsembleController.ts').WorldEnsembleState;
  p84AutobiographicalContinuity: import('../developmental/P84AutobiographicalContinuityFabric.ts').P84State;
  experienceContinuum: import('../memory/ExperienceContinuumFabric.ts').ExperienceContinuumState;
  causalExperience: import('../learning/CausalExperienceStream.ts').CausalExperienceState;
  unifiedLearning: import('../learning/UnifiedLearningSubstrate.ts').UnifiedLearningState;
  cognitiveDependencies: import('./CognitiveDependencyGraph.ts').CognitiveDependencyState;
  cognitiveResearchBattery: import('../learning/CognitiveResearchBattery.ts').CognitiveResearchBatteryState;
  causalDevelopmentLoop: import('../learning/CausalDevelopmentLoop.ts').CausalDevelopmentLoopState;
  b380TemporalLife: import('../system/B380TemporalLifeIntegrator.ts').B380State;
}

export interface EvolutionResearchState {
  version: 1;
  stage: 'emergence' | 'stabilization' | 'authorship' | 'interaction' | 'longitudinal';
  intrinsicProjectCycles: number;
  selfAuthoredActions: number;
  valueRevisionCycles: number;
  identitySamples: number;
  developmentalOutcomeSamples?: number;
  developmentalPathDependence01?: number;
  developmentalDirection?: string;
  replaySignature: string;
  lastReplayAt: number;
}

export interface OrganismCycleResult {
  subjectIntegration?: import('../cognition/SubjectContinuityFabric.ts').SubjectContinuityFrame;
  multimodal?: import('../body/MultimodalPerception.ts').MultimodalState;
  cognitiveProposal?: CognitiveProposal | null;
  state: OrganismState;
  goals: OrganismGoal[];
  memories: ConsolidatedMemory[];
  workspace: WorkspaceFrame;
  decision: OrganismDecisionTrace;
  advanced?: AdvancedDevelopmentFacet;
}
