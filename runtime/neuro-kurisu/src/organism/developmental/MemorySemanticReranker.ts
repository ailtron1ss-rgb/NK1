/**
 * Bounded second-stage reranking for semantic memory retrieval.
 *
 * The semantic score remains the primary evidence. Contextual metadata can
 * reorder only a small semantically preselected pool; it cannot inject a
 * high-salience but unrelated memory into the result set.
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
  // Query context amplifies relevant lanes without erasing their baseline
  // importance to autobiographical continuity and ongoing commitments.
  const identityGate = 0.25 + 0.75 * identityDemand;
  const goalGate = 0.25 + 0.75 * goalDemand;

  return clamp01(
    0.20 * clamp01(item.salience) +
    0.22 * clamp01(item.emotionalWeight) +
    0.18 * clamp01(item.identityRelevance) * identityGate +
    0.18 * clamp01(item.goalRelevance) * goalGate +
    0.08 * clamp01(item.socialRelevance) +
    0.07 * clamp01(item.predictionError) +
    0.07 * clamp01(item.confidence),
  );
}

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

  const preselected = [...candidates]
    .filter((candidate) =>
      candidate &&
      candidate.item &&
      typeof candidate.item.id === 'string' &&
      Number.isFinite(candidate.score) &&
      Number.isFinite(candidate.similarity),
    )
    .sort((a, b) =>
      b.score - a.score ||
      b.similarity - a.similarity ||
      a.lexicalRank - b.lexicalRank ||
      a.item.id.localeCompare(b.item.id),
    )
    .slice(0, poolLimit);

  return preselected
    .map((candidate) => {
      const baseScore = clamp01(candidate.score);
      const metadataScore = metadataRelevance(candidate.item, goalDemand, identityDemand);
      return {
        ...candidate,
        baseScore,
        metadataScore,
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
