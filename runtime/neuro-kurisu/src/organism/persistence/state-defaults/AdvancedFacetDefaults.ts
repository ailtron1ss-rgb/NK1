/** Domain-specific default-state factory extracted from the persistence coordinator. */
import { defaultMemoryOS2 } from '../../developmental/MemoryOS2.ts';
import { defaultWorldModel2 } from '../../developmental/WorldModel2.ts';
import { defaultRegretState } from '../../developmental/RegretEngine.ts';
import { defaultSemanticScarState } from '../../developmental/SemanticScarEngine.ts';
import { defaultValueProvenance } from '../../developmental/ValueProvenance.ts';
import { defaultCommitmentRepair } from '../../developmental/CommitmentRepair.ts';
import { defaultModelSwitchContinuity } from '../../developmental/ModelSwitchContinuity.ts';
import { defaultMicroDream } from '../../developmental/MicroDreamEngine.ts';
import { defaultDevelopmentalForks } from '../../developmental/DevelopmentalForks.ts';
import { defaultRelationshipSelf } from '../../developmental/RelationshipSelf.ts';
import { defaultMultiHypothesisPersonality } from '../../developmental/MultiHypothesisPersonality.ts';
import { defaultFutureSimulator } from '../../developmental/FutureSimulator.ts';
import { defaultLongTermSocialMind } from '../../developmental/LongTermSocialMind.ts';
import { defaultSelfGovernance } from '../../cognition/evolution/SelfGovernanceEngine.ts';
import { defaultFutureSelf } from '../../cognition/evolution/FutureSelfModel.ts';
import { defaultAdvancedResilience } from '../../learning/AdvancedResilienceEngine.ts';
import { defaultCausalExperienceStream } from '../../learning/CausalExperienceStream.ts';
import { defaultCognitiveResearchBattery } from '../../learning/CognitiveResearchBattery.ts';
import { defaultCausalDevelopmentLoop } from '../../learning/CausalDevelopmentLoop.ts';
import { defaultP49 } from '../../developmental/P49TemporalLifeEngine.ts';
import { defaultP50 } from '../../world/P50CausalSelfWorldEngine.ts';
import { defaultP51 } from '../../world/P51GroundedCausalWorkspace.ts';
import { defaultGroundedWorldState } from '../../world/GroundedWorldState.ts';
import { defaultP52 } from '../../world/P52CounterfactualDevelopmentMind.ts';
import { defaultP64 } from '../../cognition/P64IntegratedOrganismDynamics.ts';
import { defaultP65 } from '../../memory/P65EpistemicLedger.ts';
import { defaultP66 } from '../../cognition/P66InteroceptiveHomeostasis.ts';
import { defaultP67 } from '../../developmental/P67AutonomousGoalGenesis.ts';
import { defaultP68 } from '../../developmental/P68GoalEcology.ts';
import { defaultP69 } from '../../cognition/P69ConstitutionalArbiter.ts';
import { defaultP70 } from '../../developmental/P70MemoryLifecycleGovernor.ts';
import { defaultP71 } from '../../cognition/P71SelfConsistencyModel.ts';
import { defaultP72 } from '../../system/P72LifeCycleOrchestrator.ts';
import { defaultP73 } from '../../system/P73CapabilityEvolutionLedger.ts';
import { defaultP74 } from '../../cognition/P74IntegratedOrganismKernel.ts';
import { defaultP75 } from '../../developmental/P75MemoryContinuumOS.ts';
import { defaultP76 } from '../../system/P76IdentityLifeOS.ts';
import { defaultP77 } from '../../system/P77RealityExperimentOS.ts';
import { defaultP78 } from '../../developmental/P78AutobiographicalSelfContinuity.ts';
import { defaultP79 } from '../../world/P79EmbodiedSituationModel.ts';

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
