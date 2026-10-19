export type ValidationObservation = {
  id: string;
  input: string;
  predicted: string;
  outcome: string;
  error: number;
};

export class RuntimeCognitiveValidationEngine {
  private history: ValidationObservation[] = [];

  record(observation: ValidationObservation) {
    this.history.push(observation);
    if (this.history.length > 512) this.history.shift();
  }

  evaluate() {
    const count = this.history.length;
    if (!count) return { samples: 0, adaptation: 0, stability: 1 };

    const averageError = this.history.reduce((a, b) => a + b.error, 0) / count;
    return {
      samples: count,
      adaptation: Math.max(0, 1 - averageError),
      stability: Math.min(1, count / 100),
    };
  }
}
