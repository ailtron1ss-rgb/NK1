export interface B2508State {
  version: 1;
  enabled: boolean;
  tick: number;
  cycles: number;
  mode: 'mobile' | 'balanced' | 'quality';
  computeBudget01: number;
  horizon: 1 | 2 | 3 | 4;
  skipFactor: number;
  thermalGuard01: number;
  energyGuard01: number;
  uncertaintyDemand01: number;
  predictionDemand01: number;
}
export interface B2508Input {
  tick: number;
  profile: 'mobile' | 'balanced' | 'quality';
  energy01: number;
  thermal01: number;
  uncertainty01: number;
  predictionError01: number;
  cognitiveLoad01: number;
  novelty01: number;
}
export interface B2508Output {
  mode: 'mobile' | 'balanced' | 'quality';
  computeBudget01: number;
  horizon: 1 | 2 | 3 | 4;
  skipFactor: number;
  runDeepNeural: boolean;
  reason: string;
}
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, Number.isFinite(x) ? x : (a + b) / 2));

export const defaultB2508State = (): B2508State => ({
  version: 1,
  enabled: true,
  tick: 0,
  cycles: 0,
  mode: 'balanced',
  computeBudget01: 0.55,
  horizon: 3,
  skipFactor: 1,
  thermalGuard01: 0.2,
  energyGuard01: 0.2,
  uncertaintyDemand01: 0.5,
  predictionDemand01: 0.5,
});

export class B2508AdaptiveNeuralComputeGovernor {
  readonly systemName = 'cognition:b2508-adaptive-neural-compute-governor' as const;
  private state = defaultB2508State();
  snapshot() { return structuredClone(this.state); }
  restore(raw?: Partial<B2508State> | null) { this.state = { ...defaultB2508State(), ...structuredClone(raw ?? {}), version: 1 }; }
  setEnabled(x: boolean) { this.state.enabled = !!x; }

  beforeDecision(i: B2508Input): B2508Output {
    if (!this.state.enabled) return { mode: i.profile, computeBudget01: 0.5, horizon: 2, skipFactor: 1, runDeepNeural: true, reason: 'disabled-governor' };
    const demand = clamp(
      0.30 * i.uncertainty01 + 0.28 * i.predictionError01 + 0.18 * i.novelty01 +
      0.14 * (1 - i.energy01) + 0.10 * i.cognitiveLoad01,
    );
    const thermalGuard = clamp(i.thermal01);
    const energyGuard = clamp(1 - i.energy01);
    const mode = i.profile;
    let budget = mode === 'quality' ? 0.88 : mode === 'balanced' ? 0.60 : 0.38;
    budget = clamp(budget + demand * 0.25 - thermalGuard * 0.32 - energyGuard * 0.24);
    let horizon: 1 | 2 | 3 | 4 = mode === 'quality' ? 4 : mode === 'balanced' ? 3 : 2;
    if (demand > 0.72 && i.energy01 > 0.38 && thermalGuard < 0.68) horizon = Math.min(4, horizon + 1) as 1 | 2 | 3 | 4;
    if (thermalGuard > 0.74 || i.energy01 < 0.24) horizon = 1;
    const skipFactor = mode === 'quality'
      ? 1
      : mode === 'balanced'
        ? (demand > 0.58 ? 1 : 2)
        : ((demand > 0.62 && thermalGuard < 0.62) ? 2 : 4);
    const runDeepNeural = budget > 0.28 && !(thermalGuard > 0.86 && i.energy01 < 0.20);
    this.state.tick = i.tick;
    this.state.cycles++;
    this.state.mode = mode;
    this.state.computeBudget01 = budget;
    this.state.horizon = horizon;
    this.state.skipFactor = skipFactor;
    this.state.thermalGuard01 = thermalGuard;
    this.state.energyGuard01 = energyGuard;
    this.state.uncertaintyDemand01 = i.uncertainty01;
    this.state.predictionDemand01 = i.predictionError01;
    return {
      mode,
      computeBudget01: budget,
      horizon,
      skipFactor,
      runDeepNeural,
      reason: thermalGuard > 0.74 ? 'thermal-guard' : i.energy01 < 0.24 ? 'energy-guard' : demand > 0.7 ? 'high-demand' : 'adaptive',
    };
  }

  diagnostics() { return structuredClone(this.state); }
}
