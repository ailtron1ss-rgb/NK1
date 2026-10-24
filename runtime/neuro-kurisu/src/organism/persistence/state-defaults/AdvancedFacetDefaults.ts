/**
 * Stable facade for advanced facet defaults. Keep the external factory and
 * state shape stable while each domain owns its initial-state dependencies.
 */
import { defaultAdvancedContextFacet } from './AdvancedContextFacetDefaults.ts';
import { defaultAdvancedEvolutionFacet } from './AdvancedEvolutionFacetDefaults.ts';
import { defaultAdvancedResearchFacet } from './AdvancedResearchFacetDefaults.ts';

export const defaultAdvancedFacet = () => ({
  ...defaultAdvancedContextFacet(),
  ...defaultAdvancedEvolutionFacet(),
  ...defaultAdvancedResearchFacet(),
});
