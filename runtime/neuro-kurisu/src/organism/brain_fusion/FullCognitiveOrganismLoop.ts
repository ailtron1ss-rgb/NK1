export interface OrganismExperience {
  id: string;
  predictionError: number;
  novelty: number;
  reward: number;
  stability: number;
  timestamp: number;
}

export interface CognitiveCycleState {
  adaptation: number;
  memoryPriority: number;
  exploration: number;
  stabilityRisk: number;
}

/**
 * Lightweight mobile-oriented integration layer.
 * Purpose: connect experience, learning, memory and stability signals.
 * It does not claim consciousness; it provides measurable cognitive control signals.
 */
export class FullCognitiveOrganismLoop {
  private readonly recent: OrganismExperience[] = [];
  private readonly limit: number;

  constructor(limit = 512) {
    this.limit = limit;
  }

  step(experience: OrganismExperience): CognitiveCycleState {
    this.recent.push(experience);
    if (this.recent.length > this.limit) this.recent.shift();

    const adaptation = this.clamp(
      experience.predictionError * 0.4 +
      experience.novelty * 0.25 +
      experience.reward * 0.35,
    );

    const memoryPriority = this.clamp(
      experience.reward * 0.45 + experience.predictionError * 0.35 + experience.novelty * 0.2,
    );

    const exploration = this.clamp(
      experience.novelty * 0.55 + experience.predictionError * 0.45,
    );

    const stabilityRisk = this.clamp(1 - experience.stability);

    return { adaptation, memoryPriority, exploration, stabilityRisk };
  }

  getRecentCount(): number {
    return this.recent.length;
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
