import { cosineSimilarity as cosine } from '../core/NumericPrimitives.ts';
export interface WorkspaceCandidateV2 {
  id: string;
  source: string;
  features: number[];
  salience: number;
  content?: Record<string, unknown>;
}

export interface GlobalWorkspaceSubstrateState {
  version: 1;
  capacity: number;
  featureDim: number;
  latentDim: number;
  temperature: number;
  latent: number[];
  gateWeights: number[];
  gateBias: number;
  recurrentWeights: number[][];
  broadcastWeights: number[][];
  selectedIds: string[];
  weights: number[];
  ignition01: number;
  recurrence01: number;
  diversity01: number;
  broadcast01: number;
  cycles: number;
  lesion: { recurrence: boolean; broadcast: boolean; competition: boolean };
  learning: { samples: number; rewardMean01: number; gateUpdates: number };
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const clamp11 = (x: number) => Math.max(-1, Math.min(1, Number.isFinite(x) ? x : 0));
const tanh = (x: number) => Math.tanh(Number.isFinite(x) ? x : 0);
const sigmoid = (x: number) => 1 / (1 + Math.exp(-Math.max(-8, Math.min(8, x))));
const stableSeed = (seed: number) => {
  let x = seed | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x45d9f3b);
  x ^= x >>> 16;
  x = Math.imul(x, 0x45d9f3b);
  x ^= x >>> 16;
  return x | 0;
};
const weight = (seed: number, scale = 0.04) => (((stableSeed(seed) >>> 0) / 4294967295) * 2 - 1) * scale;
const matrix = (rows: number, cols: number, seed: number, scale = 0.04) =>
  Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => weight(seed + r * 131 + c * 17, scale)));

function vector(raw: unknown, size: number) {
  const out = new Array(size).fill(0);
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < Math.min(size, raw.length); i++) out[i] = clamp11(Number(raw[i]));
  return out;
}

const defaultState = (): GlobalWorkspaceSubstrateState => ({
  version: 1,
  capacity: 5,
  featureDim: 12,
  latentDim: 24,
  temperature: 0.22,
  latent: new Array(24).fill(0),
  gateWeights: Array.from({ length: 12 }, (_, i) => weight(21000 + i, 0.07)),
  gateBias: 0,
  recurrentWeights: matrix(24, 24, 22000, 0.03),
  broadcastWeights: matrix(16, 24, 23000, 0.035),
  selectedIds: [],
  weights: [],
  ignition01: 0,
  recurrence01: 0,
  diversity01: 0,
  broadcast01: 0,
  cycles: 0,
  lesion: { recurrence: false, broadcast: false, competition: false },
  learning: { samples: 0, rewardMean01: 0.5, gateUpdates: 0 },
});

/**
 * Central recurrent workspace substrate. It is a research/engineering mechanism,
 * not a consciousness detector or a claim of subjective experience.
 *
 * Competition selects a bounded coalition; recurrence carries the selected
 * content into the next latent state; broadcast exposes a compressed global
 * representation to other modules. Each component can be lesioned independently
 * for causal tests.
 */
export class GlobalWorkspaceSubstrateV2 {
  private state = defaultState();

  snapshot() { return structuredClone(this.state); }

  restore(raw?: Partial<GlobalWorkspaceSubstrateState> | null) {
    const d = defaultState();
    const r = raw ?? {};
    const arr = (v: unknown, n: number) => vector(v, n);
    const mat = (v: unknown, rows: number, cols: number, seed: number) => {
      if (!Array.isArray(v)) return matrix(rows, cols, seed, 0.03);
      return Array.from({ length: rows }, (_, i) => Array.isArray(v[i]) ? vector(v[i], cols) : matrix(1, cols, seed + i, 0.03)[0]);
    };
    this.state = {
      ...d,
      ...r,
      latent: arr(r.latent, d.latentDim),
      gateWeights: arr(r.gateWeights, d.featureDim),
      gateBias: Number.isFinite(Number(r.gateBias)) ? Number(r.gateBias) : d.gateBias,
      recurrentWeights: mat(r.recurrentWeights, d.latentDim, d.latentDim, 22000),
      broadcastWeights: mat(r.broadcastWeights, 16, d.latentDim, 23000),
      selectedIds: Array.isArray(r.selectedIds) ? r.selectedIds.slice(0, d.capacity) : [],
      weights: Array.isArray(r.weights) ? r.weights.slice(0, d.capacity).map(Number) : [],
      lesion: { ...d.lesion, ...(r.lesion ?? {}) },
      learning: { ...d.learning, ...(r.learning ?? {}) },
    };
  }

  private score(candidate: WorkspaceCandidateV2, context: number[]) {
    const features = vector(candidate.features, this.state.featureDim);
    let z = this.state.gateBias + Math.log(Math.max(1e-4, candidate.salience));
    for (let i = 0; i < features.length; i++) z += this.state.gateWeights[i] * features[i];
    for (let i = 0; i < Math.min(context.length, features.length); i++) z += 0.03 * context[i] * features[i];
    return z;
  }

  private updateLatent(coalition: WorkspaceCandidateV2[], selectionWeights: number[]) {
    const source = this.state.latentDim === 0 ? [] : new Array(this.state.latentDim).fill(0);
    for (let k = 0; k < coalition.length; k++) {
      const f = vector(coalition[k].features, this.state.featureDim);
      const w = selectionWeights[k] ?? 0;
      for (let j = 0; j < source.length; j++) source[j] += w * f[j % f.length];
    }
    const prev = this.state.latent;
    const next = new Array(this.state.latentDim).fill(0);
    for (let j = 0; j < next.length; j++) {
      let z = source[j % this.state.featureDim] ?? 0;
      if (this.state.lesion.recurrence) {
        next[j] = tanh(z);
        continue;
      }
      const row = this.state.recurrentWeights[j] ?? [];
      for (let i = 0; i < prev.length; i++) z += row[i] * prev[i];
      next[j] = tanh(z);
    }
    return next;
  }

  compete(candidates: WorkspaceCandidateV2[], context: number[] = []) {
    const usable = candidates.slice(0, 64).map(c => ({ ...c, features: vector(c.features, this.state.featureDim), salience: clamp01(c.salience) }));
    if (!usable.length) {
      this.state.selectedIds = [];
      this.state.weights = [];
      this.state.ignition01 = 0;
      this.state.diversity01 = 0;
      this.state.broadcast01 = 0;
      this.state.cycles++;
      return this.snapshot();
    }
    const scored = usable.map(c => ({ c, score: this.score(c, context) }));
    const max = Math.max(...scored.map(x => x.score));
    const exp = scored.map(x => this.state.lesion.competition ? 1 : Math.exp(Math.max(-8, Math.min(8, (x.score - max) / this.state.temperature))));
    const denom = exp.reduce((s, x) => s + x, 0);
    const probs = exp.map(x => x / Math.max(1e-9, denom));
    const ranked = scored.map((x, i) => ({ ...x, p: probs[i] })).sort((a, b) => b.p - a.p);
    const coalition = ranked.slice(0, this.state.capacity);
    const coalitionWeights = coalition.map(x => x.p / Math.max(1e-9, coalition.reduce((s, y) => s + y.p, 0)));
    const nextLatent = this.updateLatent(coalition.map(x => x.c), coalitionWeights);
    const similarity = cosine(this.state.latent, nextLatent);
    const sourceDiversity = new Set(coalition.map(x => x.c.source)).size / Math.max(1, coalition.length);
    const meanSalience = coalition.reduce((s, x) => s + x.c.salience, 0) / Math.max(1, coalition.length);
    const concentration = coalitionWeights.reduce((s, x) => s + x * x, 0);
    const ignition = clamp01(meanSalience * 0.48 + (1 - concentration) * 0.18 + sourceDiversity * 0.16 + Math.max(0, similarity) * 0.18);

    this.state.latent = nextLatent;
    this.state.selectedIds = coalition.map(x => x.c.id);
    this.state.weights = coalitionWeights.slice();
    this.state.ignition01 = ignition;
    this.state.recurrence01 = this.state.lesion.recurrence ? 0 : clamp01(Math.max(0, similarity) * 0.7 + ignition * 0.3);
    this.state.diversity01 = clamp01(sourceDiversity);
    this.state.broadcast01 = this.state.lesion.broadcast ? 0 : clamp01(ignition * (0.55 + sourceDiversity * 0.45));
    this.state.cycles++;
    return this.snapshot();
  }

  broadcast() {
    if (this.state.lesion.broadcast) return new Array(16).fill(0);
    const out = new Array(16).fill(0);
    for (let i = 0; i < out.length; i++) {
      const row = this.state.broadcastWeights[i] ?? [];
      let z = 0;
      for (let j = 0; j < this.state.latentDim; j++) z += (row[j] ?? 0) * (this.state.latent[j] ?? 0);
      out[i] = tanh(z) * this.state.broadcast01;
    }
    return out;
  }

  globalState() {
    return {
      latent: this.state.latent.slice(),
      broadcast: this.broadcast(),
      selectedIds: this.state.selectedIds.slice(),
      selectionWeights: this.state.weights.slice(),
      ignition01: this.state.ignition01,
      recurrence01: this.state.recurrence01,
      diversity01: this.state.diversity01,
      broadcast01: this.state.broadcast01,
      lesion: structuredClone(this.state.lesion),
    };
  }

  learnReward(reward01: number, learningRate = 0.02) {
    const reward = clamp01(reward01);
    const baseline = this.state.learning.rewardMean01;
    const error = reward - baseline;
    this.state.learning.rewardMean01 = baseline * 0.98 + reward * 0.02;
    if (!this.state.selectedIds.length) return { error01: Math.abs(error), updated: false };
    const update = learningRate * error;
    for (let k = 0; k < this.state.selectedIds.length; k++) {
      const sign = (this.state.weights[k] ?? 0) - 1 / Math.max(1, this.state.selectedIds.length);
      for (let i = 0; i < this.state.gateWeights.length; i++) {
        const featureSign = ((stableSeed((k + 1) * 997 + i * 37) >>> 0) / 4294967295) * 2 - 1;
        this.state.gateWeights[i] = clamp11(this.state.gateWeights[i] + update * sign * featureSign * 0.05);
      }
    }
    this.state.gateBias = clamp11(this.state.gateBias + update * 0.04);
    this.state.learning.samples++;
    this.state.learning.gateUpdates++;
    return { error01: Math.abs(error), updated: true };
  }

  setLesion(partial: Partial<GlobalWorkspaceSubstrateState['lesion']>) {
    this.state.lesion = { ...this.state.lesion, ...partial };
    return structuredClone(this.state.lesion);
  }

  diagnostics() {
    return {
      cycles: this.state.cycles,
      selectedCount: this.state.selectedIds.length,
      ignition01: this.state.ignition01,
      recurrence01: this.state.recurrence01,
      broadcast01: this.state.broadcast01,
      learningSamples: this.state.learning.samples,
      gateUpdates: this.state.learning.gateUpdates,
      lesions: structuredClone(this.state.lesion),
    };
  }
}
