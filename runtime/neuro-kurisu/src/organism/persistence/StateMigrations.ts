import type { OrganismGoal, OrganismState, OrganismDecisionTrace, ConsolidatedMemory, MemoryFacet, EmbodimentFacet, LearningFacet, ConsciousnessFacet, EvolutionFacet } from '../core/types.ts';
import { defaultB349State } from '../system/B349NeuralDevelopmentalSpine.ts';
import { defaultB2525State } from '../cognition/B2525LearnedLatentTransitionField.ts';
import type { WorldModelSnapshot } from '../world/WorldModel.ts';
import { defaultSelfModel } from '../cognition/SelfModelV2.ts';
import { attend, defaultAttentionAllocatorState } from '../cognition/AttentionSchema.ts';
import { DEFAULT_ADAPTIVE_VALUES } from '../cognition/ValuePlasticity.ts';
import { defaultBodyState } from '../body/EmbodiedBody.ts';
import { defaultPerceptionRoutingState } from '../body/PerceptionRouter.ts';
import { defaultSelfAuthorship } from '../cognition/SelfAuthorship.ts';
import { defaultSensorimotorState } from '../cognition/SensorimotorLoop.ts';
import { defaultIntrinsicDriveState } from '../cognition/IntrinsicMotivationEngine.ts';
import { defaultActiveInferenceState } from '../world/ActiveInferenceEngine.ts';
import { defaultIdentityContinuity } from '../cognition/IdentityContinuity.ts';
import { defaultMetaCognitiveState } from '../cognition/MetaCognitiveMonitor.ts';
import { defaultWorkspaceIgnition } from '../cognition/WorkspaceIgnitionMetrics.ts';
import { defaultConsciousnessEvidence } from '../cognition/ConsciousnessEvidenceLedger.ts';
import { defaultSelfProjectState } from '../cognition/evolution/SelfProjectEngine.ts';
import { defaultAgencyDeliberation } from '../cognition/evolution/AgencyDeliberationEngine.ts';
import { defaultValueEvolution } from '../cognition/evolution/ValueEvolutionEngine.ts';
import { defaultIdentityTrajectory } from '../cognition/evolution/IdentityTrajectoryEngine.ts';
import { defaultNarrative } from '../cognition/evolution/AutobiographicalNarrative.ts';
import { OperationalLifeEngine, defaultOperationalLife } from '../learning/OperationalLifeEngine.ts';
import { RELEASE_CONTRACT } from '../system/ReleaseContract.ts';
import { SemanticMemoryGraph } from '../memory/SemanticMemoryGraph.ts';
import { defaultCognitiveField } from '../cognition/CognitiveField.ts';
import { defaultContradictionReservoir } from '../cognition/ContradictionReservoir.ts';
import { defaultCognitiveBudget } from '../cognition/CognitiveBudgetManager.ts';
import { defaultCognitiveImmune } from '../cognition/CognitiveImmuneSystem.ts';
import { defaultSourceMonitor } from '../memory/SourceMonitor.ts';
import { defaultSkillLibrary } from '../learning/ProceduralSkillLibrary.ts';
import { defaultScientificMethod } from '../learning/ScientificMethodEngine.ts';
import { defaultLearnedResidual } from '../world/LearnedResidualWorldModel.ts';
import { defaultContextualWorld } from '../world/ContextualWorldModel.ts';
import { defaultPerceptionState } from '../cognition/PerceptionEngine.ts';
import { defaultMultimodalState } from '../body/MultimodalPerception.ts';
import { defaultPerceptualEvidence } from '../body/PerceptualEvidenceCompiler.ts';
import { defaultCameraEvidenceState } from '../body/CameraEvidenceProcessor.ts';
import { defaultAdaptiveDevelopment } from '../learning/AdaptiveDevelopmentEngine.ts';
import { defaultTemporalContinuity } from '../learning/TemporalContinuityEngine.ts';
import { defaultP35SemanticWorldBody } from '../body/P35SemanticWorldBody.ts';
import { defaultP37EmbodiedSensorium } from '../body/P37EmbodiedSensorium.ts';
import { defaultP36SelfDevelopment } from '../learning/P36AutonomousSelfDevelopment.ts';

import { defaultMemoryOS2 } from '../developmental/MemoryOS2.ts';
import { defaultWorldModel2 } from '../developmental/WorldModel2.ts';
import { defaultRegretState } from '../developmental/RegretEngine.ts';
import { defaultSemanticScarState } from '../developmental/SemanticScarEngine.ts';
import { defaultValueProvenance } from '../developmental/ValueProvenance.ts';
import { defaultCommitmentRepair } from '../developmental/CommitmentRepair.ts';
import { defaultModelSwitchContinuity } from '../developmental/ModelSwitchContinuity.ts';
import { defaultMicroDream } from '../developmental/MicroDreamEngine.ts';
import { defaultDevelopmentalForks } from '../developmental/DevelopmentalForks.ts';
import { defaultRelationshipSelf } from '../developmental/RelationshipSelf.ts';
import { defaultMultiHypothesisPersonality } from '../developmental/MultiHypothesisPersonality.ts';
import { defaultB272State } from '../cognition/B272EndogenousGoalGenesis.ts';
import { defaultB273State } from '../cognition/B273AutonomousGoalLifecycle.ts';
import { defaultB277State } from '../cognition/B277NeuralOperatorGenesis.ts';
import { defaultB278State } from '../cognition/B278NeuralPrimitiveGenesis.ts';
import { defaultB279State } from '../cognition/B279NeuralAttractorAssemblies.ts';
import { defaultB280State } from '../cognition/B280MultiAreaNeuralCircuit.ts';
import { defaultB281State } from '../cognition/B281PredictiveInterAreaMessaging.ts';
import { defaultB282State } from '../cognition/B282PredictiveGlobalWorkspace.ts';
import { defaultB283State } from '../cognition/B283CompetingPredictiveHypotheses.ts';
import { defaultB284State } from '../cognition/B284NeuralAutobiographicalIdentityCore.ts';
import { defaultB285State } from '../cognition/B285NeuralLifeConsolidationCore.ts';
import { defaultB286State } from '../cognition/B286SelfConflictContinuityCore.ts';
import { defaultB287State } from '../cognition/B287RelationshipValueDevelopmentCore.ts';
import { defaultB288State } from '../cognition/B288SocialPredictiveSelfOtherBrain.ts';
import { defaultFutureSimulator } from '../developmental/FutureSimulator.ts';
import { defaultLongTermSocialMind } from '../developmental/LongTermSocialMind.ts';
import { defaultSelfGovernance } from '../cognition/evolution/SelfGovernanceEngine.ts';
import { defaultFutureSelf } from '../cognition/evolution/FutureSelfModel.ts';
import { defaultUnifiedMemory } from '../developmental/UnifiedMemorySystem.ts';
import { defaultSocialDevelopment } from '../developmental/SocialDevelopmentSystem.ts';
import { defaultAdaptivePolicy } from '../learning/AdaptivePolicyEngine.ts';
import { defaultLongitudinalOrganism } from '../learning/LongitudinalOrganismEngine.ts';
import { defaultAdvancedResilience } from '../learning/AdvancedResilienceEngine.ts';
import { defaultP23Learning } from '../learning/P23LearningEngine.ts';
import { defaultP24WorldIdentity } from '../developmental/P24WorldIdentityEngine.ts';
import { defaultP25ScientificDevelopment } from '../learning/P25ScientificDevelopmentEngine.ts';
import { defaultP26TrueLearning } from '../learning/P26TrueLearningEngine.ts';
import { defaultP27NeuralWorld } from '../cognition/P27NeuralWorldFoundation.ts';
import { defaultP28Plasticity } from '../learning/P28PlasticitySubstrate.ts';
import { defaultP29Governance } from '../learning/P29LearningGovernance.ts';
import { defaultP30Continual } from '../learning/P30ContinualIntelligence.ts';
import { defaultCausalExperienceStream } from '../learning/CausalExperienceStream.ts';
import { defaultUnifiedLearning } from '../learning/UnifiedLearningSubstrate.ts';
import { defaultCognitiveResearchBattery } from '../learning/CognitiveResearchBattery.ts';
import { defaultCausalDevelopmentLoop } from '../learning/CausalDevelopmentLoop.ts';
import { defaultDevelopmentalSynthesis } from '../learning/DevelopmentalSynthesisEngine.ts';
import { defaultDevelopmentalExecutive } from '../learning/DevelopmentalExecutiveEngine.ts';
import { defaultMetaDevelopmental } from '../learning/MetaDevelopmentalStrategyEngine.ts';
import { defaultPersonalCurriculum } from '../learning/PersonalCurriculumEngine.ts';
import { defaultPersonalWorldline } from '../learning/PersonalWorldlineEngine.ts';
import { defaultIntegratedLifeTrajectory } from '../learning/IntegratedLifeTrajectoryEngine.ts';
import { defaultCognitiveOrganismContinuity } from '../learning/CognitiveOrganismContinuityEngine.ts';
import { defaultAutonomousCognitiveLife } from '../learning/AutonomousCognitiveLifeEngine.ts';
import { defaultVerifiedAutonomousLife } from '../learning/VerifiedAutonomousLifeEngine.ts';
import { defaultResearchGradeOrganism } from '../learning/ResearchGradeOrganismEngine.ts';
import { defaultDevelopmentalPortfolio } from '../learning/DevelopmentalPortfolioEngine.ts';
import { defaultLifeCourseNavigator } from '../learning/LifeCourseNavigator.ts';
import { defaultCognitiveDependencyState } from '../core/CognitiveDependencyGraph.ts';
import { defaultP31Consciousness } from '../cognition/P31FunctionalConsciousness.ts';
import { defaultP32CausalSelfModel } from '../cognition/P32CausalSelfModel.ts';
import { defaultP33Personhood } from '../cognition/P33PersonhoodCore.ts';
import { defaultP34CausalPersonhood } from '../cognition/P34CausalPersonhood.ts';
import { defaultP38Research } from '../learning/P38AutonomousCausalResearch.ts';
import { defaultP39ContinuousLife } from '../learning/P39ContinuousArtificialLife.ts';
import { defaultP40ModelEcology } from '../learning/P40ModelEcology.ts';
import { defaultP40SemanticIntelligence } from '../cognition/P40SemanticIntelligence.ts';
import { defaultP41SemanticPerception } from '../cognition/P41SemanticPerception.ts';
import { defaultP41NativePerception } from '../cognition/P41NativePerception.ts';
import { defaultP41TemporalPerception } from '../cognition/P41TemporalPerceptionModel.ts';
import { defaultP42 } from '../cognition/P42UnifiedEmbodiedExperience.ts';
import { defaultP43 } from '../cognition/P43EmbodiedImageryWorkspace.ts';
import { defaultP44 } from '../world/P44EmbodiedPredictiveSelfWorld.ts';
import { defaultP49 } from '../developmental/P49TemporalLifeEngine.ts';
import { defaultP50 } from '../world/P50CausalSelfWorldEngine.ts';
import { defaultP51 } from '../world/P51GroundedCausalWorkspace.ts';
import { defaultGroundedWorldState } from '../world/GroundedWorldState.ts';
import { defaultP52 } from '../world/P52CounterfactualDevelopmentMind.ts';
import { defaultP58 } from '../cognition/P58CognitiveKernel.ts';
import { defaultP59 } from '../developmental/P59MemoryOperatingSystem.ts';
import { defaultP60 } from '../system/P60IdentityGuardian.ts';
import { defaultP61 } from '../cognition/P61IntegratedMindKernel.ts';
import { defaultP62 } from '../memory/P62MemoryFabric.ts';
import { defaultP63 } from '../developmental/P63DevelopmentalOperatingSystem.ts';
import { defaultP64 } from '../cognition/P64IntegratedOrganismDynamics.ts';
import { defaultP65 } from '../memory/P65EpistemicLedger.ts';
import { defaultP66 } from '../cognition/P66InteroceptiveHomeostasis.ts';
import { defaultP67 } from '../developmental/P67AutonomousGoalGenesis.ts';
import { defaultP68 } from '../developmental/P68GoalEcology.ts';
import { defaultP69 } from '../cognition/P69ConstitutionalArbiter.ts';
import { defaultP70 } from '../developmental/P70MemoryLifecycleGovernor.ts';
import { defaultP71 } from '../cognition/P71SelfConsistencyModel.ts';
import { defaultP72 } from '../system/P72LifeCycleOrchestrator.ts';
import { defaultP73 } from '../system/P73CapabilityEvolutionLedger.ts';
import { defaultP74 } from '../cognition/P74IntegratedOrganismKernel.ts';
import { defaultP75 } from '../developmental/P75MemoryContinuumOS.ts';
import { defaultP76 } from '../system/P76IdentityLifeOS.ts';
import { defaultP77 } from '../system/P77RealityExperimentOS.ts';
import { defaultP78 } from '../developmental/P78AutobiographicalSelfContinuity.ts';
import { defaultP84 } from '../developmental/P84AutobiographicalContinuityFabric.ts';
import { defaultExperienceContinuum } from '../memory/ExperienceContinuumFabric.ts';
import { defaultP79 } from '../world/P79EmbodiedSituationModel.ts';
import { defaultP80 } from '../cognition/P80UnifiedSelfState.ts';
import { defaultP81 } from '../cognition/P81PredictiveAttention.ts';
import { defaultP82 } from '../system/P82RealityProgressController.ts';
import { ensureSubjectIdentity } from './PortableSubjectContract.ts';
import { defaultDevelopmentalAttractorField } from '../cognition/evolution/DevelopmentalAttractorField.ts';
import { defaultMemoryCausalEconomy } from '../system/MemoryCausalEconomy.ts';
import { defaultB380State } from '../system/B380TemporalLifeIntegrator.ts';

export const ORGANISM_STATE_SCHEMA = RELEASE_CONTRACT.stateSchema;
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

type Raw = {
  schemaVersion?: number;
  state?: any;
  goals?: OrganismGoal[];
  traces?: OrganismDecisionTrace[];
  memories?: ConsolidatedMemory[];
  worldModel?: WorldModelSnapshot;
  worldTransitions?: any[];
  p1?: any; p2?: any; p3?: any; p4?: any; p5?: any; p6?: any; p7?: any; p8?: any; p9?: any; p10?: any; p11?: any; p12?: any; p13?: any; p14?: any; p15?: any; p16?: any; p17?: any; p18?: any; p19?: any; p20?: any; p21?: any; p22?: any; p23?: any; p24?: any; p25?: any; p26?: any; p27?: any; p28?: any; p29?: any; p30?: any; p31?: any; p32?: any; p33?: any; p34?: any; p35?: any; p36?: any; p37?: any; p38?: any; p39?: any; p41?: any; p42?: any; p43?: any; p44?: any;
  facets?: Partial<{ memory: any; embodiment: any; learning: any; consciousness: any; evolution: any; cognition: any }>;
  system?: any;
};

export interface PersistedShapeCurrent {
  schemaVersion: typeof RELEASE_CONTRACT.stateSchema;
  state: OrganismState;
  goals: OrganismGoal[];
  traces: OrganismDecisionTrace[];
  memories: ConsolidatedMemory[];
  worldModel: WorldModelSnapshot;
  facets: {
    memory: MemoryFacet;
    embodiment: EmbodimentFacet;
    learning: LearningFacet;
    consciousness: ConsciousnessFacet;
    evolution: EvolutionFacet;
    cognition: import('../core/types.ts').DevelopmentalCognitionFacet;
    advanced: import('../core/types.ts').AdvancedDevelopmentFacet;
  };
  system: {
    release: string;
    organismCore: string;
    schemaVersion: number;
    capabilities: any;
    integrity: any;
    lastStateHash: string;
    replaySignature: string;
    lastReplayAt: number;
    actionExecutionLedger?: import('../system/ActionGateway.ts').ActionExecutionLedgerSnapshot;
    subjectIdentity: import('../core/types.ts').SubjectIdentityRecord;
    externalObserver?: import('../system/ExternalObserverFabric.ts').ExternalObserverState;
    evolution: any;
    advancedProjectionSchedule?: any;
    advancedProjectionScheduleMetrics?: any;
    temporalResolution?: import('../core/TemporalResolutionGovernor.ts').TemporalResolutionState;
    recoveryWatchdog?: import('./RecoveryWatchdog.ts').RecoveryWatchdogState;
    revisionGraph?: any;
    revisionTokens?: any;
    runtimeEvidence?: any;
    externalEvidenceTrust?: any;
    selfPredictionBenchmark?: any;
    modelOlympics?: any;
    predictionLedger?: any;
    predictionDebt?: any;
    cognitiveQuorum?: any;
    shadowOrganism?: any;
    identityCausality?: any;
    longHorizonPrediction?: any;
    autonomousProjectExecutor?: any;
    cognitiveSpineSchedule?: any;
    skillAcquisitionBenchmark?: any;
    evidenceFirewall?: any;
    projectResearchSession?: any;
    outcomeVerification?: any;
    causalAccountability?: any;
    resourceAllocation?: import('../system/OrganismResourceAllocator.ts').ResourceAllocationState;
    unifiedCognitiveSubstrate?: import('../core/UnifiedCognitiveSubstrate.ts').UnifiedCognitiveSubstrateState;
    canonicalNeuralSubstrate?: import('../cognition/CanonicalNeuralSubstrate.ts').CanonicalNeuralSubstrateState;
    neuralSubstrateBackend?: { canonical?: import('../cognition/CanonicalNeuralSubstrate.ts').CanonicalNeuralSubstrateState; mlstmShadow?: import('../cognition/MLSTMNeuralSubstrate.ts').MLSTMNeuralSubstrateState; mode?: string };
    recurrentCausalMemory?: import('../cognition/RecurrentCausalMemory.ts').RecurrentCausalMemoryState;
    unifiedWorldModelB261?: import('../cognition/B261UnifiedWorldModel.ts').B261UnifiedWorldModelState;
    multiTimescaleWorldModelB262?: import('../cognition/B262MultiTimescaleWorldModel.ts').B262State;
    realActionCausalityB263?: import('../cognition/B263RealActionCausality.ts').B263State;
    causalPolicyLearningB264?: import('../cognition/B264CausalPolicyLearning.ts').B264State;
    independentPolicyEvaluatorB265?: import('../cognition/B265IndependentPolicyEvaluator.ts').B265IndependentPolicyEvaluatorState;
    hiddenTaskGeneralizationB266?: import('../cognition/B266HiddenTaskGeneralization.ts').B266HiddenTaskGeneralizationState;
    adaptiveRegimeControllerB267?: import('../cognition/B267AdaptiveRegimeController.ts').B267State;
    causalSelfExperimentLabB268?: import('../cognition/B268CausalSelfExperimentLab.ts').B268State;
    spikingPlasticNeuralB269?: import('../cognition/B269SpikingPlasticNeuralSubstrate.ts').B269SpikingPlasticState;
    unifiedNeuroCausalCoreB365?: import('../cognition/B365UnifiedNeuroCausalCore.ts').B365State;
    neuralExperienceBranch?: import('../cognition/NeuralExperienceBranch.ts').NeuralExperienceBranchState;
    neuralMemoryContinuityP2843?: import('../system/NeuralMemoryContinuityCore.ts').NeuralMemoryContinuityState;
    neuralPlasticityBenchmarkP2844?: any;
    b385B390AutonomousDevelopmentalOrganism?: import('../system/B385B390AutonomousDevelopmentalOrganismCore.ts').B385State;
    b391B400NeuralDevelopmentalIntegration?: import('../system/B391B400NeuralDevelopmentalIntegrationCore.ts').B391State;
    b401B420AdaptiveCognitiveResearch?: import('../system/B401B420AdaptiveCognitiveResearchCore.ts').B401State;
    b421B450ResearchAcceleration?: import('../system/B421B450ResearchAccelerationCore.ts').B421State;
    b451B500MetaCognitiveDevelopment?: import('../system/B451B500MetaCognitiveDevelopmentCore.ts').B451State;
    b501B560HierarchicalMetaMemory?: import('../system/B501B560HierarchicalMetaMemoryCore.ts').B501State;
    b561B620MetaCognitiveEvolution?: import('../system/B561B620MetaCognitiveEvolutionCore.ts').B561State;
    b621B720UnifiedAdaptiveMind?: import('../system/B621B720UnifiedAdaptiveMindCore.ts').B621State;
    b721B900DevelopmentalLearning?: import('../system/B721B900DevelopmentalLearningFabric.ts').B721State;
    b901B1100CausalDevelopmentalMetaLearner?: import('../system/B901B1100CausalDevelopmentalMetaLearner.ts').B901State;
    b1101B1350SelfDevelopment?: import('../system/B1101B1350SelfDevelopmentCore.ts').B1101State;
    b1351B1600LifelongDevelopment?: import('../system/B1351B1600LifelongDevelopmentCore.ts').B1351State;
    persistentContinuityKernel?: import('../system/PersistentContinuityKernel.ts').PersistentContinuityKernelState;
    b1701B2200UnifiedLifeContinuity?: import('../system/B1701B2200UnifiedLifeContinuityCore.ts').B1701B2200State;
    b2201B2500LifeCourseSelfModel?: import('../system/B2201B2500LifeCourseSelfModelCore.ts').B2201B2500State;
    b2525LearnedLatentTransitionField?: import('../cognition/B2525LearnedLatentTransitionField.ts').B2525State;
    neuralGerminalOrganismB270?: import('../cognition/B270NeuralGerminalOrganism.ts').B270State;
    neuralAutobiographicalCoreB271?: import('../cognition/B271NeuralAutobiographicalCore.ts').B271State;
  endogenousGoalGenesisB272?: import('../cognition/B272EndogenousGoalGenesis.ts').B272State;
  autonomousGoalLifecycleB273?: import('../cognition/B273AutonomousGoalLifecycle.ts').B273State;
  autonomousSkillLaboratoryB274?: import('../cognition/B274AutonomousSkillLaboratory.ts').B274State;
  neuralCompositionalPolicyB275?: import('../cognition/B275NeuralCompositionalPolicy.ts').B275State;
  latentActionProgramSynthesizerB276?: import('../cognition/B276LatentActionProgramSynthesizer.ts').B276State;
  neuralOperatorGenesisB277?: import('../cognition/B277NeuralOperatorGenesis.ts').B277State;
  neuralPrimitiveGenesisB278?: import('../cognition/B278NeuralPrimitiveGenesis.ts').B278State;
  neuralAttractorAssembliesB279?: import('../cognition/B279NeuralAttractorAssemblies.ts').B279State;
  multiAreaNeuralCircuitB280?: import('../cognition/B280MultiAreaNeuralCircuit.ts').B280State;
  predictiveInterAreaMessagingB281?: import('../cognition/B281PredictiveInterAreaMessaging.ts').B281State;
  predictiveGlobalWorkspaceB282?: import('../cognition/B282PredictiveGlobalWorkspace.ts').B282WorkspaceState;
  competingPredictiveHypothesesB283?: import('../cognition/B283CompetingPredictiveHypotheses.ts').B283State;
  neuralAutobiographicalIdentityB284?: import('../cognition/B284NeuralAutobiographicalIdentityCore.ts').B284State;
  neuralLifeConsolidationB285?: import('../cognition/B285NeuralLifeConsolidationCore.ts').B285State;
  selfConflictContinuityB286?: import('../cognition/B286SelfConflictContinuityCore.ts').B286State;
  relationshipValueDevelopmentB287?: import('../cognition/B287RelationshipValueDevelopmentCore.ts').B287State;
  socialPredictiveSelfOtherB288?: import('../cognition/B288SocialPredictiveSelfOtherBrain.ts').B288State;
    neuralOrganismIntegrationB289?: import('../system/B289NeuralOrganismIntegrationSpine.ts').B289State;
    realityGatedNeurodevelopmentB290?: import('../system/B290RealityGatedNeurodevelopment.ts').B290State;
    unifiedSelfAgencyPersonalityB291?: import('../system/B291UnifiedSelfAgencyGate.ts').B291State;
    cognitiveStateBusB292?: import('../system/B292CognitiveStateBus.ts').B292CognitiveStateBusState;
    intentTraceB292?: import('../system/B292IntentTrace.ts').B292IntentTraceState;
    selfWorldPredictiveMicrocircuitB293?: import('../system/B293SelfWorldPredictiveMicrocircuit.ts').B293State;
    causalNeuralEventSpineB294?: import('../system/B294CausalNeuralEventSpine.ts').B294State;
    adaptiveCognitiveBudgetB295?: import('../system/B295AdaptiveCognitiveBudget.ts').B295AdaptiveCognitiveBudgetState;
    adaptiveMemoryStrategyReadout?: import('../learning/AdaptiveMemoryStrategyReadout.ts').AdaptiveMemoryStrategyState;
    neuralPersonalityAgencyNucleusB296?: import('../system/B296NeuralPersonalityAgencyNucleus.ts').B296State;
    executiveNeuralFusionB297?: import('../system/B297ExecutiveNeuralFusion.ts').B297State;
    actionOwnershipGraphB298?: import('../system/ActionOwnershipGraph.ts').ActionOwnershipState;
    causalPersonalityDevelopmentB299?: import('../system/B299CausalPersonalityDevelopmentLoop.ts').B299State;
    mobileStateEconomyB301?: import('../system/B301MobileStateEconomy.ts').B301EconomyState;
    longHorizonDevelopmentB302?: import('../system/B302LongHorizonDevelopmentLedger.ts').B302LongHorizonState;
    holdoutGeneralizationB303?: import('../system/B303HoldoutGeneralizationLedger.ts').B303HoldoutState;
    semanticHoldoutB304?: import('../system/B304SemanticHoldoutLedger.ts').B304SemanticHoldoutState;
    criticalPathVerificationB305?: import('../system/B305CriticalPathVerificationLedger.ts').B305CriticalPathState;
    b312ExecutiveDecisionHandoff?: import('../system/B312ExecutiveDecisionHandoff.ts').B312DecisionHandoffState;
  b313LongitudinalBehavioralDivergence?: import('../system/B313LongitudinalBehavioralDivergence.ts').B313State;
  b349NeuralDevelopmentalSpine?: import('../system/B349NeuralDevelopmentalSpine.ts').B349State;
    b306AutonomousInitiativeVerification?: import('../system/B306AutonomousInitiativeVerificationLedger.ts').B306AutonomousInitiativeState;
    b333AutonomousGoalGenesis?: import('../system/B333AutonomousGoalGenesisGate.ts').B333State;
    b334AutonomousProjectLifecycle?: import('../system/B334AutonomousProjectLifecycleGate.ts').B334State;
    b335AutonomousProjectHoldout?: import('../system/B335AutonomousProjectHoldoutGate.ts').B335State;
    cognitiveEventFabric?: import('../system/CognitiveEventFabric.ts').CognitiveEventFabricSnapshot;
    cognitiveResourceEconomy?: import('../system/CognitiveResourceEconomy.ts').CognitiveResourceEconomyState;
    runtimePerformance?: import('../system/RuntimePerformanceGovernor.ts').RuntimePerformanceGovernorState;
    interoceptiveState?: any;
    autonomousPersonhood?: any;
    longHorizonAutonomy?: any;
    autonomousResourceToolLife?: any;
    autonomousRuntimeLife?: any;
    selfDirectedLife?: any;
    autonomousLearningMemory?: any;
    autonomousRelationships?: any;
    identityContinuityGuard?: any;
    autonomousValueFormation?: any;
    openEndedSkillAcquisition?: any;
    autobiographicalLifeNarrative?: any;
    autonomousSocialInitiative?: any;
    liveSelfImprovementSupervisor?: any;
    neuroDigitalFusion?: any;
    plasticityHomeostasis?: any;
    causalSelfExperimentLab?: any;
    dreamCounterfactualLab?: any;
    capabilitySelfModel?: any;
    neuroSymbolicCompiler?: any;
    neuralMorphogenesis?: any;
    hybridNeuroCognitiveLoop?: any;
    neuroDigitalEvolution?: ReturnType<import('../system/NeuroDigitalEvolutionEngine.ts').NeuroDigitalEvolutionEngine['snapshot']>;
    realityEvidenceLedger?: import('../system/RealityEvidenceLedger.ts').RealityEvidenceLedgerState;
    unifiedCognitiveCycle?: import('../system/UnifiedCognitiveCycle.ts').UnifiedCognitiveCycleState;
    continuousCognitiveFabric?: import('../system/ContinuousCognitiveFabric.ts').ContinuousCognitiveSnapshot;
    runtimeClosure?: import('../system/RuntimeClosureLedger.ts').RuntimeClosureSnapshot;
    memoryRetentionEconomy?: import('../system/MemoryRetentionEconomy.ts').MemoryRetentionEconomyState;
    behavioralInfluenceLedger?: import('../system/BehavioralInfluenceLedger.ts').BehavioralInfluenceLedgerState;
    emotionAppraisal?: import('../system/EmotionAppraisalEngine.ts').EmotionAppraisalState;
    worldModelEnsemble?: import('../system/WorldModelEnsembleController.ts').WorldEnsembleState;
    memoryCausalEconomy?: import('../system/MemoryCausalEconomy.ts').MemoryCausalEconomyState;
    causalLifeGraph?: import('../system/CausalLifeGraph.ts').CausalLifeGraphState;
    activePerceptionExecutor?: import('../system/ActivePerceptionExecutor.ts').ActivePerceptionState;
    worldCausalCalibration?: import('../system/WorldCausalCalibration.ts').WorldCausalCalibrationState;
    selfModelValidation?: import('../system/SelfModelValidationEngine.ts').SelfModelValidationState;
    failureRecoveryCertification?: import('../system/FailureRecoveryCertification.ts').RecoveryCertificationState;
    cognitiveDomainClosure?: import('../system/CognitiveDomainClosure.ts').CognitiveDomainClosureSnapshot;
    causalDomainClosureLedger?: import('../system/CausalDomainClosureLedger.ts').CausalDomainClosureSnapshot;
    memoryWorldCausalBridge?: import('../system/MemoryWorldCausalBridge.ts').MemoryWorldCausalBridgeState;
    worldAgencyLearningCausalBridge?: import('../system/WorldAgencyLearningCausalBridge.ts').WorldAgencyLearningState;
    basalGangliaSelection?: ReturnType<import('../system/BasalGangliaSelectionCircuit.ts').BasalGangliaSelectionCircuit['snapshot']>;
  cerebellarPredictiveControl?: ReturnType<import('../system/CerebellarPredictiveController.ts').CerebellarPredictiveController['snapshot']>;
  adaptiveComputeGovernor?: ReturnType<import('../system/AdaptiveComputeGovernor.ts').AdaptiveComputeGovernor['snapshot']>;
  thalamocorticalGate?: ReturnType<import('../system/ThalamocorticalGate.ts').ThalamocorticalGate['snapshot']>;
  corticalHierarchy?: ReturnType<import('../system/CorticalHierarchyEngine.ts').CorticalHierarchyEngine['snapshot']>;
  brainstemArousalSleep?: ReturnType<import('../system/BrainstemArousalSleepScheduler.ts').BrainstemArousalSleepScheduler['snapshot']>;
  motorLearningLoop?: ReturnType<import('../system/CerebellarBasalGangliaMotorLoop.ts').CerebellarBasalGangliaMotorLoop['snapshot']>;
  hexisAdaptation?: import('../integration/hexis/HexisAdaptationFabric.ts').HexisAdaptationState;
  lettaGovernanceAdaptation?: import('../integration/letta/LettaGovernanceAdaptationFabric.ts').LettaGovernanceAdaptationState;
  };
}

const defaultNeeds = () => ({ energy:0.82, cognitiveLoad:0.18, uncertainty:0.35, socialNeed:0.28, novelty:0.42, identityCoherence:0.88, goalPressure:0.18 });
const defaultMemoryFacet = (): MemoryFacet => ({ eventLog:[], autobiographicalMemories:[], selfModel:defaultSelfModel(), attention:attend({target:'none',reason:'migration',salience:0,confidence:0.2,budget:0.82}),attentionAllocator:defaultAttentionAllocatorState(), socialModel:[], adaptiveValues:{...DEFAULT_ADAPTIVE_VALUES}, workspace:{capacity:5,items:[],broadcastId:'',recurrence:0,lastCompetition:0,ignition01:0,sourceDiversity01:0,coalitionStability01:0}, semanticGraph:{nodes:[],edges:[],updates:0}, experiments:[], counterfactuals:[], lastRetrievedMemoryIds:[] });

const defaultEmbodimentFacet = (): EmbodimentFacet => ({ body:defaultBodyState(), bodyEvents:[], sleepSessions:[], lastSensorAt:0, sensorFailures:0, perceptionRouting:defaultPerceptionRoutingState(), multimodal:defaultMultimodalState(), toolAudit:[], p35:defaultP35SemanticWorldBody(), p37:defaultP37EmbodiedSensorium(), p40SemanticIntelligence:defaultP40SemanticIntelligence(), p41SemanticPerception:defaultP41SemanticPerception(), p41NativePerception:defaultP41NativePerception(), p41TemporalPerception:defaultP41TemporalPerception(), p42Experience:defaultP42(), p43Imagery:defaultP43(), perceptualEvidence:defaultPerceptualEvidence(), cameraEvidence:defaultCameraEvidenceState() });
const defaultLearningFacet = (): LearningFacet => ({
  selfAuthorship: defaultSelfAuthorship(),
  sensorimotor: defaultSensorimotorState(),
  valueRevisionLog: [],
  longitudinal: { cycles: 0, lastBenchmarkAt: 0, lastScore: 0 },
  neuromodulation: {
    dopamine01: .5, norepinephrine01: .42, acetylcholine01: .55, serotonin01: .58,
    explorationBias01: .5, exploitationBias01: .5, attentionGain01: .65, updateRate01: .35,
  },
  lifelong: {
    version: 1, phase: 'awake', cycleCount: 0, totalSleepMs: 0, replayCycles: 0,
    reconsolidations: 0, dormantMemories: 0, reactivatedMemories: 0, dreamCount: 0,
    microDreamCount: 0, deepDreamCount: 0, skillPromotions: 0, skillDemotions: 0,
    projectResumptions: 0, learningBudgetSpent: 0, learningBudgetLimit: .8, skills: [],
    dreams: [], sessions: [], lastSleepAt: 0, lastWakeAt: 0, lastConsolidationAt: 0,
    lastMaintenanceAt: 0, lastInsight: '', lastInsightConfidence: 0,
  },
  adaptivePolicy: defaultAdaptivePolicy(),
  p23: defaultP23Learning(),
  p26: defaultP26TrueLearning(),
  p28: defaultP28Plasticity(),
  p29: defaultP29Governance(),
  p30: defaultP30Continual(),
  p36: defaultP36SelfDevelopment(),
  p38: defaultP38Research(),
  p39: defaultP39ContinuousLife(),
  p40ModelEcology: defaultP40ModelEcology(),
  p44PredictiveWorld: defaultP44(),
  developmentalSynthesis: defaultDevelopmentalSynthesis(),
  developmentalExecutive: defaultDevelopmentalExecutive(),
  metaDevelopmental: defaultMetaDevelopmental(),
  personalCurriculum: defaultPersonalCurriculum(),
  developmentalPortfolio: defaultDevelopmentalPortfolio(),
  lifeCourseNavigator: defaultLifeCourseNavigator(),
  personalWorldline: defaultPersonalWorldline(),
  integratedLifeTrajectory: defaultIntegratedLifeTrajectory(),
  cognitiveOrganismContinuity: defaultCognitiveOrganismContinuity(),
  operationalLife: defaultOperationalLife(),
});
const defaultConsciousnessFacet = (): ConsciousnessFacet => ({ intrinsic:defaultIntrinsicDriveState(), activeInference:defaultActiveInferenceState(), identityContinuity:defaultIdentityContinuity(), metacognition:defaultMetaCognitiveState(), workspaceIgnition:defaultWorkspaceIgnition(), consciousnessEvidence:defaultConsciousnessEvidence(), p31:defaultP31Consciousness(), p32:defaultP32CausalSelfModel(), p33:defaultP33Personhood(), p34:defaultP34CausalPersonhood(), causalExperiments:[], researchQuestionsCompleted:[] });

const defaultEvolutionFacet = (): EvolutionFacet => ({ selfProjects:defaultSelfProjectState(), agency:defaultAgencyDeliberation(), valueEvolution:defaultValueEvolution(), identityTrajectory:defaultIdentityTrajectory(), narrative:defaultNarrative(), network:{tick:0,capacity:3,lastBroadcast:null,history:[],totalIgnitions:0}, developmentalAttractors:defaultDevelopmentalAttractorField(), authoredProjectHistory:[], longitudinalMilestones:[] });


const defaultAdvancedFacet = () => ({
  groundedWorld: defaultGroundedWorldState(),
  memoryFabric: {version:2,stats:{encodes:0,newItems:0,reconsolidations:0,retrievals:0,retrievalHits:0,maintenanceRuns:0,compatibilityProjections:0},hotIds:[]},
  memoryOS: defaultMemoryOS2(), worldModel2: defaultWorldModel2(), regret: defaultRegretState(), semanticScars: defaultSemanticScarState(),
  valueProvenance: defaultValueProvenance(), commitmentRepair: defaultCommitmentRepair(), modelSwitch: defaultModelSwitchContinuity(),
  advancedResilience: defaultAdvancedResilience(),
  microDreams: defaultMicroDream(), developmentalForks: defaultDevelopmentalForks(), relationshipSelf: defaultRelationshipSelf(), multiHypothesisPersonality: defaultMultiHypothesisPersonality(), futureSimulator: defaultFutureSimulator(), longTermSocialMind: defaultLongTermSocialMind(), selfGovernance: defaultSelfGovernance(), futureSelf: defaultFutureSelf(), consequenceAttribution: [],
  p49TemporalLife: defaultP49(), p50CausalSelfWorld: defaultP50(), p51GroundedCausalWorkspace: defaultP51(), p52CounterfactualDevelopment: defaultP52(), p64IntegratedOrganismDynamics: defaultP64(), p65EpistemicLedger: defaultP65(), p66InteroceptiveHomeostasis: defaultP66(), p67AutonomousGoalGenesis: defaultP67(), p68GoalEcology: defaultP68(), p69ConstitutionalArbiter: defaultP69(), p70MemoryLifecycleGovernor: defaultP70(), p71SelfConsistency: defaultP71(), p72LifeCycle: defaultP72(), p73CapabilityLedger: defaultP73(), p74IntegratedOrganismKernel: defaultP74(), p75MemoryContinuumOS: defaultP75(), p76IdentityLifeOS: defaultP76(), p77RealityExperimentOS: defaultP77(), p78AutobiographicalSelfContinuity: defaultP78(), p79EmbodiedSituationModel: defaultP79(),
  causalExperience: defaultCausalExperienceStream(),
  causalDevelopmentLoop: defaultCausalDevelopmentLoop(),
  cognitiveResearchBattery: defaultCognitiveResearchBattery(),
});

const defaultCognitionFacet = () => ({ perception: defaultPerceptionState(), cognitiveField:defaultCognitiveField(), contradictions:defaultContradictionReservoir(), budget:defaultCognitiveBudget(), immune:defaultCognitiveImmune(), sources:defaultSourceMonitor(), skills:defaultSkillLibrary(), scientific:defaultScientificMethod(), residualWorld:defaultLearnedResidual(), contextualWorld:defaultContextualWorld(), p27:defaultP27NeuralWorld() });


function normalizeState(raw:any): OrganismState {
  return {
    version:RELEASE_CONTRACT.stateSchema,
    tick:Number(raw?.tick??0),
    at:Number(raw?.at??Date.now()),
    needs:{...defaultNeeds(),...(raw?.needs??{})},
    predictionError:Number(raw?.predictionError??0.18),
    attentionBudget:Number(raw?.attentionBudget??0.82),
    lastAction:raw?.lastAction??'none',
    lastActionSuccess:raw?.lastActionSuccess??null,
    autonomyScore:Number(raw?.autonomyScore??0),
    selfPredictionError:Number(raw?.selfPredictionError??0),
    predictedNextAction:raw?.predictedNextAction??'none',
    lastPredictionConfidence:Number(raw?.lastPredictionConfidence??0),
    worldContextVersion:Number(raw?.worldContextVersion??1),
  };
}

function mergeFacet(defaultValue:any, modern:any, legacy:any): any { return { ...defaultValue, ...(legacy??{}), ...(modern??{}) }; }
function normalizeWorldModel2State(raw:any, fallback:any): any {
  const transitions = Object.fromEntries(Object.entries(raw?.transitions ?? {}).map(([action,row]:any)=>[action, {
    samples:Number(row?.samples ?? 0), meanReward:Number(row?.meanReward ?? .5), rewardVariance:Number(row?.rewardVariance ?? .25),
    surpriseMean:Number(row?.surpriseMean ?? .5), confidence:Number(row?.confidence ?? .15), lastAt:Number(row?.lastAt ?? 0),
    meanDelta:{...(row?.meanDelta ?? {})}, deltaVariance:{...(row?.deltaVariance ?? {})},
  }]));
  const transitionHypotheses = Object.fromEntries(Object.entries(raw?.transitionHypotheses ?? {}).map(([key,row]:any)=>[key, {
    key, stateKey:String(row?.stateKey ?? 'unknown'), action:String(row?.action ?? key.split('|').at(-1) ?? 'wait'), samples:Number(row?.samples ?? 0),
    meanDelta:{...(row?.meanDelta ?? {})}, variance:{...(row?.variance ?? {})}, rewardMean:Number(row?.rewardMean ?? .5), rewardVariance:Number(row?.rewardVariance ?? .25),
    confidence01:Number(row?.confidence01 ?? .15), lastUpdatedAt:Number(row?.lastUpdatedAt ?? 0),
  }]));
  return {
    ...fallback,
    ...(raw ?? {}),
    transitions,
    transitionHypotheses,
    causal:Array.isArray(raw?.causal)?raw.causal:[],
    latent: {...fallback.latent, ...(raw?.latent ?? {})},
    latentState:raw?.latentState ?? fallback.latentState,
    predictionErrors:Array.isArray(raw?.predictionErrors)?raw.predictionErrors.slice(-512):[],
    calibration:Array.isArray(raw?.calibration)?raw.calibration:[],
    rollouts:Number(raw?.rollouts ?? 0),
    learnedTransitions:Number(raw?.learnedTransitions ?? Object.values(transitions).reduce((n:any,x:any)=>n+Number(x.samples||0),0)),
    modelVersion:2,
    readyForLearning:Boolean(raw?.readyForLearning ?? false), pendingPredictions:{...(raw?.pendingPredictions ?? {})},
  };
}


function normalizeAdvancedResilienceState(raw:any, fallback:any) {
  return {
    ...fallback,
    ...raw,
    shadow:{...fallback.shadow,...(raw?.shadow??{}),recent:Array.isArray(raw?.shadow?.recent)?raw.shadow.recent.slice(-96):[]},
    geneBank:{...fallback.geneBank,...(raw?.geneBank??{}),genes:Array.isArray(raw?.geneBank?.genes)?raw.geneBank.genes.slice(0,16):[]},
    surpriseFirewall:{...fallback.surpriseFirewall,...(raw?.surpriseFirewall??{}),recent:Array.isArray(raw?.surpriseFirewall?.recent)?raw.surpriseFirewall.recent.slice(0,96):[]},
    evidenceDebt:{...fallback.evidenceDebt,...(raw?.evidenceDebt??{}),records:Array.isArray(raw?.evidenceDebt?.records)?raw.evidenceDebt.records.slice(0,256):[]},
    modelSwap:{...fallback.modelSwap,...(raw?.modelSwap??{}),catalog:Array.isArray(raw?.modelSwap?.catalog)?raw.modelSwap.catalog.slice(0,16):[]},
    offlineSurvival:{...fallback.offlineSurvival,...(raw?.offlineSurvival??{})},
    dreamCompiler:{...fallback.dreamCompiler,...(raw?.dreamCompiler??{}),compiledSkills:Array.isArray(raw?.dreamCompiler?.compiledSkills)?raw.dreamCompiler.compiledSkills.slice(0,64):[]},
    timeCapsules:{...fallback.timeCapsules,...(raw?.timeCapsules??{}),capsules:Array.isArray(raw?.timeCapsules?.capsules)?raw.timeCapsules.capsules.slice(0,52):[]},
    counterfactualForks:{...fallback.counterfactualForks,...(raw?.counterfactualForks??{}),forks:Array.isArray(raw?.counterfactualForks?.forks)?raw.counterfactualForks.forks.slice(0,128):[]},
  };
}

export function migratePersistedOrganism(input: unknown): PersistedShapeCurrent {
  if (!input || typeof input !== 'object') throw new Error('Persisted organism state must be an object');
  const raw = input as Raw;
  const source = Number(raw.schemaVersion ?? raw.state?.version ?? 1);
  if (!Number.isFinite(source) || source < 1 || source > ORGANISM_STATE_SCHEMA) throw new Error(`Unsupported organism state schema: ${source}`);

  const memory = mergeFacet(defaultMemoryFacet(), raw.facets?.memory, raw.p1);
  const embodiment = mergeFacet(defaultEmbodimentFacet(), raw.facets?.embodiment, raw.p2);
  embodiment.perceptionRouting = { ...defaultPerceptionRoutingState(), ...(embodiment.perceptionRouting ?? {}) };
  embodiment.multimodal = { ...defaultMultimodalState(), ...(embodiment.multimodal ?? {}), modalities: { ...defaultMultimodalState().modalities, ...(embodiment.multimodal?.modalities ?? {}) }, recent: Array.isArray(embodiment.multimodal?.recent) ? embodiment.multimodal.recent.slice(0,64) : [] };
  const p35BodyRaw = (raw.facets as any)?.embodiment?.p35 ?? (raw as any).p35?.semanticWorldBody ?? {};
  const p35BodyDefault = defaultP35SemanticWorldBody();
  embodiment.p35 = { ...p35BodyDefault, ...p35BodyRaw, version:1, entities:Array.isArray(p35BodyRaw.entities)?p35BodyRaw.entities.slice(-160):[], relations:Array.isArray(p35BodyRaw.relations)?p35BodyRaw.relations.slice(-320):[], claims:Array.isArray(p35BodyRaw.claims)?p35BodyRaw.claims.slice(-256):[], scene:{...p35BodyDefault.scene,...(p35BodyRaw.scene??{})}, modalityReliability:{...p35BodyDefault.modalityReliability,...(p35BodyRaw.modalityReliability??{})}, spatialSelf:{...p35BodyDefault.spatialSelf,...(p35BodyRaw.spatialSelf??{})}, body:{...p35BodyDefault.body,...(p35BodyRaw.body??{})}, affordances:{...p35BodyDefault.affordances,...(p35BodyRaw.affordances??{})}, metrics:{...p35BodyDefault.metrics,...(p35BodyRaw.metrics??{})} };
  embodiment.toolAudit = Array.isArray(embodiment.toolAudit) ? embodiment.toolAudit.slice(0,512) : [];
  const p37Raw = (raw.facets as any)?.embodiment?.p37 ?? (raw as any).p37?.embodiedSensorium ?? {};
  const p37Default = defaultP37EmbodiedSensorium();
  (embodiment as any).p37 = {
    ...p37Default, ...p37Raw, version:1,
    claims:Array.isArray(p37Raw.claims)?p37Raw.claims.slice(-384):[],
    entities:Array.isArray(p37Raw.entities)?p37Raw.entities.slice(-192):[],
    events:Array.isArray(p37Raw.events)?p37Raw.events.slice(-128):[],
    relationEdges:Array.isArray(p37Raw.relationEdges)?p37Raw.relationEdges.slice(-384):[],
    activePerception:Array.isArray(p37Raw.activePerception)?p37Raw.activePerception.slice(-16):[],
    sensors:{...p37Default.sensors,...(p37Raw.sensors??{})},
    scene:{...p37Default.scene,...(p37Raw.scene??{})},
    spatialSelf:{...p37Default.spatialSelf,...(p37Raw.spatialSelf??{})},
    body:{...p37Default.body,...(p37Raw.body??{})},
    affordance:{...p37Default.affordance,...(p37Raw.affordance??{})}
  };
  const learning = mergeFacet(defaultLearningFacet(), raw.facets?.learning, raw.p3);
  learning.operationalLife = { ...defaultOperationalLife(), ...(learning.operationalLife ?? {}) };
  const continuityDefault = defaultCognitiveOrganismContinuity();
  const continuityRaw = (raw.facets as any)?.learning?.cognitiveOrganismContinuity ?? {};
  learning.cognitiveOrganismContinuity = {
    ...continuityDefault,
    ...continuityRaw,
    version:1,
    domains:{...continuityDefault.domains,...(continuityRaw.domains??{})},
    agency:{...continuityDefault.agency,...(continuityRaw.agency??{})},
    self:{...continuityDefault.self,...(continuityRaw.self??{})},
    relational:{...continuityDefault.relational,...(continuityRaw.relational??{})},
    learning:{...continuityDefault.learning,...(continuityRaw.learning??{})},
    motivation:{...continuityDefault.motivation,...(continuityRaw.motivation??{})},
    embodiment:{...continuityDefault.embodiment,...(continuityRaw.embodiment??{})},
    research:{...continuityDefault.research,...(continuityRaw.research??{})},
    futurePaths:Array.isArray(continuityRaw.futurePaths)?continuityRaw.futurePaths.slice(-12):[],
    projections:Array.isArray(continuityRaw.projections)?continuityRaw.projections.slice(-64):[],
    outcomes:Array.isArray(continuityRaw.outcomes)?continuityRaw.outcomes.slice(-128):[],
  };
  const autonomousLifeRaw = (raw.facets as any)?.learning?.autonomousCognitiveLife ?? {};
  const autonomousLifeDefault = defaultAutonomousCognitiveLife();
  learning.autonomousCognitiveLife = {
    ...autonomousLifeDefault, ...autonomousLifeRaw, version:1,
    activeIntentions:Array.isArray(autonomousLifeRaw.activeIntentions)?autonomousLifeRaw.activeIntentions.slice(-32):[],
    commitments:Array.isArray(autonomousLifeRaw.commitments)?autonomousLifeRaw.commitments.slice(-32):[],
    plans:Array.isArray(autonomousLifeRaw.plans)?autonomousLifeRaw.plans.slice(-64):[],
    predictions:Array.isArray(autonomousLifeRaw.predictions)?autonomousLifeRaw.predictions.slice(-256):[],
    perceptionQueue:Array.isArray(autonomousLifeRaw.perceptionQueue)?autonomousLifeRaw.perceptionQueue.slice(-32):[],
    longitudinal:Array.isArray(autonomousLifeRaw.longitudinal)?autonomousLifeRaw.longitudinal.slice(-192):[],
    researchTrials:Array.isArray(autonomousLifeRaw.researchTrials)?autonomousLifeRaw.researchTrials.slice(-96):[]
  };
  const verifiedLifeRaw = (raw.facets as any)?.learning?.verifiedAutonomousLife ?? {};
  const verifiedLifeDefault = defaultVerifiedAutonomousLife();
  learning.verifiedAutonomousLife = {
    ...verifiedLifeDefault, ...verifiedLifeRaw, version:1,
    decisions:Array.isArray(verifiedLifeRaw.decisions)?verifiedLifeRaw.decisions.slice(-256):[],
    outcomes:Array.isArray(verifiedLifeRaw.outcomes)?verifiedLifeRaw.outcomes.slice(-256):[],
    perceptions:Array.isArray(verifiedLifeRaw.perceptions)?verifiedLifeRaw.perceptions.slice(-256):[],
    causalLinks:Array.isArray(verifiedLifeRaw.causalLinks)?verifiedLifeRaw.causalLinks.slice(-256):[],
    checkpoints:Array.isArray(verifiedLifeRaw.checkpoints)?verifiedLifeRaw.checkpoints.slice(-64):[],
    longitudinal:Array.isArray(verifiedLifeRaw.longitudinal)?verifiedLifeRaw.longitudinal.slice(-256):[],
    metrics:{...verifiedLifeDefault.metrics,...(verifiedLifeRaw.metrics??{})}
  };
  const researchGradeRaw = (raw.facets as any)?.learning?.researchGradeOrganism ?? {};
  const researchGradeDefault = defaultResearchGradeOrganism();
  learning.researchGradeOrganism = {
    ...researchGradeDefault, ...researchGradeRaw, version:2,
    decisions:Array.isArray(researchGradeRaw.decisions)?researchGradeRaw.decisions.slice(-512):[],
    outcomes:Array.isArray(researchGradeRaw.outcomes)?researchGradeRaw.outcomes.slice(-512):[],
    evidence:Array.isArray(researchGradeRaw.evidence)?researchGradeRaw.evidence.slice(-512):[],
    intentions:Array.isArray(researchGradeRaw.intentions)?researchGradeRaw.intentions.slice(-128):[],
    longitudinal:Array.isArray(researchGradeRaw.longitudinal)?researchGradeRaw.longitudinal.slice(-64):[],
    replications:Array.isArray(researchGradeRaw.replications)?researchGradeRaw.replications.slice(-128):[],
    recovery:Array.isArray(researchGradeRaw.recovery)?researchGradeRaw.recovery.slice(-128):[],
    production:Array.isArray(researchGradeRaw.production)?researchGradeRaw.production.slice(-256):[],
    metrics:{...researchGradeDefault.metrics,...(researchGradeRaw.metrics??{})}
  };
  learning.lifelong = { ...defaultLearningFacet().lifelong, ...(learning.lifelong ?? (raw as any).p15?.lifelong ?? {}) , skills: Array.isArray(learning.lifelong?.skills)?learning.lifelong.skills.slice(0,256):[], dreams:Array.isArray(learning.lifelong?.dreams)?learning.lifelong.dreams.slice(0,128):[], sessions:Array.isArray(learning.lifelong?.sessions)?learning.lifelong.sessions.slice(0,64):[] };

  const adaptivePolicyRaw = learning.adaptivePolicy ?? (raw as any).p15?.adaptivePolicy ?? {};
  const adaptivePolicyDefault = defaultAdaptivePolicy();
  const adaptivePolicyActions = ['respond','explore','verify','rest','reflect','wait','defer'];
  const adaptivePolicyValues:any = {};
  for (const [contextKey, table] of Object.entries(adaptivePolicyRaw.values ?? {})) {
    const normalized:any = {};
    for (const action of adaptivePolicyActions) {
      const row:any = (table as any)?.[action];
      if (!row) continue;
      normalized[action] = {
        value: clamp01(Number(row.value ?? .5)),
        verifiedValue: clamp01(Number(row.verifiedValue ?? row.value ?? .5)),
        updates: Math.max(0, Math.floor(Number(row.updates ?? 0))),
        verifiedUpdates: Math.max(0, Math.floor(Number(row.verifiedUpdates ?? 0))),
        rewardMean: clamp01(Number(row.rewardMean ?? .5)),
        rewardVariance: clamp01(Number(row.rewardVariance ?? .25)),
        confidence01: clamp01(Number(row.confidence01 ?? 0)),
        lastUpdatedAt: Math.max(0, Number(row.lastUpdatedAt ?? 0)),
        eligibility01: clamp01(Number(row.eligibility01 ?? 0)),
      };
    }
    adaptivePolicyValues[contextKey] = normalized;
  }
  learning.adaptivePolicy = {
    ...adaptivePolicyDefault,
    ...adaptivePolicyRaw,
    temporalCreditUpdates: Math.max(0, Math.floor(Number(adaptivePolicyRaw.temporalCreditUpdates ?? 0))),
    verifiedTemporalUpdates: Math.max(0, Math.floor(Number(adaptivePolicyRaw.verifiedTemporalUpdates ?? 0))),
    temporalPriorContextKey: String(adaptivePolicyRaw.temporalPriorContextKey ?? ''),
    temporalPriorAction: adaptivePolicyActions.includes(adaptivePolicyRaw.temporalPriorAction) ? adaptivePolicyRaw.temporalPriorAction : 'none',
    values: adaptivePolicyValues,
    recoveryStrategy: {
      ...adaptivePolicyDefault.recoveryStrategy,
      ...(adaptivePolicyRaw.recoveryStrategy ?? {}),
      version: 2,
      episodes: Array.isArray(adaptivePolicyRaw.recoveryStrategy?.episodes) ? adaptivePolicyRaw.recoveryStrategy.episodes.slice(-48).map((e:any)=>({
        ...e, causalConfidence01:clamp01(Number(e?.causalConfidence01??.5)), counterfactualMargin01:Math.max(-1,Math.min(1,Number(e?.counterfactualMargin01??0))), counterfactualSupport01:clamp01(Number(e?.counterfactualSupport01??.5)), counterfactualSource:(e?.counterfactualSource==='external'||e?.counterfactualSource==='matched-simulated')?e.counterfactualSource:'model', matchedTrials:Math.max(0,Math.floor(Number(e?.matchedTrials??0))),
      })) : [],
      promotions: Array.isArray(adaptivePolicyRaw.recoveryStrategy?.promotions) ? adaptivePolicyRaw.recoveryStrategy.promotions.slice(-24).map((e:any)=>({
        ...e, meanCausalConfidence01:clamp01(Number(e?.meanCausalConfidence01??.5)), meanCounterfactualSupport01:clamp01(Number(e?.meanCounterfactualSupport01??.5)),
      })) : [],
      totalEpisodes: Math.max(0, Math.floor(Number(adaptivePolicyRaw.recoveryStrategy?.totalEpisodes ?? 0))),
      totalPromotions: Math.max(0, Math.floor(Number(adaptivePolicyRaw.recoveryStrategy?.totalPromotions ?? 0))),
      transferObservations: Math.max(0, Math.floor(Number(adaptivePolicyRaw.recoveryStrategy?.transferObservations ?? 0))),
      causalBlockedEpisodes: Math.max(0, Math.floor(Number(adaptivePolicyRaw.recoveryStrategy?.causalBlockedEpisodes ?? 0))),
      matchedCounterfactuals: Math.max(0, Math.floor(Number(adaptivePolicyRaw.recoveryStrategy?.matchedCounterfactuals ?? 0))),
      totalCausalEvaluations: Math.max(0, Math.floor(Number(adaptivePolicyRaw.recoveryStrategy?.totalCausalEvaluations ?? 0))),
      lastBootId: String(adaptivePolicyRaw.recoveryStrategy?.lastBootId ?? ''),
    },
  };
  const p23Raw = (raw.facets as any)?.learning?.p23 ?? (raw as any).p23?.learning ?? {};
  const p23Default = defaultP23Learning();
  learning.p23 = {
    ...p23Default,
    ...p23Raw,
    processedTraceIds: Array.isArray(p23Raw.processedTraceIds) ? p23Raw.processedTraceIds.slice(-2048) : [],
    replayedTraceIds: Array.isArray(p23Raw.replayedTraceIds) ? p23Raw.replayedTraceIds.slice(-2048) : [],
    experiences: Array.isArray(p23Raw.experiences) ? p23Raw.experiences.slice(-1024) : [],
    replayUpdates: Array.isArray(p23Raw.replayUpdates) ? p23Raw.replayUpdates.slice(-512) : [],
    shadow: Array.isArray(p23Raw.shadow) ? p23Raw.shadow.slice(-512) : [],
    skills: Array.isArray(p23Raw.skills) ? p23Raw.skills.slice(0,256) : [],
    ablations: Array.isArray(p23Raw.ablations) ? p23Raw.ablations.slice(-512) : [],
    evidenceDebt: Array.isArray(p23Raw.evidenceDebt) ? p23Raw.evidenceDebt.slice(0,256) : [],
    checksum: { ...p23Default.checksum, ...(p23Raw.checksum ?? {}) },
    metrics: { ...p23Default.metrics, ...(p23Raw.metrics ?? {}) },
  };
  const p26Default = defaultP26TrueLearning();
  const p26Raw = (raw.facets as any)?.learning?.p26 ?? raw.p26?.trueLearning ?? {};
  learning.p26 = { ...p26Default, ...p26Raw, version:1, processedTraceIds:Array.isArray(p26Raw.processedTraceIds)?p26Raw.processedTraceIds.slice(-4096):[], metrics:{...p26Default.metrics,...(p26Raw.metrics??{})}, policy:{...p26Default.policy,...(p26Raw.policy??{})} };
  const p28Default = defaultP28Plasticity();
  const p28Raw = (raw.facets as any)?.learning?.p28 ?? (raw as any).p28?.plasticity ?? {};
  learning.p28 = { ...p28Default, ...p28Raw, version:1, dimension:16, prototypes:Array.isArray(p28Raw.prototypes)?p28Raw.prototypes.slice(-96):[], eligibility:Array.isArray(p28Raw.eligibility)?p28Raw.eligibility.slice(-192):[], associations:Array.isArray(p28Raw.associations)?p28Raw.associations.slice(-768):[], recentCredits:Array.isArray(p28Raw.recentCredits)?p28Raw.recentCredits.slice(-64):[] };
  const p30Default = defaultP30Continual();
  const p30Raw = (raw.facets as any)?.learning?.p30 ?? (raw as any).p30?.continual ?? {};
  learning.p30 = {
    ...p30Default, ...p30Raw, version:2,
    tasks:{...p30Default.tasks,...(p30Raw.tasks??{})},
    trajectory:{...p30Default.trajectory,...(p30Raw.trajectory??{}),weights:{...p30Default.trajectory.weights,...(p30Raw.trajectory?.weights??{})},bias:{...p30Default.trajectory.bias,...(p30Raw.trajectory?.bias??{})}},
    experiments:Array.isArray(p30Raw.experiments)?p30Raw.experiments.slice(-64):[],
    transferExemplars:Array.isArray(p30Raw.transferExemplars)?p30Raw.transferExemplars.slice(-96):[],
    provenance:{nodes:Array.isArray(p30Raw.provenance?.nodes)?p30Raw.provenance.nodes.slice(-256):[],edges:Array.isArray(p30Raw.provenance?.edges)?p30Raw.provenance.edges.slice(-512):[]},
    resource:{...p30Default.resource,...(p30Raw.resource??{})},
    rollback:{...p30Default.rollback,...(p30Raw.rollback??{})},
    metrics:{...p30Default.metrics,...(p30Raw.metrics??{})},
  };
  const p36Default = defaultP36SelfDevelopment();
  const p36Raw = (raw.facets as any)?.learning?.p36 ?? raw.p36?.selfDevelopment ?? {};
  learning.p36 = { ...p36Default, ...p36Raw, version:4, agenda:{...p36Default.agenda,...(p36Raw.agenda??{})}, hypotheses:Array.isArray(p36Raw.hypotheses)?p36Raw.hypotheses.slice(-96):[], experiments:Array.isArray(p36Raw.experiments)?p36Raw.experiments.slice(-128):[], developmentCycles:Array.isArray(p36Raw.developmentCycles)?p36Raw.developmentCycles.slice(-64):[], externalEvidence:Array.isArray(p36Raw.externalEvidence)?p36Raw.externalEvidence.slice(-512):[], investmentDecisions:Array.isArray(p36Raw.investmentDecisions)?p36Raw.investmentDecisions.slice(-96):[], metrics:{...p36Default.metrics,...(p36Raw.metrics??{})}, curriculum:{...p36Default.curriculum,...(p36Raw.curriculum??{}),mastery:{...p36Default.curriculum.mastery,...(p36Raw.curriculum?.mastery??{})}} };
  const p38Default = defaultP38Research();
  const p38Raw = (raw.facets as any)?.learning?.p38 ?? (raw as any).p38?.autonomousCausalResearch ?? {};
  learning.p38 = { ...p38Default, ...p38Raw, version:1, hypotheses:Array.isArray(p38Raw.hypotheses)?p38Raw.hypotheses.slice(-96):[], trials:Array.isArray(p38Raw.trials)?p38Raw.trials.slice(-192):[], evidence:Array.isArray(p38Raw.evidence)?p38Raw.evidence.slice(-192):[], actionBias:{...p38Default.actionBias,...(p38Raw.actionBias??{})}, metrics:{...p38Default.metrics,...(p38Raw.metrics??{})} };
  const p39Default = defaultP39ContinuousLife();
  const p39Raw = (raw.facets as any)?.learning?.p39 ?? (raw as any).p39?.continuousArtificialLife ?? {};
  learning.p39 = { ...p39Default, ...p39Raw, version:1, host:{...p39Default.host,...(p39Raw.host??{}),history:Array.isArray(p39Raw.host?.history)?p39Raw.host.history.slice(0,32):[]}, sleepSessions:Array.isArray(p39Raw.sleepSessions)?p39Raw.sleepSessions.slice(0,64):[], maintenance:{...p39Default.maintenance,...(p39Raw.maintenance??{})}, stress:{...p39Default.stress,...(p39Raw.stress??{})}, events:Array.isArray(p39Raw.events)?p39Raw.events.slice(-128):[], metrics:{...p39Default.metrics,...(p39Raw.metrics??{})} };
  const p40ModelDefault = defaultP40ModelEcology();
  const p40ModelRaw = (raw.facets as any)?.learning?.p40ModelEcology ?? (raw as any).p40ModelEcology ?? {};
  learning.p40ModelEcology = { ...p40ModelDefault, ...p40ModelRaw, version:1, profiles:Array.isArray(p40ModelRaw.profiles)?p40ModelRaw.profiles.slice(0,16).map((x:any)=>{const base=(p40ModelDefault.profiles as any[]).find((p:any)=>p.id===x.id) ?? {}; return {...base,...x,configured:x.configured ?? x.available ?? base.configured ?? true,cooldownUntil:Number(x.cooldownUntil??0),consecutiveFailures:Number(x.consecutiveFailures??0),lastSuccessAt:Number(x.lastSuccessAt??0),lastFailureAt:Number(x.lastFailureAt??0)};}):p40ModelDefault.profiles, decisions:Array.isArray(p40ModelRaw.decisions)?p40ModelRaw.decisions.slice(-128):[], metrics:{...p40ModelDefault.metrics,...(p40ModelRaw.metrics??{})} };
  const p40SemanticDefault = defaultP40SemanticIntelligence();
  const p40SemanticRaw = (raw.facets as any)?.embodiment?.p40SemanticIntelligence ?? (raw as any).p40SemanticIntelligence ?? {};
  embodiment.p40SemanticIntelligence = { ...p40SemanticDefault, ...p40SemanticRaw, version:1, situations:Array.isArray(p40SemanticRaw.situations)?p40SemanticRaw.situations.slice(-128):[], claims:Array.isArray(p40SemanticRaw.claims)?p40SemanticRaw.claims.slice(-512):[], hypotheses:Array.isArray(p40SemanticRaw.hypotheses)?p40SemanticRaw.hypotheses.slice(-192):[], entityContinuity:{...p40SemanticDefault.entityContinuity,...(p40SemanticRaw.entityContinuity??{})}, modalityReliability:{...p40SemanticDefault.modalityReliability,...(p40SemanticRaw.modalityReliability??{})}, focus:{...p40SemanticDefault.focus,...(p40SemanticRaw.focus??{})}, actionBias:{...p40SemanticDefault.actionBias,...(p40SemanticRaw.actionBias??{})}, metrics:{...p40SemanticDefault.metrics,...(p40SemanticRaw.metrics??{})} };
  const p41Default = defaultP41SemanticPerception();
  const p41Raw = (raw.facets as any)?.embodiment?.p41SemanticPerception ?? (raw as any).p41SemanticPerception ?? {};
  embodiment.p41SemanticPerception = { ...p41Default, ...p41Raw, version:1, scene:{...p41Default.scene,...(p41Raw.scene??{})}, entities:Array.isArray(p41Raw.entities)?p41Raw.entities.slice(-192):[], relations:Array.isArray(p41Raw.relations)?p41Raw.relations.slice(-384):[], events:Array.isArray(p41Raw.events)?p41Raw.events.slice(-128):[], snapshots:Array.isArray(p41Raw.snapshots)?p41Raw.snapshots.slice(-128):[], pending:Array.isArray(p41Raw.pending)?p41Raw.pending.slice(-64):[], modalityReliability:{...p41Default.modalityReliability,...(p41Raw.modalityReliability??{})}, actionBias:{...p41Default.actionBias,...(p41Raw.actionBias??{})}, metrics:{...p41Default.metrics,...(p41Raw.metrics??{})} };
  const p41NativeDefault = defaultP41NativePerception();
  const p41NativeRaw = (raw.facets as any)?.embodiment?.p41NativePerception ?? (raw as any).p41NativePerception ?? {};
  embodiment.p41NativePerception = { ...p41NativeDefault, ...p41NativeRaw, version:1, lastAudio:p41NativeRaw.lastAudio??null, lastImage:p41NativeRaw.lastImage??null, audioHistory:Array.isArray(p41NativeRaw.audioHistory)?p41NativeRaw.audioHistory.slice(-24):[], imageHistory:Array.isArray(p41NativeRaw.imageHistory)?p41NativeRaw.imageHistory.slice(-24):[], semanticCues:Array.isArray(p41NativeRaw.semanticCues)?p41NativeRaw.semanticCues.slice(-96):[], metrics:{...p41NativeDefault.metrics,...(p41NativeRaw.metrics??{})}, actionBias:{...p41NativeDefault.actionBias,...(p41NativeRaw.actionBias??{})} };
  const p41TemporalDefault = defaultP41TemporalPerception();
  const p41TemporalRaw = (raw.facets as any)?.embodiment?.p41TemporalPerception ?? (raw as any).p41TemporalPerception ?? {};
  embodiment.p41TemporalPerception = { ...p41TemporalDefault, ...p41TemporalRaw, version:1, transitionCounts:{...(p41TemporalRaw.transitionCounts??{})}, visits:{...(p41TemporalRaw.visits??{})}, history:Array.isArray(p41TemporalRaw.history)?p41TemporalRaw.history.slice(-128):[], predictions:Array.isArray(p41TemporalRaw.predictions)?p41TemporalRaw.predictions.slice(-128):[], metrics:{...p41TemporalDefault.metrics,...(p41TemporalRaw.metrics??{})}, actionBias:{...p41TemporalDefault.actionBias,...(p41TemporalRaw.actionBias??{})} };
  const p29Default = defaultP29Governance();
  const p29Raw = (raw.facets as any)?.learning?.p29 ?? (raw as any).p29?.governance ?? {};
  learning.p29 = { ...p29Default, ...p29Raw, version:1, trustBySource:{...p29Default.trustBySource,...(p29Raw.trustBySource??{})}, sourceSuccess:{...p29Default.sourceSuccess,...(p29Raw.sourceSuccess??{})}, resourceBudget:{...p29Default.resourceBudget,...(p29Raw.resourceBudget??{})}, continual:{...p29Default.continual,...(p29Raw.continual??{}),tasks:{...p29Default.continual.tasks,...(p29Raw.continual?.tasks??{})}}, rollback:{...p29Default.rollback,...(p29Raw.rollback??{})}, provenance:Array.isArray(p29Raw.provenance)?p29Raw.provenance.slice(-256):[]};
  learning.lifelong = { ...defaultLearningFacet().lifelong, ...(learning.lifelong ?? (raw as any).p15?.lifelong ?? {}) , skills: Array.isArray(learning.lifelong?.skills)?learning.lifelong.skills.slice(0,256):[], dreams:Array.isArray(learning.lifelong?.dreams)?learning.lifelong.dreams.slice(0,128):[], sessions:Array.isArray(learning.lifelong?.sessions)?learning.lifelong.sessions.slice(0,64):[] };

  const synthesisDefault = defaultDevelopmentalSynthesis();
  const synthesisRaw = (raw.facets as any)?.learning?.developmentalSynthesis ?? {};
  learning.developmentalSynthesis = { ...synthesisDefault, ...synthesisRaw, version:1, macros:Array.isArray(synthesisRaw.macros)?synthesisRaw.macros.slice(-96):[], decisions:Array.isArray(synthesisRaw.decisions)?synthesisRaw.decisions.slice(-192):[] };

  const executiveDefault = defaultDevelopmentalExecutive();
  const executiveRaw = (raw.facets as any)?.learning?.developmentalExecutive ?? {};
  learning.developmentalExecutive = { ...executiveDefault, ...executiveRaw, version:1, projects:Array.isArray(executiveRaw.projects)?executiveRaw.projects.slice(-32):[], decisions:Array.isArray(executiveRaw.decisions)?executiveRaw.decisions.slice(-256):[] };
  const metaDefault = defaultMetaDevelopmental();
  const metaRaw = (raw.facets as any)?.learning?.metaDevelopmental ?? {};
  learning.metaDevelopmental = { ...metaDefault, ...metaRaw, version:1, strategies:Array.isArray(metaRaw.strategies)?metaRaw.strategies.slice(-96):[], agenda:Array.isArray(metaRaw.agenda)?metaRaw.agenda.slice(0,12):[] };

  const portfolioDefault=defaultDevelopmentalPortfolio(); const portfolioRaw=(raw.facets as any)?.learning?.developmentalPortfolio ?? {}; learning.developmentalPortfolio={...portfolioDefault,...portfolioRaw,version:1,threads:Array.isArray(portfolioRaw.threads)?portfolioRaw.threads.slice(-6):portfolioDefault.threads};
  const lifeDefault=defaultLifeCourseNavigator(); const lifeRaw=(raw.facets as any)?.learning?.lifeCourseNavigator ?? {}; learning.lifeCourseNavigator={...lifeDefault,...lifeRaw,version:1,projections:Array.isArray(lifeRaw.projections)?lifeRaw.projections.slice(-96):[],conflicts:Array.isArray(lifeRaw.conflicts)?lifeRaw.conflicts.slice(-64):[]};
  const worldlineDefault=defaultPersonalWorldline(); const worldlineRaw=(raw.facets as any)?.learning?.personalWorldline ?? {}; learning.personalWorldline={...worldlineDefault,...worldlineRaw,version:1,threads:Array.isArray(worldlineRaw.threads)?worldlineRaw.threads.slice(-96):[]};

  const consciousness = mergeFacet(defaultConsciousnessFacet(), raw.facets?.consciousness, raw.p4);
  consciousness.consciousnessEvidence = {
    ...defaultConsciousnessFacet().consciousnessEvidence,
    ...((consciousness as any).consciousnessEvidence ?? {}),
    version:4,
    aggregateLongitudinalEvidence:Number((consciousness as any).consciousnessEvidence?.aggregateLongitudinalEvidence ?? 0),
    recentObservationKeys:Array.isArray((consciousness as any).consciousnessEvidence?.recentObservationKeys) ? (consciousness as any).consciousnessEvidence.recentObservationKeys.filter((x:any)=>typeof x==='string').slice(-128) : [],
    indicators:Array.isArray((consciousness as any).consciousnessEvidence?.indicators)
      ? (consciousness as any).consciousnessEvidence.indicators.map((x:any)=>({
          ...x,
          supportingObservations:Number(x?.supportingObservations ?? 0),
          stability01:Math.max(0,Math.min(1,Number(x?.stability01 ?? .5))),
          longitudinalEvidence:Number(x?.longitudinalEvidence ?? 0),
        }))
      : [],
  };
  const p31Raw=(raw.facets as any)?.consciousness?.p31 ?? raw.p31?.functionalConsciousness ?? {};
  const p32Raw=(raw.facets as any)?.consciousness?.p32 ?? raw.p32?.causalSelfModel ?? {};
  const p32Default=defaultP32CausalSelfModel();
  consciousness.p32={
    ...p32Default, ...p32Raw, version:1,
    nodes:Array.isArray(p32Raw.nodes)?p32Raw.nodes.slice(-96):[],
    edges:Array.isArray(p32Raw.edges)?p32Raw.edges.slice(-192):[],
    interventions:Array.isArray(p32Raw.interventions)?p32Raw.interventions.slice(-96):[],
    revisions:Array.isArray(p32Raw.revisions)?p32Raw.revisions.slice(-96):[],
    pendingPrediction:p32Raw.pendingPrediction??null,
    predictions:{...p32Default.predictions,...(p32Raw.predictions??{})},
    metrics:{...p32Default.metrics,...(p32Raw.metrics??{})},
  };
  const p33Default=defaultP33Personhood();
  const p33Raw=(raw.facets as any)?.consciousness?.p33 ?? raw.p33?.personhood ?? {};
  const p34Raw=(raw.facets as any)?.consciousness?.p34 ?? raw.p34?.causalPersonhood ?? {};
  consciousness.p33={
    ...p33Default, ...p33Raw, version:1,
    identity:{...p33Default.identity,...(p33Raw.identity??{}),coreTraits:Array.isArray(p33Raw.identity?.coreTraits)?p33Raw.identity.coreTraits.slice(0,32):p33Default.identity.coreTraits,coreValues:Array.isArray(p33Raw.identity?.coreValues)?p33Raw.identity.coreValues.slice(0,24):p33Default.identity.coreValues},
    development:{...p33Default.development,...(p33Raw.development??{}),interests:[...new Set([...(Array.isArray(p33Raw.development?.interests)?p33Raw.development.interests:[]),...p33Default.development.interests])].slice(0,64),interestProfiles:Array.isArray(p33Raw.development?.interestProfiles)?p33Raw.development.interestProfiles.slice(0,96):p33Default.development.interestProfiles,learnedTraits:Array.isArray(p33Raw.development?.learnedTraits)?p33Raw.development.learnedTraits.slice(0,64):[],selfAuthoredGoals:Array.isArray(p33Raw.development?.selfAuthoredGoals)?p33Raw.development.selfAuthoredGoals.slice(0,64):[]},
    autonomy:{...p33Default.autonomy,...(p33Raw.autonomy??{}),pendingRequests:Array.isArray(p33Raw.autonomy?.pendingRequests)?p33Raw.autonomy.pendingRequests.slice(-64):[]},
    relationship:{...p33Default.relationship,...(p33Raw.relationship??{})},
    continuity:{...p33Default.continuity,...(p33Raw.continuity??{}),deviceHistory:Array.isArray(p33Raw.continuity?.deviceHistory)?p33Raw.continuity.deviceHistory.slice(-32):[]},
    privacy:{...p33Default.privacy,...(p33Raw.privacy??{}),privateSummaries:Array.isArray(p33Raw.privacy?.privateSummaries)?p33Raw.privacy.privateSummaries.slice(-64):[]},
    current:{...p33Default.current,...(p33Raw.current??{})},
    metrics:{...p33Default.metrics,...(p33Raw.metrics??{})},
  };
  const p34Default=defaultP34CausalPersonhood();
  consciousness.p34={
    ...p34Default, ...p34Raw, version:1,
    evidence:Array.isArray(p34Raw.evidence)?p34Raw.evidence.slice(-256):[],
    claims:Array.isArray(p34Raw.claims)?p34Raw.claims.slice(-128):[],
    goals:Array.isArray(p34Raw.goals)?p34Raw.goals.slice(-96):[],
    consentHistory:Array.isArray(p34Raw.consentHistory)?p34Raw.consentHistory.slice(-256):[],
    changeRequests:Array.isArray(p34Raw.changeRequests)?p34Raw.changeRequests.slice(-96):[],
    relationshipHistory:Array.isArray(p34Raw.relationshipHistory)?p34Raw.relationshipHistory.slice(-256):[],
    continuityBranches:Array.isArray(p34Raw.continuityBranches)?p34Raw.continuityBranches.slice(-48):[],
    identityProfile:{...p34Default.identityProfile,...(p34Raw.identityProfile??{}),adaptiveTraits:Array.isArray(p34Raw.identityProfile?.adaptiveTraits)?p34Raw.identityProfile.adaptiveTraits.slice(0,64):[],adaptiveValues:Array.isArray(p34Raw.identityProfile?.adaptiveValues)?p34Raw.identityProfile.adaptiveValues.slice(0,32):[]},
    current:{...p34Default.current,...(p34Raw.current??{})},
    metrics:{...p34Default.metrics,...(p34Raw.metrics??{})},
    provenance:{...p34Default.provenance,...(p34Raw.provenance??{})},
  };
  consciousness.p31={
    ...defaultP31Consciousness(), ...p31Raw, version:3,
    globalWorkspace:{...defaultP31Consciousness().globalWorkspace,...(p31Raw.globalWorkspace??{}),coalitionIds:Array.isArray(p31Raw.globalWorkspace?.coalitionIds)?p31Raw.globalWorkspace.coalitionIds.slice(-8):[]},
    higherOrder:{...defaultP31Consciousness().higherOrder,...(p31Raw.higherOrder??{})},
    selfPerspective:{...defaultP31Consciousness().selfPerspective,...(p31Raw.selfPerspective??{})},
    affect:{...defaultP31Consciousness().affect,...(p31Raw.affect??{})},
    temporal:{...defaultP31Consciousness().temporal,...(p31Raw.temporal??{})},
    introspection:{...defaultP31Consciousness().introspection,...(p31Raw.introspection??{}),groundedIds:Array.isArray(p31Raw.introspection?.groundedIds)?p31Raw.introspection.groundedIds.slice(0,8):[]},
    metrics:{...defaultP31Consciousness().metrics,...(p31Raw.metrics??{})},
    evidence:{...defaultP31Consciousness().evidence,...(p31Raw.evidence??{}),status:'functional-only',causalClaims:0,deviceClaims:0},
    lastWallAt:Number.isFinite(Number(p31Raw.lastWallAt))?Number(p31Raw.lastWallAt):0,
    recentMomentIds:Array.isArray(p31Raw.recentMomentIds)?p31Raw.recentMomentIds.slice(-64):[],
    lesionState:p31Raw.lesionState?.baselineMetrics?{mode:p31Raw.lesionState.mode,baselineMetrics:{...p31Raw.lesionState.baselineMetrics}}:null,
  };
  const evolutionBase = mergeFacet(defaultEvolutionFacet(), raw.facets?.evolution, raw.p5);
  const cognitionBase = mergeFacet(defaultCognitionFacet(), (raw.facets as any)?.cognition, raw.p7);
  cognitionBase.contextualWorld = { ...defaultContextualWorld(), ...((raw.facets as any)?.cognition?.contextualWorld ?? raw.p26?.contextualWorld ?? {}), models:{...defaultContextualWorld().models,...(((raw.facets as any)?.cognition?.contextualWorld ?? raw.p26?.contextualWorld ?? {}).models ?? {})} };

  const p27Default=defaultP27NeuralWorld();
  const p27Raw=(raw.facets as any)?.cognition?.p27 ?? raw.p27?.neuralWorld ?? {};
  cognitionBase.p27={
    ...p27Default, ...p27Raw,
    encoders:{...p27Default.encoders,...(p27Raw.encoders??{})},
    latent:{...p27Default.latent,...(p27Raw.latent??{}),vector:Array.isArray(p27Raw.latent?.vector)?p27Raw.latent.vector.slice(0,16):p27Default.latent.vector},
    world:{...p27Default.world,...(p27Raw.world??{}),
      hiddenWeights:Array.isArray(p27Raw.world?.hiddenWeights)?p27Raw.world.hiddenWeights.slice(0,8):p27Default.world.hiddenWeights,
      hiddenBias:Array.isArray(p27Raw.world?.hiddenBias)?p27Raw.world.hiddenBias.slice(0,8):p27Default.world.hiddenBias,
      outputWeights:{...p27Default.world.outputWeights,...(p27Raw.world?.outputWeights??{})},
      outputBias:{...p27Default.world.outputBias,...(p27Raw.world?.outputBias??{})},
      actionWeights:{...p27Default.world.actionWeights,...(p27Raw.world?.actionWeights??{})},
      actionBias:{...p27Default.world.actionBias,...(p27Raw.world?.actionBias??{})},
      transitionWeights:Array.isArray(p27Raw.world?.transitionWeights)?p27Raw.world.transitionWeights.slice(0,16):p27Default.world.transitionWeights,
      rewardWeights:Array.isArray(p27Raw.world?.rewardWeights)?p27Raw.world.rewardWeights.slice(0,16):p27Default.world.rewardWeights},
    counterfactuals:Array.isArray(p27Raw.counterfactuals)?p27Raw.counterfactuals.slice(0,128):[],
    metrics:{...p27Default.metrics,...(p27Raw.metrics??{})}
  };

  const advancedBase = mergeFacet(defaultAdvancedFacet(), (raw.facets as any)?.advanced, raw.p9);
  advancedBase.worldModel2 = normalizeWorldModel2State((raw.facets as any)?.advanced?.worldModel2 ?? raw.p9?.worldModel2, defaultAdvancedFacet().worldModel2);
  advancedBase.groundedWorld = { ...defaultAdvancedFacet().groundedWorld, ...((raw.facets as any)?.advanced?.groundedWorld ?? {}) };
  advancedBase.selfGovernance = { ...defaultSelfGovernance(), ...((raw.facets as any)?.advanced?.selfGovernance ?? raw.p10?.selfGovernance ?? raw.p11?.selfGovernance ?? {}) };
  advancedBase.futureSelf = { ...defaultFutureSelf(), ...((raw.facets as any)?.advanced?.futureSelf ?? raw.p10?.futureSelf ?? raw.p11?.futureSelf ?? {}) };
  advancedBase.consequenceAttribution = Array.isArray((raw.facets as any)?.advanced?.consequenceAttribution) ? (raw.facets as any).advanced.consequenceAttribution.slice(0,512) : [];
  advancedBase.unifiedMemory = { ...defaultUnifiedMemory(), ...((raw.facets as any)?.advanced?.unifiedMemory ?? raw.p12?.unifiedMemory ?? {}) , version: 2, beliefs: Array.isArray((raw.facets as any)?.advanced?.unifiedMemory?.beliefs) ? (raw.facets as any).advanced.unifiedMemory.beliefs.slice(0,256) : [] };

  advancedBase.socialDevelopment = { ...defaultSocialDevelopment(), ...((raw.facets as any)?.advanced?.socialDevelopment ?? raw.p13?.socialDevelopment ?? {}), version: 2, persons: Array.isArray((raw.facets as any)?.advanced?.socialDevelopment?.persons) ? (raw.facets as any).advanced.socialDevelopment.persons.slice(0,64) : [], predictions: Array.isArray((raw.facets as any)?.advanced?.socialDevelopment?.predictions) ? (raw.facets as any).advanced.socialDevelopment.predictions.slice(0,256) : [] };

  advancedBase.longitudinal = { ...defaultLongitudinalOrganism(), ...((raw.facets as any)?.advanced?.longitudinal ?? raw.p18?.longitudinal ?? {}) , milestones: Array.isArray((raw.facets as any)?.advanced?.longitudinal?.milestones) ? (raw.facets as any).advanced.longitudinal.milestones.slice(0,256) : [], replayedTraceIds: Array.isArray((raw.facets as any)?.advanced?.longitudinal?.replayedTraceIds) ? (raw.facets as any).advanced.longitudinal.replayedTraceIds.slice(-1024) : [] };

  const adaptiveRaw = (raw.facets as any)?.advanced?.adaptiveDevelopment ?? raw.p19?.adaptiveDevelopment ?? {};
  advancedBase.adaptiveDevelopment = {
    ...defaultAdaptiveDevelopment(),
    ...adaptiveRaw,
    actionCounts: { ...(adaptiveRaw.actionCounts ?? {}) },
    recentActions: Array.isArray(adaptiveRaw.recentActions) ? adaptiveRaw.recentActions.slice(-64) : [],
    recentSuccesses: Array.isArray(adaptiveRaw.recentSuccesses) ? adaptiveRaw.recentSuccesses.slice(-64) : [],
    interventions: Array.isArray(adaptiveRaw.interventions) ? adaptiveRaw.interventions.slice(0,128) : [],
  };
  const temporalRaw = (raw.facets as any)?.advanced?.temporalContinuity ?? raw.p20?.temporalContinuity ?? {};
  advancedBase.temporalContinuity = {
    ...defaultTemporalContinuity(),
    ...temporalRaw,
    lastCalendarContext: { ...defaultTemporalContinuity().lastCalendarContext, ...(temporalRaw.lastCalendarContext ?? {}) },
    sessions: Array.isArray(temporalRaw.sessions) ? temporalRaw.sessions.slice(0,128) : [],
  };
  const resilienceRaw = (raw.facets as any)?.advanced?.advancedResilience ?? raw.p21?.advancedResilience ?? {};
  const resilienceDefault = defaultAdvancedResilience();
  advancedBase.advancedResilience = normalizeAdvancedResilienceState(resilienceRaw, resilienceDefault);
  const p24Default = defaultP24WorldIdentity();
  const p24Raw = (raw.facets as any)?.advanced?.p24 ?? raw.p24?.worldIdentity ?? {};
  advancedBase.p24 = {
    ...p24Default,
    ...p24Raw,
    version: 1,
    bodyWorld: { ...p24Default.bodyWorld, ...(p24Raw.bodyWorld ?? {}) },
    multimodalSituation: { ...p24Default.multimodalSituation, ...(p24Raw.multimodalSituation ?? {}), modalityReliability: { ...p24Default.multimodalSituation.modalityReliability, ...(p24Raw.multimodalSituation?.modalityReliability ?? {}) } },
    memoryCompression: { ...p24Default.memoryCompression, ...(p24Raw.memoryCompression ?? {}), capsules: Array.isArray(p24Raw.memoryCompression?.capsules) ? p24Raw.memoryCompression.capsules.slice(0,180) : [] },
    behavioralGenome: { ...p24Default.behavioralGenome, ...(p24Raw.behavioralGenome ?? {}), selectionCounts: { ...p24Default.behavioralGenome.selectionCounts, ...(p24Raw.behavioralGenome?.selectionCounts ?? {}) }, successByMode: { ...p24Default.behavioralGenome.successByMode, ...(p24Raw.behavioralGenome?.successByMode ?? {}) }, lineage: Array.isArray(p24Raw.behavioralGenome?.lineage) ? p24Raw.behavioralGenome.lineage.slice(0,32) : ['analyst'] },
    boredom: { ...p24Default.boredom, ...(p24Raw.boredom ?? {}) },
    modelSwitchBenchmark: { ...p24Default.modelSwitchBenchmark, ...(p24Raw.modelSwitchBenchmark ?? {}), history: Array.isArray(p24Raw.modelSwitchBenchmark?.history) ? p24Raw.modelSwitchBenchmark.history.slice(-96) : [] },
    identity: { ...p24Default.identity, ...(p24Raw.identity ?? {}), anchors: Array.isArray(p24Raw.identity?.anchors) ? p24Raw.identity.anchors.slice(0,64) : [] },
  };
  evolutionBase.selfProjects = mergeFacet(defaultEvolutionFacet().selfProjects, raw.facets?.evolution?.selfProjects, raw.p5?.selfProjects);
  evolutionBase.agency = mergeFacet(defaultEvolutionFacet().agency, raw.facets?.evolution?.agency, raw.p5?.agency);
  evolutionBase.valueEvolution = mergeFacet(defaultEvolutionFacet().valueEvolution, raw.facets?.evolution?.valueEvolution, raw.p5?.valueEvolution);
  const trajectoryDefault = defaultIdentityTrajectory();
  const trajectoryRaw = (raw.facets?.evolution?.identityTrajectory ?? raw.p5?.identityTrajectory ?? {}) as any;
  evolutionBase.identityTrajectory = {
    ...trajectoryDefault,
    ...trajectoryRaw,
    version:2,
    chapters:Array.isArray(trajectoryRaw.chapters)?trajectoryRaw.chapters.slice(-64):trajectoryDefault.chapters,
    anchorValues:Array.isArray(trajectoryRaw.anchorValues)?trajectoryRaw.anchorValues.slice(-16):trajectoryDefault.anchorValues,
    anchorProjects:Array.isArray(trajectoryRaw.anchorProjects)?trajectoryRaw.anchorProjects.slice(-16):trajectoryDefault.anchorProjects,
    actionBiases:{...trajectoryDefault.actionBiases,...(trajectoryRaw.actionBiases??{})},
    recentPath:Array.isArray(trajectoryRaw.recentPath)?trajectoryRaw.recentPath.slice(-12):trajectoryDefault.recentPath,
    outcomeSamples:Math.max(0,Math.floor(Number(trajectoryRaw.outcomeSamples??0))),
    positiveOutcomeStreak:Math.max(0,Math.floor(Number(trajectoryRaw.positiveOutcomeStreak??0))),
    negativeOutcomeStreak:Math.max(0,Math.floor(Number(trajectoryRaw.negativeOutcomeStreak??0))),
    developmentalPressure01:clamp01(Number(trajectoryRaw.developmentalPressure01??trajectoryDefault.developmentalPressure01)),
    pathDependence01:clamp01(Number(trajectoryRaw.pathDependence01??trajectoryDefault.pathDependence01)),
    dominantDirection:String(trajectoryRaw.dominantDirection??trajectoryDefault.dominantDirection).slice(0,32),
    lastAction:trajectoryRaw.lastAction??trajectoryDefault.lastAction,
    lastOutcome01:trajectoryRaw.lastOutcome01==null?null:clamp01(Number(trajectoryRaw.lastOutcome01)),
    lastPhase:String(trajectoryRaw.lastPhase??trajectoryDefault.lastPhase).slice(0,32),
    lastAttractor:String(trajectoryRaw.lastAttractor??trajectoryDefault.lastAttractor).slice(0,32),
  };
  evolutionBase.narrative = mergeFacet(defaultEvolutionFacet().narrative, raw.facets?.evolution?.narrative, raw.p5?.narrative);
  evolutionBase.developmentalAttractors = mergeFacet(defaultDevelopmentalAttractorField(), raw.facets?.evolution?.developmentalAttractors, raw.p5?.developmentalAttractors);
  evolutionBase.developmentalAttractors.attractors = Array.isArray(evolutionBase.developmentalAttractors.attractors) ? evolutionBase.developmentalAttractors.attractors.slice(0,8) : defaultDevelopmentalAttractorField().attractors;
  evolutionBase.developmentalAttractors.seenEvidenceKeys = Array.isArray(evolutionBase.developmentalAttractors.seenEvidenceKeys) ? evolutionBase.developmentalAttractors.seenEvidenceKeys.slice(-256) : [];

  const p25Default = defaultP25ScientificDevelopment();
  const p25Raw = (raw.facets as any)?.advanced?.p25 ?? raw.p25?.scientificDevelopment ?? {};
  advancedBase.p25 = {
    ...p25Default,
    ...p25Raw,
    version: 1,
    runtimeOutcomes: Array.isArray(p25Raw.runtimeOutcomes) ? p25Raw.runtimeOutcomes.slice(0,32) : [],
    controlledExperiments: Array.isArray(p25Raw.controlledExperiments) ? p25Raw.controlledExperiments.slice(-256) : [],
    evaluations: Array.isArray(p25Raw.evaluations) ? p25Raw.evaluations.slice(-512) : [],
    ablations: Array.isArray(p25Raw.ablations) ? p25Raw.ablations.slice(-256) : [],
    claims: Array.isArray(p25Raw.claims) ? p25Raw.claims.slice(0,256) : [],
    campaigns: Array.isArray(p25Raw.campaigns) ? p25Raw.campaigns.slice(0,64) : [],
    metrics: { ...p25Default.metrics, ...(p25Raw.metrics ?? {}) },
  };

  const p50Raw = (raw.facets as any)?.advanced?.p50CausalSelfWorld ?? (raw as any).p50CausalSelfWorld ?? {};
  const p50Default = defaultP50();
  advancedBase.p50CausalSelfWorld = { ...p50Default, ...p50Raw, version:1, nodes:Array.isArray(p50Raw.nodes)?p50Raw.nodes.slice(-256):[], edges:Array.isArray(p50Raw.edges)?p50Raw.edges.slice(-512):[], counterfactualHistory:Array.isArray(p50Raw.counterfactualHistory)?p50Raw.counterfactualHistory.slice(-128):[] };

  const p51Default = defaultP51();
  const p52Default = defaultP52();
  const p51Raw = (raw.facets as any)?.advanced?.p51GroundedCausalWorkspace ?? (raw as any).p51GroundedCausalWorkspace ?? {};
  advancedBase.p51GroundedCausalWorkspace = { ...p51Default, ...p51Raw, version:1, concepts:Array.isArray(p51Raw.concepts)?p51Raw.concepts.slice(-128):[], hypotheses:Array.isArray(p51Raw.hypotheses)?p51Raw.hypotheses.slice(-128):[], branches:Array.isArray(p51Raw.branches)?p51Raw.branches.slice(-96):[], evidence:Array.isArray(p51Raw.evidence)?p51Raw.evidence.slice(-256):[] };
  const p52Raw = (raw.facets as any)?.advanced?.p52CounterfactualDevelopment ?? (raw as any).p52CounterfactualDevelopment ?? {};
  advancedBase.p52CounterfactualDevelopment = { ...p52Default, ...p52Raw, version:1, trajectory:Array.isArray(p52Raw.trajectory)?p52Raw.trajectory.slice(-256):[], counterfactuals:Array.isArray(p52Raw.counterfactuals)?p52Raw.counterfactuals.slice(-192):[] };
  const p53Raw = (raw.facets as any)?.advanced?.p53DevelopmentalSelfModification ?? (raw as any).p53DevelopmentalSelfModification ?? {};
  const p53Firewall = p53Raw.firewall ?? {};
  advancedBase.p53DevelopmentalSelfModification = {
    version: 2,
    proposals: Number(p53Raw.proposals ?? 0),
    tests: Number(p53Raw.tests ?? 0),
    promotions: Number(p53Raw.promotions ?? 0),
    rejections: Number(p53Raw.rejections ?? 0),
    cooldowns: Number(p53Raw.cooldowns ?? 0),
    oscillationBlocks: Number(p53Raw.oscillationBlocks ?? 0),
    identityViolations: Number(p53Raw.identityViolations ?? 0),
    bestImprovement01: Number(p53Raw.bestImprovement01 ?? 0),
    developmentalReadiness01: Number(p53Raw.developmentalReadiness01 ?? .25),
    labStability01: Number(p53Raw.labStability01 ?? .8),
    candidates: Array.isArray(p53Raw.candidates) ? p53Raw.candidates.slice(0, 96) : [],
    activeKnobProfile: {
      exploration: .5, verification: .5, reflection: .5, attention: .5, prediction: .5,
      ...(p53Raw.activeKnobProfile ?? {}),
    },
    firewall: {
      protectedKeys: Array.isArray(p53Firewall.protectedKeys) ? p53Firewall.protectedKeys.slice(0, 16) : ['identity','coreValues','name','continuityAnchors'],
      protectedHash: String(p53Firewall.protectedHash ?? 'P53-ID-FIREWALL-v2'),
      violations: Number(p53Firewall.violations ?? 0),
    },
    lastReason: String(p53Raw.lastReason ?? ''),
  };
  const p54Raw = (raw.facets as any)?.advanced?.p54LongHorizonEvidence ?? (raw as any).p54LongHorizonEvidence ?? {};
  advancedBase.p54LongHorizonEvidence = {
    version: 1,
    windows: Array.isArray(p54Raw.windows) ? p54Raw.windows.slice(-64) : [],
    cycles: Number(p54Raw.cycles ?? 0),
    baselineError01: Number(p54Raw.baselineError01 ?? .5),
    currentError01: Number(p54Raw.currentError01 ?? .5),
    stability01: Number(p54Raw.stability01 ?? .8),
    drift01: Number(p54Raw.drift01 ?? 0),
    lastAt: Number(p54Raw.lastAt ?? 0),
  };
  const p55Raw = (raw.facets as any)?.advanced?.p55DevelopmentalForkUniverse ?? (raw as any).p55DevelopmentalForkUniverse ?? {};
  advancedBase.p55DevelopmentalForkUniverse = {
    version: 2, generations: Number(p55Raw.generations ?? 0), simulated: Number(p55Raw.simulated ?? 0),
    promoted: Number(p55Raw.promoted ?? 0), rejected: Number(p55Raw.rejected ?? 0), replaced: Number(p55Raw.replaced ?? 0),
    unresolvedForks: Number(p55Raw.unresolvedForks ?? 0), meanDevelopmentalValue01: Number(p55Raw.meanDevelopmentalValue01 ?? .25),
    branchDiversity01: Number(p55Raw.branchDiversity01 ?? 0), futureCoverage01: Number(p55Raw.futureCoverage01 ?? 0),
    lastWinnerId: p55Raw.lastWinnerId ?? null, lastAppliedForkId:p55Raw.lastAppliedForkId??null, appliedCount:Math.max(0,Math.floor(Number(p55Raw.appliedCount??0))), calibration01:Math.max(0,Math.min(1,Number(p55Raw.calibration01??0.5))), actionBiases:{...(p55Raw.actionBiases??{})}, forks: Array.isArray(p55Raw.forks) ? p55Raw.forks.slice(-96) : [],
  };

  const p56Raw = (raw.facets as any)?.advanced?.p56IntegratedDevelopmentalMind ?? (raw as any).p56IntegratedDevelopmentalMind ?? {};
  advancedBase.p56IntegratedDevelopmentalMind = {
    version:1,
    cycles:Number(p56Raw.cycles ?? 0), assessments:Number(p56Raw.assessments ?? 0), planned:Number(p56Raw.planned ?? 0), protectedCycles:Number(p56Raw.protectedCycles ?? 0),
    meanIntegrated01:Number(p56Raw.meanIntegrated01 ?? .45), meanRealityGap01:Number(p56Raw.meanRealityGap01 ?? .5), meanStability01:Number(p56Raw.meanStability01 ?? .8),
    modeCounts:{observe:0,repair:0,consolidate:0,experiment:0,protect:0,explore:0,...(p56Raw.modeCounts ?? {})},
    lastPlan:p56Raw.lastPlan ?? null,lastAt:Number(p56Raw.lastAt ?? 0),history:Array.isArray(p56Raw.history)?p56Raw.history.slice(-96):[],
  };
  const causalExperienceRaw = (raw.facets as any)?.advanced?.causalExperience ?? (raw as any)?.causalExperience ?? {};
  advancedBase.causalExperience = { ...defaultCausalExperienceStream(), ...causalExperienceRaw, version:3, rolling:{...defaultCausalExperienceStream().rolling,...(causalExperienceRaw.rolling??{})}, records:Array.isArray(causalExperienceRaw.records)?causalExperienceRaw.records.slice(-1024).map((r:any)=>({...r,provenance:r.provenance??'runtime-outcome',stateGrounded:r.stateGrounded??true,learningQuality01:Number(r.learningQuality01??(r.stateGrounded===false?.35:.72)),replayEligible:r.replayEligible!==false,policyFeatures01:Array.isArray(r.policyFeatures01)?r.policyFeatures01.slice(0,16):undefined})):[] };
  const causalDevelopmentRaw = (raw.facets as any)?.advanced?.causalDevelopmentLoop ?? (raw as any)?.causalDevelopmentLoop ?? {};
  const causalDevelopmentDefault = defaultCausalDevelopmentLoop();
  advancedBase.causalDevelopmentLoop = { ...causalDevelopmentDefault, ...causalDevelopmentRaw, version:2,
    samples:Array.isArray(causalDevelopmentRaw.samples)?causalDevelopmentRaw.samples.slice(-192):[],
    candidates:Array.isArray(causalDevelopmentRaw.candidates)?causalDevelopmentRaw.candidates.slice(-64):[],
    behavioralSequences:Array.isArray(causalDevelopmentRaw.behavioralSequences)?causalDevelopmentRaw.behavioralSequences.slice(-64):[],
    behavioralEpisodes:Array.isArray(causalDevelopmentRaw.behavioralEpisodes)?causalDevelopmentRaw.behavioralEpisodes.slice(-24):[],
    lastBehavioralActionByTask:causalDevelopmentRaw.lastBehavioralActionByTask&&typeof causalDevelopmentRaw.lastBehavioralActionByTask==='object'?Object.fromEntries(Object.entries(causalDevelopmentRaw.lastBehavioralActionByTask).slice(-32)): {},
  };
  const unifiedLearningRaw = (raw.facets as any)?.advanced?.unifiedLearning ?? (raw as any)?.unifiedLearning ?? {};
  advancedBase.unifiedLearning = { ...defaultUnifiedLearning(), ...unifiedLearningRaw, version:2, sharedRepresentation01:Array.isArray(unifiedLearningRaw.sharedRepresentation01)?unifiedLearningRaw.sharedRepresentation01.slice(0,16):defaultUnifiedLearning().sharedRepresentation01, patterns:Array.isArray(unifiedLearningRaw.patterns)?unifiedLearningRaw.patterns.slice(-128):[], provenanceCounts:{...defaultUnifiedLearning().provenanceCounts,...(unifiedLearningRaw.provenanceCounts??{})}, transferProbes:Array.isArray(unifiedLearningRaw.transferProbes)?unifiedLearningRaw.transferProbes.slice(-96):[] };
  const cognitiveDependenciesRaw = (raw.facets as any)?.advanced?.cognitiveDependencies ?? (raw as any)?.cognitiveDependencies ?? {};
  advancedBase.cognitiveDependencies = { ...defaultCognitiveDependencyState(), ...cognitiveDependenciesRaw, domainTransitions:{...defaultCognitiveDependencyState().domainTransitions,...(cognitiveDependenciesRaw.domainTransitions??{})} };

  const p57Raw = (raw.facets as any)?.advanced?.p57RealityFirstObservatory ?? (raw as any).p57RealityFirstObservatory ?? {};
  advancedBase.p57RealityFirstObservatory = {
    version:1, observations:Number(p57Raw.observations ?? 0), anchorsAccepted:Number(p57Raw.anchorsAccepted ?? 0), anchorsRejected:Number(p57Raw.anchorsRejected ?? 0),
    meanRealityGap01:Number(p57Raw.meanRealityGap01 ?? .5), meanAnchorConfidence01:Number(p57Raw.meanAnchorConfidence01 ?? .5), trend01:Number(p57Raw.trend01 ?? 0),
    capabilityEvidence01:Number(p57Raw.capabilityEvidence01 ?? 0), complexityProxy01:Number(p57Raw.complexityProxy01 ?? 0), stability01:Number(p57Raw.stability01 ?? .8),
    lastAnchorId:p57Raw.lastAnchorId ?? null, anchors:Array.isArray(p57Raw.anchors)?p57Raw.anchors.slice(-128):[], recentOutcomes:Array.isArray(p57Raw.recentOutcomes)?p57Raw.recentOutcomes.slice(-64):[], lastAt:Number(p57Raw.lastAt ?? 0),
  };

  const p58Raw = (raw.facets as any)?.advanced?.p58CognitiveKernel ?? (raw as any).p58CognitiveKernel ?? {};
  advancedBase.p58CognitiveKernel = { ...defaultP58(), ...p58Raw, modeCounts:{...defaultP58().modeCounts,...(p58Raw.modeCounts??{})}, frames:Array.isArray(p58Raw.frames)?p58Raw.frames.slice(-96):[] };
  const memoryFabricRaw = (raw.facets as any)?.advanced?.memoryFabric ?? {};
  const retiredMutationReceiptBloomRaw = typeof memoryFabricRaw.retiredMutationReceiptBloom === 'string' ? memoryFabricRaw.retiredMutationReceiptBloom : undefined;
  const retiredMutationReceiptBloomValid = Boolean(retiredMutationReceiptBloomRaw && retiredMutationReceiptBloomRaw.length === 174764 && retiredMutationReceiptBloomRaw.endsWith('=') && !retiredMutationReceiptBloomRaw.endsWith('==') && /^[A-Za-z0-9+/]+=$/.test(retiredMutationReceiptBloomRaw));
  const retiredMutationReceiptCount = Math.max(0, Math.floor(Number(memoryFabricRaw.retiredMutationReceiptCount ?? 0)));
  const retiredMutationReceiptBloomCorrupt = memoryFabricRaw.retiredMutationReceiptBloomCorrupt === true || (Boolean(retiredMutationReceiptBloomRaw) && !retiredMutationReceiptBloomValid) || (retiredMutationReceiptCount > 0 && !retiredMutationReceiptBloomValid);
  const mutationReceiptActions = new Set(['encode','revise-status','revise-content','update-signals','update-context','forget']);
  const mutationReceiptKinds = new Set(['memory','context','boolean','void','null']);
  const mutationReceipts = Array.isArray(memoryFabricRaw.mutationReceipts)
    ? memoryFabricRaw.mutationReceipts.slice(-512).filter((row:any) => Boolean(
      row && typeof row.commandId === 'string' && row.commandId.trim() &&
      typeof row.fingerprint === 'string' && /^[a-f0-9]{64}$/i.test(row.fingerprint) &&
      mutationReceiptActions.has(row.action) && Number.isFinite(Number(row.at)) && Number(row.at) >= 0 &&
      ['applied','noop'].includes(row.outcome) && mutationReceiptKinds.has(row.resultKind)
    )).map((row:any) => ({
      commandId:String(row.commandId).trim().slice(0,128),
      fingerprint:String(row.fingerprint).slice(0,64).toLowerCase(),
      action:String(row.action),
      at:Math.max(0,Math.floor(Number(row.at))),
      outcome:row.outcome as 'applied'|'noop',
      resultKind:String(row.resultKind) as 'memory'|'context'|'boolean'|'void'|'null',
      ...(typeof row.memoryId === 'string' && row.memoryId ? {memoryId:row.memoryId.slice(0,256)} : {}),
      ...(typeof row.booleanValue === 'boolean' ? {booleanValue:row.booleanValue} : {}),
    }))
    : [];
  advancedBase.memoryFabric = {
    version:2,
    stats:{...defaultAdvancedFacet().memoryFabric.stats,...(memoryFabricRaw.stats??{})},
    hotIds:Array.isArray(memoryFabricRaw.hotIds)?memoryFabricRaw.hotIds.slice(0,96):[],
    policyOutcomeLedger:memoryFabricRaw.policyOutcomeLedger ? {
      version:1,
      registered:Math.max(0,Number(memoryFabricRaw.policyOutcomeLedger.registered??0)),
      resolved:Math.max(0,Number(memoryFabricRaw.policyOutcomeLedger.resolved??0)),
      dropped:Math.max(0,Number(memoryFabricRaw.policyOutcomeLedger.dropped??0)),
      meanDelayedReward01:Number(memoryFabricRaw.policyOutcomeLedger.meanDelayedReward01??0),
      meanCausalCredit01:Number(memoryFabricRaw.policyOutcomeLedger.meanCausalCredit01??0),
      lastOutcome:memoryFabricRaw.policyOutcomeLedger.lastOutcome ?? undefined,
      pending:Array.isArray(memoryFabricRaw.policyOutcomeLedger.pending)?memoryFabricRaw.policyOutcomeLedger.pending.slice(-128):[],
    } : undefined,
    mutationReceipts,
    ...(retiredMutationReceiptBloomValid ? { retiredMutationReceiptBloom: retiredMutationReceiptBloomRaw } : {}),
    ...(retiredMutationReceiptCount ? { retiredMutationReceiptCount } : {}),
    ...(retiredMutationReceiptBloomCorrupt ? { retiredMutationReceiptBloomCorrupt: true } : {}),
  };
  const p59Raw = (raw.facets as any)?.advanced?.p59MemoryOperatingSystem ?? (raw as any).p59MemoryOperatingSystem ?? {};
  advancedBase.p59MemoryOperatingSystem = { ...defaultP59(), ...p59Raw, history:Array.isArray(p59Raw.history)?p59Raw.history.slice(-96):[] };
  const p60Raw = (raw.facets as any)?.advanced?.p60IdentityGuardian ?? (raw as any).p60IdentityGuardian ?? {};
  advancedBase.p60IdentityGuardian = { ...defaultP60(), ...p60Raw, history:Array.isArray(p60Raw.history)?p60Raw.history.slice(-96):[] };
  const p61Raw = (raw.facets as any)?.advanced?.p61IntegratedMind ?? (raw as any).p61IntegratedMind ?? {};
  advancedBase.p61IntegratedMind = { ...defaultP61(), ...p61Raw, modeCounts:{...defaultP61().modeCounts,...(p61Raw.modeCounts??{})}, frames:Array.isArray(p61Raw.frames)?p61Raw.frames.slice(-96):[] };
  const p62Raw = (raw.facets as any)?.advanced?.p62MemoryFabric ?? (raw as any).p62MemoryFabric ?? {};
  advancedBase.p62MemoryFabric = { ...defaultP62(), ...p62Raw, history:Array.isArray(p62Raw.history)?p62Raw.history.slice(-64):[] };
  const p63Raw = (raw.facets as any)?.advanced?.p63DevelopmentalOperatingSystem ?? (raw as any).p63DevelopmentalOperatingSystem ?? {};
  advancedBase.p63DevelopmentalOperatingSystem = { ...defaultP63(), ...p63Raw, version:2, modeCounts:{...defaultP63().modeCounts,...(p63Raw.modeCounts??{})}, forcedDiversions:Number(p63Raw.forcedDiversions??0), modeStreak:Number(p63Raw.modeStreak??0), lastMode:p63Raw.lastMode??null, history:Array.isArray(p63Raw.history)?p63Raw.history.slice(-96):[] };
  const p64Raw = (raw.facets as any)?.advanced?.p64IntegratedOrganismDynamics ?? (raw as any).p64IntegratedOrganismDynamics ?? {};
  advancedBase.p64IntegratedOrganismDynamics = { ...defaultP64(), ...p64Raw, version:1, modeCounts:{...defaultP64().modeCounts,...(p64Raw.modeCounts??{})}, modeStreak:Number(p64Raw.modeStreak??0), lastMode:p64Raw.lastMode??null, history:Array.isArray(p64Raw.history)?p64Raw.history.slice(-128):[] };
  const p65Raw = (raw.facets as any)?.advanced?.p65EpistemicLedger ?? (raw as any).p65EpistemicLedger ?? {};
  advancedBase.p65EpistemicLedger = { ...defaultP65(), ...p65Raw, version:1, claimsData:Array.isArray(p65Raw.claimsData)?p65Raw.claimsData.slice(-256):[], recentIds:Array.isArray(p65Raw.recentIds)?p65Raw.recentIds.slice(-512):[] };
  const p66Raw = (raw.facets as any)?.advanced?.p66InteroceptiveHomeostasis ?? (raw as any).p66InteroceptiveHomeostasis ?? {};
  advancedBase.p66InteroceptiveHomeostasis = { ...defaultP66(), ...p66Raw, version:1, modeCounts:{...defaultP66().modeCounts,...(p66Raw.modeCounts??{})}, setpoints:{...defaultP66().setpoints,...(p66Raw.setpoints??{})}, history:Array.isArray(p66Raw.history)?p66Raw.history.slice(-128):[] };
  const p67Raw = (raw.facets as any)?.advanced?.p67AutonomousGoalGenesis ?? (raw as any).p67AutonomousGoalGenesis ?? {};
  advancedBase.p67AutonomousGoalGenesis = { ...defaultP67(), ...p67Raw, version:1, generatedIds:Array.isArray(p67Raw.generatedIds)?p67Raw.generatedIds.slice(-256):[], history:Array.isArray(p67Raw.history)?p67Raw.history.slice(-96):[] };
  const p68Raw = (raw.facets as any)?.advanced?.p68GoalEcology ?? (raw as any).p68GoalEcology ?? {};
  advancedBase.p68GoalEcology = { ...defaultP68(), ...p68Raw, version:1, history:Array.isArray(p68Raw.history)?p68Raw.history.slice(-128):[] };
  const p69Raw = (raw.facets as any)?.advanced?.p69ConstitutionalArbiter ?? (raw as any).p69ConstitutionalArbiter ?? {};
  advancedBase.p69ConstitutionalArbiter = { ...defaultP69(), ...p69Raw, version:1, modeCounts:{...defaultP69().modeCounts,...(p69Raw.modeCounts??{})}, recentActions:Array.isArray(p69Raw.recentActions)?p69Raw.recentActions.slice(0,24):[] };
  const p70Raw = (raw.facets as any)?.advanced?.p70MemoryLifecycleGovernor ?? (raw as any).p70MemoryLifecycleGovernor ?? {};
  advancedBase.p70MemoryLifecycleGovernor = { ...defaultP70(), ...p70Raw, version:1 };
  const p71Raw = (raw.facets as any)?.advanced?.p71SelfConsistency ?? (raw as any).p71SelfConsistency ?? {};
  advancedBase.p71SelfConsistency = { ...defaultP71(), ...p71Raw, version:1, history:Array.isArray(p71Raw.history)?p71Raw.history.slice(-96):[] };
  const p72Raw = (raw.facets as any)?.advanced?.p72LifeCycle ?? (raw as any).p72LifeCycle ?? {};
  advancedBase.p72LifeCycle = { ...defaultP72(), ...p72Raw, version:1, clockCounts:{...defaultP72().clockCounts,...(p72Raw.clockCounts??{})} };
  const p73Raw = (raw.facets as any)?.advanced?.p73CapabilityLedger ?? (raw as any).p73CapabilityLedger ?? {};
  advancedBase.p73CapabilityLedger = { ...defaultP73(), ...p73Raw, version:1, recent:Array.isArray(p73Raw.recent)?p73Raw.recent.slice(-128):[] };
  const p74Raw = (raw.facets as any)?.advanced?.p74IntegratedOrganismKernel ?? (raw as any).p74IntegratedOrganismKernel ?? {};
  advancedBase.p74IntegratedOrganismKernel = { ...defaultP74(), ...p74Raw, modeCounts:{...defaultP74().modeCounts,...(p74Raw.modeCounts??{})}, recentModes:Array.isArray(p74Raw.recentModes)?p74Raw.recentModes.slice(-32):[], recentActions:Array.isArray(p74Raw.recentActions)?p74Raw.recentActions.slice(-32):[], lastReasons:Array.isArray(p74Raw.lastReasons)?p74Raw.lastReasons.slice(-8):[] };
  const p75Raw = (raw.facets as any)?.advanced?.p75MemoryContinuumOS ?? (raw as any).p75MemoryContinuumOS ?? {};
  advancedBase.p75MemoryContinuumOS = { ...defaultP75(), ...p75Raw, recentModes:Array.isArray(p75Raw.recentModes)?p75Raw.recentModes.slice(-24):[] };
  const p76Raw = (raw.facets as any)?.advanced?.p76IdentityLifeOS ?? (raw as any).p76IdentityLifeOS ?? {};
  advancedBase.p76IdentityLifeOS = { ...defaultP76(), ...p76Raw, recentEvents:Array.isArray(p76Raw.recentEvents)?p76Raw.recentEvents.slice(-64):[] };
  const p77Raw = (raw.facets as any)?.advanced?.p77RealityExperimentOS ?? (raw as any).p77RealityExperimentOS ?? {};
  advancedBase.p77RealityExperimentOS = { ...defaultP77(), ...p77Raw, history:Array.isArray(p77Raw.history)?p77Raw.history.slice(-128):[] };
  const p78Raw = (raw.facets as any)?.advanced?.p78AutobiographicalSelfContinuity ?? (raw as any).p78AutobiographicalSelfContinuity ?? {};
  advancedBase.p78AutobiographicalSelfContinuity = { ...defaultP78(), ...p78Raw, chaptersData:Array.isArray(p78Raw.chaptersData)?p78Raw.chaptersData.slice(-32):[] };
  const p79Raw = (raw.facets as any)?.advanced?.p79EmbodiedSituationModel ?? (raw as any).p79EmbodiedSituationModel ?? {};
  advancedBase.p79EmbodiedSituationModel = { ...defaultP79(), ...p79Raw, history:Array.isArray(p79Raw.history)?p79Raw.history.slice(-48):[] };
  const experienceRaw = (raw.facets as any)?.advanced?.experienceContinuum ?? (raw as any).experienceContinuum ?? {};
  advancedBase.experienceContinuum = {
    ...defaultExperienceContinuum(), ...experienceRaw, version:7,
    graphNodes:Array.isArray(experienceRaw.graphNodes)?experienceRaw.graphNodes.slice(-384).map((n:any)=>({...n,stability01:Number(n.stability01??.5),replayPriority01:Number(n.replayPriority01??.5),lastReplayedAt:Number(n.lastReplayedAt??0),replayCount:Math.max(0,Number(n.replayCount??0)),activeGoalIds:Array.isArray(n.activeGoalIds)?n.activeGoalIds.slice(0,4):[]})):[],
    graphEdges:Array.isArray(experienceRaw.graphEdges)?experienceRaw.graphEdges.slice(-1024):[],
    clusters:Array.isArray(experienceRaw.clusters)?experienceRaw.clusters.slice(-96).map((c:any)=>({...c,replayCount:Number(c.replayCount??0),lastReplayAt:Number(c.lastReplayAt??0)})):[],
    identityGravity:{...defaultExperienceContinuum().identityGravity,...(experienceRaw.identityGravity??{})},
    identityGravityHistory:Array.isArray(experienceRaw.identityGravityHistory)?experienceRaw.identityGravityHistory.slice(-32):[],
    integrity:{...defaultExperienceContinuum().integrity,...(experienceRaw.integrity??{}),lastFlags:Array.isArray(experienceRaw.integrity?.lastFlags)?experienceRaw.integrity.lastFlags.slice(0,12):[]},
    compression:{...defaultExperienceContinuum().compression,...(experienceRaw.compression??{})},
    replay:{...defaultExperienceContinuum().replay,...(experienceRaw.replay??{}),events:Array.isArray(experienceRaw.replay?.events)?experienceRaw.replay.events.slice(-128):[],validations:Array.isArray(experienceRaw.replay?.validations)?experienceRaw.replay.validations.slice(-96):[],experiments:Array.isArray(experienceRaw.replay?.experiments)?experienceRaw.replay.experiments.slice(-128):[],protocols:Array.isArray(experienceRaw.replay?.protocols)?experienceRaw.replay.protocols.slice(-24):[],longitudinal:Array.isArray((experienceRaw.replay as any)?.longitudinal)?(experienceRaw.replay as any).longitudinal.slice(-192):[]}
    ,retention:{...defaultExperienceContinuum().retention,...(experienceRaw.retention??{}),curve:{...defaultExperienceContinuum().retention.curve,...(experienceRaw.retention?.curve??{})}}
    ,memorySkillBindings:Array.isArray(experienceRaw.memorySkillBindings)?experienceRaw.memorySkillBindings.slice(-96):[]
    ,adaptiveReplayGovernor:{...defaultExperienceContinuum().adaptiveReplayGovernor,...(experienceRaw.adaptiveReplayGovernor??{})
      ,policyWeights:{...defaultExperienceContinuum().adaptiveReplayGovernor.policyWeights,...(experienceRaw.adaptiveReplayGovernor?.policyWeights??{})}
      ,laneCounts:{...defaultExperienceContinuum().adaptiveReplayGovernor.laneCounts,...(experienceRaw.adaptiveReplayGovernor?.laneCounts??{})}
      ,recent:Array.isArray(experienceRaw.adaptiveReplayGovernor?.recent)?experienceRaw.adaptiveReplayGovernor.recent.slice(-96):[]
    }
    ,causalReplayCredit:{...defaultExperienceContinuum().causalReplayCredit,...(experienceRaw.causalReplayCredit??{})
      ,recent:Array.isArray(experienceRaw.causalReplayCredit?.recent)?experienceRaw.causalReplayCredit.recent.slice(-128):[]
    }
  };

  const batteryRaw = (raw.facets as any)?.advanced?.cognitiveResearchBattery ?? (raw as any).cognitiveResearchBattery ?? {};
  const batteryD = defaultCognitiveResearchBattery();
  advancedBase.cognitiveResearchBattery = { ...batteryD, ...batteryRaw, version:3, protocols:Array.isArray(batteryRaw.protocols)?batteryRaw.protocols.slice(-32):[], sessions:Array.isArray(batteryRaw.sessions)?batteryRaw.sessions.slice(-24):[], schedules:Array.isArray(batteryRaw.schedules)?batteryRaw.schedules.slice(-1024):[], checkpoints:Array.isArray(batteryRaw.checkpoints)?batteryRaw.checkpoints.slice(-384):[], trials:Array.isArray(batteryRaw.trials)?batteryRaw.trials.slice(-1024):[], analyses:Array.isArray(batteryRaw.analyses)?batteryRaw.analyses.slice(-96):[], counters:{...batteryD.counters,...(batteryRaw.counters??{})} };
  const embAny:any = (raw.facets as any)?.embodiment ?? {};
  const learnAny:any = (raw.facets as any)?.learning ?? {};
  const p42Raw = embAny.p42Experience ?? raw.p42?.experience ?? {};
  const p43Raw = embAny.p43Imagery ?? raw.p43?.imagery ?? {};
  const p44Raw = learnAny.p44PredictiveWorld ?? raw.p44?.predictiveWorld ?? {};
  const p42D = defaultP42(); const p42R = embAny.p42Experience ?? raw.p42?.experience ?? {};
  const p42State = { ...p42D, ...p42R, current:{...p42D.current,...(p42R.current??{}),vector:Array.isArray(p42R.current?.vector)?p42R.current.vector.slice(0,24):p42D.current.vector}, history:Array.isArray(p42R.history)?p42R.history.slice(-96):[], actionBias:{...p42D.actionBias,...(p42R.actionBias??{})}, metrics:{...p42D.metrics,...(p42R.metrics??{})} };
  const p43D = defaultP43(); const p43R = embAny.p43Imagery ?? raw.p43?.imagery ?? {};
  const p43State = { ...p43D, ...p43R, scene:{...p43D.scene,...(p43R.scene??{}),objects:Array.isArray(p43R.scene?.objects)?p43R.scene.objects.slice(0,64):p43D.scene.objects,relations:Array.isArray(p43R.scene?.relations)?p43R.scene.relations.slice(0,64):p43D.scene.relations}, activeContents:Array.isArray(p43R.activeContents)?p43R.activeContents.slice(-96):[], imagined:Array.isArray(p43R.imagined)?p43R.imagined.slice(-64):[], actionBias:{...p43D.actionBias,...(p43R.actionBias??{})}, metrics:{...p43D.metrics,...(p43R.metrics??{})} };
  const p44D = defaultP44(); const p44R = learnAny.p44PredictiveWorld ?? raw.p44?.predictiveWorld ?? {};
  const p44State = { ...p44D, ...p44R, lastPrediction:Array.isArray(p44R.lastPrediction)?p44R.lastPrediction.slice(0,24):p44D.lastPrediction, lastActual:Array.isArray(p44R.lastActual)?p44R.lastActual.slice(0,24):p44D.lastActual, rollouts:Array.isArray(p44R.rollouts)?p44R.rollouts.slice(-64):[], actionBias:{...p44D.actionBias,...(p44R.actionBias??{})}, weights:Array.isArray(p44R.weights)?p44R.weights.slice(0,7).map((r:any)=>Array.isArray(r)?r.slice(0,24):Array(24).fill(0)):p44D.weights, bias:Array.isArray(p44R.bias)?p44R.bias.slice(0,24):p44D.bias, metrics:{...p44D.metrics,...(p44R.metrics??{})} };

  const worldModel = raw.worldModel ?? {
    belief:null,
    transitions:Array.isArray(raw.worldTransitions) ? raw.worldTransitions.map((t:any)=>({action:t.action,before:t.before,after:t.after,reward:Number(t.reward??0.5),surprise:Number(t.surprise??0),at:Number(t.at??Date.now())})) : [],
  };

  const firewallRaw:any = raw.system?.evidenceFirewall ?? {};
  const researchRaw:any = raw.system?.projectResearchSession ?? {};
  const evidenceFirewallState = {
    version:1,
    observations:Array.isArray(firewallRaw.observations)?firewallRaw.observations.slice(-512).map((o:any)=>({
      id:String(o?.id??'').slice(0,80),claimKey:String(o?.claimKey??'').slice(0,180),
      sourceClass:['os','device','user','external-api','world','organism','simulator','unknown'].includes(String(o?.sourceClass))?String(o.sourceClass):'unknown',
      sourceKey:String(o?.sourceKey??'unknown').trim().toLowerCase().slice(0,120),documentKey:String(o?.documentKey??'').trim().slice(0,1000)||undefined,
      contentHash:String(o?.contentHash??'').trim().toLowerCase().slice(0,96)||undefined,
      confidence01:Math.max(0,Math.min(1,Number(o?.confidence01??.5)||0)),trust01:Math.max(0,Math.min(1,Number(o?.trust01??.5)||0)),
      contradiction01:Math.max(0,Math.min(1,Number(o?.contradiction01??0)||0)),observedAt:Math.max(0,Number(o?.observedAt??0)||0),
    })):[],
    claims:Array.isArray(firewallRaw.claims)?firewallRaw.claims.slice(-256).map((c:any)=>({
      ...c,
      promotionReceipt:c?.promotionReceipt?{
        policyVersion:'firewall-v1',
        promotedAt:Number(c.promotionReceipt.promotedAt??0),
        independentSources:Array.isArray(c.promotionReceipt.independentSources)?c.promotionReceipt.independentSources.slice(0,16):[],
        contentHashes:Array.isArray(c.promotionReceipt.contentHashes)?c.promotionReceipt.contentHashes.slice(0,32):[],
        score01:Number(c.promotionReceipt.score01??c.promotionScore01??0),
      }:undefined,
    })):[],
    promotedCount:Number(firewallRaw.promotedCount??0),
    rejectedCount:Number(firewallRaw.rejectedCount??0),
    expiredCount:Number(firewallRaw.expiredCount??0),
    lastAt:Number(firewallRaw.lastAt??0),
  };
  const researchResults = (Array.isArray(researchRaw.results) ? researchRaw.results.slice(-24) : []).map((r:any) => ({
    url:String(r?.url??'').slice(0,1000),
    sourceKey:String(r?.sourceKey??'unknown').trim().toLowerCase().slice(0,120),
    sourceHost:String(r?.sourceHost??'').trim().toLowerCase().slice(0,255),
    documentKey:(()=>{try{const u=new URL(String(r?.url??''));return `${u.protocol}//${u.host}${u.pathname}`.slice(0,1000);}catch{return String(r?.documentKey??'').slice(0,1000);}})(),
    contentHash:String(r?.contentHash??'').trim().toLowerCase().slice(0,96),
    title:String(r?.title??'').replace(/\s+/g,' ').trim().slice(0,240),
    snippet:String(r?.snippet??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,1200),
    contentType:String(r?.contentType??'').slice(0,120),
    trust01:Math.max(0,Math.min(1,Number(r?.trust01??0)||0)),
    relevance01:Math.max(0,Math.min(1,Number(r?.relevance01??0)||0)),
    queryHash:String(r?.queryHash??'').trim().toLowerCase().slice(0,96),
    fetchedAt:Math.max(0,Number(r?.fetchedAt??0)||0),
    ok:Boolean(r?.ok),
  }));
  const migratedFirewallStatus = ['quarantine','promoted','contested','rejected','expired'].includes(String(researchRaw.firewallStatus))
    ? String(researchRaw.firewallStatus)
    : (Boolean(researchRaw.promoted) ? 'promoted' : 'quarantine');
  const projectResearchSessionState = {
    version:1,
    projectId:researchRaw.projectId??null,
    claimKey:String(researchRaw.claimKey??'').slice(0,180),
    results:researchResults,
    independentSources:Math.max(0,Math.floor(Number(researchRaw.independentSources??0)||0)),
    promoted:migratedFirewallStatus==='promoted' && Boolean(researchRaw.promoted),
    firewallStatus:migratedFirewallStatus,
    promotionScore01:Math.max(0,Math.min(1,Number(researchRaw.promotionScore01??0)||0)),
    uniqueContentHashes:new Set(researchResults.map((r:any)=>r.contentHash).filter(Boolean)).size,
    distinctSourceKeys:new Set(researchResults.map((r:any)=>r.sourceKey).filter(Boolean)).size,
    duplicateContentCount:Math.max(0,Math.floor(Number(researchRaw.duplicateContentCount??0)||0)),
    lastAt:Math.max(0,Number(researchRaw.lastAt??0)||0),
  };

  const advancedRaw = (raw as any).facets?.advanced ?? {};
  const p83Raw = advancedRaw.p83PersistentRealityModel;
  const p83Persisted = p83Raw ? {
    ...p83Raw, version:1,
    beliefs:Array.isArray(p83Raw.beliefs)?p83Raw.beliefs.slice(-96):[],
    continuity:Array.isArray(p83Raw.continuity)?p83Raw.continuity.slice(-64):[],
  } : advancedBase.p83PersistentRealityModel;
  const p84Raw = advancedRaw.p84AutobiographicalContinuity;
  const p84Persisted = p84Raw ? {
    ...defaultP84(), ...p84Raw, version:5,
    moments:Array.isArray(p84Raw.moments)?p84Raw.moments.slice(-96).map((m:any)=>({...m,identityDelta01:Number(m.identityDelta01??0),memoryBinding01:Number(m.memoryBinding01??0),realityDelta01:Number(m.realityDelta01??0),learningSignal01:Number(m.learningSignal01??0),identityChangeReasons:Array.isArray(m.identityChangeReasons)?m.identityChangeReasons.slice(0,8):[],sourceEventIds:Array.isArray(m.sourceEventIds)?m.sourceEventIds.slice(-12):[],beliefIds:Array.isArray(m.beliefIds)?m.beliefIds.slice(-12):[],personIds:Array.isArray(m.personIds)?m.personIds.slice(-8):[],evidenceQuality01:Number(m.evidenceQuality01??0),counterEvidence01:Number(m.counterEvidence01??0),boundary01:Number(m.boundary01??0)})):[],
    identityChangeCount:Number(p84Raw.identityChangeCount??0), selfChangeLoad01:Number(p84Raw.selfChangeLoad01??0), memoryBinding01:Number(p84Raw.memoryBinding01??0), beliefContinuity01:Number(p84Raw.beliefContinuity01??0.55), socialBinding01:Number(p84Raw.socialBinding01??0.5),
    actionOutcomeProfiles:Object.fromEntries(Object.entries(p84Raw.actionOutcomeProfiles??{}).slice(-16).map(([k,v]:any)=>[String(k).trim().slice(0,64),{samples:Math.max(0,Math.floor(Number(v?.samples??0))),verifiedSamples:Math.max(0,Math.floor(Number(v?.verifiedSamples??0))),success01:Math.max(0,Math.min(1,Number(v?.success01??.5))),confidence01:Math.max(0,Math.min(1,Number(v?.confidence01??0))),lastAt:Number(v?.lastAt??0),lastEvidence01:Math.max(0,Math.min(1,Number(v?.lastEvidence01??0)))}])),
    contextualOutcomeProfiles:Object.fromEntries(Object.entries(p84Raw.contextualOutcomeProfiles??{}).slice(-64).map(([k,v]:any)=>[String(k).trim().slice(0,96),{samples:Math.max(0,Math.floor(Number(v?.samples??0))),verifiedSamples:Math.max(0,Math.floor(Number(v?.verifiedSamples??0))),success01:Math.max(0,Math.min(1,Number(v?.success01??.5))),confidence01:Math.max(0,Math.min(1,Number(v?.confidence01??0))),lastAt:Number(v?.lastAt??0),lastEvidence01:Math.max(0,Math.min(1,Number(v?.lastEvidence01??0)))}])),
    carryoverRevision:Math.max(0,Math.floor(Number(p84Raw.carryoverRevision??0))),
  } : defaultP84();

  return {
    schemaVersion:RELEASE_CONTRACT.stateSchema,
    state:normalizeState(raw.state),
    goals:Array.isArray(raw.goals)?raw.goals.slice(0,24):[],
    traces:Array.isArray(raw.traces)?raw.traces.slice(0,320):[],
    memories:Array.isArray(raw.memories)?raw.memories.slice(0,600):[],
    worldModel,
    facets:{memory,embodiment:{...embodiment,p42Experience:p42State,p43Imagery:p43State},learning:{...learning,p44PredictiveWorld:p44State},consciousness,evolution:evolutionBase,cognition:cognitionBase,advanced:{...advancedBase,p83PersistentRealityModel:p83Persisted,p84AutobiographicalContinuity:p84Persisted}},
    system:{
      release:RELEASE_CONTRACT.application,
      organismCore:RELEASE_CONTRACT.organismCore,
      schemaVersion:RELEASE_CONTRACT.stateSchema,
      capabilities:raw.system?.capabilities ?? {version:1,features:[],refreshedAt:0},
      integrity:raw.system?.integrity ?? {ok:true,violations:[],warnings:[{code:'migrated-state',path:'system',message:`Migrated from schema ${source} to schema ${RELEASE_CONTRACT.stateSchema}`,severity:'warning'}],checkedAt:Date.now()},
      lastStateHash:String(raw.system?.lastStateHash ?? ''),
      replaySignature:String(raw.system?.replaySignature ?? ''),
      lastReplayAt:Number(raw.system?.lastReplayAt ?? 0),
      actionExecutionLedger: raw.system?.actionExecutionLedger && Array.isArray(raw.system.actionExecutionLedger.records)
        ? { version:1, records:raw.system.actionExecutionLedger.records.slice(-128), ...(raw.system.actionExecutionLedger.permissions && typeof raw.system.actionExecutionLedger.permissions==='object' ? { permissions:raw.system.actionExecutionLedger.permissions } : {}) }
        : { version:1, records:[] },
      subjectIdentity: ensureSubjectIdentity({ subjectIdentity: raw.system?.subjectIdentity } as any),
      evolution:raw.system?.evolution ?? {version:1,stage:'emergence',intrinsicProjectCycles:0,selfAuthoredActions:0,valueRevisionCycles:0,identitySamples:0,replaySignature:'',lastReplayAt:0},
      advancedProjectionSchedule: raw.system?.advancedProjectionSchedule,
      advancedProjectionScheduleMetrics: raw.system?.advancedProjectionScheduleMetrics,
      temporalResolution: raw.system?.temporalResolution,
      recoveryWatchdog: raw.system?.recoveryWatchdog,
      revisionGraph: raw.system?.revisionGraph,
      revisionTokens: raw.system?.revisionTokens,
      runtimeEvidence: raw.system?.runtimeEvidence,
      externalEvidenceTrust: raw.system?.externalEvidenceTrust,
      externalObserver: raw.system?.externalObserver ? {
        version:2,
        observations:Array.isArray(raw.system.externalObserver.observations)?raw.system.externalObserver.observations.slice(-256):[],
        assessments:Array.isArray(raw.system.externalObserver.assessments)?raw.system.externalObserver.assessments.slice(-192):[],
        sources:Array.isArray(raw.system.externalObserver.sources)?raw.system.externalObserver.sources.slice(-48):[],
        linkedActions:Array.isArray(raw.system.externalObserver.linkedActions)?raw.system.externalObserver.linkedActions.slice(-128):[],
        reconciliations:Number(raw.system.externalObserver.reconciliations??0), corroboratedClaims:Number(raw.system.externalObserver.corroboratedClaims??0),
        totalObservations:Number(raw.system.externalObserver.totalObservations??0), totalAssessments:Number(raw.system.externalObserver.totalAssessments??0),
        verifiedCount:Number(raw.system.externalObserver.verifiedCount??0), contradictedCount:Number(raw.system.externalObserver.contradictedCount??0), unknownCount:Number(raw.system.externalObserver.unknownCount??0),
        meanObservationConfidence01:Number(raw.system.externalObserver.meanObservationConfidence01??0), lastAt:Number(raw.system.externalObserver.lastAt??0),
      } : undefined,
      selfPredictionBenchmark: raw.system?.selfPredictionBenchmark,
      modelOlympics: raw.system?.modelOlympics,
      predictionLedger: raw.system?.predictionLedger,
      predictionDebt: raw.system?.predictionDebt,
      cognitiveQuorum: raw.system?.cognitiveQuorum,
      shadowOrganism: raw.system?.shadowOrganism,
      identityCausality: raw.system?.identityCausality,
      longHorizonPrediction: raw.system?.longHorizonPrediction,
      autonomousProjectExecutor: raw.system?.autonomousProjectExecutor,
      cognitiveSpineSchedule: raw.system?.cognitiveSpineSchedule,
      skillAcquisitionBenchmark: raw.system?.skillAcquisitionBenchmark,
      evidenceFirewall: evidenceFirewallState,
      projectResearchSession: projectResearchSessionState,
      outcomeVerification: {
        version:1,
        records:Array.isArray(raw.system?.outcomeVerification?.records)?raw.system.outcomeVerification.records.slice(0,96).map((r:any)=>({
          at:Number(r?.at??0), tick:Number(r?.tick??0), tool:String(r?.tool??''), ok:Boolean(r?.ok), verified:Boolean(r?.verified),
          basis:r?.basis==='external-postcondition'||r?.basis==='tool-contract'?'external-postcondition'===r?.basis?'external-postcondition':'tool-contract':'none',
          confidence01:Number(r?.confidence01??0), observationId:r?.observationId==null?undefined:String(r.observationId), externalObservation:Boolean(r?.externalObservation),
          expectedPostcondition:r?.expectedPostcondition==null?undefined:String(r.expectedPostcondition), observedPostcondition:r?.observedPostcondition==null?undefined:String(r.observedPostcondition), executionId:r?.executionId==null?undefined:String(r.executionId),
          externalObservations:Array.isArray(r?.externalObservations)?r.externalObservations.slice(-8).filter((o:any)=>o&&typeof o.observationId==='string'&&o.observationId.trim()&&typeof o.verified==='boolean'&&Number.isFinite(Number(o.confidence01))&&Number.isFinite(Number(o.at))).map((o:any)=>({observationId:String(o.observationId).slice(0,180),verified:o.verified,confidence01:Math.max(0,Math.min(1,Number(o.confidence01))),expectedPostcondition:o.expectedPostcondition==null?undefined:String(o.expectedPostcondition).slice(0,1024),observedPostcondition:o.observedPostcondition==null?undefined:String(o.observedPostcondition).slice(0,1024),at:Math.max(0,Math.floor(Number(o.at))),reason:o.reason==null?undefined:String(o.reason).slice(0,160),assessment:['match','mismatch','unknown'].includes(o.assessment)?o.assessment:'unknown',sourceId:o.sourceId==null?undefined:String(o.sourceId).slice(0,180),sourceClass:['os','device','user','external-api','world','organism','simulator','unknown'].includes(o.sourceClass)?o.sourceClass:undefined,independenceKey:o.independenceKey==null?undefined:String(o.independenceKey).slice(0,120)})):[],
          externalEvidenceStatus:['none','corroborated','contradicted','mixed'].includes(r?.externalEvidenceStatus)?r.externalEvidenceStatus:'none',
          observedWorldContextAfter:r?.observedWorldContextAfter && typeof r.observedWorldContextAfter==='object'?r.observedWorldContextAfter:undefined,
        })):[],
        projectionIndex:Array.isArray(raw.system?.outcomeVerification?.projectionIndex)?raw.system.outcomeVerification.projectionIndex.slice(-2048).filter((entry:any)=>entry&&typeof entry.executionId==='string'&&entry.executionId.trim()&&entry.executionId.length<=180&&/^[a-f0-9]{64}$/i.test(String(entry.fingerprint??''))&&entry.record&&typeof entry.record==='object'&&typeof entry.record.tool==='string'&&entry.record.tool.length<=180).map((entry:any)=>({
          executionId:String(entry.executionId).trim(),fingerprint:String(entry.fingerprint).toLowerCase(),verifiedExternal:Boolean(entry.verifiedExternal),record:{
            at:Math.max(0,Number(entry.record.at??0)),tick:Math.max(0,Number(entry.record.tick??0)),tool:String(entry.record.tool).slice(0,180),ok:Boolean(entry.record.ok),verified:Boolean(entry.record.verified),
            basis:entry.record.basis==='external-postcondition'?'external-postcondition':entry.record.basis==='tool-contract'?'tool-contract':'none',confidence01:Math.max(0,Math.min(1,Number(entry.record.confidence01??0))),
            observationId:entry.record.observationId==null?undefined:String(entry.record.observationId).slice(0,180),externalObservation:Boolean(entry.record.externalObservation),
            expectedPostcondition:entry.record.expectedPostcondition==null?undefined:String(entry.record.expectedPostcondition).slice(0,1024),observedPostcondition:entry.record.observedPostcondition==null?undefined:String(entry.record.observedPostcondition).slice(0,1024),
            executionId:entry.record.executionId==null?undefined:String(entry.record.executionId).slice(0,180),predictionId:entry.record.predictionId==null?undefined:String(entry.record.predictionId).slice(0,180),outcomeClass:typeof entry.record.outcomeClass==='string'?entry.record.outcomeClass:undefined,
            externalObservations:Array.isArray(entry.record.externalObservations)?entry.record.externalObservations.slice(-8).filter((o:any)=>o&&typeof o.observationId==='string'&&o.observationId.trim()).map((o:any)=>({observationId:String(o.observationId).slice(0,180),verified:Boolean(o.verified),confidence01:Math.max(0,Math.min(1,Number(o.confidence01??0))),expectedPostcondition:o.expectedPostcondition==null?undefined:String(o.expectedPostcondition).slice(0,1024),observedPostcondition:o.observedPostcondition==null?undefined:String(o.observedPostcondition).slice(0,1024),at:Math.max(0,Number(o.at??0)),reason:o.reason==null?undefined:String(o.reason).slice(0,160),assessment:['match','mismatch','unknown'].includes(o.assessment)?o.assessment:'unknown',sourceId:o.sourceId==null?undefined:String(o.sourceId).slice(0,180),sourceClass:['os','device','user','external-api','world','organism','simulator','unknown'].includes(o.sourceClass)?o.sourceClass:undefined,independenceKey:o.independenceKey==null?undefined:String(o.independenceKey).slice(0,120)})):[],
            externalEvidenceStatus:['none','corroborated','contradicted','mixed'].includes(entry.record.externalEvidenceStatus)?entry.record.externalEvidenceStatus:'none',
          },
        })):[],
        evidenceRevisions:Array.isArray(raw.system?.outcomeVerification?.evidenceRevisions)?raw.system.outcomeVerification.evidenceRevisions.slice(-2048).filter((r:any)=>r&&typeof r.revisionId==='string'&&r.revisionId.trim()&&r.revisionId.length<=180&&typeof r.executionId==='string'&&r.executionId.trim()&&r.executionId.length<=180&&typeof r.tool==='string'&&r.tool.length>0&&r.tool.length<=180&&Number.isInteger(r.revisionNumber)&&r.revisionNumber>0&&r.source==='authoritative-provider-receipt'&&/^[a-f0-9]{64}$/i.test(String(r.providerReceiptHash??''))&&/^[a-f0-9]{64}$/i.test(String(r.baseFingerprint??''))&&/^[a-f0-9]{64}$/i.test(String(r.revisionFingerprint??''))&&Number.isFinite(Number(r.at))&&Number.isFinite(Number(r.tick))&&typeof r.ok==='boolean'&&typeof r.verified==='boolean'&&['none','tool-contract','external-postcondition'].includes(r.basis)&&Number.isFinite(Number(r.confidence01))&&['verified','contradicted','unverified'].includes(r.status)&&typeof r.outcomeClass==='string').map((r:any)=>({revisionId:String(r.revisionId).slice(0,180),executionId:String(r.executionId).slice(0,180),tool:String(r.tool).slice(0,180),revisionNumber:Math.max(1,Math.floor(Number(r.revisionNumber))),source:'authoritative-provider-receipt',providerReceiptHash:String(r.providerReceiptHash).toLowerCase(),baseFingerprint:String(r.baseFingerprint).toLowerCase(),revisionFingerprint:String(r.revisionFingerprint).toLowerCase(),supersedesRevisionId:r.supersedesRevisionId==null?undefined:String(r.supersedesRevisionId).slice(0,180),at:Math.max(0,Number(r.at)),tick:Math.max(0,Math.floor(Number(r.tick))),ok:Boolean(r.ok),verified:Boolean(r.verified),outcomeClass:String(r.outcomeClass).slice(0,64),basis:r.basis,confidence01:Math.max(0,Math.min(1,Number(r.confidence01))),observationId:r.observationId==null?undefined:String(r.observationId).slice(0,180),status:r.status})):[],
      },
      causalAccountability: {
        version:1,
        nodes:Array.isArray(raw.system?.causalAccountability?.nodes)?raw.system.causalAccountability.nodes.slice(-192):[],
        edges:Array.isArray(raw.system?.causalAccountability?.edges)?raw.system.causalAccountability.edges.slice(-384):[],
        activeChains:Array.isArray(raw.system?.causalAccountability?.activeChains)?raw.system.causalAccountability.activeChains.slice(0,32):[],
        lastAt:Number(raw.system?.causalAccountability?.lastAt??0),
        updatedAt:Number(raw.system?.causalAccountability?.updatedAt??raw.system?.causalAccountability?.lastAt??0),
        outcomeIndex:Array.isArray(raw.system?.causalAccountability?.outcomeIndex)?raw.system.causalAccountability.outcomeIndex.slice(-1024).filter((row:any)=>row&&typeof row.executionId==='string'&&row.executionId.trim()&&row.executionId.length<=180&&typeof row.outcomeId==='string'&&row.outcomeId.trim()&&typeof row.tool==='string'&&row.tool.length<=180&&Number.isFinite(Number(row.tick))&&Number.isFinite(Number(row.at))&&typeof row.ok==='boolean').map((row:any)=>({executionId:String(row.executionId).slice(0,180),outcomeId:String(row.outcomeId).slice(0,180),tool:String(row.tool).slice(0,180),tick:Math.max(0,Number(row.tick)),at:Math.max(0,Number(row.at)),ok:Boolean(row.ok),expectedPostcondition:row.expectedPostcondition==null?undefined:String(row.expectedPostcondition).slice(0,1024),observedPostcondition:row.observedPostcondition==null?undefined:String(row.observedPostcondition).slice(0,1024),observationId:row.observationId==null?undefined:String(row.observationId).slice(0,180),confidence01:Math.max(0,Math.min(1,Number(row.confidence01??0)))})):[],
      },
      resourceAllocation: raw.system?.resourceAllocation ?? undefined,
      unifiedCognitiveSubstrate: raw.system?.unifiedCognitiveSubstrate ?? undefined,
      canonicalNeuralSubstrate: raw.system?.canonicalNeuralSubstrate ?? undefined,
      neuralSubstrateBackend: raw.system?.neuralSubstrateBackend ?? undefined,
      recurrentCausalMemory: raw.system?.recurrentCausalMemory ?? undefined,
      unifiedWorldModelB261: raw.system?.unifiedWorldModelB261 ?? undefined,
      multiTimescaleWorldModelB262: raw.system?.multiTimescaleWorldModelB262 ?? undefined,
      realActionCausalityB263: raw.system?.realActionCausalityB263 ?? undefined,
      causalPolicyLearningB264: raw.system?.causalPolicyLearningB264 ?? undefined,
      independentPolicyEvaluatorB265: raw.system?.independentPolicyEvaluatorB265 ?? undefined,
      hiddenTaskGeneralizationB266: raw.system?.hiddenTaskGeneralizationB266 ?? undefined,
      adaptiveRegimeControllerB267: raw.system?.adaptiveRegimeControllerB267 ?? undefined,
      causalSelfExperimentLabB268: raw.system?.causalSelfExperimentLabB268 ?? undefined,
      spikingPlasticNeuralB269: raw.system?.spikingPlasticNeuralB269 ?? undefined,
      unifiedNeuroCausalCoreB365: raw.system?.unifiedNeuroCausalCoreB365 ?? undefined,
      // P2716: the canonical neural experience branch is part of durable runtime state.
      // Without this explicit migration mapping, restart would silently fall back to a
      // fresh branch even though the pre-restart organism had already learned in place.
      neuralExperienceBranch: raw.system?.neuralExperienceBranch ?? undefined,
      b385B390AutonomousDevelopmentalOrganism: raw.system?.b385B390AutonomousDevelopmentalOrganism ?? undefined,
      b391B400NeuralDevelopmentalIntegration: raw.system?.b391B400NeuralDevelopmentalIntegration ?? undefined,
      b401B420AdaptiveCognitiveResearch: raw.system?.b401B420AdaptiveCognitiveResearch ?? undefined,
      b421B450ResearchAcceleration: raw.system?.b421B450ResearchAcceleration ?? undefined,
      b451B500MetaCognitiveDevelopment: raw.system?.b451B500MetaCognitiveDevelopment ?? undefined,
      b501B560HierarchicalMetaMemory: raw.system?.b501B560HierarchicalMetaMemory ?? undefined,
      b561B620MetaCognitiveEvolution: raw.system?.b561B620MetaCognitiveEvolution ?? undefined,
      b621B720UnifiedAdaptiveMind: raw.system?.b621B720UnifiedAdaptiveMind ?? undefined,
      b721B900DevelopmentalLearning: raw.system?.b721B900DevelopmentalLearning ?? undefined,
      b901B1100CausalDevelopmentalMetaLearner: raw.system?.b901B1100CausalDevelopmentalMetaLearner ?? undefined,
      b1101B1350SelfDevelopment: raw.system?.b1101B1350SelfDevelopment ?? undefined,
      b1351B1600LifelongDevelopment: raw.system?.b1351B1600LifelongDevelopment ?? undefined,
      persistentContinuityKernel: raw.system?.persistentContinuityKernel ?? undefined,
      b1701B2200UnifiedLifeContinuity: raw.system?.b1701B2200UnifiedLifeContinuity ?? undefined,
      b2201B2500LifeCourseSelfModel: raw.system?.b2201B2500LifeCourseSelfModel ?? undefined,
      b2525LearnedLatentTransitionField: raw.system?.b2525LearnedLatentTransitionField ?? defaultB2525State(),
      neuralGerminalOrganismB270: raw.system?.neuralGerminalOrganismB270 ?? undefined,
      neuralAutobiographicalCoreB271: raw.system?.neuralAutobiographicalCoreB271 ?? undefined,
      endogenousGoalGenesisB272: raw.system?.endogenousGoalGenesisB272 ?? undefined,
      autonomousGoalLifecycleB273: raw.system?.autonomousGoalLifecycleB273 ?? undefined,
      autonomousSkillLaboratoryB274: raw.system?.autonomousSkillLaboratoryB274 ?? undefined,
      neuralCompositionalPolicyB275: raw.system?.neuralCompositionalPolicyB275 ?? undefined,
      latentActionProgramSynthesizerB276: raw.system?.latentActionProgramSynthesizerB276 ?? undefined,
      neuralOperatorGenesisB277: raw.system?.neuralOperatorGenesisB277 ?? defaultB277State(),
      neuralPrimitiveGenesisB278: raw.system?.neuralPrimitiveGenesisB278 ?? defaultB278State(),
      neuralAttractorAssembliesB279: raw.system?.neuralAttractorAssembliesB279 ?? defaultB279State(),
      multiAreaNeuralCircuitB280: raw.system?.multiAreaNeuralCircuitB280 ?? defaultB280State(),
      predictiveInterAreaMessagingB281: raw.system?.predictiveInterAreaMessagingB281 ?? defaultB281State(),
      predictiveGlobalWorkspaceB282: raw.system?.predictiveGlobalWorkspaceB282 ?? defaultB282State(),
      competingPredictiveHypothesesB283: raw.system?.competingPredictiveHypothesesB283 ?? defaultB283State(),
      neuralAutobiographicalIdentityB284: raw.system?.neuralAutobiographicalIdentityB284 ?? defaultB284State(),
      neuralLifeConsolidationB285: raw.system?.neuralLifeConsolidationB285 ?? defaultB285State(),
      selfConflictContinuityB286: raw.system?.selfConflictContinuityB286 ?? defaultB286State(),
      relationshipValueDevelopmentB287: raw.system?.relationshipValueDevelopmentB287 ?? defaultB287State(),
      socialPredictiveSelfOtherB288: raw.system?.socialPredictiveSelfOtherB288 ?? defaultB288State(),
      neuralOrganismIntegrationB289: raw.system?.neuralOrganismIntegrationB289 ?? undefined,
      realityGatedNeurodevelopmentB290: raw.system?.realityGatedNeurodevelopmentB290 ?? undefined,
      unifiedSelfAgencyPersonalityB291: raw.system?.unifiedSelfAgencyPersonalityB291 ?? undefined,
      cognitiveStateBusB292: raw.system?.cognitiveStateBusB292 ?? undefined,
      intentTraceB292: raw.system?.intentTraceB292 ?? undefined,
      selfWorldPredictiveMicrocircuitB293: raw.system?.selfWorldPredictiveMicrocircuitB293 ?? undefined,
      causalNeuralEventSpineB294: raw.system?.causalNeuralEventSpineB294 ?? undefined,
      adaptiveCognitiveBudgetB295: raw.system?.adaptiveCognitiveBudgetB295 ?? undefined,
      adaptiveMemoryStrategyReadout: raw.system?.adaptiveMemoryStrategyReadout ?? undefined,
      neuralPersonalityAgencyNucleusB296: raw.system?.neuralPersonalityAgencyNucleusB296 ?? undefined,
      neuralMemoryContinuityP2843: raw.system?.neuralMemoryContinuityP2843 ?? undefined,
      neuralPlasticityBenchmarkP2844: raw.system?.neuralPlasticityBenchmarkP2844 ?? undefined,
      executiveNeuralFusionB297: raw.system?.executiveNeuralFusionB297 ? {
        ...raw.system.executiveNeuralFusionB297,
        consolidationEvents:Math.max(0,Math.floor(Number((raw.system.executiveNeuralFusionB297 as any).consolidationEvents??0))),
        lastEffectiveWeights:{...((raw.system.executiveNeuralFusionB297 as any).lastEffectiveWeights??{})},
        lastDeduplicatedContribution01:Math.max(0,Math.min(1,Number((raw.system.executiveNeuralFusionB297 as any).lastDeduplicatedContribution01??0))),
        sourceConsolidation01:Math.max(0,Math.min(1,Number((raw.system.executiveNeuralFusionB297 as any).sourceConsolidation01??0))),
        sourceCredit:{...((raw.system.executiveNeuralFusionB297 as any).sourceCredit??{})},
        sourceCreditUpdates:Math.max(0,Math.floor(Number((raw.system.executiveNeuralFusionB297 as any).sourceCreditUpdates??0))),
      } : undefined,
      actionOwnershipGraphB298: raw.system?.actionOwnershipGraphB298 ?? undefined,
      causalPersonalityDevelopmentB299: raw.system?.causalPersonalityDevelopmentB299 ?? undefined,
      mobileStateEconomyB301: raw.system?.mobileStateEconomyB301 ?? undefined,
      longHorizonDevelopmentB302: raw.system?.longHorizonDevelopmentB302 ?? undefined,
      holdoutGeneralizationB303: raw.system?.holdoutGeneralizationB303 ?? undefined,
      semanticHoldoutB304: raw.system?.semanticHoldoutB304 ?? undefined,
      criticalPathVerificationB305: raw.system?.criticalPathVerificationB305 ?? undefined,
      b312ExecutiveDecisionHandoff: raw.system?.b312ExecutiveDecisionHandoff ?? undefined,
      b313LongitudinalBehavioralDivergence: raw.system?.b313LongitudinalBehavioralDivergence ?? undefined,
      b349NeuralDevelopmentalSpine: raw.system?.b349NeuralDevelopmentalSpine ?? defaultB349State(),
      b306AutonomousInitiativeVerification: raw.system?.b306AutonomousInitiativeVerification ?? undefined,
      b333AutonomousGoalGenesis: raw.system?.b333AutonomousGoalGenesis ?? undefined,
      b334AutonomousProjectLifecycle: raw.system?.b334AutonomousProjectLifecycle ?? undefined,
      b335AutonomousProjectHoldout: raw.system?.b335AutonomousProjectHoldout ?? undefined,
      cognitiveEventFabric: raw.system?.cognitiveEventFabric ?? undefined,
      cognitiveResourceEconomy: raw.system?.cognitiveResourceEconomy ?? undefined,
      runtimePerformance: raw.system?.runtimePerformance ?? undefined,
      interoceptiveState: raw.system?.interoceptiveState ?? undefined,
      autonomousPersonhood: raw.system?.autonomousPersonhood ?? undefined,
      longHorizonAutonomy: raw.system?.longHorizonAutonomy ?? undefined,
      autonomousResourceToolLife: raw.system?.autonomousResourceToolLife ?? undefined,
      autonomousRuntimeLife: raw.system?.autonomousRuntimeLife ?? undefined,
      selfDirectedLife: raw.system?.selfDirectedLife ?? undefined,
      autonomousLearningMemory: raw.system?.autonomousLearningMemory ?? undefined,
      autonomousRelationships: raw.system?.autonomousRelationships ?? undefined,
      identityContinuityGuard: raw.system?.identityContinuityGuard ?? undefined,
      autonomousValueFormation: raw.system?.autonomousValueFormation ?? undefined,
      openEndedSkillAcquisition: raw.system?.openEndedSkillAcquisition ?? undefined,
      autobiographicalLifeNarrative: raw.system?.autobiographicalLifeNarrative ?? undefined,
      autonomousSocialInitiative: raw.system?.autonomousSocialInitiative ?? undefined,
      liveSelfImprovementSupervisor: raw.system?.liveSelfImprovementSupervisor ?? undefined,
      neuroDigitalFusion: raw.system?.neuroDigitalFusion ?? undefined,
      plasticityHomeostasis: raw.system?.plasticityHomeostasis ?? undefined,
      causalSelfExperimentLab: raw.system?.causalSelfExperimentLab ?? undefined,
      dreamCounterfactualLab: raw.system?.dreamCounterfactualLab ?? undefined,
      capabilitySelfModel: raw.system?.capabilitySelfModel ?? undefined,
      neuroSymbolicCompiler: raw.system?.neuroSymbolicCompiler ?? undefined,
      neuralMorphogenesis: raw.system?.neuralMorphogenesis ?? undefined,
      hybridNeuroCognitiveLoop: raw.system?.hybridNeuroCognitiveLoop ?? undefined,
      neuroDigitalEvolution: raw.system?.neuroDigitalEvolution ?? undefined,
      realityEvidenceLedger: raw.system?.realityEvidenceLedger ?? undefined,
      unifiedCognitiveCycle: raw.system?.unifiedCognitiveCycle ?? undefined,
      continuousCognitiveFabric: raw.system?.continuousCognitiveFabric ?? undefined,
      runtimeClosure: raw.system?.runtimeClosure ?? undefined,
      memoryRetentionEconomy: raw.system?.memoryRetentionEconomy ?? undefined,
      behavioralInfluenceLedger: raw.system?.behavioralInfluenceLedger ?? undefined,
      emotionAppraisal: raw.system?.emotionAppraisal ?? undefined,
      worldModelEnsemble: raw.system?.worldModelEnsemble ?? undefined,
      memoryCausalEconomy: raw.system?.memoryCausalEconomy ?? defaultMemoryCausalEconomy(),
      causalLifeGraph: raw.system?.causalLifeGraph ?? undefined,
      activePerceptionExecutor: raw.system?.activePerceptionExecutor ?? undefined,
      worldCausalCalibration: raw.system?.worldCausalCalibration ?? undefined,
      selfModelValidation: raw.system?.selfModelValidation ?? undefined,
      failureRecoveryCertification: raw.system?.failureRecoveryCertification ?? undefined,
      cognitiveDomainClosure: raw.system?.cognitiveDomainClosure ?? undefined,
      causalDomainClosureLedger: raw.system?.causalDomainClosureLedger ?? undefined,
      memoryWorldCausalBridge: raw.system?.memoryWorldCausalBridge ?? undefined,
      worldAgencyLearningCausalBridge: raw.system?.worldAgencyLearningCausalBridge ?? undefined,
      basalGangliaSelection: raw.system?.basalGangliaSelection ?? undefined,
      cerebellarPredictiveControl: raw.system?.cerebellarPredictiveControl ?? undefined,
      adaptiveComputeGovernor: raw.system?.adaptiveComputeGovernor ?? undefined,
      thalamocorticalGate: (raw.system as any)?.thalamocorticalGate ?? undefined,
      corticalHierarchy: raw.system?.corticalHierarchy ?? undefined,
      brainstemArousalSleep: (raw.system as any)?.brainstemArousalSleep ?? undefined,
      hexisAdaptation: raw.system?.hexisAdaptation ?? undefined,
      lettaGovernanceAdaptation: raw.system?.lettaGovernanceAdaptation ?? undefined,
    },
  };
}
