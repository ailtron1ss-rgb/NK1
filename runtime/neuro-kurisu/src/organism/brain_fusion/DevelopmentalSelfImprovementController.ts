export interface DevelopmentSignal {
  weakness: number;
  uncertainty: number;
  improvementGain: number;
}

export interface DevelopmentDecision {
  shouldExperiment: boolean;
  priority: number;
}

/**
 * Experimental self-development controller.
 * Selects where improvement experiments are worth spending resources.
 */
export class DevelopmentalSelfImprovementController {
  evaluate(signal: DevelopmentSignal): DevelopmentDecision {
    const priority = Math.max(
      0,
      Math.min(1,
        signal.weakness * 0.45 +
        signal.uncertainty * 0.35 +
        signal.improvementGain * 0.2,
      ),
    );

    return {
      shouldExperiment: priority > 0.55,
      priority,
    };
  }
}
