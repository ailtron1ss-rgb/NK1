export const clamp01 = (x: number) =>
  Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));

export const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Number.isFinite(x) ? x : lo));

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function softmax(logits: number[], temperature = 1): number[] {
  const t = Math.max(1e-4, temperature);
  const m = Math.max(...logits);
  const exps = logits.map((v) => Math.exp((v - m) / t));
  const s = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((v) => v / s);
}

export function sampleCategorical(probs: number[], rng: () => number): number {
  let r = rng();
  for (let i = 0; i < probs.length; i++) {
    r -= probs[i];
    if (r <= 0) return i;
  }
  return probs.length - 1;
}

export function l2(a: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s);
}

export function normalize(a: Float32Array): Float32Array {
  const n = l2(a) || 1;
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] / n;
  return out;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  const d = (l2(a) || 1) * (l2(b) || 1);
  return s / d;
}

export function addScaled(a: Float32Array, b: Float32Array, k: number) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) a[i] += b[i] * k;
}

export function mix(a: Float32Array, b: Float32Array, t: number): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * (1 - t) + (b[i] ?? 0) * t;
  return out;
}

export function mse(a: Float32Array, b: Float32Array): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s / Math.max(1, n);
}

export function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function linspace(lo: number, hi: number, n: number): Float32Array {
  const out = new Float32Array(n);
  if (n === 1) {
    out[0] = lo;
    return out;
  }
  for (let i = 0; i < n; i++) out[i] = lo + ((hi - lo) * i) / (n - 1);
  return out;
}

export function entropy(probs: number[]): number {
  let e = 0;
  for (const p of probs) if (p > 1e-8) e -= p * Math.log(p);
  return e;
}

export function id(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function vecToArray(v: Float32Array): number[] {
  return Array.from(v);
}

export function arrayToVec(a: number[] | undefined, dim: number): Float32Array {
  const out = new Float32Array(dim);
  if (!a) return out;
  for (let i = 0; i < Math.min(dim, a.length); i++) out[i] = a[i] ?? 0;
  return out;
}
