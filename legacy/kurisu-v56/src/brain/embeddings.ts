/**
 * Mobile vector memory primitives.
 * Hash-n-gram embeddings (DIM=96) + cosine. API stable for later ONNX swap.
 */

export const EMBED_DIM = 96;

function hashToken(t: string): number {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function embedText(text: string): Float32Array {
  const v = new Float32Array(EMBED_DIM);
  const s = (text || '').toLowerCase().replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s]/gi, ' ');
  const parts = s.split(/\s+/).filter(Boolean);
  for (const w of parts) {
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i <= w.length - n; i++) {
        const ng = w.slice(i, i + n);
        v[hashToken(ng) % EMBED_DIM] += 1 / n;
      }
    }
    v[hashToken(w) % EMBED_DIM] += 1.8;
    // char bigrams for Russian morphology robustness
    for (let i = 0; i < w.length - 1; i++) {
      v[hashToken(w.slice(i, i + 2)) % EMBED_DIM] += 0.35;
    }
  }
  let norm = 0;
  for (let i = 0; i < EMBED_DIM; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < EMBED_DIM; i++) v[i] /= norm;
  return v;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

export function embedToArray(text: string): number[] {
  return Array.from(embedText(text));
}

export function arrayToVec(arr: number[]): Float32Array {
  const v = new Float32Array(EMBED_DIM);
  for (let i = 0; i < Math.min(arr.length, EMBED_DIM); i++) v[i] = arr[i];
  return v;
}
