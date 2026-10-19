import type { ActionKind } from '../core/types.ts';

const A: ActionKind[] = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, Number.isFinite(x) ? x : (a + b) / 2));
const dist = (a: number[], b: number[]) => Math.sqrt(
  a.reduce((s, x, i) => s + (x - (b[i] ?? 0)) ** 2, 0) / Math.max(1, Math.max(a.length, b.length)),
);
const mean = (xs: number[]) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;

export interface B2525Transition {
  id: number;
  action: ActionKind;
  pre: number[];
  delta: number[];
  reward01: number;
  error01: number;
  count: number;
  lastTick: number;
  success01: number;
}

export interface B2525State {
  version: 1;
  enabled: boolean;
  tick: number;
  writes: number;
  queries: number;
  transitionHits: number;
  prototypes: B2525Transition[];
  maxPrototypes: number;
  meanPredictionError01: number;
  transitionConfidence01: number;
  distributionShift01: number;
  novelty01: number;
  actionBias: Record<ActionKind, number>;
  experiments: number;
  experimentUseful: number;
  learningGain01: number;
  lesionFraction01: number;
  lastPredictedAction: ActionKind | null;
  lastPrediction: number[];
  lastPreContext: number[];
}

export const defaultB2525State = (): B2525State => ({
  version: 1,
  enabled: true,
  tick: 0,
  writes: 0,
  queries: 0,
  transitionHits: 0,
  prototypes: [],
  maxPrototypes: 384,
  meanPredictionError01: .5,
  transitionConfidence01: .25,
  distributionShift01: .5,
  novelty01: .5,
  actionBias: Object.fromEntries(A.map(a => [a, 0])) as Record<ActionKind, number>,
  experiments: 0,
  experimentUseful: 0,
  learningGain01: 0,
  lesionFraction01: 0,
  lastPredictedAction: null,
  lastPrediction: new Array(32).fill(.5),
  lastPreContext: new Array(32).fill(.5),
});

export class B2525LearnedLatentTransitionField {
  private state = defaultB2525State();
  readonly systemName = 'cognition:b2525-learned-latent-transition-field' as const;

  snapshot() { return structuredClone(this.state); }

  restore(raw?: Partial<B2525State> | null) {
    const d0 = defaultB2525State();
    const r: any = raw ?? {};
    this.state = {
      ...d0,
      ...structuredClone(r),
      prototypes: Array.isArray(r.prototypes) ? structuredClone(r.prototypes) : [],
      actionBias: { ...d0.actionBias, ...(r.actionBias ?? {}) },
      lastPrediction: Array.isArray(r.lastPrediction) ? r.lastPrediction.slice(0, 32) : d0.lastPrediction,
      lastPreContext: Array.isArray(r.lastPreContext) ? r.lastPreContext.slice(0, 32) : d0.lastPreContext,
      version: 1,
    };
  }

  setEnabled(v: boolean) { this.state.enabled = !!v; }
  setLesion(v: number) { this.state.lesionFraction01 = clamp(v); }

  beforeDecision(i: {
    tick: number;
    context: number[];
    baseUtilities: Record<ActionKind, number>;
    uncertainty01: number;
    novelty01: number;
    predictionError01: number;
    computeBudget01: number;
  }) {
    this.state.tick = i.tick;
    const zero = Object.fromEntries(A.map(a => [a, 0])) as Record<ActionKind, number>;
    if (!this.state.enabled) {
      return {
        actionBias: zero,
        transitionConfidence01: this.state.transitionConfidence01,
        distributionShift01: this.state.distributionShift01,
        novelty01: this.state.novelty01,
        experiments: 0,
      };
    }

    this.state.queries++;
    this.state.lastPreContext = i.context.slice(0, 32);
    const ranked = this.state.prototypes
      .map(p => ({ p, dist: dist(i.context, p.pre) }))
      .sort((x, y) => x.dist - y.dist)
      .slice(0, 12);
    const nearest = ranked[0]?.dist ?? 1;
    const shift = clamp(nearest * .92 + i.uncertainty01 * .08);
    this.state.distributionShift01 = clamp(this.state.distributionShift01 * .88 + shift * .12);
    this.state.novelty01 = clamp(this.state.novelty01 * .9 + shift * .1);

    const bias = zero;
    let best: ActionKind = 'wait';
    let bestScore = -Infinity;
    let bestPrediction = i.context.slice(0, 32);

    for (const a of A) {
      const rows = ranked.filter(x => x.p.action === a);
      if (!rows.length) {
        bias[a] = ((a === 'explore' || a === 'verify') ? i.uncertainty01 * .018 : 0)
          * (1 - this.state.lesionFraction01);
        continue;
      }
      const w = rows.map(x => Math.exp(-x.dist / (.08 + .22 * i.uncertainty01)));
      const z = mean(w) || 1;
      const reward = rows.reduce((s, x, j) => s + w[j]! * (x.p.reward01 - .5), 0) / z;
      const err = rows.reduce((s, x, j) => s + w[j]! * x.p.error01, 0) / z;
      const del = rows.reduce((acc, x, j) => {
        const ww = w[j]!;
        for (let k = 0; k < 32; k++) acc[k] = (acc[k] ?? 0) + ww * (x.p.delta[k] ?? 0);
        return acc;
      }, new Array(32).fill(0)).map(v => v / z);
      const pred = i.context.slice(0, 32).map((v, k) => clamp(v + (del[k] ?? 0)));
      const stability = clamp(1 - err);
      const known = clamp(1 - mean(rows.map(x => x.dist)));
      const score = (i.baseUtilities[a] ?? .5)
        + reward * .22
        + stability * .035
        + known * .025
        - shift * .018
        + (a === 'explore' || a === 'verify' ? i.uncertainty01 * .02 : 0);
      bias[a] = clamp(
        (score - (i.baseUtilities[a] ?? .5)) * .22 * (1 - .5 * this.state.lesionFraction01),
        -.10,
        .10,
      );
      if (score > bestScore) {
        bestScore = score;
        best = a;
        bestPrediction = pred;
      }
    }

    const experiment = (this.state.distributionShift01 > .58 || i.uncertainty01 > .72 || i.predictionError01 > .58) ? 1 : 0;
    if (experiment) {
      bias.explore += .012 * (1 - this.state.lesionFraction01);
      bias.verify += .010 * (1 - this.state.lesionFraction01);
      this.state.experiments++;
    }

    this.state.actionBias = bias;
    this.state.lastPredictedAction = best;
    this.state.lastPrediction = bestPrediction;
    const conf = ranked.length
      ? clamp((1 - nearest) * .5 + rowsConfidence(ranked) * .5)
      : 0;
    this.state.transitionConfidence01 = clamp(this.state.transitionConfidence01 * .93 + conf * .07);
    return {
      actionBias: { ...bias },
      transitionConfidence01: this.state.transitionConfidence01,
      distributionShift01: this.state.distributionShift01,
      novelty01: this.state.novelty01,
      experiments: experiment,
    };
  }

  afterOutcome(i: {
    tick: number;
    preContext: number[];
    postContext: number[];
    action: ActionKind;
    reward01: number;
    predictionError01: number;
  }) {
    if (!this.state.enabled) return;
    const pre = (this.state.lastPreContext.length ? this.state.lastPreContext : i.preContext).slice(0, 32);
    const post = i.postContext.slice(0, 32);
    const delta = post.map((v, k) => clamp(v - (pre[k] ?? 0), -1, 1));
    const candidates = this.state.prototypes
      .filter(p => p.action === i.action)
      .map(p => ({ p, dist: dist(pre, p.pre) }))
      .sort((a, b) => a.dist - b.dist);
    const n = candidates[0];
    const merge = .24 / (1 + (n?.p.count ?? 0) * .03);

    if (n && n.dist < .16) {
      const p = n.p;
      p.delta = p.delta.map((v, k) => clamp(v * (1 - merge) + (delta[k] ?? 0) * merge, -1, 1));
      p.reward01 = clamp(p.reward01 * (1 - merge) + i.reward01 * merge);
      p.error01 = clamp(p.error01 * (1 - merge) + i.predictionError01 * merge);
      p.success01 = clamp(p.success01 * (1 - merge) + (i.reward01 >= .5 ? 1 : 0) * merge);
      p.count++;
      p.lastTick = i.tick;
      this.state.transitionHits++;
    } else {
      this.state.prototypes.push({
        id: (this.state.prototypes.at(-1)?.id ?? 0) + 1,
        action: i.action,
        pre: pre.slice(),
        delta,
        reward01: clamp(i.reward01),
        error01: clamp(i.predictionError01),
        count: 1,
        lastTick: i.tick,
        success01: i.reward01 >= .5 ? 1 : 0,
      });
      if (this.state.prototypes.length > this.state.maxPrototypes) {
        this.state.prototypes.splice(0, this.state.prototypes.length - this.state.maxPrototypes);
      }
    }

    const predErr = clamp(dist(this.state.lastPrediction, post));
    this.state.meanPredictionError01 = clamp(this.state.meanPredictionError01 * .94 + predErr * .06);
    this.state.learningGain01 = clamp(this.state.learningGain01 * .97 + (1 - predErr) * .03);
    if (this.state.experiments && predErr < .35) this.state.experimentUseful++;
    this.state.writes++;
    this.state.tick = i.tick;
  }

  metrics() { return { prototypes: this.state.prototypes.length, writes: this.state.writes, queries: this.state.queries, transitionHits: this.state.transitionHits, meanPredictionError01: this.state.meanPredictionError01, transitionConfidence01: this.state.transitionConfidence01, distributionShift01: this.state.distributionShift01, novelty01: this.state.novelty01, experiments: this.state.experiments, experimentUseful: this.state.experimentUseful, learningGain01: this.state.learningGain01, lesionFraction01: this.state.lesionFraction01, actionBias: { ...this.state.actionBias } }; }
  diagnostics() { return structuredClone(this.state); }

  lesion(f = .5) {
    const args = {
      tick: this.state.tick + 1,
      context: new Array(32).fill(.5),
      baseUtilities: Object.fromEntries(A.map(a => [a, .5])) as Record<ActionKind, number>,
      uncertainty01: .75,
      novelty01: .7,
      predictionError01: .6,
      computeBudget01: .9,
    };
    this.setLesion(0);
    const on = this.beforeDecision(args).actionBias;
    this.setLesion(f);
    const off = this.beforeDecision({ ...args, tick: args.tick + 1 }).actionBias;
    this.setLesion(0);
    const effect = A.reduce((s, a) => s + Math.abs(on[a] - off[a]), 0);
    return { causalDrop01: clamp(effect * 3), effect01: clamp(effect) };
  }
}

function rowsConfidence(rows: Array<{ p: B2525Transition; dist: number }>) {
  return clamp(rows.reduce((s, x) => s + (1 - x.p.error01) * Math.exp(-x.dist / .2), 0) / Math.max(1, rows.length));
}
