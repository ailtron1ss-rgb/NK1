/**
 * Owns the developmental + neural learning machinery extracted from OrganismCore.
 *
 * This is an ownership refactor only: the concrete engines keep their original
 * identity and lifetime, while OrganismCore becomes an orchestration layer.
 * No new learner or alternate source of truth is introduced here.
 */
import { NeuralSubstrateBackend } from '../cognition/NeuralSubstrateBackend.ts';
import { BoundedRecurrentStateSubstrate, type BoundedRecurrentState, type RecurrentStep } from '../cognition/BoundedRecurrentStateSubstrate.ts';
import { RecurrentCausalMemory, defaultRecurrentCausalMemory } from '../cognition/RecurrentCausalMemory.ts';
import { B261UnifiedWorldModel, defaultB261UnifiedWorldModel } from '../cognition/B261UnifiedWorldModel.ts';
import { B262MultiTimescaleWorldModel, defaultB262MultiTimescaleWorldModel } from '../cognition/B262MultiTimescaleWorldModel.ts';
import { B263RealActionCausality, defaultB263RealActionCausality } from '../cognition/B263RealActionCausality.ts';
import { B264CausalPolicyLearning, defaultB264CausalPolicyLearning } from '../cognition/B264CausalPolicyLearning.ts';
import { B265IndependentPolicyEvaluator, defaultB265IndependentPolicyEvaluator } from '../cognition/B265IndependentPolicyEvaluator.ts';
import { B266HiddenTaskGeneralization, defaultB266HiddenTaskGeneralization } from '../cognition/B266HiddenTaskGeneralization.ts';
import { B267AdaptiveRegimeController, defaultB267AdaptiveRegimeController } from '../cognition/B267AdaptiveRegimeController.ts';
import { B268CausalSelfExperimentLab, defaultB268CausalSelfExperimentLab, evaluateB264SnapshotOnFamilies, mutateB264PolicySnapshot, type B268ExperimentSpec } from '../cognition/B268CausalSelfExperimentLab.ts';
import { B269SpikingPlasticNeuralSubstrate, defaultB269SpikingPlastic } from '../cognition/B269SpikingPlasticNeuralSubstrate.ts';
import { B270NeuralGerminalOrganism, defaultB270NeuralGerminalOrganism } from '../cognition/B270NeuralGerminalOrganism.ts';
import { B271NeuralAutobiographicalCore, defaultB271State } from '../cognition/B271NeuralAutobiographicalCore.ts';
import { B272EndogenousGoalGenesis, defaultB272State } from '../cognition/B272EndogenousGoalGenesis.ts';
import { B273AutonomousGoalLifecycle, defaultB273State } from '../cognition/B273AutonomousGoalLifecycle.ts';
import { B274AutonomousSkillLaboratory, defaultB274State } from '../cognition/B274AutonomousSkillLaboratory.ts';
import { B275NeuralCompositionalPolicy, defaultB275State } from '../cognition/B275NeuralCompositionalPolicy.ts';
import { B276LatentActionProgramSynthesizer, defaultB276State } from '../cognition/B276LatentActionProgramSynthesizer.ts';
import { B277NeuralOperatorGenesis, defaultB277State } from '../cognition/B277NeuralOperatorGenesis.ts';
import { B278NeuralPrimitiveGenesis, defaultB278State } from '../cognition/B278NeuralPrimitiveGenesis.ts';
import { B279NeuralAttractorAssemblies, defaultB279State } from '../cognition/B279NeuralAttractorAssemblies.ts';
import { B280MultiAreaNeuralCircuit, defaultB280State } from '../cognition/B280MultiAreaNeuralCircuit.ts';
import { B281PredictiveInterAreaMessaging, defaultB281State } from '../cognition/B281PredictiveInterAreaMessaging.ts';
import { B282PredictiveGlobalWorkspace, defaultB282State } from '../cognition/B282PredictiveGlobalWorkspace.ts';
import { B283CompetingPredictiveHypotheses, defaultB283State } from '../cognition/B283CompetingPredictiveHypotheses.ts';
import { B284NeuralAutobiographicalIdentityCore, defaultB284State } from '../cognition/B284NeuralAutobiographicalIdentityCore.ts';
import { B285NeuralLifeConsolidationCore, defaultB285State } from '../cognition/B285NeuralLifeConsolidationCore.ts';
import { B286SelfConflictContinuityCore, defaultB286State } from '../cognition/B286SelfConflictContinuityCore.ts';
import { B287RelationshipValueDevelopmentCore, defaultB287State } from '../cognition/B287RelationshipValueDevelopmentCore.ts';
import { B288SocialPredictiveSelfOtherBrain, defaultB288State } from '../cognition/B288SocialPredictiveSelfOtherBrain.ts';
import { B289NeuralOrganismIntegrationSpine, defaultB289State } from '../system/B289NeuralOrganismIntegrationSpine.ts';
import { B290RealityGatedNeurodevelopment, defaultB290State } from '../system/B290RealityGatedNeurodevelopment.ts';
import { B291UnifiedSelfAgencyGate, defaultB291State } from '../system/B291UnifiedSelfAgencyGate.ts';
import { B292CognitiveStateBus, defaultB292CognitiveStateBus } from '../system/B292CognitiveStateBus.ts';
import { B292IntentTrace, defaultB292IntentTrace } from '../system/B292IntentTrace.ts';
import { B293SelfWorldPredictiveMicrocircuit, defaultB293State } from '../system/B293SelfWorldPredictiveMicrocircuit.ts';
import { B294CausalNeuralEventSpine, defaultB294State } from '../system/B294CausalNeuralEventSpine.ts';
import { B295AdaptiveCognitiveBudget, defaultB295AdaptiveCognitiveBudget, type B295BudgetPlan } from '../system/B295AdaptiveCognitiveBudget.ts';
import { B296NeuralPersonalityAgencyNucleus, defaultB296State } from '../system/B296NeuralPersonalityAgencyNucleus.ts';
import { NeuralMemoryContinuityCore } from '../system/NeuralMemoryContinuityCore.ts';
import { NeuralPlasticityBenchmarkSuite } from '../system/NeuralPlasticityBenchmarkSuite.ts';
import { B297ExecutiveNeuralFusion, defaultB297State } from '../system/B297ExecutiveNeuralFusion.ts';
import { ActionOwnershipGraph, defaultActionOwnershipState } from '../system/ActionOwnershipGraph.ts';
import { B299CausalPersonalityDevelopmentLoop, defaultB299State } from '../system/B299CausalPersonalityDevelopmentLoop.ts';
import { B312ExecutiveDecisionHandoff, defaultB312DecisionHandoff } from '../system/B312ExecutiveDecisionHandoff.ts';
import { B313LongitudinalBehavioralDivergence, defaultB313State, traitToAction } from '../system/B313LongitudinalBehavioralDivergence.ts';
import { B349NeuralDevelopmentalSpine, defaultB349State } from '../system/B349NeuralDevelopmentalSpine.ts';
import { B365UnifiedNeuroCausalCore, defaultB365State } from '../cognition/B365UnifiedNeuroCausalCore.ts';
import { B2501DeepNeuralCausalBranch, defaultB2501State } from '../cognition/B2501DeepNeuralCausalBranch.ts';
import { B2502EINeuralReplayField, defaultB2502State } from '../cognition/B2502EINeuralReplayField.ts';
import { B2503ActionablePredictiveField, defaultB2503State } from '../cognition/B2503ActionablePredictiveField.ts';
import { B2504UnifiedSelfWorldPredictiveField, defaultB2504State } from '../cognition/B2504UnifiedSelfWorldPredictiveField.ts';
import { B2505CompositionalReplayComposer, defaultB2505State } from '../cognition/B2505CompositionalReplayComposer.ts';
import { B2506NeuralBottleneckEscalator, defaultB2506State } from '../cognition/B2506NeuralBottleneckEscalator.ts';
import { B2507ConsolidationScheduler, defaultB2507State } from '../cognition/B2507ConsolidationScheduler.ts';
import { B2508AdaptiveNeuralComputeGovernor, defaultB2508State } from '../cognition/B2508AdaptiveNeuralComputeGovernor.ts';
import { B2509EmbodiedHomeostaticActionField, defaultB2509State } from '../cognition/B2509EmbodiedHomeostaticActionField.ts';
import { B2510DevelopmentalPersonalityCoupling, defaultB2510State } from '../cognition/B2510DevelopmentalPersonalityCoupling.ts';
import { B2511ActiveEpistemicExperimentController, defaultB2511State } from '../cognition/B2511ActiveEpistemicExperimentController.ts';
import { B2512EpistemicSemanticAutobiographicalConsolidator, defaultB2512State } from '../cognition/B2512EpistemicSemanticAutobiographicalConsolidator.ts';
import { B2513FutureSelfProjectionField, defaultB2513State } from '../cognition/B2513FutureSelfProjectionField.ts';
import { B2514MemoryNeedPrioritizer, defaultB2514State } from '../cognition/B2514MemoryNeedPrioritizer.ts';
import { B2515UnifiedOrganismLatentFabric, defaultB2515State } from '../cognition/B2515UnifiedOrganismLatentFabric.ts';
import { B2516CausalAutobiographicalGraph, defaultB2516State } from '../cognition/B2516CausalAutobiographicalGraph.ts';
import { B2517SelfAuthoredRuleCompiler, defaultB2517State } from '../cognition/B2517SelfAuthoredRuleCompiler.ts';
import { B2518PersistentSelfWorldModel, defaultB2518State } from '../cognition/B2518PersistentSelfWorldModel.ts';
import { B2519LongHorizonCounterfactualPlanner, defaultB2519State } from '../cognition/B2519LongHorizonCounterfactualPlanner.ts';
import { B2520SensorimotorImagination, defaultB2520State } from '../cognition/B2520SensorimotorImagination.ts';
import { B2521LearnedGenerativeOrganismLoop, defaultB2521State } from '../cognition/B2521LearnedGenerativeOrganismLoop.ts';
import { B2522AdaptiveWorldModelMixtureRouter, defaultB2522State } from '../cognition/B2522AdaptiveWorldModelMixtureRouter.ts';
import { B2523MultiHorizonCounterfactualVerifier, defaultB2523State } from '../cognition/B2523MultiHorizonCounterfactualVerifier.ts';
import { B2524NonparametricWorldExperienceMemory, defaultB2524State } from '../cognition/B2524NonparametricWorldExperienceMemory.ts';
import { B2525LearnedLatentTransitionField, defaultB2525State } from '../cognition/B2525LearnedLatentTransitionField.ts';
import { NeuralExperienceBranch, defaultNeuralExperienceBranch } from '../cognition/NeuralExperienceBranch.ts';
import { B385B390AutonomousDevelopmentalOrganismCore, defaultB385B390State } from '../system/B385B390AutonomousDevelopmentalOrganismCore.ts';
import { B391B400NeuralDevelopmentalIntegrationCore, defaultB391B400State } from '../system/B391B400NeuralDevelopmentalIntegrationCore.ts';
import { B401B420AdaptiveCognitiveResearchCore, defaultB401B420State } from '../system/B401B420AdaptiveCognitiveResearchCore.ts';
import { B421B450ResearchAccelerationCore, defaultB421B450State, type B421Input } from '../system/B421B450ResearchAccelerationCore.ts';
import { B451B500MetaCognitiveDevelopmentCore, defaultB451B500State, type B451Input } from '../system/B451B500MetaCognitiveDevelopmentCore.ts';
import { B501B560HierarchicalMetaMemoryCore, defaultB501B560State } from '../system/B501B560HierarchicalMetaMemoryCore.ts';
import { B561B620MetaCognitiveEvolutionCore, defaultB561B620State, type B561Input } from '../system/B561B620MetaCognitiveEvolutionCore.ts';
import { B621B720UnifiedAdaptiveMindCore, defaultB621B720State } from '../system/B621B720UnifiedAdaptiveMindCore.ts';
import { B721B900DevelopmentalLearningFabric, defaultB721B900State } from '../system/B721B900DevelopmentalLearningFabric.ts';
import { B901B1100CausalDevelopmentalMetaLearner, defaultB901B1100State } from '../system/B901B1100CausalDevelopmentalMetaLearner.ts';
import { B1101B1350SelfDevelopmentCore, defaultB1101B1350State } from '../system/B1101B1350SelfDevelopmentCore.ts';
import { B1351B1600LifelongDevelopmentCore, defaultB1351B1600State } from '../system/B1351B1600LifelongDevelopmentCore.ts';
import { PersistentContinuityKernel, defaultPersistentContinuityKernel, type ContinuityMaterialInput } from '../system/PersistentContinuityKernel.ts';
import { B1701B2200UnifiedLifeContinuityCore, defaultB1701B2200State, type B1701Input } from '../system/B1701B2200UnifiedLifeContinuityCore.ts';
import { B2201B2500LifeCourseSelfModelCore, defaultB2201B2500State, type B2201Input } from '../system/B2201B2500LifeCourseSelfModelCore.ts';
import { CanonicalSelfAgencyAuthority } from '../system/CanonicalSelfAgencyAuthority.ts';
import { NeuroDigitalFusionKernel } from '../cognition/NeuroDigitalFusionKernel.ts';
import { PlasticityHomeostasisGovernor } from '../system/PlasticityHomeostasisGovernor.ts';
import { CausalSelfExperimentLab } from '../system/CausalSelfExperimentLab.ts';
import { DreamCounterfactualLaboratory } from '../system/DreamCounterfactualLaboratory.ts';
import { CapabilitySelfModelGraph } from '../system/CapabilitySelfModelGraph.ts';
import { NeuroSymbolicConceptCompiler } from '../cognition/NeuroSymbolicConceptCompiler.ts';
import { NeuralMorphogenesisEngine } from '../system/NeuralMorphogenesisEngine.ts';
import { HybridNeuroCognitiveLoop } from '../system/HybridNeuroCognitiveLoop.ts';
import { NeuroDigitalEvolutionEngine } from '../system/NeuroDigitalEvolutionEngine.ts';
import { P23LearningEngine, defaultP23Learning } from '../learning/P23LearningEngine.ts';
import { P25ScientificDevelopmentEngine, defaultP25ScientificDevelopment } from '../learning/P25ScientificDevelopmentEngine.ts';
import { P26TrueLearningEngine, defaultP26TrueLearning } from '../learning/P26TrueLearningEngine.ts';
import { P28PlasticitySubstrate, defaultP28Plasticity } from '../learning/P28PlasticitySubstrate.ts';
import { P29LearningGovernanceEngine, defaultP29Governance } from '../learning/P29LearningGovernance.ts';
import { P30ContinualIntelligenceEngine, defaultP30Continual } from '../learning/P30ContinualIntelligence.ts';
import { DevelopmentalSynthesisEngine, defaultDevelopmentalSynthesis } from '../learning/DevelopmentalSynthesisEngine.ts';
import { DevelopmentalExecutiveEngine, defaultDevelopmentalExecutive } from '../learning/DevelopmentalExecutiveEngine.ts';
import { MetaDevelopmentalStrategyEngine, defaultMetaDevelopmental } from '../learning/MetaDevelopmentalStrategyEngine.ts';
import { PersonalCurriculumEngine, defaultPersonalCurriculum } from '../learning/PersonalCurriculumEngine.ts';
import { DevelopmentalPortfolioEngine, defaultDevelopmentalPortfolio } from '../learning/DevelopmentalPortfolioEngine.ts';
import { LifeCourseNavigator, defaultLifeCourseNavigator } from '../learning/LifeCourseNavigator.ts';
import { PersonalWorldlineEngine, defaultPersonalWorldline } from '../learning/PersonalWorldlineEngine.ts';
import { IntegratedLifeTrajectoryEngine, defaultIntegratedLifeTrajectory, type TrajectoryDecision } from '../learning/IntegratedLifeTrajectoryEngine.ts';
import { CognitiveOrganismContinuityEngine, defaultCognitiveOrganismContinuity, type CognitiveOrganismContext } from '../learning/CognitiveOrganismContinuityEngine.ts';
import { AutonomousCognitiveLifeEngine, defaultAutonomousCognitiveLife, type AutonomousCognitiveLifeContext } from '../learning/AutonomousCognitiveLifeEngine.ts';
import { VerifiedAutonomousLifeEngine, defaultVerifiedAutonomousLife, type VerifiedAutonomousLifeContext } from '../learning/VerifiedAutonomousLifeEngine.ts';
import { ResearchGradeOrganismEngine, defaultResearchGradeOrganism } from '../learning/ResearchGradeOrganismEngine.ts';
import { OperationalLifeEngine, defaultOperationalLife, type OperationalLifeContext } from '../learning/OperationalLifeEngine.ts';
import { AutonomousScientificBrainSubstrate } from '../learning/AutonomousScientificBrainSubstrate.ts';
import { P36AutonomousSelfDevelopmentEngine, defaultP36SelfDevelopment } from '../learning/P36AutonomousSelfDevelopment.ts';
import { CausalExperienceStream, defaultCausalExperienceStream } from '../learning/CausalExperienceStream.ts';
import { UnifiedLearningSubstrate, defaultUnifiedLearning } from '../learning/UnifiedLearningSubstrate.ts';
import { CognitiveResearchBattery, defaultCognitiveResearchBattery } from '../learning/CognitiveResearchBattery.ts';
import { CausalDevelopmentLoop, defaultCausalDevelopmentLoop } from '../learning/CausalDevelopmentLoop.ts';
import { CognitiveDependencyGraph, defaultCognitiveDependencyState } from './CognitiveDependencyGraph.ts';
import { CognitiveSpineScheduler, defaultCognitiveSpineSchedule } from '../system/CognitiveSpineScheduler.ts';
import { B380TemporalLifeIntegrator, defaultB380State, type B380TemporalSignals } from '../system/B380TemporalLifeIntegrator.ts';
import { OrganismResourceAllocator, defaultOrganismResourceAllocation } from '../system/OrganismResourceAllocator.ts';
import { UnifiedCognitiveSubstrate, defaultUnifiedCognitiveSubstrate } from './UnifiedCognitiveSubstrate.ts';
import { B301MobileStateEconomy, defaultB301MobileStateEconomy } from '../system/B301MobileStateEconomy.ts';
import { B302LongHorizonDevelopmentLedger, defaultB302LongHorizonState, type B302EpochKind } from '../system/B302LongHorizonDevelopmentLedger.ts';
import { B303HoldoutGeneralizationLedger, defaultB303HoldoutState, type B303EvaluationPhase } from '../system/B303HoldoutGeneralizationLedger.ts';
import { B304SemanticHoldoutLedger, defaultB304SemanticHoldoutState, type B304SemanticPhase } from '../system/B304SemanticHoldoutLedger.ts';
import { B305CriticalPathVerificationLedger, defaultB305CriticalPathState } from '../system/B305CriticalPathVerificationLedger.ts';

export class DevelopmentalNeuralRuntime {
  readonly canonicalSelfAgencyAuthority = new CanonicalSelfAgencyAuthority();
  readonly neuroDigitalFusion = new NeuroDigitalFusionKernel();
  readonly plasticityHomeostasis = new PlasticityHomeostasisGovernor();
  readonly causalSelfExperimentLab = new CausalSelfExperimentLab();
  readonly dreamCounterfactualLab = new DreamCounterfactualLaboratory();
  readonly capabilitySelfModel = new CapabilitySelfModelGraph();
  readonly neuroSymbolicCompiler = new NeuroSymbolicConceptCompiler();
  readonly neuralMorphogenesis = new NeuralMorphogenesisEngine();
  readonly hybridNeuroCognitiveLoop = new HybridNeuroCognitiveLoop();
  readonly neuroDigitalEvolution = new NeuroDigitalEvolutionEngine();
  readonly p23Learning = new P23LearningEngine();
  readonly p25ScientificDevelopment = new P25ScientificDevelopmentEngine();
  readonly p26TrueLearning = new P26TrueLearningEngine();
  readonly p28Plasticity = new P28PlasticitySubstrate();
  readonly p29Learning = new P29LearningGovernanceEngine();
  readonly p30Continual = new P30ContinualIntelligenceEngine();
  readonly causalExperience = new CausalExperienceStream();
  readonly unifiedLearning = new UnifiedLearningSubstrate();
  readonly cognitiveDependencies = new CognitiveDependencyGraph();
  readonly cognitiveResearchBattery = new CognitiveResearchBattery();
  readonly causalDevelopmentLoop = new CausalDevelopmentLoop();
  readonly b380TemporalLife = new B380TemporalLifeIntegrator();
  readonly developmentalSynthesis = new DevelopmentalSynthesisEngine();
  readonly developmentalExecutive = new DevelopmentalExecutiveEngine();
  readonly metaDevelopmental = new MetaDevelopmentalStrategyEngine();
  readonly personalCurriculum = new PersonalCurriculumEngine();
  readonly developmentalPortfolio = new DevelopmentalPortfolioEngine();
  readonly lifeCourseNavigator = new LifeCourseNavigator();
  readonly personalWorldline = new PersonalWorldlineEngine();
  readonly integratedLifeTrajectory = new IntegratedLifeTrajectoryEngine();
  readonly cognitiveOrganismContinuity = new CognitiveOrganismContinuityEngine();
  readonly autonomousCognitiveLife = new AutonomousCognitiveLifeEngine();
  readonly verifiedAutonomousLife = new VerifiedAutonomousLifeEngine();
  readonly researchGradeOrganism = new ResearchGradeOrganismEngine();
  readonly operationalLife = new OperationalLifeEngine();
  readonly autonomousScientificBrain = new AutonomousScientificBrainSubstrate();
  researchGradeDecisionId: string|null = null;
  operationalLifeDecisionId: string|null = null;
  verifiedAutonomousLifeDecisionId:string|null = null;
  autonomousLifeProjections: import('../learning/AutonomousCognitiveLifeEngine.ts').ActionEvaluation[] = [];
  continuityProjections: import('../learning/CognitiveOrganismContinuityEngine.ts').ContinuityProjection[] = [];
  trajectoryDecisions: TrajectoryDecision[] = [];
  developmentalExecutiveDecision: import('../learning/DevelopmentalExecutiveEngine.ts').DevelopmentExecutiveDecision | null = null;
  readonly p36SelfDevelopment = new P36AutonomousSelfDevelopmentEngine();
  readonly cognitiveSpineScheduler = new CognitiveSpineScheduler();
  readonly resourceAllocator = new OrganismResourceAllocator();
  readonly unifiedCognitiveSubstrate = new UnifiedCognitiveSubstrate();
  /** B259: one canonical recurrent learning substrate; domain modules remain projections around it. */
  /** Single neural composition root; canonical learner remains persisted, mLSTM is an explicit shadow backend. */
  readonly neuralSubstrate = new NeuralSubstrateBackend();
  /** R23 bounded recurrent substrate stays in the developmental/neural ownership boundary. */
  readonly boundedRecurrent = new BoundedRecurrentStateSubstrate(16,'r23-core');

  restoreBoundedRecurrent(raw?:Partial<BoundedRecurrentState>){ this.boundedRecurrent.restore(raw); }
  snapshotBoundedRecurrent(){ return this.boundedRecurrent.snapshot(); }
  stepBoundedRecurrent(input:number[]):RecurrentStep{ return this.boundedRecurrent.step(input); }
  resetBoundedRecurrent(){ this.boundedRecurrent.reset(); return this.boundedRecurrent.diagnostics(); }
  boundedRecurrentDiagnostics(){ return this.boundedRecurrent.diagnostics(); }

  /**
   * Returns the large developmental/neural states that must cross a durable
   * persistence boundary. Hot observation cycles intentionally do not snapshot
   * these structures; the persistence coordinator owns their checkpoint projection.
   */
  snapshotHotNeuralPersistenceState(b365Snapshot?: ReturnType<B365UnifiedNeuroCausalCore['snapshot']>){
    return {
      b385B390AutonomousDevelopmentalOrganism:this.b385B390AutonomousDevelopmentalOrganism.snapshot(),
      b391B400NeuralDevelopmentalIntegration:this.b391B400NeuralDevelopmentalIntegration.snapshot(),
      b401B420AdaptiveCognitiveResearch:this.b401B420AdaptiveCognitiveResearch.snapshot(),
      b421B450ResearchAcceleration:this.b421B450ResearchAcceleration.snapshot(),
      b451B500MetaCognitiveDevelopment:this.b451B500MetaCognitiveDevelopment.snapshot(),
      b501B560HierarchicalMetaMemory:this.b501B560HierarchicalMetaMemory.snapshot(),
      b561B620MetaCognitiveEvolution:this.b561B620MetaCognitiveEvolution.snapshot(),
      b621B720UnifiedAdaptiveMind:this.b621B720UnifiedAdaptiveMind.snapshot(),
      b721B900DevelopmentalLearning:this.b721B900DevelopmentalLearning.snapshot(),
      b901B1100CausalDevelopmentalMetaLearner:this.b901B1100CausalDevelopmentalMetaLearner.snapshot(),
      b1101B1350SelfDevelopment:this.b1101B1350SelfDevelopment.snapshot(),
      b1351B1600LifelongDevelopment:this.b1351B1600LifelongDevelopment.snapshot(),
      b1701B2200UnifiedLifeContinuity:this.b1701B2200UnifiedLifeContinuity.snapshot(),
      spikingPlasticNeuralB269:this.spikingPlasticNeuralB269.snapshot(),
      b2501DeepNeuralCausalBranch:this.b2501DeepNeuralCausalBranch.snapshot(),
      b2502EINeuralReplayField:this.b2502EINeuralReplayField.snapshot(),
      neuralPersonalityAgencyNucleusB296:this.neuralPersonalityAgencyNucleusB296.snapshot(),
      unifiedNeuroCausalCoreB365:b365Snapshot ?? this.unifiedNeuroCausalCoreB365.snapshot(),
    };
  }
  readonly recurrentCausalMemory = new RecurrentCausalMemory();
  /** B261: single action-conditioned world dynamics path around the shared latent/recurrent state. */
  readonly unifiedWorldModelB261 = new B261UnifiedWorldModel();
  readonly multiTimescaleWorldModelB262 = new B262MultiTimescaleWorldModel();
  /** B263: real action consequence and intervention causal learner. */
  readonly realActionCausalityB263 = new B263RealActionCausality();
  /** B264: policy must causally exploit intervention predictions and learn from real consequences. */
  readonly causalPolicyLearningB264 = new B264CausalPolicyLearning();
  /** B265: an independent evaluator scores multi-step behaviour without trusting the policy's self-reported reward. */
  readonly independentPolicyEvaluatorB265 = new B265IndependentPolicyEvaluator();
  /** B266: hidden-family, delayed-reward and adversarial generalization evaluator. */
  readonly hiddenTaskGeneralizationB266 = new B266HiddenTaskGeneralization();
  /** B267: online regime-shift detection and adaptive exploration/verification controller. */
  readonly adaptiveRegimeControllerB267 = new B267AdaptiveRegimeController();
  readonly causalSelfExperimentLabB268 = new B268CausalSelfExperimentLab();
  /** B269: event-driven sparse neuronal substrate with local/neuromodulated plasticity and homeostasis. */
  readonly spikingPlasticNeuralB269 = new B269SpikingPlasticNeuralSubstrate();
  /** B270: unified neural-germinal self/agency/personality substrate. */
  readonly neuralGerminalOrganismB270 = new B270NeuralGerminalOrganism();
  /** B271: neural assemblies bind autobiographical sequences, predict self, and generate endogenous goals. */
  readonly neuralAutobiographicalCoreB271 = new B271NeuralAutobiographicalCore();
  /** B272: endogenous continuous goal generation from self/world conflict, needs and learned action prototypes. */
  readonly endogenousGoalGenesisB272 = new B272EndogenousGoalGenesis();
  /** B273: autonomous hierarchical goal lifecycle, subgoal formation, plan/skill genesis and outcome-driven goal revision. */
  readonly autonomousGoalLifecycleB273 = new B273AutonomousGoalLifecycle();
  /** B274: self-directed skill discovery through imagined experiment, bounded real trial, independent verification and promotion/rollback. */
  readonly autonomousSkillLaboratoryB274 = new B274AutonomousSkillLaboratory();
  /** B275: learned compositional neural policy that can combine verified skills into reusable behavior programs. */
  readonly neuralCompositionalPolicyB275 = new B275NeuralCompositionalPolicy();
  /** B276: latent hierarchical action-program synthesis, verification, transfer and self/personality grounding. */
  readonly latentActionProgramSynthesizerB276 = new B276LatentActionProgramSynthesizer();
  /** B277: developmental neural operator genesis; learned internal operators grow from neural/self/world context and verified programs. */
  readonly neuralOperatorGenesisB277 = new B277NeuralOperatorGenesis();
  /** B278: endogenous neural primitive invention from operator/program/self/world context, with independent promotion and transfer. */
  readonly neuralPrimitiveGenesisB278 = new B278NeuralPrimitiveGenesis();
  /** B279: recurrent attractor assemblies consolidate distributed experience in synaptic weights; recall does not require a pattern ledger. */
  readonly neuralAttractorAssembliesB279 = new B279NeuralAttractorAssemblies();
  /** B280: explicit excitatory/inhibitory multi-area neural circuit with short-term plasticity and cross-area assemblies. */
  readonly multiAreaNeuralCircuitB280 = new B280MultiAreaNeuralCircuit();
  /** B281: predictive inter-area messaging with delayed cross-area credit. */
  readonly predictiveInterAreaMessagingB281 = new B281PredictiveInterAreaMessaging();
  /** B282: shared predictive workspace with winner-take-all coalition, global future prediction and broadcast/action influence. */
  readonly predictiveGlobalWorkspaceB282 = new B282PredictiveGlobalWorkspace();
  readonly competingPredictiveHypothesesB283 = new B283CompetingPredictiveHypotheses();
  /** B284: neural autobiographical identity core; slow self/value/relationship continuity substrate. */
  readonly neuralAutobiographicalIdentityB284 = new B284NeuralAutobiographicalIdentityCore();
  /** B285: long-horizon neural life consolidation, relationship-specific self and future-self prediction. */
  readonly neuralLifeConsolidationB285 = new B285NeuralLifeConsolidationCore();
  readonly selfConflictContinuityB286 = new B286SelfConflictContinuityCore();
  readonly relationshipValueDevelopmentB287 = new B287RelationshipValueDevelopmentCore();
  /** B288: canonical social-brain coordinator; consolidates overlapping social/relationship state into one predictive neural loop. */
  readonly socialPredictiveSelfOtherB288 = new B288SocialPredictiveSelfOtherBrain();
  /** B289: compact recurrent bridge that integrates existing neural subsystems and exposes an explicit mobile active-set. */
  readonly neuralOrganismIntegrationB289 = new B289NeuralOrganismIntegrationSpine();
  /** B290: single developmental gate coordinating existing neural plasticity and evidence systems. */
  readonly realityGatedNeurodevelopmentB290 = new B290RealityGatedNeurodevelopment();
  readonly unifiedSelfAgencyPersonalityB291 = new B291UnifiedSelfAgencyGate();
  readonly cognitiveStateBusB292 = new B292CognitiveStateBus();
  readonly intentTraceB292 = new B292IntentTrace();
  /** B293: small recurrent self/world predictive circuit feeding evidence into B290/B291. */
  readonly selfWorldPredictiveMicrocircuitB293 = new B293SelfWorldPredictiveMicrocircuit();
  /** B294: causal event-linked eligibility circuit routing real outcomes into bounded neural credit assignment. */
  readonly causalNeuralEventSpineB294 = new B294CausalNeuralEventSpine();
  /** B295: central compute-budget/seam controller for B289-B294; it owns cadence, not cognition. */
  readonly adaptiveCognitiveBudgetB295 = new B295AdaptiveCognitiveBudget();
  /** B296: compact event-driven neural readout coupling spiking, self, agency and personality without duplicating canonical state. */
  readonly neuralPersonalityAgencyNucleusB296 = new B296NeuralPersonalityAgencyNucleus();
  /** P2843: fast episodic + slow semantic complementary-learning memory substrate. */
  readonly neuralMemoryContinuityP2843 = new NeuralMemoryContinuityCore();
  readonly neuralPlasticityBenchmarkP2844 = new NeuralPlasticityBenchmarkSuite();
  /** B297: consolidated executive action ecology; fuses duplicated bias channels with redundancy tracking and outcome-weighted reliability. */
  readonly executiveNeuralFusionB297 = new B297ExecutiveNeuralFusion();
  /** B298: provenance graph proving where action scores changed after executive fusion. */
  readonly actionOwnershipGraphB298 = new ActionOwnershipGraph();
  /** B299: outcome-grounded personality development bridge; not a second personality store. */
  readonly causalPersonalityDevelopmentB299 = new B299CausalPersonalityDevelopmentLoop();
  readonly mobileStateEconomyB301 = new B301MobileStateEconomy();
  readonly longHorizonDevelopmentB302 = new B302LongHorizonDevelopmentLedger();
  readonly holdoutGeneralizationB303 = new B303HoldoutGeneralizationLedger();
  /** B304: evaluation-only semantic-family holdout; never a second learner. */
  readonly semanticHoldoutB304 = new B304SemanticHoldoutLedger();
  /** B305: evaluation-only verification of the existing neural -> causal -> personality -> policy -> outcome -> persistence chain. */
  readonly criticalPathVerificationB305 = new B305CriticalPathVerificationLedger();
  /** B312: closes the verified policy -> executive -> final action handoff without creating a new learner. */
  readonly b312ExecutiveDecisionHandoff = new B312ExecutiveDecisionHandoff();
  readonly b313LongitudinalBehavioralDivergence = new B313LongitudinalBehavioralDivergence();
  /** B349: one causal developmental spine that consolidates B269/B289/B293/B294/B296 into a single outcome-trained neural influence path. */
  readonly b349NeuralDevelopmentalSpine = new B349NeuralDevelopmentalSpine();
  /** B365: canonical 96-neuron causal core. It fuses body/interoception, exteroception, recurrent association and self/action populations. */
  readonly unifiedNeuroCausalCoreB365 = new B365UnifiedNeuroCausalCore();
  readonly b2501DeepNeuralCausalBranch = new B2501DeepNeuralCausalBranch();
  readonly b2502EINeuralReplayField = new B2502EINeuralReplayField();
  readonly b2503ActionablePredictiveField = new B2503ActionablePredictiveField();
  readonly b2504UnifiedSelfWorldPredictiveField = new B2504UnifiedSelfWorldPredictiveField();
  readonly b2505CompositionalReplayComposer = new B2505CompositionalReplayComposer();
  readonly b2506NeuralBottleneckEscalator = new B2506NeuralBottleneckEscalator();
  readonly b2507ConsolidationScheduler = new B2507ConsolidationScheduler();
  readonly b2508AdaptiveNeuralComputeGovernor = new B2508AdaptiveNeuralComputeGovernor();
  readonly b2509EmbodiedHomeostaticActionField = new B2509EmbodiedHomeostaticActionField();
  readonly b2510DevelopmentalPersonalityCoupling = new B2510DevelopmentalPersonalityCoupling();
  readonly b2511ActiveEpistemicExperimentController = new B2511ActiveEpistemicExperimentController();
  readonly b2512EpistemicSemanticAutobiographicalConsolidator = new B2512EpistemicSemanticAutobiographicalConsolidator();
  readonly b2513FutureSelfProjectionField = new B2513FutureSelfProjectionField();
  readonly b2514MemoryNeedPrioritizer = new B2514MemoryNeedPrioritizer();
  readonly b2515UnifiedOrganismLatentFabric = new B2515UnifiedOrganismLatentFabric();
  readonly b2516CausalAutobiographicalGraph = new B2516CausalAutobiographicalGraph();
  readonly b2517SelfAuthoredRuleCompiler = new B2517SelfAuthoredRuleCompiler();
  readonly b2518PersistentSelfWorldModel = new B2518PersistentSelfWorldModel();
  readonly b2519LongHorizonCounterfactualPlanner = new B2519LongHorizonCounterfactualPlanner();
  readonly b2520SensorimotorImagination = new B2520SensorimotorImagination();
  readonly b2521LearnedGenerativeOrganismLoop = new B2521LearnedGenerativeOrganismLoop();
  readonly b2522AdaptiveWorldModelMixtureRouter = new B2522AdaptiveWorldModelMixtureRouter();
  readonly b2523MultiHorizonCounterfactualVerifier = new B2523MultiHorizonCounterfactualVerifier();
  readonly b2524NonparametricWorldExperienceMemory = new B2524NonparametricWorldExperienceMemory();
  readonly b2525LearnedLatentTransitionField = new B2525LearnedLatentTransitionField();
  /** Unified temporal neural branch: one experience token, pressure field, recurrent state and plasticity path. */
  readonly neuralExperienceBranch = new NeuralExperienceBranch();
  lastEmbodiedBridgeFeatures:number[] = new Array(64).fill(0);
  lastEmbodiedBridgeFreshness01 = .5;
  /** B385-B390: developmental fabric connecting autobiographical retrieval, self-model, values, goals, motivation and prediction into one causal loop. */
  readonly b385B390AutonomousDevelopmentalOrganism = new B385B390AutonomousDevelopmentalOrganismCore();
  readonly b391B400NeuralDevelopmentalIntegration = new B391B400NeuralDevelopmentalIntegrationCore();
  /** B401-B420: research ensemble for continual memory, multi-timescale state, latent prediction and counterfactual routing. It is an adaptive support layer, never a second canonical policy owner. */
  readonly b401B420AdaptiveCognitiveResearch = new B401B420AdaptiveCognitiveResearchCore();
  /** B421-B450: research acceleration fabric combining causal graph retrieval, procedural refinement, meta-routing, adaptive compute, hierarchical world prediction, coordinated micro-rollouts, calibration and self-experiment proposals. It is a bounded residual support layer, never a second policy owner. */
  readonly b421B450ResearchAcceleration = new B421B450ResearchAccelerationCore();
  /** B451-B500: meta-cognitive developmental controller; learns when/how to remember, transfer skills, allocate compute, run experiments and consolidate identity. */
  readonly b451B500MetaCognitiveDevelopment = new B451B500MetaCognitiveDevelopmentCore();
  /** B501-B560: hierarchical temporal memory, learned meta-routing, calibrated confidence, counterfactual state checks and strategy transfer. */
  readonly b501B560HierarchicalMetaMemory = new B501B560HierarchicalMetaMemoryCore();
  /** B561-B620: learned meta-policy, dual-process memory, co-evolving skills, action-conditioned world model, distributed population code and experiment/compute governance. */
  readonly b561B620MetaCognitiveEvolution = new B561B620MetaCognitiveEvolutionCore();
  /** B621-B720: unified adaptive mind layer combining learned strategy routing, hierarchical autobiographical memory, world-model ensembles, regime-shift detection, transferable skills and distributed neural identity. */
  readonly b621B720UnifiedAdaptiveMind = new B621B720UnifiedAdaptiveMindCore();
  readonly b721B900DevelopmentalLearning = new B721B900DevelopmentalLearningFabric();
  readonly b901B1100CausalDevelopmentalMetaLearner = new B901B1100CausalDevelopmentalMetaLearner();
  readonly b1101B1350SelfDevelopment = new B1101B1350SelfDevelopmentCore();
  readonly b1351B1600LifelongDevelopment = new B1351B1600LifelongDevelopmentCore();
  readonly persistentContinuityKernel = new PersistentContinuityKernel();
  /** B1701-B2200: canonical life continuity, behavior contracts, causal receipts, runtime-independent transfer, self-memory fabric, neural causal readout, world calibration, autonomous research and curriculum. */
  readonly b1701B2200UnifiedLifeContinuity = new B1701B2200UnifiedLifeContinuityCore();
  /** B2201-B2500: canonical life-course self-model; binds unfinished intentions, autobiographical causality, self-beliefs and behavioural continuity into the decision loop. */
  readonly b2201B2500LifeCourseSelfModel = new B2201B2500LifeCourseSelfModelCore();
  b1701DecisionCache:ReturnType<B1701B2200UnifiedLifeContinuityCore['beforeDecision']>|null=null;
  b2201DecisionCache:ReturnType<B2201B2500LifeCourseSelfModelCore['beforeDecision']>|null=null;
  b1101DecisionCache:ReturnType<B1101B1350SelfDevelopmentCore['beforeDecision']>|null=null;
  b1351DecisionCache:ReturnType<B1351B1600LifelongDevelopmentCore['beforeDecision']>|null=null;
  b385FullDecisionCache:ReturnType<B385B390AutonomousDevelopmentalOrganismCore['beforeDecision']>|null=null;
  b391FullDecisionCache:ReturnType<B391B400NeuralDevelopmentalIntegrationCore['beforeDecision']>|null=null;
  b401FullDecisionCache:ReturnType<B401B420AdaptiveCognitiveResearchCore['beforeDecision']>|null=null;
  b451FullDecisionCache:ReturnType<B451B500MetaCognitiveDevelopmentCore['beforeDecision']>|null=null;
  b451DecisionCache:ReturnType<B451B500MetaCognitiveDevelopmentCore['beforeDecision']>|null=null;
  b621DecisionCache:ReturnType<B621B720UnifiedAdaptiveMindCore['beforeDecision']>|null=null;
  b721DecisionCache:ReturnType<B721B900DevelopmentalLearningFabric['beforeDecision']>|null=null;
  b901DecisionCache:ReturnType<B901B1100CausalDevelopmentalMetaLearner['beforeDecision']>|null=null;
}
