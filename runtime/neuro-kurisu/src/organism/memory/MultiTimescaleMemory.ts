import type { ConsolidatedMemory } from '../core/types.ts';

export interface MemoryRecord extends ConsolidatedMemory {
  timescale: 'working' | 'episodic' | 'semantic' | 'autobiographical';
  retrievalCount: number;
  lastRetrievedAt: number;
  confidence: number;
  sourceEventIds: string[];
  embedding?: number[];
  consolidationScore01?: number;
  associationIds?: string[];
  /** Read-only projection of a canonical MemoryOS2 row; never re-ingest on restore. */
  canonicalProjection?: { owner:'memoryOS2'; itemId:string; schemaVersion:1 };
}

const EMBEDDING_DIMENSIONS = 24;
const MAX_ITEMS_PER_TIMESCALE = 200;
const MAX_RETRIEVAL_RESULTS = 32;
const TOKEN_CACHE_CAPACITY = 512;
const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const finite = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

type Timescale = MemoryRecord['timescale'];
const TIMESCALES = new Set<Timescale>(['working', 'episodic', 'semantic', 'autobiographical']);

/** Shared RU/EN tokenizer for indexed text and queries. */
function tokenize(text: string): string[] {
  return String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? [];
}

function normalizedEmbedding(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length !== EMBEDDING_DIMENSIONS) return null;
  const vector: number[] = [];
  let normSquared = 0;
  for (const component of value) {
    if (typeof component !== 'number' || !Number.isFinite(component)) return null;
    vector.push(component);
    normSquared += component * component;
  }
  const norm = Math.sqrt(normSquared);
  if (!Number.isFinite(norm) || norm <= 1e-12) return null;
  return vector.map(component => component / norm);
}

interface TokenCacheEntry {
  fingerprint: string;
  tokens: Set<string>;
}

export class MultiTimescaleMemory {
  private working: MemoryRecord[] = [];
  private episodic: MemoryRecord[] = [];
  private semantic: MemoryRecord[] = [];
  private autobiographical: MemoryRecord[] = [];
  /** Bounded LRU; the content fingerprint also catches in-place compatibility mutations. */
  private readonly textTokenCache = new Map<string, TokenCacheEntry>();

  restore(rows: MemoryRecord[] = []) {
    this.working = [];
    this.episodic = [];
    this.semantic = [];
    this.autobiographical = [];
    this.textTokenCache.clear();
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      try { this.add(row); } catch { /* Ignore malformed compatibility projections; canonical MemoryOS2 is unchanged. */ }
    }
  }

  add(row: MemoryRecord, clone = true) {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id.trim()) {
      throw new Error('multi-timescale-memory-id-invalid');
    }

    this.remove(row.id);
    const summary = String(row.summary ?? '').slice(0, 24_000);
    const evidence = Array.isArray(row.evidence)
      ? row.evidence.filter((value): value is string => typeof value === 'string').slice(-64).map(value => value.slice(0, 4_000))
      : [];
    const timescale: Timescale = TIMESCALES.has(row.timescale) ? row.timescale : 'episodic';
    const embedding = normalizedEmbedding(row.embedding) ?? this.embed(`${summary} ${evidence.join(' ')}`);
    const confidence = clamp01(finite(row.confidence, 0.5));
    const salience = clamp01(finite(row.salience, 0.5));
    const consolidationScore01 = clamp01(finite(row.consolidationScore01, salience * 0.45 + confidence * 0.35));
    const enriched: MemoryRecord = {
      ...row,
      id: row.id.trim().slice(0, 160),
      kind: row.kind,
      summary,
      evidence,
      salience,
      createdAt: Math.max(0, finite(row.createdAt, Date.now())),
      timescale,
      retrievalCount: Math.max(0, Math.floor(finite(row.retrievalCount, 0))),
      lastRetrievedAt: Math.max(0, finite(row.lastRetrievedAt, 0)),
      confidence,
      sourceEventIds: Array.isArray(row.sourceEventIds)
        ? row.sourceEventIds.filter((value): value is string => typeof value === 'string').slice(-64).map(value => value.slice(0, 160))
        : [],
      associationIds: Array.isArray(row.associationIds)
        ? row.associationIds.filter((value): value is string => typeof value === 'string').slice(-128).map(value => value.slice(0, 160))
        : [],
      embedding,
      consolidationScore01,
    };

    const target = this.itemsFor(timescale);
    target.unshift(clone ? structuredClone(enriched) : enriched);
    target.splice(MAX_ITEMS_PER_TIMESCALE);
    this.invalidateTokenCache(enriched.id);
  }

  promote(id: string, timescale: Timescale) {
    if (!TIMESCALES.has(timescale)) return;
    const row = this.find(id);
    if (!row) return;
    this.remove(id);
    this.add({ ...row, timescale, lastRetrievedAt: Date.now() });
  }

  private itemsFor(timescale: Timescale): MemoryRecord[] {
    switch (timescale) {
      case 'working': return this.working;
      case 'semantic': return this.semantic;
      case 'autobiographical': return this.autobiographical;
      default: return this.episodic;
    }
  }

  private find(id: string): MemoryRecord | undefined {
    return this.working.find(row => row.id === id)
      ?? this.episodic.find(row => row.id === id)
      ?? this.semantic.find(row => row.id === id)
      ?? this.autobiographical.find(row => row.id === id);
  }

  private fingerprint(row: MemoryRecord): string {
    return `${row.summary}\u0000${row.evidence.join('\u0000')}`;
  }

  private tokensFor(row: MemoryRecord): Set<string> {
    const fingerprint = this.fingerprint(row);
    const cached = this.textTokenCache.get(row.id);
    if (cached?.fingerprint === fingerprint) {
      this.textTokenCache.delete(row.id);
      this.textTokenCache.set(row.id, cached);
      return cached.tokens;
    }

    const tokens = new Set(tokenize(`${row.summary} ${row.evidence.join(' ')}`));
    this.invalidateTokenCache(row.id);
    while (this.textTokenCache.size >= TOKEN_CACHE_CAPACITY) {
      const oldest = this.textTokenCache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.textTokenCache.delete(oldest);
    }
    this.textTokenCache.set(row.id, { fingerprint, tokens });
    return tokens;
  }

  private invalidateTokenCache(id: string) {
    this.textTokenCache.delete(id);
  }

  private embed(text: string): number[] {
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    const normalized = String(text ?? '').normalize('NFKC').toLowerCase();
    for (let index = 0; index < normalized.length; index++) {
      const code = normalized.charCodeAt(index);
      vector[(code + index * 7) % EMBEDDING_DIMENSIONS] += ((code % 17) - 8) / 120;
    }
    let norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (!Number.isFinite(norm) || norm <= 1e-12) {
      vector[0] = 1;
      norm = 1;
    }
    return vector.map(value => value / norm);
  }

  private cosine(a: number[] | undefined, b: number[]): number {
    if (!Array.isArray(a) || a.length !== EMBEDDING_DIMENSIONS || b.length !== EMBEDDING_DIMENSIONS) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let index = 0; index < EMBEDDING_DIMENSIONS; index++) {
      const left = a[index];
      const right = b[index];
      if (!Number.isFinite(left) || !Number.isFinite(right)) return 0;
      dot += left * right;
      normA += left * left;
      normB += right * right;
    }
    if (normA <= 1e-12 || normB <= 1e-12) return 0;
    const score = dot / Math.sqrt(normA * normB);
    return Number.isFinite(score) ? Math.max(-1, Math.min(1, score)) : 0;
  }

  retrieve(query: string, limit = 8, clone = true) {
    const queryTokens = [...new Set(tokenize(query))];
    if (queryTokens.length === 0 || !Number.isFinite(limit) || limit < 1) return [];
    const safeLimit = Math.max(1, Math.min(MAX_RETRIEVAL_RESULTS, Math.floor(limit)));
    const qEmbedding = this.embed(query);
    const now = Date.now();
    const top: Array<{ m: MemoryRecord; score: number }> = [];

    const consider = (memory: MemoryRecord) => {
      const score = this.score(memory, queryTokens, now)
        + Math.max(0, this.cosine(memory.embedding, qEmbedding)) * 0.28
        + clamp01(finite(memory.consolidationScore01, 0)) * 0.08;
      if (!Number.isFinite(score)) return;
      let at = top.length;
      while (at > 0 && top[at - 1]!.score < score) at--;
      if (at < safeLimit) top.splice(at, 0, { m: memory, score });
      if (top.length > safeLimit) top.pop();
    };

    for (const memory of this.autobiographical) consider(memory);
    for (const memory of this.semantic) consider(memory);
    for (const memory of this.episodic) consider(memory);
    for (const memory of this.working) consider(memory);

    return top.map(({ m }) => {
      m.retrievalCount++;
      m.lastRetrievedAt = now;
      return clone ? structuredClone(m) : m;
    });
  }

  snapshot(options: { clone?: boolean; compact?: boolean } = {}) {
    const rows = [
      ...this.autobiographical.slice(0, 48),
      ...this.semantic.slice(0, 48),
      ...this.episodic.slice(0, 48),
      ...this.working.slice(0, 16),
    ].slice(0, 160);
    if (!options.compact) return options.clone === false ? rows : rows.map(row => structuredClone(row));
    const compacted = rows.map(row => ({
      ...row,
      evidence: row.evidence.slice(-6),
      sourceEventIds: row.sourceEventIds.slice(-8),
    }));
    return options.clone === false ? compacted : compacted.map(row => structuredClone(row));
  }

  /** Remove every timescale copy of an ID and invalidate its lexical cache. */
  remove(id: string): boolean {
    let removed = false;
    for (const rows of [this.working, this.episodic, this.semantic, this.autobiographical]) {
      for (let index = rows.length - 1; index >= 0; index--) {
        if (rows[index]!.id === id) {
          rows.splice(index, 1);
          removed = true;
        }
      }
    }
    this.invalidateTokenCache(id);
    return removed;
  }

  /**
   * Remove a canonical MemoryOS2 row from its derived read-model projection.
   * The ID fallback also covers snapshots written before canonicalProjection was introduced.
   */
  removeCanonicalProjection(itemId: string): boolean {
    const canonicalId = String(itemId ?? '').trim().slice(0, 160);
    if (!canonicalId) return false;
    let removed = false;
    for (const rows of [this.working, this.episodic, this.semantic, this.autobiographical]) {
      for (let index = rows.length - 1; index >= 0; index--) {
        const row = rows[index]!;
        if (row.id === canonicalId || (row.canonicalProjection?.owner === 'memoryOS2' && row.canonicalProjection.itemId === canonicalId)) {
          rows.splice(index, 1);
          this.invalidateTokenCache(row.id);
          removed = true;
        }
      }
    }
    this.invalidateTokenCache(canonicalId);
    return removed;
  }

  private score(memory: MemoryRecord, queryTokens: string[], now = Date.now()) {
    const haystack = this.tokensFor(memory);
    let hits = 0;
    for (const token of queryTokens) if (haystack.has(token)) hits++;
    const age = Math.max(0, now - finite(memory.createdAt, now)) / 86_400_000;
    const decay = memory.timescale === 'working'
      ? Math.exp(-age / 0.02)
      : memory.timescale === 'episodic'
        ? Math.exp(-age / 7)
        : memory.timescale === 'semantic'
          ? Math.exp(-age / 180)
          : Math.exp(-age / 365);
    return Math.min(1.4, hits * 0.28)
      + clamp01(finite(memory.salience, 0.5)) * 0.22
      + clamp01(finite(memory.confidence, 0.5)) * 0.18
      + clamp01(finite(memory.consolidationScore01, 0)) * 0.12
      + Math.min(0.12, Math.max(0, finite(memory.retrievalCount, 0)) * 0.006)
      + clamp01(decay) * 0.20;
  }
}
