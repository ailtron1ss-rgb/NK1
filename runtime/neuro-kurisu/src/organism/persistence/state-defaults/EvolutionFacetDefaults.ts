/** Domain-specific default-state factory extracted from the persistence coordinator. */
import type { EvolutionFacet } from '../../core/types.ts';
import { defaultSelfProjectState } from '../../cognition/evolution/SelfProjectEngine.ts';
import { defaultAgencyDeliberation } from '../../cognition/evolution/AgencyDeliberationEngine.ts';
import { defaultValueEvolution } from '../../cognition/evolution/ValueEvolutionEngine.ts';
import { defaultIdentityTrajectory } from '../../cognition/evolution/IdentityTrajectoryEngine.ts';
import { defaultNarrative } from '../../cognition/evolution/AutobiographicalNarrative.ts';
import { defaultDevelopmentalAttractorField } from '../../cognition/evolution/DevelopmentalAttractorField.ts';

export const defaultEvolutionFacet = (): EvolutionFacet => ({ selfProjects:defaultSelfProjectState(), agency:defaultAgencyDeliberation(), valueEvolution:defaultValueEvolution(), identityTrajectory:defaultIdentityTrajectory(), narrative:defaultNarrative(), network:{tick:0,capacity:3,lastBroadcast:null,history:[],totalIgnitions:0}, developmentalAttractors:defaultDevelopmentalAttractorField(), authoredProjectHistory:[], longitudinalMilestones:[] });
