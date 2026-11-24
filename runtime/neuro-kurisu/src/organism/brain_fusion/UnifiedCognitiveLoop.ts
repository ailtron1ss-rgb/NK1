export type CognitivePhase =
  | 'observation'
  | 'prediction'
  | 'evaluation'
  | 'consolidation'
  | 'adaptation';

export interface CognitiveEvent {
  id: string;
  novelty: number;
  predictionError: number;
  importance: number;
  timestamp: number;
}

export interface CognitiveLoopResult {
  phase: CognitivePhase;
  learningSignal: number;
  consolidationSignal: number;
  explorationSignal: number;
}

/**
 * Unified cognitive loop coordinator.
 * This is intentionally lightweight for mobile execution.
 * It creates a single feedback point between experience, learning and memory.
 */
export class UnifiedCognitiveLoop {
  private history: CognitiveEvent[] = [];
  private readonly maxHistory: number;

  constructor(maxHistory = 256) {
    this.maxHistory = maxHistory;
  }

  process(event: CognitiveEvent): CognitiveLoopResult {
    this.history.push(event);
    if (this.history.length > this.maxHistory) this.history.shift();

    const learningSignal = this.clamp(
      event.predictionError * 0.45 + event.novelty * 0.35 + event.importance * 0.2,
    );

    const consolidationSignal = this.clamp(
      event.importance * 0.6 + event.predictionError * 0.4,
    );

    const explorationSignal = this.clamp(
      event.novelty * 0.7 + event.predictionError * 0.3,
    );

    return {
      phase: 'adaptation',
      learningSignal,
      consolidationSignal,
      explorationSignal,
    };
  }

  getHistorySize(): number {
    return this.history.length;
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
