/**
 * Bounded second-stage reranking for semantic memory retrieval.
 *
 * Semantic evidence chooses the candidate pool first. Affective and contextual
 * metadata can only reorder that pool; it cannot inject unrelated memories.
 */
export interface SemanticRerankMetadata {
  id: string;
  salience: number;
  emotionalWeight: number;
  identityRelevance: number;
  goalRelevance: number;
  socialRelevance: number;
  predictionError: number;
  confidence: number;
}

export interface SemanticRerankCandidate<T extends SemanticRerankMetadata> {
  item: T;
  /** Existing semantic/lexical score, before contextual reranking. */
  score: number;
  similarity: number;
  lexicalRank: number;
}

export interface SemanticRerankOptions {
  limit: number;
  goalRelevance?: number;
  identityRelevance?: number;
}

export interface SemanticRerankedCandidate<T extends SemanticRerankMetadata>
  extends SemanticRerankCandidate<T> {
  /** Final bounded score after contextual reranking. */
  score: number;
  /** Preserved score from the semantic preselection stage. */
  baseScore: number;
  metadataScore: number;
}

const clamp01 = (value: unknown, fallback = 0): number => {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, numeric));
};

const safeLimit = (value: number): number =>
  Math.max(1, Math.min(32, Number.isFinite(value) ? Math.floor(value) : 8));

function metadataRelevance(
  item: SemanticRerankMetadata,
  goalDemand: number,
  identityDemand: number,
): number {
  // Query context amplifies identity/goal matches without making either lane
  // dominate unrelated queries. Confidence is reliability, not relevance:
  // it gates metadata influence instead of rewarding confidence by itself.
  const identityGate = 0.25 + 0.75 * identityDemand;
  const goalGate = 0.25 + 0.75 * goalDemand;
  const reliability = 0.4 + 0.6 * clamp01(item.confidence);

  const contextualSignal =
    0.22 * clamp01(item.salience) +
    0.26 * clamp01(item.emotionalWeight) +
    0.18 * clamp01(item.identityRelevance) * identityGate +
    0.18 * clamp01(item.goalRelevance) * goalGate +
    0.08 * clamp01(item.socialRelevance) +
    0.08 * clamp01(item.predictionError);

  return clamp01(contextualSignal * reliability);
}

interface NormalizedCandidate<T extends SemanticRerankMetadata>
  extends SemanticRerankCandidate<T> {
  normalizedId: string;
}

function normalizeCandidates<T extends SemanticRerankMetadata>(
  candidates: readonly SemanticRerankCandidate<T>[],
): NormalizedCandidate<T>[] {
  const byId = new Map<string, NormalizedCandidate<T>>();

  for (const candidate of candidates) {
    if (
      !candidate ||
      !candidate.item ||
      typeof candidate.item.id !== 'string' ||
      !candidate.item.id.trim() ||
      candidate.item.id.length > 256 ||
      !Number.isFinite(candidate.score) ||
      !Number.isFinite(candidate.similarity)
    ) continue;

    const normalized: NormalizedCandidate<T> = {
      ...candidate,
      normalizedId: candidate.item.id.trim(),
      score: clamp01(candidate.score),
      similarity: clamp01(candidate.similarity),
      lexicalRank: Number.isFinite(candidate.lexicalRank) && candidate.lexicalRank >= 0
        ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(candidate.lexicalRank))
        : Number.MAX_SAFE_INTEGER,
    };
    const previous = byId.get(normalized.normalizedId);
    if (
      !previous ||
      normalized.score > previous.score ||
      (normalized.score === previous.score && normalized.similarity > previous.similarity) ||
      (normalized.score === previous.score &&
        normalized.similarity === previous.similarity &&
        normalized.lexicalRank < previous.lexicalRank)
    ) byId.set(normalized.normalizedId, normalized);
  }

  return [...byId.values()];
}

const semanticOrder = <T extends SemanticRerankMetadata>(
  a: NormalizedCandidate<T>,
  b: NormalizedCandidate<T>,
): number =>
  b.score - a.score ||
  b.similarity - a.similarity ||
  a.lexicalRank - b.lexicalRank ||
  a.normalizedId.localeCompare(b.normalizedId);

/**
 * Preserve semantic recall as the first gate, then modestly rerank by the
 * organism's affective and contextual relevance. Stable tie-breakers make the
 * result deterministic across identical snapshots.
 */
export function rerankSemanticCandidates<T extends SemanticRerankMetadata>(
  candidates: readonly SemanticRerankCandidate<T>[],
  options: SemanticRerankOptions,
): SemanticRerankedCandidate<T>[] {
  const limit = safeLimit(options.limit);
  const poolLimit = Math.max(limit, Math.min(64, limit * 4));
  const goalDemand = clamp01(options.goalRelevance);
  const identityDemand = clamp01(options.identityRelevance);

  const preselected = normalizeCandidates(candidates)
    .sort(semanticOrder)
    .slice(0, poolLimit);

  return preselected
    .map((candidate) => {
      const baseScore = candidate.score;
      const metadataScore = metadataRelevance(candidate.item, goalDemand, identityDemand);
      return {
        item: candidate.item,
        baseScore,
        metadataScore,
        similarity: candidate.similarity,
        lexicalRank: candidate.lexicalRank,
        score: clamp01(0.88 * baseScore + 0.12 * metadataScore),
      };
    })
    .sort((a, b) =>
      b.score - a.score ||
      b.baseScore - a.baseScore ||
      b.similarity - a.similarity ||
      a.lexicalRank - b.lexicalRank ||
      a.item.id.localeCompare(b.item.id),
    )
    .slice(0, limit);
}
