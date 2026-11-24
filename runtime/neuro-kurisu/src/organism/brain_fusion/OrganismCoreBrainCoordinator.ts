export type BrainCycleInput = {
  experienceId: string;
  predictionError?: number;
  novelty?: number;
  importance?: number;
};

export type BrainCycleOutput = {
  learningSignal: number;
  consolidationSignal: number;
  explorationSignal: number;
  stabilitySignal: number;
};

/**
 * Lightweight coordinator for joining brain subsystems.
 * Intentionally dependency-free for mobile execution.
 */
export class OrganismCoreBrainCoordinator {
  private stability = 1;

  process(input: BrainCycleInput): BrainCycleOutput {
    const error = clamp(input.predictionError ?? 0);
    const novelty = clamp(input.novelty ?? 0);
    const importance = clamp(input.importance ?? 0);

    const learningSignal = clamp(error * 0.45 + importance * 0.35 + novelty * 0.2);
    const consolidationSignal = clamp(importance * 0.6 + error * 0.25);
    const explorationSignal = clamp(novelty * 0.7 + error * 0.3);

    this.stability = clamp(this.stability * 0.9 + (1 - error) * 0.1);

    return {
      learningSignal,
      consolidationSignal,
      explorationSignal,
      stabilitySignal: this.stability,
    };
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
