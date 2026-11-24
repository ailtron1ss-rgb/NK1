/**
 * P3351-P3500 Behaviour Change Evaluator
 * Measures state transitions for experiments.
 */
export interface BehaviourSnapshot {
  label: string;
  score: number;
  memoryReferences: number;
}

export interface BehaviourDelta {
  scoreDelta: number;
  memoryDelta: number;
  changed: boolean;
}

export class BehaviourChangeEvaluator {
  compare(before: BehaviourSnapshot, after: BehaviourSnapshot): BehaviourDelta {
    const scoreDelta = after.score - before.score;
    const memoryDelta = after.memoryReferences - before.memoryReferences;
    return {
      scoreDelta,
      memoryDelta,
      changed: Math.abs(scoreDelta) > 0.001 || memoryDelta !== 0,
    };
  }
}
