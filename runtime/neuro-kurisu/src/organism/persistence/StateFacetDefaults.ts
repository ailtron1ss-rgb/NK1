/**
 * Stable facade for canonical state facet defaults. Implementations are split
 * by domain so persistence migration does not depend on every subsystem directly.
 */
export const defaultNeeds = () => ({ energy:0.82, cognitiveLoad:0.18, uncertainty:0.35, socialNeed:0.28, novelty:0.42, identityCoherence:0.88, goalPressure:0.18 });

export { defaultMemoryFacet } from './state-defaults/MemoryFacetDefaults.ts';
export { defaultEmbodimentFacet } from './state-defaults/EmbodimentFacetDefaults.ts';
export { defaultLearningFacet } from './state-defaults/LearningFacetDefaults.ts';
export { defaultConsciousnessFacet } from './state-defaults/ConsciousnessFacetDefaults.ts';
export { defaultEvolutionFacet } from './state-defaults/EvolutionFacetDefaults.ts';
export { defaultAdvancedFacet } from './state-defaults/AdvancedFacetDefaults.ts';
export { defaultCognitionFacet } from './state-defaults/CognitionFacetDefaults.ts';
