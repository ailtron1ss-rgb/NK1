export interface MemoryCandidate {
  importance: number;
  recurrence: number;
  emotionalWeight: number;
}

export class MemoryConsolidationScheduler {
  score(candidate: MemoryCandidate): number {
    return Math.max(0, Math.min(1,
      candidate.importance * 0.5 +
      candidate.recurrence * 0.3 +
      candidate.emotionalWeight * 0.2,
    ));
  }
}
