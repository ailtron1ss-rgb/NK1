import { LATENT_DIM, VALUE_BINS } from "./types";
import { clamp, linspace, softmax } from "./math";

export interface CriticSnap {
  W: number[][];
  b: number[];
  steps: number;
}

/** Compact C51 critic over the world-model latent. */
export class DistributionalCritic {
  bins = linspace(-8, 8, VALUE_BINS);
  W: Float32Array[] = [];
  b = new Float32Array(VALUE_BINS);
  steps = 0;
  featDim: number;

  constructor(featDim = LATENT_DIM) {
    this.featDim = featDim;
    for (let i = 0; i < VALUE_BINS; i++) {
      const row = new Float32Array(featDim);
      for (let j = 0; j < featDim; j++) row[j] = (Math.random() * 2 - 1) * 0.05;
      this.W.push(row);
    }
  }

  logits(feat: Float32Array): number[] {
    const out = new Array<number>(VALUE_BINS);
    for (let i = 0; i < VALUE_BINS; i++) {
      let s = this.b[i];
      const row = this.W[i];
      const n = Math.min(row.length, feat.length);
      for (let j = 0; j < n; j++) s += row[j] * feat[j];
      out[i] = s;
    }
    return out;
  }

  value(feat: Float32Array): number {
    const p = softmax(this.logits(feat));
    let v = 0;
    for (let i = 0; i < p.length; i++) v += p[i] * this.bins[i];
    return v;
  }

  learn(feat: Float32Array, targetReturn: number, lr = 0.03) {
    const y = clamp(targetReturn, this.bins[0], this.bins[this.bins.length - 1]);
    const tz = twohot(y, this.bins);
    const logits = this.logits(feat);
    const p = softmax(logits);
    for (let i = 0; i < VALUE_BINS; i++) {
      const g = p[i] - tz[i];
      this.b[i] -= lr * g;
      const row = this.W[i];
      const n = Math.min(row.length, feat.length);
      for (let j = 0; j < n; j++) row[j] -= lr * g * feat[j];
    }
    this.steps += 1;
  }

  snapshot(): CriticSnap {
    return {
      W: this.W.map((r) => Array.from(r)),
      b: Array.from(this.b),
      steps: this.steps,
    };
  }

  restore(raw?: CriticSnap) {
    if (!raw?.W || raw.W.length !== VALUE_BINS) return;
    if (raw.W[0]?.length !== this.featDim) return;
    this.W = raw.W.map((r) => Float32Array.from(r));
    if (raw.b?.length === VALUE_BINS) this.b = Float32Array.from(raw.b);
    if (typeof raw.steps === "number") this.steps = raw.steps;
  }
}

function twohot(x: number, bins: Float32Array): number[] {
  const out = new Array(bins.length).fill(0);
  let below = 0;
  for (let i = 0; i < bins.length; i++) if (bins[i] <= x) below = i;
  below = Math.max(0, Math.min(bins.length - 2, below));
  const above = below + 1;
  const span = bins[above] - bins[below] || 1;
  const wa = clamp((x - bins[below]) / span, 0, 1);
  out[below] = 1 - wa;
  out[above] = wa;
  return out;
}
