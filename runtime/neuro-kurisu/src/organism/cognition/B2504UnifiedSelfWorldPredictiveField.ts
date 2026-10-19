import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const D = 32;
const HEADS = 3;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, Number.isFinite(x) ? x : (a + b) / 2));
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const hash = (x: number) => { x |= 0; x = Math.imul(x ^ (x >>> 16), 0x21f0aaad); x = Math.imul(x ^ (x >>> 15), 0x735a2d97); return (x ^ (x >>> 13)) >>> 0; };
const rand = (seed: number, scale = 0.03) => ((hash(seed) / 0xffffffff) * 2 - 1) * scale;

export interface B2504Head {
  decay: number[];
  actionEffect: number[][];
  groupGain: number[];
  rewardBias: number;
  rewardAction: number[];
  error01: number;
  mass01: number;
}

export interface B2504State {
  version: 1;
  enabled: boolean;
  tick: number;
  cycles: number;
  learningUpdates: number;
  rollouts: number;
  predictionError01: number;
  uncertainty01: number;
  calibration01: number;
  causalEffect01: number;
  selfConsistency01: number;
  actionUtility: number[];
  actionBias: number[];
  actionUncertainty: number[];
  heads: B2504Head[];
  lastState: number[];
  lastPrediction: number[];
  horizon: 1 | 2 | 3 | 4;
  lesion: boolean;
}

export interface B2504Input {
  tick: number;
  state01: number[];
  baseUtilities: Record<ActionKind, number>;
  b2502Utility?: Record<ActionKind, number>;
  b2503Prediction?: Record<ActionKind, number>;
  uncertainty01: number;
  predictionError01: number;
  novelty01: number;
  energy01: number;
  cognitiveLoad01: number;
  goalPressure01: number;
}

export interface B2504Output {
  predictedUtility: Record<ActionKind, number>;
  actionBias: Record<ActionKind, number>;
  uncertainty: Record<ActionKind, number>;
  statePrediction: number[];
  worldPrediction01: number;
  bodyPrediction01: number;
  selfPrediction01: number;
  goalPrediction01: number;
  selfConsistency01: number;
  causalSpread01: number;
  bottleneckConfidence01: number;
  selectedAction: ActionKind;
}

const makeHead = (h: number): B2504Head => ({
  decay: Array.from({ length: D }, (_, k) => 0.74 + rand(250400 + h * 100 + k, 0.025)),
  actionEffect: ACTIONS.map((_, a) => Array.from({ length: D }, (_, k) => rand(250420 + h * 1000 + a * 40 + k, 0.018))),
  groupGain: [0.04 + rand(250460 + h, 0.012), 0.04 + rand(250470 + h, 0.012), 0.04 + rand(250480 + h, 0.012), 0.04 + rand(250490 + h, 0.012)],
  rewardBias: 0,
  rewardAction: ACTIONS.map(() => 0),
  error01: 0.5,
  mass01: 0.5,
});

export const defaultB2504State = (): B2504State => ({
  version: 1,
  enabled: true,
  tick: 0,
  cycles: 0,
  learningUpdates: 0,
  rollouts: 0,
  predictionError01: 0.45,
  uncertainty01: 0.5,
  calibration01: 0.5,
  causalEffect01: 0,
  selfConsistency01: 0.5,
  actionUtility: ACTIONS.map(() => 0.5),
  actionBias: ACTIONS.map(() => 0),
  actionUncertainty: ACTIONS.map(() => 0.6),
  heads: Array.from({ length: HEADS }, (_, h) => makeHead(h)),
  lastState: Array(D).fill(0.5),
  lastPrediction: Array(D).fill(0.5),
  horizon: 3,
  lesion: false,
});

export class B2504UnifiedSelfWorldPredictiveField {
  readonly systemName = 'cognition:b2504-unified-self-world-predictive-field' as const;
  private state = defaultB2504State();
  private lesionFraction01 = 0;

  snapshot() { return structuredClone(this.state); }

  restore(raw?: Partial<B2504State> | null) {
    const d = defaultB2504State();
    const r: any = raw ?? {};
    const rawHeads = Array.isArray(r.heads) && r.heads.length ? r.heads : d.heads;
    this.state = {
      ...d,
      ...structuredClone(r),
      version: 1,
      heads: Array.from({ length: HEADS }, (_, h) => {
        const q = rawHeads[h] ?? d.heads[h]!;
        return {
          ...d.heads[h],
          ...q,
          decay: Array.from({ length: D }, (_, k) => clamp(q.decay?.[k] ?? d.heads[h]!.decay[k], 0.35, 0.98)),
          actionEffect: ACTIONS.map((_, a) => Array.from({ length: D }, (_, k) => clamp(q.actionEffect?.[a]?.[k] ?? d.heads[h]!.actionEffect[a]![k]!, -0.25, 0.25))),
          groupGain: Array.from({ length: 4 }, (_, k) => clamp(q.groupGain?.[k] ?? d.heads[h]!.groupGain[k], -0.4, 0.4)),
          rewardBias: clamp(q.rewardBias ?? d.heads[h]!.rewardBias, -0.5, 0.5),
          rewardAction: ACTIONS.map((_, a) => clamp(q.rewardAction?.[a] ?? d.heads[h]!.rewardAction[a]!, -0.5, 0.5)),
        };
      }),
      lastState: Array.from({ length: D }, (_, k) => clamp(r.lastState?.[k] ?? 0.5)),
      lastPrediction: Array.from({ length: D }, (_, k) => clamp(r.lastPrediction?.[k] ?? 0.5)),
      actionUtility: ACTIONS.map((_, i) => clamp(r.actionUtility?.[i] ?? 0.5)),
      actionBias: ACTIONS.map((_, i) => clamp(r.actionBias?.[i] ?? 0, -0.2, 0.2)),
      actionUncertainty: ACTIONS.map((_, i) => clamp(r.actionUncertainty?.[i] ?? 0.6)),
    };
  }

  setEnabled(x: boolean) { this.state.enabled = !!x; }
  setHorizon(h: 1 | 2 | 3 | 4) { this.state.horizon = h; }

  private groups(state: number[]) {
    return [mean(state.slice(0, 8)), mean(state.slice(8, 16)), mean(state.slice(16, 24)), mean(state.slice(24, 32))];
  }

  private step(state: number[], action: ActionKind, head: B2504Head) {
    const ai = Math.max(0, ACTIONS.indexOf(action));
    const g = this.groups(state);
    const out = new Array(D).fill(0);
    for (let k = 0; k < D; k++) {
      const gi = k < 8 ? 0 : k < 16 ? 1 : k < 24 ? 2 : 3;
      const cross = (g[(gi + 1) % 4]! - 0.5) * head.groupGain[gi]! + (g[(gi + 2) % 4]! - 0.5) * 0.5 * head.groupGain[gi]!;
      const effect = this.state.lesion ? head.actionEffect[ai]![k]! * (1 - this.lesionFraction01) : head.actionEffect[ai]![k]!;
      out[k] = clamp(state[k]! * head.decay[k]! + effect * 0.82 + cross + (g[gi]! - 0.5) * 0.10);
    }
    return out;
  }

  private project(state: number[], action: ActionKind) {
    const preds: number[][] = [];
    const rewards: number[] = [];
    for (let h = 0; h < HEADS; h++) {
      let cur = state.slice();
      let reward = 0.5;
      for (let t = 0; t < this.state.horizon; t++) cur = this.step(cur, action, this.state.heads[h]!);
      const head = this.state.heads[h]!;
      reward = clamp(0.50 + head.rewardBias + head.rewardAction[ACTIONS.indexOf(action)]! + (mean(cur.slice(0, 8)) - mean(cur.slice(8, 16))) * 0.10 + head.mass01 * 0.04);
      preds.push(cur);
      rewards.push(reward);
    }
    const next = Array.from({ length: D }, (_, k) => mean(preds.map(x => x[k]!)));
    const spread = mean(next.map((x, k) => mean(preds.map(p => Math.abs(p[k]! - x)))));
    const headSpread = Math.max(...rewards) - Math.min(...rewards);
    return {
      next,
      reward: clamp(mean(rewards)),
      uncertainty: clamp(0.16 + spread * 0.8 + headSpread * 0.7 + mean(this.state.heads.map(h => h.error01)) * 0.3),
      spread: clamp(headSpread * 0.8 + spread * 0.6),
    };
  }

  beforeDecision(i: B2504Input): B2504Output {
    const base = ACTIONS.map(a => clamp(i.baseUtilities[a] ?? 0.5));
    if (!this.state.enabled) {
      const selected = ACTIONS[base.indexOf(Math.max(...base))] ?? 'wait';
      return {
        predictedUtility: Object.fromEntries(ACTIONS.map((a, k) => [a, base[k]!])) as any,
        actionBias: Object.fromEntries(ACTIONS.map(a => [a, 0])) as any,
        uncertainty: Object.fromEntries(ACTIONS.map(a => [a, 0.7])) as any,
        statePrediction: this.state.lastPrediction.slice(),
        worldPrediction01: 0.5,
        bodyPrediction01: 0.5,
        selfPrediction01: 0.5,
        goalPrediction01: 0.5,
        selfConsistency01: 0.5,
        causalSpread01: 0,
        bottleneckConfidence01: 0.2,
        selectedAction: selected,
      };
    }

    const state = Array.from({ length: D }, (_, k) => clamp(i.state01[k % Math.max(1, i.state01.length)] ?? 0.5));
    const preds: number[] = [];
    const uncs: number[] = [];
    const spreads: number[] = [];
    for (const action of ACTIONS) {
      const p = this.project(state, action);
      preds.push(p.reward);
      uncs.push(p.uncertainty);
      spreads.push(p.spread);
    }
    const precision = clamp(
      0.22 + 0.26 * (1 - i.uncertainty01) + 0.18 * (1 - i.predictionError01) +
      0.12 * (1 - i.cognitiveLoad01) + 0.12 * this.state.calibration01 + 0.10 * i.energy01,
    );
    const unified = ACTIONS.map((action, k) => clamp(
      0.42 * preds[k]! +
      0.23 * (i.b2503Prediction?.[action] ?? 0.5) +
      0.15 * (i.b2502Utility?.[action] ?? 0.5) +
      0.20 * base[k]!,
    ));
    const bias = unified.map((u, k) => clamp((u - base[k]!) * (0.18 + 0.30 * precision), -0.13, 0.13));
    const scores = unified.map((u, k) => u + bias[k]! + base[k]! * 0.16);
    const selected = ACTIONS[scores.indexOf(Math.max(...scores))] ?? 'wait';
    const selectedProjection = this.project(state, selected);
    const groups = this.groups(selectedProjection.next);

    this.state.tick = i.tick;
    this.state.cycles++;
    this.state.rollouts += ACTIONS.length * this.state.horizon;
    this.state.lastState = state;
    this.state.lastPrediction = selectedProjection.next;
    this.state.actionUtility = unified;
    this.state.actionBias = bias;
    this.state.actionUncertainty = uncs;
    this.state.uncertainty01 = mean(uncs);
    this.state.selfConsistency01 = clamp(this.state.selfConsistency01 * 0.94 + 0.06 * (1 - selectedProjection.uncertainty));
    this.state.calibration01 = clamp(this.state.calibration01 * 0.95 + 0.05 * (1 - mean(uncs)));

    return {
      predictedUtility: Object.fromEntries(ACTIONS.map((a, k) => [a, unified[k]!])) as any,
      actionBias: Object.fromEntries(ACTIONS.map((a, k) => [a, bias[k]!])) as any,
      uncertainty: Object.fromEntries(ACTIONS.map((a, k) => [a, uncs[k]!])) as any,
      statePrediction: selectedProjection.next.slice(),
      worldPrediction01: groups[0]!,
      bodyPrediction01: groups[1]!,
      selfPrediction01: groups[2]!,
      goalPrediction01: groups[3]!,
      selfConsistency01: this.state.selfConsistency01,
      causalSpread01: mean(spreads),
      bottleneckConfidence01: clamp(0.25 + 0.55 * precision + 0.20 * this.state.selfConsistency01),
      selectedAction: selected,
    };
  }

  afterOutcome(i: { tick: number; action: ActionKind; reward01: number; nextState01: number[]; verified01: number; predictionError01: number }) {
    if (!this.state.enabled) return;
    const actual = clamp(i.reward01);
    const ai = ACTIONS.indexOf(i.action);
    const pred = this.state.actionUtility[ai] ?? 0.5;
    const err = Math.abs(actual - pred);
    this.state.predictionError01 = clamp(this.state.predictionError01 * 0.88 + err * 0.12);
    this.state.learningUpdates++;
    const next = Array.from({ length: D }, (_, k) => clamp(i.nextState01?.[k] ?? 0.5));
    const prev = this.state.lastState;
    for (let h = 0; h < HEADS; h++) {
      const head = this.state.heads[h]!;
      const alpha = (0.012 + 0.022 * clamp(i.verified01)) * (h === 0 ? 1 : h === 1 ? 0.72 : 0.48);
      for (let k = 0; k < D; k++) {
        const projected = clamp(prev[k]! * head.decay[k]! + head.actionEffect[ai]![k]! * 0.82);
        const e = next[k]! - projected;
        head.decay[k] = clamp(head.decay[k]! + alpha * e * prev[k]!, 0.35, 0.98);
        head.actionEffect[ai]![k] = clamp(head.actionEffect[ai]![k]! + alpha * e * 0.82, -0.25, 0.25);
      }
      const rewardAlpha = (0.025 + 0.035 * clamp(i.verified01)) * (h === 0 ? 1 : h === 1 ? 0.7 : 0.45);
      head.rewardBias = clamp(head.rewardBias + rewardAlpha * (actual - pred), -0.5, 0.5);
      head.rewardAction[ai] = clamp(head.rewardAction[ai]! + rewardAlpha * (actual - pred), -0.5, 0.5);
      head.error01 = clamp(head.error01 * 0.92 + 0.08 * err);
      head.mass01 = clamp(head.mass01 * 0.97 + 0.03 * clamp(i.verified01));
    }
    this.state.calibration01 = clamp(this.state.calibration01 * 0.9 + 0.1 * (1 - err));
  }

  lesionFraction(f = 0.5) {
    const before = this.state.actionUtility.slice();
    this.lesionFraction01 = clamp(f);
    this.state.lesion = true;
    const out = this.beforeDecision({
      tick: this.state.tick + 1,
      state01: this.state.lastState,
      baseUtilities: Object.fromEntries(ACTIONS.map((a, k) => [a, before[k] ?? 0.5])) as any,
      uncertainty01: 0.5,
      predictionError01: this.state.predictionError01,
      novelty01: 0.4,
      energy01: 0.7,
      cognitiveLoad01: 0.2,
      goalPressure01: 0.5,
    });
    const after = ACTIONS.map(a => out.predictedUtility[a] ?? 0.5);
    const effect = mean(before.map((x, k) => Math.abs(x - (after[k] ?? x))));
    this.state.causalEffect01 = Math.max(this.state.causalEffect01, effect);
    this.state.lesion = false;
    this.lesionFraction01 = 0;
    return { effect01: effect, heads: HEADS };
  }

  diagnostics() {
    return {
      enabled: this.state.enabled,
      cycles: this.state.cycles,
      learningUpdates: this.state.learningUpdates,
      rollouts: this.state.rollouts,
      predictionError01: this.state.predictionError01,
      uncertainty01: this.state.uncertainty01,
      calibration01: this.state.calibration01,
      causalEffect01: this.state.causalEffect01,
      selfConsistency01: this.state.selfConsistency01,
      horizon: this.state.horizon,
      actionUtility: this.state.actionUtility.slice(),
    };
  }
}
