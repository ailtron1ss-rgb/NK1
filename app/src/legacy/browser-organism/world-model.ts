import { EMBED_DIM, LATENT_DIM } from "./types";
import { clamp, clamp01, mse } from "./math";

function zeros(n: number) {
  return new Float32Array(n);
}

function tanhVec(v: Float32Array) {
  for (let i = 0; i < v.length; i++) v[i] = Math.tanh(v[i]);
}

type Mat = Float32Array[];

export interface WorldSnap {
  h: number[];
  errorEma: number;
  steps: number;
  Wz?: number[][];
  Wr?: number[][];
  Wh?: number[][];
  bz?: number[];
  br?: number[];
  bh?: number[];
  Wpred?: number[][];
  bpred?: number[];
  Wrew?: number[];
}

/** Tiny GRU world model. Predicts next embedding + reward. Learns by truncated SGD. */
export class WorldModel {
  h = zeros(LATENT_DIM);
  Wz = randomMatrix(LATENT_DIM, EMBED_DIM + LATENT_DIM + 6, 0.08);
  Wr = randomMatrix(LATENT_DIM, EMBED_DIM + LATENT_DIM + 6, 0.08);
  Wh = randomMatrix(LATENT_DIM, EMBED_DIM + LATENT_DIM + 6, 0.08);
  bz = zeros(LATENT_DIM);
  br = zeros(LATENT_DIM);
  bh = zeros(LATENT_DIM);
  Wpred = randomMatrix(EMBED_DIM, LATENT_DIM, 0.08);
  bpred = zeros(EMBED_DIM);
  Wrew = randomMatrix(1, LATENT_DIM, 0.05);
  prev: Float32Array | null = null;
  errorEma = 0.4;
  steps = 0;

  private concat(embed: Float32Array, actionOh: Float32Array) {
    const x = new Float32Array(EMBED_DIM + LATENT_DIM + 6);
    x.set(embed, 0);
    x.set(this.h, EMBED_DIM);
    x.set(actionOh, EMBED_DIM + LATENT_DIM);
    return x;
  }

  predict(embed: Float32Array, actionOh: Float32Array) {
    const x = this.concat(embed, actionOh);
    const z = sigmoid(matVec(this.Wz, x, this.bz));
    const r = sigmoid(matVec(this.Wr, x, this.br));
    const xh = new Float32Array(x);
    for (let i = 0; i < LATENT_DIM; i++) xh[EMBED_DIM + i] = this.h[i] * r[i];
    const n = matVec(this.Wh, xh, this.bh);
    tanhVec(n);
    const hNext = new Float32Array(LATENT_DIM);
    for (let i = 0; i < LATENT_DIM; i++) hNext[i] = (1 - z[i]) * this.h[i] + z[i] * n[i];
    const pred = matVec(this.Wpred, hNext, this.bpred);
    tanhVec(pred);
    const reward = clamp(dot(this.Wrew[0], hNext), -4, 4);
    return { hNext, pred, reward, z, r, n, x, xh };
  }

  observe(embed: Float32Array, actionOh: Float32Array, actual: Float32Array, reward: number) {
    const { hNext, pred, reward: predR, z, n, x, xh } = this.predict(embed, actionOh);
    const err = mse(pred, actual);
    this.errorEma = this.errorEma * 0.94 + err * 0.06;
    const lr = 0.03;

    const dPred = new Float32Array(EMBED_DIM);
    for (let i = 0; i < EMBED_DIM; i++) {
      const tanhDeriv = 1 - pred[i] * pred[i];
      dPred[i] = ((pred[i] - actual[i]) / EMBED_DIM) * tanhDeriv;
    }
    const dRew = predR - reward;
    const dh = new Float32Array(LATENT_DIM);
    for (let i = 0; i < LATENT_DIM; i++) {
      let g = dRew * this.Wrew[0][i] * 0.2;
      for (let j = 0; j < EMBED_DIM; j++) g += this.Wpred[j][i] * dPred[j];
      dh[i] = g;
      for (let j = 0; j < EMBED_DIM; j++) this.Wpred[j][i] -= lr * dPred[j] * hNext[i];
      this.Wrew[0][i] -= lr * 0.2 * dRew * hNext[i];
    }
    for (let j = 0; j < EMBED_DIM; j++) this.bpred[j] -= lr * dPred[j];

    for (let i = 0; i < LATENT_DIM; i++) {
      const dn = dh[i] * z[i] * (1 - n[i] * n[i]);
      this.bh[i] -= lr * dn;
      for (let j = 0; j < xh.length; j++) this.Wh[i][j] -= lr * dn * xh[j];
      const dz = dh[i] * (n[i] - this.h[i]) * z[i] * (1 - z[i]);
      this.bz[i] -= lr * 0.4 * dz;
      for (let j = 0; j < x.length; j++) this.Wz[i][j] -= lr * 0.4 * dz * x[j];
    }

    this.h = hNext;
    this.prev = new Float32Array(actual);
    this.steps += 1;
    return { error: err, predReward: predR };
  }

  snapshot(): WorldSnap {
    return {
      h: Array.from(this.h),
      errorEma: this.errorEma,
      steps: this.steps,
      Wz: packMat(this.Wz),
      Wr: packMat(this.Wr),
      Wh: packMat(this.Wh),
      bz: Array.from(this.bz),
      br: Array.from(this.br),
      bh: Array.from(this.bh),
      Wpred: packMat(this.Wpred),
      bpred: Array.from(this.bpred),
      Wrew: Array.from(this.Wrew[0]),
    };
  }

  restore(raw?: WorldSnap) {
    if (!raw) return;
    if (raw.h) this.h = Float32Array.from(raw.h.slice(0, LATENT_DIM));
    if (typeof raw.errorEma === "number") this.errorEma = raw.errorEma;
    if (typeof raw.steps === "number") this.steps = raw.steps;
    restoreMat(this.Wz, raw.Wz);
    restoreMat(this.Wr, raw.Wr);
    restoreMat(this.Wh, raw.Wh);
    restoreVec(this.bz, raw.bz);
    restoreVec(this.br, raw.br);
    restoreVec(this.bh, raw.bh);
    restoreMat(this.Wpred, raw.Wpred);
    restoreVec(this.bpred, raw.bpred);
    if (raw.Wrew) restoreVec(this.Wrew[0], raw.Wrew);
  }
}

function packMat(m: Mat) {
  return m.map((r) => Array.from(r));
}

function restoreMat(target: Mat, src?: number[][]) {
  if (!src || src.length !== target.length) return;
  for (let i = 0; i < target.length; i++) {
    const row = src[i];
    if (!row || row.length !== target[i].length) return;
  }
  for (let i = 0; i < target.length; i++) target[i] = Float32Array.from(src[i]);
}

function restoreVec(target: Float32Array, src?: number[]) {
  if (!src || src.length !== target.length) return;
  target.set(src);
}

function randomMatrix(rows: number, cols: number, scale: number) {
  const m: Float32Array[] = [];
  for (let r = 0; r < rows; r++) {
    const row = new Float32Array(cols);
    for (let c = 0; c < cols; c++) row[c] = (Math.random() * 2 - 1) * scale;
    m.push(row);
  }
  return m;
}

function matVec(m: Float32Array[], x: Float32Array, b: Float32Array) {
  const out = new Float32Array(m.length);
  for (let i = 0; i < m.length; i++) {
    let s = b[i] ?? 0;
    const row = m[i];
    const n = Math.min(row.length, x.length);
    for (let j = 0; j < n; j++) s += row[j] * x[j];
    out[i] = s;
  }
  return out;
}

function sigmoid(v: Float32Array) {
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = 1 / (1 + Math.exp(-v[i]));
  return out;
}

function dot(a: Float32Array, b: Float32Array) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

export function actionOneHot(index: number): Float32Array {
  const v = new Float32Array(6);
  v[clamp(index, 0, 5)] = 1;
  return v;
}

export function curiosityBonus(error: number, ema: number) {
  const norm = error / (Math.sqrt(ema) + 1e-4);
  return clamp01(norm / 4);
}
