export type BrainEvent = {
  id: string;
  source: string;
  value: number;
  predictionError: number;
  timestamp: number;
};

export class BrainIntegrationSpine {
  private history: BrainEvent[] = [];

  observe(event: BrainEvent) {
    this.history.push(event);
    if (this.history.length > 5000) this.history.shift();
  }

  getDevelopmentSignal() {
    const recent = this.history.slice(-50);
    const error = recent.reduce((s, e) => s + Math.abs(e.predictionError), 0);
    const value = recent.reduce((s, e) => s + e.value, 0);
    return {
      uncertainty: error / Math.max(1, recent.length),
      importance: value / Math.max(1, recent.length),
      samples: recent.length
    };
  }
}
