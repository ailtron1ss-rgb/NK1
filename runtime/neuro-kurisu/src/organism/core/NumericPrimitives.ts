/** Shared, deterministic numeric primitives used across cognition and memory layers. */

/** FNV-1a 32-bit hash. Keep hashing in one place so sparse vectors and IDs stay reproducible. */
export function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Raw cosine similarity in [-1, 1]. Empty/zero vectors return 0, never NaN.
 * `minimumSquaredNorm` preserves older modules' epsilon norm floor where needed. */
export function cosineSimilarity(a: readonly number[], b: readonly number[], minimumSquaredNorm = 0): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < length; index++) {
    const rawA = Number(a[index] ?? 0);
    const rawB = Number(b[index] ?? 0);
    // Match the runtime's established `finite(value, 0)` policy: bad dimensions
    // contribute zero rather than dropping the other vector's valid coordinate.
    const av = Number.isFinite(rawA) ? rawA : 0;
    const bv = Number.isFinite(rawB) ? rawB : 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  const floor = Number.isFinite(minimumSquaredNorm) ? Math.max(0, minimumSquaredNorm) : 0;
  const denominator = Math.sqrt(Math.max(floor, normA) * Math.max(floor, normB));
  if (!Number.isFinite(dot) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  const similarity = dot / denominator;
  return Number.isFinite(similarity) ? Math.max(-1, Math.min(1, similarity)) : 0;
}
/** Cosine similarity mapped to [0, 1]; degenerate vectors are neutral (0.5). */
export function cosineSimilarity01(a: readonly number[], b: readonly number[], minimumSquaredNorm = 0): number {
  return Math.max(0, Math.min(1, 0.5 + 0.5 * cosineSimilarity(a, b, minimumSquaredNorm)));
}

