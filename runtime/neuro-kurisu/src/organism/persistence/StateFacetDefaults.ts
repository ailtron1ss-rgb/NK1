/**
 * Canonical initial facet values used by persistence migration and cold-start normalization.
 * The migration coordinator consumes these factories rather than owning each subsystem default.
 */
import type { MemoryFacet, EmbodimentFacet, LearningFacet, ConsciousnessFacet, EvolutionFacet } from '../core/types.ts';
import { defaultSelfModel } from '../cognition/SelfModelV2.ts';
import { attend } from '../cognition/AttentionSchema.ts';
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
import { defaultOperationalLife } from '../learning/OperationalLifeEngine.ts';
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
import { defaultFutureSimulator } from '../developmental/FutureSimulator.ts';
import { defaultLongTermSocialMind } from '../developmental/LongTermSocialMind.ts';
import { defaultSelfGovernance } from '../cognition/evolution/SelfGovernanceEngine.ts';
import { defaultFutureSelf } from '../cognition/evolution/FutureSelfModel.ts';
import { defaultAdaptivePolicy } from '../learning/AdaptivePolicyEngine.ts';
import { defaultAdvancedResilience } from '../learning/AdvancedResilienceEngine.ts';
import { defaultP23Learning } from '../learning/P23LearningEngine.ts';
import { defaultP26TrueLearning } from '../learning/P26TrueLearningEngine.ts';
import { defaultP27NeuralWorld } from '../cognition/P27NeuralWorldFoundation.ts';
import { defaultP28Plasticity } from '../learning/P28PlasticitySubstrate.ts';
import { defaultP29Governance } from '../learning/P29LearningGovernance.ts';
import { defaultP30Continual } from '../learning/P30ContinualIntelligence.ts';
import { defaultCausalExperienceStream } from '../learning/CausalExperienceStream.ts';
import { defaultCognitiveResearchBattery } from '../learning/CognitiveResearchBattery.ts';
import { defaultCausalDevelopmentLoop } from '../learning/CausalDevelopmentLoop.ts';
import { defaultDevelopmentalSynthesis } from '../learning/DevelopmentalSynthesisEngine.ts';
import { defaultDevelopmentalExecutive } from '../learning/DevelopmentalExecutiveEngine.ts';
import { defaultMetaDevelopmental } from '../learning/MetaDevelopmentalStrategyEngine.ts';
import { defaultPersonalCurriculum } from '../learning/PersonalCurriculumEngine.ts';
import { defaultPersonalWorldline } from '../learning/PersonalWorldlineEngine.ts';
import { defaultIntegratedLifeTrajectory } from '../learning/IntegratedLifeTrajectoryEngine.ts';
import { defaultCognitiveOrganismContinuity } from '../learning/CognitiveOrganismContinuityEngine.ts';
import { defaultDevelopmentalPortfolio } from '../learning/DevelopmentalPortfolioEngine.ts';
import { defaultLifeCourseNavigator } from '../learning/LifeCourseNavigator.ts';
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
import { defaultP79 } from '../world/P79EmbodiedSituationModel.ts';
import { defaultDevelopmentalAttractorField } from '../cognition/evolution/DevelopmentalAttractorField.ts';

export const defaultNeeds = () => ({ energy:0.82, cognitiveLoad:0.18, uncertainty:0.35, socialNeed:0.28, novelty:0.42, identityCoherence:0.88, goalPressure:0.18 });
export const defaultMemoryFacet = (): MemoryFacet => ({ eventLog:[], autobiographicalMemories:[], selfModel:defaultSelfModel(), attention:attend({target:'none',reason:'migration',salience:0,confidence:0.2,budget:0.82}), socialModel:[], adaptiveValues:{...DEFAULT_ADAPTIVE_VALUES}, workspace:{capacity:5,items:[],broadcastId:'',recurrence:0,lastCompetition:0,ignition01:0,sourceDiversity01:0,coalitionStability01:0}, semanticGraph:{nodes:[],edges:[],updates:0}, experiments:[], counterfactuals:[], lastRetrievedMemoryIds:[] });

export const defaultEmbodimentFacet = (): EmbodimentFacet => ({ body:defaultBodyState(), bodyEvents:[], sleepSessions:[], lastSensorAt:0, sensorFailures:0, perceptionRouting:defaultPerceptionRoutingState(), multimodal:defaultMultimodalState(), toolAudit:[], p35:defaultP35SemanticWorldBody(), p37:defaultP37EmbodiedSensorium(), p40SemanticIntelligence:defaultP40SemanticIntelligence(), p41SemanticPerception:defaultP41SemanticPerception(), p41NativePerception:defaultP41NativePerception(), p41TemporalPerception:defaultP41TemporalPerception(), p42Experience:defaultP42(), p43Imagery:defaultP43(), perceptualEvidence:defaultPerceptualEvidence(), cameraEvidence:defaultCameraEvidenceState() });
export const defaultLearningFacet = (): LearningFacet => ({
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
export const defaultConsciousnessFacet = (): ConsciousnessFacet => ({ intrinsic:defaultIntrinsicDriveState(), activeInference:defaultActiveInferenceState(), identityContinuity:defaultIdentityContinuity(), metacognition:defaultMetaCognitiveState(), workspaceIgnition:defaultWorkspaceIgnition(), consciousnessEvidence:defaultConsciousnessEvidence(), p31:defaultP31Consciousness(), p32:defaultP32CausalSelfModel(), p33:defaultP33Personhood(), p34:defaultP34CausalPersonhood(), causalExperiments:[], researchQuestionsCompleted:[] });

export const defaultEvolutionFacet = (): EvolutionFacet => ({ selfProjects:defaultSelfProjectState(), agency:defaultAgencyDeliberation(), valueEvolution:defaultValueEvolution(), identityTrajectory:defaultIdentityTrajectory(), narrative:defaultNarrative(), network:{tick:0,capacity:3,lastBroadcast:null,history:[],totalIgnitions:0}, developmentalAttractors:defaultDevelopmentalAttractorField(), authoredProjectHistory:[], longitudinalMilestones:[] });


export const defaultAdvancedFacet = () => ({
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

export const defaultCognitionFacet = () => ({ perception: defaultPerceptionState(), cognitiveField:defaultCognitiveField(), contradictions:defaultContradictionReservoir(), budget:defaultCognitiveBudget(), immune:defaultCognitiveImmune(), sources:defaultSourceMonitor(), skills:defaultSkillLibrary(), scientific:defaultScientificMethod(), residualWorld:defaultLearnedResidual(), contextualWorld:defaultContextualWorld(), p27:defaultP27NeuralWorld() });
