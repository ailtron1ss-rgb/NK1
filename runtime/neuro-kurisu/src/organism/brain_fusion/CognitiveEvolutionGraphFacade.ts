/**
 * Compatibility facade. The richer canonical cognitive evolution graph lives
 * under cognition/evolution; this module prevents two independent graph
 * implementations from drifting apart.
 */
export {
  CognitiveEvolutionGraph,
  type CognitiveEvolutionNode,
  type CognitiveEvolutionEdge,
} from '../cognition/evolution/CognitiveEvolutionGraph.ts';
