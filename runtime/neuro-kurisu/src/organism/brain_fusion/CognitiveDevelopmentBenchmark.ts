export interface DevelopmentSample {
  before: number;
  after: number;
  expectedDirection: 'increase' | 'decrease';
}

export interface DevelopmentReport {
  improvement: number;
  stable: boolean;
  samples: number;
}

/**
 * Small deterministic benchmark for checking whether a module changes
 * measurable behaviour after experience.
 */
export class CognitiveDevelopmentBenchmark {
  evaluate(samples: DevelopmentSample[]): DevelopmentReport {
    if (samples.length === 0) return { improvement: 0, stable: false, samples: 0 };
    let score = 0;
    for (const s of samples) {
      const delta = s.after - s.before;
      score += s.expectedDirection === 'increase' ? delta : -delta;
    }
    const improvement = Math.max(0, Math.min(1, score / samples.length));
    return {
      improvement,
      stable: samples.length > 2 && improvement > 0,
      samples: samples.length
    };
  }
}
