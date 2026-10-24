/** Advanced state defaults for causal experience, developmental learning, and cognitive research. */
import { defaultCausalExperienceStream } from '../../learning/CausalExperienceStream.ts';
import { defaultCognitiveResearchBattery } from '../../learning/CognitiveResearchBattery.ts';
import { defaultCausalDevelopmentLoop } from '../../learning/CausalDevelopmentLoop.ts';

export const defaultAdvancedResearchFacet = () => ({
  causalExperience: defaultCausalExperienceStream(),
  causalDevelopmentLoop: defaultCausalDevelopmentLoop(),
  cognitiveResearchBattery: defaultCognitiveResearchBattery(),
});
