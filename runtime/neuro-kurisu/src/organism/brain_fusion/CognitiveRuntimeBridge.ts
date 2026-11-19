import { FullCognitiveOrganismLoop } from './FullCognitiveOrganismLoop.ts';
import type { OrganismExperience, CognitiveCycleState } from './FullCognitiveOrganismLoop.ts';

export interface RuntimeDecision {
  state: CognitiveCycleState;
  shouldConsolidate: boolean;
  shouldExplore: boolean;
  priority: number;
}

/**
 * Connects runtime events with cognitive evaluation.
 * This is an integration primitive, not a claim of artificial consciousness.
 */
export class CognitiveRuntimeBridge {
  private readonly loop: FullCognitiveOrganismLoop;
  private cycle = 0;

  constructor(limit = 512) {
    this.loop = new FullCognitiveOrganismLoop(limit);
  }

  processExperience(experience: OrganismExperience): RuntimeDecision {
    this.cycle++;
    const state = this.loop.step(experience);
    return {
      state,
      shouldConsolidate: state.memoryPriority > 0.55,
      shouldExplore: state.exploration > 0.5,
      priority: Math.min(1, (state.adaptation + state.memoryPriority) / 2)
    };
  }

  getCycleCount(): number {
    return this.cycle;
  }
}
