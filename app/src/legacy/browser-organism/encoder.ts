import { EMBED_DIM } from "./types";
import { hash32, normalize } from "./math";

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "is",
  "it",
  "i",
  "you",
  "we",
  "я",
  "ты",
  "и",
  "в",
  "на",
  "не",
  "что",
  "это",
  "с",
  "как",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Feature-hashed n-gram embedding. Real retrieval signal, not a decoration. */
export function embed(text: string, dim = EMBED_DIM): Float32Array {
  const v = new Float32Array(dim);
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    const h = hash32(text || "empty");
    v[h % dim] = 1;
    return normalize(v);
  }
  const bump = (key: string, w: number) => {
    const h = hash32(key);
    v[h % dim] += w;
    v[(h >>> 8) % dim] += w * 0.5;
    v[(h >>> 16) % dim] += w * 0.25;
  };
  for (let i = 0; i < tokens.length; i++) {
    bump(tokens[i], 1);
    if (i + 1 < tokens.length) bump(`${tokens[i]}_${tokens[i + 1]}`, 0.7);
  }
  bump(`len:${Math.min(12, tokens.length)}`, 0.15);
  return normalize(v);
}

export function mixEmbeds(parts: Array<{ v: Float32Array; w: number }>, dim = EMBED_DIM): Float32Array {
  const out = new Float32Array(dim);
  for (const p of parts) {
    for (let i = 0; i < dim; i++) out[i] += (p.v[i] ?? 0) * p.w;
  }
  return normalize(out);
}
