/** Advanced state defaults for context, memory, governance, and future-self models. */
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
import { defaultGroundedWorldState } from '../../world/GroundedWorldState.ts';

export const defaultAdvancedContextFacet = () => ({
  groundedWorld: defaultGroundedWorldState(),
  memoryFabric: {version:2,stats:{encodes:0,newItems:0,reconsolidations:0,retrievals:0,retrievalHits:0,maintenanceRuns:0,compatibilityProjections:0},hotIds:[]},
  memoryOS: defaultMemoryOS2(), worldModel2: defaultWorldModel2(), regret: defaultRegretState(), semanticScars: defaultSemanticScarState(),
  valueProvenance: defaultValueProvenance(), commitmentRepair: defaultCommitmentRepair(), modelSwitch: defaultModelSwitchContinuity(),
  advancedResilience: defaultAdvancedResilience(),
  microDreams: defaultMicroDream(), developmentalForks: defaultDevelopmentalForks(), relationshipSelf: defaultRelationshipSelf(), multiHypothesisPersonality: defaultMultiHypothesisPersonality(), futureSimulator: defaultFutureSimulator(), longTermSocialMind: defaultLongTermSocialMind(), selfGovernance: defaultSelfGovernance(), futureSelf: defaultFutureSelf(), consequenceAttribution: [],
});
