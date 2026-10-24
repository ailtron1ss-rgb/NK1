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
    this.maxHistory = Number.isSafeInteger(maxHistory)
      ? Math.max(1, Math.min(4096, maxHistory))
      : 256;
  }

  private validateEvent(value: unknown): CognitiveEvent {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError('cognitive-event-invalid');
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('cognitive-event-invalid');
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const row: Record<string, unknown> = Object.create(null);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        throw new TypeError('cognitive-event-invalid');
      }
      row[key] = descriptor.value;
    }
    const id = row.id;
    const boundedSignal = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
    if (typeof id !== 'string' || id.length < 1 || id.length > 180 ||
        id.trim() !== id || id.normalize('NFKC') !== id ||
        Array.from(id).some((character) => { const code = character.codePointAt(0) ?? 0; return code <= 0x1f || (code >= 0x7f && code <= 0x9f); }) ||
        !boundedSignal(row.novelty) || !boundedSignal(row.predictionError) ||
        !boundedSignal(row.importance) || typeof row.timestamp !== 'number' ||
        !Number.isFinite(row.timestamp) || row.timestamp < 0) {
      throw new TypeError('cognitive-event-invalid');
    }
    return {
      id,
      novelty: row.novelty as number,
      predictionError: row.predictionError as number,
      importance: row.importance as number,
      timestamp: row.timestamp,
    };
  }

  process(event: CognitiveEvent): CognitiveLoopResult {
    const safeEvent = this.validateEvent(event);
    this.history.push(safeEvent);
    if (this.history.length > this.maxHistory) this.history.shift();

    const learningSignal = this.clamp(
      safeEvent.predictionError * 0.45 + safeEvent.novelty * 0.35 + safeEvent.importance * 0.2,
    );

    const consolidationSignal = this.clamp(
      safeEvent.importance * 0.6 + safeEvent.predictionError * 0.4,
    );

    const explorationSignal = this.clamp(
      safeEvent.novelty * 0.7 + safeEvent.predictionError * 0.3,
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
