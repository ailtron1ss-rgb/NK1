import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, Number.isFinite(x) ? x : (a + b) / 2));
const mean = (x: number[]) => x.length ? x.reduce((a, b) => a + b, 0) / x.length : 0.5;

export interface B2506State {
  version: 1;
  enabled: boolean;
  tick: number;
  cycles: number;
  authority01: number;
  reliability01: number;
  causalEvidence01: number;
  consensus01: number;
  conflict01: number;
  failure01: number;
  escalations: number;
  deescalations: number;
  lastComposite: number[];
  lastBase: number[];
  lastSelectedPrediction01: number;
  lastSelectedAction: ActionKind;
  mode: 'guarded' | 'balanced' | 'neural-central';
}

export interface B2506Input {
  tick: number;
  baseUtilities: Record<ActionKind, number>;
  neuralUtilities: Record<ActionKind, number>[];
  neuralConfidences: number[];
  uncertainty01: number;
  predictionError01: number;
  causalEffects01: number[];
  performanceProfile?: 'quality' | 'balanced' | 'mobile';
  energy01: number;
  thermal01: number;
}
export interface B2506Output {
  authority01: number;
  actionBias: Record<ActionKind, number>;
  actionGate: Record<ActionKind, number>;
  consensus01: number;
  conflict01: number;
  neuralCentrality01: number;
  mode: 'guarded' | 'balanced' | 'neural-central';
  selectedAction: ActionKind;
}

export const defaultB2506State = (): B2506State => ({
  version: 1,
  enabled: true,
  tick: 0,
  cycles: 0,
  authority01: 0.28,
  reliability01: 0.55,
  causalEvidence01: 0,
  consensus01: 0.5,
  conflict01: 0.25,
  failure01: 0.2,
  escalations: 0,
  deescalations: 0,
  lastComposite: ACTIONS.map(() => 0.5),
  lastBase: ACTIONS.map(() => 0.5),
  lastSelectedPrediction01: 0.5,
  lastSelectedAction: 'wait',
  mode: 'guarded',
});

export class B2506NeuralBottleneckEscalator {
  readonly systemName = 'cognition:b2506-neural-bottleneck-escalator' as const;
  private state = defaultB2506State();

  snapshot() { return structuredClone(this.state); }
  restore(raw?: Partial<B2506State> | null) { this.state = { ...defaultB2506State(), ...structuredClone(raw ?? {}), version: 1 }; }
  setEnabled(x: boolean) { this.state.enabled = !!x; }

  beforeDecision(i: B2506Input): B2506Output {
    const base = ACTIONS.map(a => clamp(i.baseUtilities[a] ?? 0.5));
    if (!this.state.enabled) {
      const selected = ACTIONS[base.indexOf(Math.max(...base))] ?? 'wait';
      return {
        authority01: 0,
        actionBias: Object.fromEntries(ACTIONS.map(x => [x, 0])) as any,
        actionGate: Object.fromEntries(ACTIONS.map(x => [x, 0.5])) as any,
        consensus01: 0.5,
        conflict01: 1,
        neuralCentrality01: 0,
        mode: 'guarded',
        selectedAction: selected,
      };
    }
    const columns = i.neuralUtilities.map(u => ACTIONS.map(a => clamp(u[a] ?? 0.5)));
    const meanNeural = ACTIONS.map((_, k) => columns.length ? columns.reduce((z, row) => z + row[k]!, 0) / columns.length : 0.5);
    const spread = ACTIONS.map((_, k) => columns.length ? Math.max(...columns.map(row => row[k]!)) - Math.min(...columns.map(row => row[k]!)) : 0.5);
    const consensus = clamp(1 - spread.reduce((a, b) => a + b, 0) / Math.max(1, ACTIONS.length));
    const causal = clamp(mean(i.causalEffects01));
    const evidence = clamp(0.28 * consensus + 0.26 * mean(i.neuralConfidences) + 0.26 * causal + 0.20 * (1 - i.predictionError01));
    const resourceGuard = clamp(i.energy01 * 0.65 + (1 - i.thermal01) * 0.35);
    const target = clamp(0.18 + 0.58 * evidence + 0.18 * resourceGuard - 0.24 * i.uncertainty01 - 0.16 * i.predictionError01);
    const floor = i.performanceProfile === 'mobile' ? 0.10 : 0.08;
    const next = clamp(this.state.authority01 * 0.88 + target * 0.12, floor, 0.82);
    if (next > this.state.authority01 + 0.025) this.state.escalations++;
    if (next < this.state.authority01 - 0.025) this.state.deescalations++;
    this.state.authority01 = next;
    this.state.reliability01 = clamp(this.state.reliability01 * 0.94 + 0.06 * evidence);
    this.state.causalEvidence01 = clamp(this.state.causalEvidence01 * 0.96 + 0.04 * causal);
    this.state.consensus01 = clamp(this.state.consensus01 * 0.92 + 0.08 * consensus);
    this.state.conflict01 = clamp(this.state.conflict01 * 0.92 + 0.08 * mean(spread));
    this.state.tick = i.tick;
    this.state.cycles++;
    const bias = meanNeural.map((u, k) => clamp((u - base[k]!) * this.state.authority01, -0.14, 0.14));
    const gate = ACTIONS.map((_, k) => clamp(0.35 + 0.55 * this.state.authority01 + 0.10 * (1 - spread[k]!)));
    const scores = base.map((b, k) => b + bias[k]!);
    const selectedIndex = scores.indexOf(Math.max(...scores));
    const selected = ACTIONS[selectedIndex] ?? 'wait';
    const mode = this.state.authority01 > 0.62 ? 'neural-central' : this.state.authority01 > 0.35 ? 'balanced' : 'guarded';
    this.state.mode = mode;
    this.state.lastBase = base;
    this.state.lastComposite = meanNeural;
    this.state.lastSelectedPrediction01 = meanNeural[selectedIndex] ?? 0.5;
    this.state.lastSelectedAction = selected;
    return {
      authority01: this.state.authority01,
      actionBias: Object.fromEntries(ACTIONS.map((a, k) => [a, bias[k]!])) as any,
      actionGate: Object.fromEntries(ACTIONS.map((a, k) => [a, gate[k]!])) as any,
      consensus01: this.state.consensus01,
      conflict01: this.state.conflict01,
      neuralCentrality01: this.state.authority01,
      mode,
      selectedAction: selected,
    };
  }

  afterOutcome(i: { reward01: number; predicted01?: number; verified01: number; predictionError01: number; tick: number }) {
    const predicted = i.predicted01 ?? this.state.lastSelectedPrediction01;
    const error = Math.abs(clamp(i.reward01) - clamp(predicted));
    const success = clamp(1 - error);
    this.state.reliability01 = clamp(this.state.reliability01 * 0.91 + success * 0.09);
    this.state.failure01 = clamp(this.state.failure01 * 0.91 + error * 0.09);
    const correction = (success - 0.5) * 0.045 + clamp(i.verified01) * 0.015;
    this.state.authority01 = clamp(this.state.authority01 + correction);
  }

  diagnostics() {
    return {
      enabled: this.state.enabled,
      cycles: this.state.cycles,
      authority01: this.state.authority01,
      reliability01: this.state.reliability01,
      causalEvidence01: this.state.causalEvidence01,
      consensus01: this.state.consensus01,
      conflict01: this.state.conflict01,
      failure01: this.state.failure01,
      escalations: this.state.escalations,
      deescalations: this.state.deescalations,
      lastSelectedPrediction01: this.state.lastSelectedPrediction01,
      lastSelectedAction: this.state.lastSelectedAction,
      mode: this.state.mode,
    };
  }
}
