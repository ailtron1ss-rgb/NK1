/**
 * Lightweight "embedding" for mobile: hashed character n-grams → fixed vector.
 * Not neural, but semantic-ish overlap better than pure word Jaccard for RU/EN mix.
 * Swap later for real ONNX embedder behind same API.
 */

const DIM = 64;

function hashToken(t: string): number {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Build bag-of-ngrams vector */
export function embedText(text: string): Float32Array {
  const v = new Float32Array(DIM);
  const s = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const parts = s.split(/\s+/).filter(Boolean);
  for (const w of parts) {
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i <= w.length - n; i++) {
        const ng = w.slice(i, i + n);
        const idx = hashToken(ng) % DIM;
        v[idx] += 1;
      }
    }
    v[hashToken(w) % DIM] += 1.5;
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < DIM; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < DIM; i++) v[i] /= norm;
  return v;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
