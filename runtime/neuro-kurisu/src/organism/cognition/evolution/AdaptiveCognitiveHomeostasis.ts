export interface CognitivePressure {
  uncertainty01: number;
  predictionError01: number;
  importance01: number;
  futureImpact01: number;
  cost01: number;
}

export class AdaptiveCognitiveHomeostasis {
  evaluate(p: CognitivePressure) {
    const priority = Math.max(0, Math.min(1,
      p.uncertainty01 * 0.25 +
      p.predictionError01 * 0.25 +
      p.importance01 * 0.2 +
      p.futureImpact01 * 0.2 -
      p.cost01 * 0.1
    ));
    return {
      priority01: priority,
      shouldInvestigate: priority > 0.55,
      shouldConsolidate: p.importance01 > 0.7 || p.predictionError01 > 0.75,
      explanation: priority > 0.55 ? 'high-cognitive-pressure' : 'stable-state'
    };
  }
}
