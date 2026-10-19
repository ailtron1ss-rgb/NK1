import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, Number.isFinite(x) ? x : (a + b) / 2));
const mean = (x: number[]) => x.length ? x.reduce((a, b) => a + b, 0) / x.length : 0;
const cosine = (a: number[], b: number[]) => {
  let aa = 0, bb = 0, ab = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    aa += a[i]! * a[i]!;
    bb += b[i]! * b[i]!;
    ab += a[i]! * b[i]!;
  }
  return aa && bb ? clamp((ab / Math.sqrt(aa * bb) + 1) / 2) : 0.5;
};

export interface B2505Primitive {
  key: string;
  vector: number[];
  value01: number;
  mass01: number;
  usage: number;
  lastTick: number;
}
export interface B2505Composition {
  world: number[];
  body: number[];
  self: number[];
  goal: number[];
  action: ActionKind;
  value01: number;
  confidence01: number;
  tick: number;
}
export interface B2505State {
  version: 1;
  enabled: boolean;
  tick: number;
  cycles: number;
  learningUpdates: number;
  primitiveHits: number;
  primitiveCreates: number;
  compositions: number;
  replaySteps: number;
  holdout01: number;
  generalization01: number;
  causalEffect01: number;
  lastUtility: number[];
  primitives: B2505Primitive[];
  composed: B2505Composition[];
  lastState: number[];
  lastAction: ActionKind | null;
  lesion: boolean;
}
export interface B2505Input {
  tick: number;
  state01: number[];
  actionUtilities: Record<ActionKind, number>;
  b2504Predicted?: Record<ActionKind, number>;
  b2502Prototypes?: Array<{
    vector: number[];
    action: ActionKind;
    utility: number;
    reward01: number;
    precision01: number;
  }>;
  uncertainty01: number;
  novelty01: number;
  goalPressure01: number;
}
export interface B2505Output {
  actionBias: Record<ActionKind, number>;
  predictedUtility: Record<ActionKind, number>;
  compositionConfidence01: Record<ActionKind, number>;
  replayGain01: number;
  generalization01: number;
  selectedAction: ActionKind;
}

export const defaultB2505State = (): B2505State => ({
  version: 1,
  enabled: true,
  tick: 0,
  cycles: 0,
  learningUpdates: 0,
  primitiveHits: 0,
  primitiveCreates: 0,
  compositions: 0,
  replaySteps: 0,
  holdout01: 0,
  generalization01: 0.5,
  causalEffect01: 0,
  lastUtility: ACTIONS.map(() => 0.5),
  primitives: [],
  composed: [],
  lastState: Array(32).fill(0.5),
  lastAction: null,
  lesion: false,
});

export class B2505CompositionalReplayComposer {
  readonly systemName = 'cognition:b2505-compositional-replay-composer' as const;
  private state = defaultB2505State();

  snapshot() { return structuredClone(this.state); }

  restore(raw?: Partial<B2505State> | null) {
    const d = defaultB2505State();
    const r: any = raw ?? {};
    this.state = {
      ...d,
      ...structuredClone(r),
      version: 1,
      primitives: Array.isArray(r.primitives) ? r.primitives.slice(-96) : [],
      composed: Array.isArray(r.composed) ? r.composed.slice(-96) : [],
      lastUtility: ACTIONS.map((_, i) => clamp(r.lastUtility?.[i] ?? 0.5)),
      lastState: Array.from({ length: 32 }, (_, i) => clamp(r.lastState?.[i] ?? 0.5)),
    };
  }

  setEnabled(x: boolean) { this.state.enabled = !!x; }

  private upsert(key: string, vector: number[], value: number, tick: number) {
    const p = this.state.primitives.find(x => x.key === key);
    if (p) {
      const q = 0.16 + 0.08 * clamp(value);
      for (let k = 0; k < Math.min(8, vector.length); k++) {
        p.vector[k] = clamp(p.vector[k]! * (1 - q) + vector[k]! * q);
      }
      p.value01 = clamp(p.value01 * 0.88 + value * 0.12);
      p.mass01 = clamp(p.mass01 * 0.94 + 0.06);
      p.usage++;
      p.lastTick = tick;
      this.state.primitiveHits++;
      return;
    }
    if (this.state.primitives.length < 96) {
      this.state.primitives.push({
        key,
        vector: vector.slice(0, 8),
        value01: clamp(value),
        mass01: 0.5,
        usage: 1,
        lastTick: tick,
      });
      this.state.primitiveCreates++;
    }
  }

  beforeDecision(i: B2505Input): B2505Output {
    const base = ACTIONS.map(a => clamp(i.actionUtilities[a] ?? 0.5));
    if (!this.state.enabled) {
      const selected = ACTIONS[base.indexOf(Math.max(...base))] ?? 'wait';
      return {
        actionBias: Object.fromEntries(ACTIONS.map(x => [x, 0])) as any,
        predictedUtility: Object.fromEntries(ACTIONS.map((x, k) => [x, base[k]!])) as any,
        compositionConfidence01: Object.fromEntries(ACTIONS.map(x => [x, 0.3])) as any,
        replayGain01: 0,
        generalization01: this.state.generalization01,
        selectedAction: selected,
      };
    }
    if (i.b2502Prototypes?.length) {
      for (const proto of i.b2502Prototypes.slice(-16)) {
        const value = clamp(proto.utility * 0.60 + proto.reward01 * 0.30 + proto.precision01 * 0.10);
        this.upsert(`replay:${proto.action}`, proto.vector.slice(0, 8), value, i.tick);
      }
    }
    const s = Array.from({ length: 32 }, (_, k) => clamp(i.state01[k % Math.max(1, i.state01.length)] ?? 0.5));
    const groups = [s.slice(0, 8), s.slice(8, 16), s.slice(16, 24), s.slice(24, 32)];
    const utilities: number[] = [];
    const confidence: number[] = [];

    for (const action of ACTIONS) {
      const candidates = this.state.primitives
        .filter(p => p.key.startsWith('world:') || p.key.startsWith('body:') || p.key.startsWith('self:') || p.key.startsWith('goal:') || p.key.startsWith('replay:'))
        .map(p => {
          const gi = p.key.startsWith('world:') || p.key.startsWith('replay:') ? 0 : p.key.startsWith('body:') ? 1 : p.key.startsWith('self:') ? 2 : 3;
          return { p, q: cosine(p.vector, groups[gi] ?? s.slice(0, 8)), gi };
        })
        .sort((x, y) => y.q - x.q)
        .slice(0, 6);
      let value = 0.5;
      let conf = 0.25;
      if (candidates.length) {
        const byDomain = [0, 1, 2, 3].map(gi => candidates.filter(x => x.gi === gi).slice(0, 2));
        const domainVals = byDomain.map(xs => xs.length
          ? mean(xs.map(x => x.p.value01 * x.q)) / Math.max(0.35, mean(xs.map(x => x.q)))
          : 0.5);
        const pairSynergy = 0.04 * (domainVals[0]! - 0.5) * (domainVals[2]! - 0.5) +
          0.04 * (domainVals[1]! - 0.5) * (domainVals[3]! - 0.5);
        value = clamp(domainVals.reduce((a, b) => a + b, 0) / 4 + pairSynergy);
        conf = clamp(mean(candidates.map(x => x.q)) * 0.7 + 0.2);
      }
      const actionPrim = this.state.primitives.find(p => p.key === `action:${action}`);
      if (actionPrim) {
        value = clamp(value * 0.78 + actionPrim.value01 * 0.22);
        conf = clamp(conf + 0.08 * actionPrim.mass01);
      }
      if (!this.state.lesion) {
        value = clamp(value * 0.64 + (i.b2504Predicted?.[action] ?? 0.5) * 0.36);
      }
      utilities.push(value);
      confidence.push(conf);
      this.state.compositions++;
    }

    const noveltyGain = clamp(i.novelty01 * 0.22 + i.uncertainty01 * 0.12);
    const bias = utilities.map((u, k) => clamp(
      (u - base[k]!) * (0.12 + 0.18 * confidence[k]!) + noveltyGain * (u > 0.5 ? 0.18 : 0),
      -0.10,
      0.10,
    ));
    const score = utilities.map((u, k) => u + base[k]! * 0.20 + bias[k]!);
    const selected = ACTIONS[score.indexOf(Math.max(...score))] ?? 'wait';
    this.state.tick = i.tick;
    this.state.cycles++;
    this.state.lastState = s;
    this.state.lastUtility = utilities;
    this.state.lastAction = selected;
    const generalization = clamp(
      mean(confidence) * 0.75 +
      this.state.primitiveHits / Math.max(1, this.state.primitiveHits + this.state.primitiveCreates) * 0.25,
    );
    this.state.generalization01 = clamp(this.state.generalization01 * 0.93 + 0.07 * generalization);
    return {
      actionBias: Object.fromEntries(ACTIONS.map((a, k) => [a, bias[k]!])) as any,
      predictedUtility: Object.fromEntries(ACTIONS.map((a, k) => [a, utilities[k]!])) as any,
      compositionConfidence01: Object.fromEntries(ACTIONS.map((a, k) => [a, confidence[k]!])) as any,
      replayGain01: clamp(this.state.replaySteps / 64),
      generalization01: this.state.generalization01,
      selectedAction: selected,
    };
  }

  afterOutcome(i: { tick: number; action: ActionKind; reward01: number; nextState01: number[]; verified01: number; predictionError01: number }) {
    if (!this.state.enabled) return;
    const s = this.state.lastState;
    const next = Array.from({ length: 32 }, (_, k) => clamp(i.nextState01?.[k] ?? 0.5));
    const reward = clamp(i.reward01);
    this.upsert(`world:${i.action}`, s.slice(0, 8), reward, i.tick);
    this.upsert(`body:${i.action}`, s.slice(8, 16), reward, i.tick);
    this.upsert(`self:${i.action}`, s.slice(16, 24), reward, i.tick);
    this.upsert(`goal:${i.action}`, s.slice(24, 32), reward, i.tick);
    this.upsert(`action:${i.action}`, [...s.slice(0, 4), ...next.slice(0, 4)], reward, i.tick);
    this.state.composed.push({
      world: s.slice(0, 8), body: s.slice(8, 16), self: s.slice(16, 24), goal: s.slice(24, 32),
      action: i.action, value01: reward, confidence01: clamp(1 - i.predictionError01), tick: i.tick,
    });
    if (this.state.composed.length > 96) this.state.composed.splice(0, this.state.composed.length - 96);
    this.state.learningUpdates++;
  }

  consolidate(budget = 8) {
    if (!this.state.enabled) return 0;
    let steps = 0;
    const recent = this.state.composed.slice(-Math.max(1, budget * 2));
    for (const c of recent) {
      if (steps >= budget) break;
      const key = `composition:${c.action}:${Math.round(c.value01 * 10)}`;
      this.upsert(key, [...c.world.slice(0, 4), ...c.self.slice(0, 4)], c.value01, c.tick);
      steps++;
    }
    this.state.replaySteps += steps;
    this.state.holdout01 = clamp(this.state.holdout01 * 0.9 + 0.1 * this.state.generalization01);
    return steps;
  }

  lesionFraction() {
    const before = this.state.lastUtility.slice();
    this.state.lesion = true;
    const out = this.beforeDecision({
      tick: this.state.tick + 1,
      state01: this.state.lastState,
      actionUtilities: Object.fromEntries(ACTIONS.map((a, k) => [a, before[k] ?? 0.5])) as any,
      uncertainty01: 0.5,
      novelty01: 0.4,
      goalPressure01: 0.5,
    });
    const after = ACTIONS.map(a => out.predictedUtility[a] ?? 0.5);
    const effect = mean(before.map((x, k) => Math.abs(x - (after[k] ?? x))));
    this.state.lesion = false;
    this.state.causalEffect01 = Math.max(this.state.causalEffect01, effect);
    return { effect01: effect, compositions: this.state.composed.length, primitives: this.state.primitives.length };
  }

  diagnostics() {
    return {
      enabled: this.state.enabled,
      cycles: this.state.cycles,
      learningUpdates: this.state.learningUpdates,
      primitiveHits: this.state.primitiveHits,
      primitiveCreates: this.state.primitiveCreates,
      compositions: this.state.compositions,
      replaySteps: this.state.replaySteps,
      holdout01: this.state.holdout01,
      generalization01: this.state.generalization01,
      causalEffect01: this.state.causalEffect01,
    };
  }
}
