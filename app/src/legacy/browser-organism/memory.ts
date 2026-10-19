import type { EmotionLabel, MemoryRecord, OptionKind } from "./types";
import { EMBED_DIM } from "./types";
import { clamp01, cosine, id } from "./math";
import { embed, tokenize } from "./encoder";

const EPISODIC_CAP = 280;
const SEMANTIC_CAP = 64;

export class MemorySystem {
  episodes: MemoryRecord[] = [];
  semantic: MemoryRecord[] = [];

  store(input: {
    text: string;
    kind: MemoryRecord["kind"];
    tick: number;
    emotion: EmotionLabel;
    option: OptionKind;
    reward: number;
    predictionError: number;
    verified?: boolean;
    salience?: number;
  }): MemoryRecord {
    const rec: MemoryRecord = {
      id: id(),
      kind: input.kind,
      text: input.text.slice(0, 480),
      embedding: Array.from(embed(input.text)),
      salience: clamp01(input.salience ?? 0.35 + input.predictionError * 0.4 + Math.abs(input.reward) * 0.2),
      recencyTick: input.tick,
      createdAt: Date.now(),
      emotion: input.emotion,
      option: input.option,
      reward: input.reward,
      predictionError: input.predictionError,
      verified: Boolean(input.verified),
      touches: 0,
    };
    if (rec.kind === "semantic" || rec.kind === "self") {
      this.semantic.unshift(rec);
      this.semantic = this.semantic.slice(0, SEMANTIC_CAP);
    } else {
      this.episodes.unshift(rec);
      this.episodes = this.episodes.slice(0, EPISODIC_CAP);
    }
    return rec;
  }

  /**
   * Multi-signal retrieval: cosine + lexical overlap + recency + salience
   * + identity/emotion match + prediction-error resonance + value conditioning.
   */
  retrieve(
    query: string,
    tick: number,
    opts: { emotion: EmotionLabel; value: number; k?: number },
  ): MemoryRecord[] {
    const qv = embed(query);
    const qTokens = new Set(tokenize(query));
    const pool = [...this.episodes, ...this.semantic];
    const scored = pool.map((m) => {
      const ev = Float32Array.from(m.embedding);
      const semantic = (cosine(qv, ev) + 1) / 2;
      const lex = lexicalOverlap(qTokens, tokenize(m.text));
      const recency = clamp01(1 - (tick - m.recencyTick) / 400);
      const emo = m.emotion === opts.emotion ? 0.12 : 0;
      const valueMatch = 1 - Math.min(1, Math.abs(m.reward - opts.value) / 4);
      const pe = m.predictionError * 0.15;
      const verified = m.verified ? 0.08 : 0;
      const score =
        semantic * 0.38 +
        lex * 0.16 +
        recency * 0.12 +
        m.salience * 0.14 +
        emo +
        valueMatch * 0.08 +
        pe +
        verified;
      return { m, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const k = opts.k ?? 6;
    const picked = scored.slice(0, k).map((s) => {
      s.m.touches += 1;
      s.m.recencyTick = tick;
      return s.m;
    });
    return picked;
  }

  consolidate(tick: number) {
    const clusters = new Map<string, MemoryRecord[]>();
    for (const e of this.episodes.slice(0, 80)) {
      const key = tokenize(e.text).slice(0, 3).join("_") || e.id;
      const list = clusters.get(key) ?? [];
      list.push(e);
      clusters.set(key, list);
    }
    let made = 0;
    for (const [, group] of clusters) {
      if (group.length < 3) continue;
      const already = this.semantic.some((s) => s.text.includes(group[0].text.slice(0, 40)));
      if (already) continue;
      const summary = summarizeGroup(group);
      this.store({
        text: summary,
        kind: "semantic",
        tick,
        emotion: group[0].emotion,
        option: group[0].option,
        reward: group.reduce((a, b) => a + b.reward, 0) / group.length,
        predictionError: group.reduce((a, b) => a + b.predictionError, 0) / group.length,
        verified: group.some((g) => g.verified),
        salience: 0.7,
      });
      made += 1;
      if (made >= 3) break;
    }
    for (const e of this.episodes) e.salience *= 0.985;
    this.episodes = this.episodes.filter((e) => e.salience > 0.08 || e.verified || e.kind === "self");
  }

  snapshot() {
    return {
      episodes: this.episodes,
      semantic: this.semantic,
    };
  }

  restore(raw?: { episodes?: MemoryRecord[]; semantic?: MemoryRecord[] }) {
    this.episodes = Array.isArray(raw?.episodes) ? raw!.episodes.slice(0, EPISODIC_CAP) : [];
    this.semantic = Array.isArray(raw?.semantic) ? raw!.semantic.slice(0, SEMANTIC_CAP) : [];
    for (const m of [...this.episodes, ...this.semantic]) {
      if (!m.embedding || m.embedding.length !== EMBED_DIM) m.embedding = Array.from(embed(m.text || ""));
    }
  }
}

function lexicalOverlap(a: Set<string>, b: string[]) {
  if (a.size === 0 || b.length === 0) return 0;
  let hit = 0;
  for (const t of b) if (a.has(t)) hit += 1;
  return hit / Math.max(a.size, b.length);
}

function summarizeGroup(group: MemoryRecord[]) {
  const texts = group.map((g) => g.text);
  const tokens = texts.flatMap((t) => tokenize(t));
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  const top = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t);
  return `pattern: ${top.join(" ")} · n=${group.length}`;
}
