import { CognitiveEventFabric, type CognitiveEventNode } from '../system/CognitiveEventFabric.ts';
import { CognitiveResourceEconomy } from '../system/CognitiveResourceEconomy.ts';
import { UnifiedCognitiveCycle } from '../system/UnifiedCognitiveCycle.ts';
import { EmotionAppraisalEngine, defaultEmotionAppraisalState } from '../system/EmotionAppraisalEngine.ts';
import { CognitiveExecutionPlanner } from './CognitiveExecutionPlanner.ts';
import { TemporalResolutionGovernor } from './TemporalResolutionGovernor.ts';
/**
 * Owns cross-domain cognitive runtime services that previously lived directly
 * on OrganismCore. This cluster is an ownership boundary, not a new cognitive
 * layer: all contained engines retain their original algorithms and state.
 */
import type { ActionKind,
  OrganismDecisionTrace,
  IntentCandidate,
  OrganismCycleResult,
  OrganismGoal,
  OrganismObservation,
  OrganismState,
  OrganismNeeds,
  EmbodimentFacet,
  WorkspaceFrame,
  ConsolidatedMemory,
  PredictedActionOutcome,
  WorldTransitionForOrganism,
} from './types.ts';
import { RecoveryWatchdog, type RecoveryWatchdogState } from '../persistence/RecoveryWatchdog.ts';
import { CentralBrainSubstrate } from '../cognition/CentralBrainSubstrate.ts';
import { PredictiveSelfAgencySubstrate } from '../cognition/PredictiveSelfAgencySubstrate.ts';
import { GlobalWorkspaceSubstrateV2 } from '../cognition/GlobalWorkspaceSubstrateV2.ts';
import { IntrinsicExperimentGenerator } from '../cognition/IntrinsicExperimentGenerator.ts';
import { SensorimotorLoop, defaultSensorimotorState } from '../cognition/SensorimotorLoop.ts';
import { IntrinsicMotivationEngine, defaultIntrinsicDriveState } from '../cognition/IntrinsicMotivationEngine.ts';
import { MetaCognitiveMonitor, defaultMetaCognitiveState } from '../cognition/MetaCognitiveMonitor.ts';
import { MetacognitiveNeuralSubstrate } from '../cognition/MetacognitiveNeuralSubstrate.ts';
import { ConsciousnessEvidenceLedger, defaultConsciousnessEvidence } from '../cognition/ConsciousnessEvidenceLedger.ts';
import { ValueEvolutionEngine } from '../cognition/evolution/ValueEvolutionEngine.ts';
import { IdentityTrajectoryEngine, defaultIdentityTrajectory } from '../cognition/evolution/IdentityTrajectoryEngine.ts';
import { AutobiographicalNarrativeEngine } from '../cognition/evolution/AutobiographicalNarrative.ts';
import { DevelopmentalIdentityFabric, type DevelopmentalIdentityFrame } from '../cognition/evolution/DevelopmentalIdentityFabric.ts';
import { MotiveEcologyFabric, type MotiveEcologyFrame } from '../cognition/evolution/MotiveEcologyFabric.ts';
import { DevelopmentalAttractorField, defaultDevelopmentalAttractorField } from '../cognition/evolution/DevelopmentalAttractorField.ts';
import { ActionGateway } from '../system/ActionGateway.ts';
import { OutcomeCognitionFabric } from '../system/OutcomeCognitionFabric.ts';
import { CognitiveNetworkBus, type SpecialistSignal } from '../cognition/CognitiveNetworkBus.ts';
import { NeuromodulationSystem } from '../cognition/NeuromodulationSystem.ts';
import { CognitiveFieldEngine, defaultCognitiveField } from '../cognition/CognitiveField.ts';
import { CognitivePressureField } from '../cognition/CognitivePressureField.ts';
import { ContradictionReservoir, defaultContradictionReservoir } from '../cognition/ContradictionReservoir.ts';
import { CognitiveImmuneSystem, defaultCognitiveImmune } from '../cognition/CognitiveImmuneSystem.ts';
import { SubjectContinuityFabric } from '../cognition/SubjectContinuityFabric.ts';
import { SourceMonitor, defaultSourceMonitor } from '../memory/SourceMonitor.ts';
import { ProceduralSkillLibrary, defaultSkillLibrary } from '../learning/ProceduralSkillLibrary.ts';
import { ScientificMethodEngine, defaultScientificMethod } from '../learning/ScientificMethodEngine.ts';
import { AdaptivePolicyEngine, defaultAdaptivePolicy } from '../learning/AdaptivePolicyEngine.ts';
import { CanonicalActionPolicyArbiter } from '../learning/CanonicalActionPolicyArbiter.ts';
import { PolicyAuthorityLedger } from '../learning/PolicyAuthorityLedger.ts';
import { CanonicalTemporalCreditAuthority, defaultCanonicalTemporalCreditState } from '../learning/CanonicalTemporalCreditAuthority.ts';
import { LongitudinalOrganismEngine, defaultLongitudinalOrganism } from '../learning/LongitudinalOrganismEngine.ts';
import { AdaptiveDevelopmentEngine, defaultAdaptiveDevelopment } from '../learning/AdaptiveDevelopmentEngine.ts';
import { TemporalContinuityEngine, defaultTemporalContinuity } from '../learning/TemporalContinuityEngine.ts';
import { RegretEngine, defaultRegretState } from '../developmental/RegretEngine.ts';
import { SemanticScarEngine, defaultSemanticScarState } from '../developmental/SemanticScarEngine.ts';
import { ValueProvenance, defaultValueProvenance } from '../developmental/ValueProvenance.ts';
import { CommitmentRepair, defaultCommitmentRepair } from '../developmental/CommitmentRepair.ts';
import { ModelSwitchContinuity, defaultModelSwitchContinuity } from '../developmental/ModelSwitchContinuity.ts';
import { MicroDreamEngine, defaultMicroDream } from '../developmental/MicroDreamEngine.ts';
import { DevelopmentalForks, defaultDevelopmentalForks } from '../developmental/DevelopmentalForks.ts';
import { RelationshipSelf, defaultRelationshipSelf } from '../developmental/RelationshipSelf.ts';
import { MultiHypothesisPersonality, defaultMultiHypothesisPersonality } from '../developmental/MultiHypothesisPersonality.ts';
import { FutureSimulator, defaultFutureSimulator } from '../developmental/FutureSimulator.ts';
import { LongTermSocialMind, defaultLongTermSocialMind } from '../developmental/LongTermSocialMind.ts';
import { FutureSelfModel, defaultFutureSelf } from '../cognition/evolution/FutureSelfModel.ts';
import { SocialDevelopmentSystem, defaultSocialDevelopment } from '../developmental/SocialDevelopmentSystem.ts';
import { SocialMindKernel, defaultSocialMindState } from '../cognition/SocialMindKernel.ts';
import { SocialPredictiveNeuralSubstrate } from '../cognition/SocialPredictiveNeuralSubstrate.ts';
import { CentralSubjectDynamics, defaultCentralSubjectDynamics } from '../cognition/CentralSubjectDynamics.ts';
import { DeviceEvidenceLedger, defaultDeviceEvidence } from '../body/DeviceEvidenceLedger.ts';
import { LifelongDevelopmentSystem, defaultLifelongDevelopment } from '../learning/LifelongDevelopmentSystem.ts';
import { P27NeuralWorldFoundation, defaultP27NeuralWorld } from '../cognition/P27NeuralWorldFoundation.ts';
import { PredictiveAllostasisSubstrate } from '../cognition/PredictiveAllostasisSubstrate.ts';
import { MultiHorizonAllostasisSubstrate } from '../cognition/MultiHorizonAllostasisSubstrate.ts';
import { NeuromodulatoryPlasticitySubstrate } from '../cognition/NeuromodulatoryPlasticitySubstrate.ts';
import type { OrganismSystemFabric } from './OrganismSystemFabric.ts';
import { CognitiveKernelCoordinator } from './CognitiveKernelCoordinator.ts';
import { CognitiveSubsystemRegistry } from './CognitiveSubsystemRegistry.ts';
import type { P61IntegratedMindKernel } from '../cognition/P61IntegratedMindKernel.ts';
import type { P64IntegratedOrganismDynamics } from '../cognition/P64IntegratedOrganismDynamics.ts';

export class CognitiveRuntimeCluster {
  readonly sensorimotor = new SensorimotorLoop();
  readonly experimentGenerator = new IntrinsicExperimentGenerator();
  readonly intrinsicMotivation = new IntrinsicMotivationEngine();
  readonly metacognition = new MetaCognitiveMonitor();
  readonly metacognitiveNeural = new MetacognitiveNeuralSubstrate();
  readonly predictiveAllostasis = new PredictiveAllostasisSubstrate();
  readonly multiHorizonAllostasis = new MultiHorizonAllostasisSubstrate();
  readonly neuromodulatoryPlasticity = new NeuromodulatoryPlasticitySubstrate();
  readonly evidenceLedger = new ConsciousnessEvidenceLedger();
  readonly valueEvolution = new ValueEvolutionEngine();
  readonly identityTrajectory = new IdentityTrajectoryEngine();
  readonly narrative = new AutobiographicalNarrativeEngine();
  readonly developmentalIdentity = new DevelopmentalIdentityFabric();
  readonly motiveEcology = new MotiveEcologyFabric();
  readonly developmentalAttractors = new DevelopmentalAttractorField();
  lastMotiveEcology: MotiveEcologyFrame = {version:1,epistemic01:.35,exploratory01:.35,competence01:.35,coherence01:.7,social01:.35,care01:.4,autonomy01:.5,homeostatic01:.25,responsibility01:.5,overall01:.5,dominant:'coherence',conflict01:.1,valueAlignment01:.7,eilsSignals:{curiosity01:.35,stress01:.2,confidence01:.7},learningModulation:{entropyFloor01:.12,plasticity01:.3,trustRegionRadius01:.32},actionBiases:{},reasons:['bootstrap'],nonConsciousnessClaim:true};
  lastDevelopmentalIdentity: DevelopmentalIdentityFrame = {version:1,continuity01:.8,integrity01:.7,developmentalReadiness01:.3,revisionReadiness01:.2,protectiveStability01:.85,beliefLineage01:.6,autobiographicalBinding01:.7,socialContinuity01:.6,authorship01:.6,causalSelf01:.5,evidenceBalance01:.5,counterEvidencePressure01:0,selfConsistency01:.8,identityPressure01:.1,noveltyPressure01:.2,phase:'stabilizing',reasons:['bootstrap'],nonConsciousnessClaim:true};
  readonly actionGateway = new ActionGateway({ live: /^(1|true|yes|on)$/i.test(process.env.ACTIONS_LIVE || '') });
  latestMatchedCounterfactual: { tick:number; action:import('../world/WorldEnvironment.ts').EnvironmentAction; contextKey:string; selectedExpected01:number; alternativeExpected01:number; actualSelectedReward01:number; matchedTrials:number; source:'matched-simulated'|'external' } | null = null;
  readonly matchedTrialCounts = new Map<string,number>();
  readonly outcomeCognition = new OutcomeCognitionFabric();
  lastP27Latent: import('../cognition/P27NeuralWorldFoundation.ts').LatentSituation | null = null;
  lastGroundedWorldContext: import('./types.ts').WorldContext | null = null;
  readonly cognitiveNetwork = new CognitiveNetworkBus();
  readonly neuromodulation = new NeuromodulationSystem();
  readonly centralBrain = new CentralBrainSubstrate();
  readonly predictiveSelfAgency = new PredictiveSelfAgencySubstrate();
  readonly globalWorkspace = new GlobalWorkspaceSubstrateV2();
  readonly cognitiveField = new CognitiveFieldEngine();
  readonly cognitivePressureField = new CognitivePressureField();
  readonly contradictions = new ContradictionReservoir();
  readonly cognitiveImmune = new CognitiveImmuneSystem();
  readonly subjectContinuity = new SubjectContinuityFabric();
  lastSubjectContinuity = this.subjectContinuity.build({tick:0,at:0,identity01:.88,identityConservation01:.92,memoryContinuity01:.75,autobiographicalContinuity01:.72,causalContinuity01:.65,grounding01:.35,realityAlignment01:.5,workspace01:.5,crossModalAgreement01:.5,unresolved01:.2,epistemicIntegrity01:.65,agency01:.5,energy01:.8,cognitiveCapacity01:.8,predictionError01:.18,novelty01:.4,goalPressure01:.2,externalInput:false,activeModalities:[]});
  readonly sourceMonitor = new SourceMonitor();
  readonly skillLibrary = new ProceduralSkillLibrary();
  readonly scientificMethod = new ScientificMethodEngine();
  readonly regretEngine = new RegretEngine();
  readonly semanticScars = new SemanticScarEngine();
  readonly valueProvenance = new ValueProvenance();
  readonly commitmentRepair = new CommitmentRepair();
  readonly modelSwitch = new ModelSwitchContinuity();
  readonly microDreams = new MicroDreamEngine();
  readonly developmentalForks = new DevelopmentalForks();
  readonly relationshipSelf = new RelationshipSelf();
  readonly multiHypothesisPersonality = new MultiHypothesisPersonality();
  readonly futureSimulator = new FutureSimulator();
  readonly longTermSocialMind = new LongTermSocialMind();
  readonly futureSelf = new FutureSelfModel();
  readonly socialDevelopment = new SocialDevelopmentSystem();
  readonly socialMind = new SocialMindKernel();
  readonly socialPredictiveNeural = new SocialPredictiveNeuralSubstrate();
  readonly centralSubjectDynamics = new CentralSubjectDynamics();
  readonly deviceEvidence = new DeviceEvidenceLedger();
  lastSocialPredictionTicketId: string | null = null;
  readonly lifelong = new LifelongDevelopmentSystem();
  readonly adaptivePolicy = new AdaptivePolicyEngine();
  readonly canonicalActionPolicy = new CanonicalActionPolicyArbiter();
  readonly policyAuthorityLedger = new PolicyAuthorityLedger();
  readonly canonicalTemporalCredit = new CanonicalTemporalCreditAuthority();
  lastCanonicalActionPolicy: Record<ActionKind, ReturnType<CanonicalActionPolicyArbiter['contribution']>> | null = null;
  readonly longitudinal = new LongitudinalOrganismEngine();
  readonly adaptiveDevelopment = new AdaptiveDevelopmentEngine();
  readonly temporalContinuity = new TemporalContinuityEngine();
  readonly recoveryWatchdog = new RecoveryWatchdog('neuro-kurisu');
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly cognitiveEventFabric = new CognitiveEventFabric(512);

  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly cognitiveResourceEconomy = new CognitiveResourceEconomy();

  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly unifiedCognitiveCycle = new UnifiedCognitiveCycle();

  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly emotionAppraisal = new EmotionAppraisalEngine();

  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly cognitiveExecutionPlanner = new CognitiveExecutionPlanner();

  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly temporalResolutionGovernor = new TemporalResolutionGovernor();
  readonly cognitiveKernelCoordinator: CognitiveKernelCoordinator;
  readonly cognitiveSubsystemRegistry: CognitiveSubsystemRegistry;

  constructor(input: {
    organismSystems: OrganismSystemFabric;
    p61IntegratedMind: P61IntegratedMindKernel;
    p64IntegratedOrganismDynamics: P64IntegratedOrganismDynamics;
  }) {
    this.cognitiveKernelCoordinator = new CognitiveKernelCoordinator(input.p61IntegratedMind, input.p64IntegratedOrganismDynamics);
    this.cognitiveSubsystemRegistry = new CognitiveSubsystemRegistry(input.organismSystems);
  }
}
