import type { LocalCrossEncoderReranker } from './LocalCrossEncoderReranker.ts';

export interface MemoryRerankShadowCore {
  memoryInspectorSearchSemantic(query: string, limit: number): Promise<{
    memories: Array<{ id: string; content: string }>;
    semantic?: unknown;
  }>;
}

/**
 * Read-only comparison for the MemoryOS2 inspector. The canonical result is returned
 * unchanged; cross-encoder output is a separate, explicitly non-user-facing shadow list.
 */
export async function previewMemoryCrossEncoderShadow(
  core: MemoryRerankShadowCore,
  reranker: LocalCrossEncoderReranker | undefined,
  rawQuery: string,
  rawLimit = 8,
) {
  const query = String(rawQuery ?? '').trim().slice(0, 512);
  const limitValue = Number(rawLimit);
  const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(32, Math.floor(limitValue))) : 8;
  if (!query) throw new Error('memory-rerank-shadow-query-required');
  if (!reranker) {
    return {
      enabled: false,
      ok: false,
      userFacingEligible: false,
      errorCode: 'disabled',
      canonicalIds: [],
      shadowIds: [],
      ranked: [],
      comparison: null,
    };
  }

  const baseline = await core.memoryInspectorSearchSemantic(query, limit);
  const memories = Array.isArray(baseline?.memories)
    ? baseline.memories.slice(0, limit).filter(row => row && typeof row.id === 'string' && row.id
      && typeof row.content === 'string' && row.content.trim())
    : [];
  if (!memories.length) {
    return {
      enabled: true,
      ok: true,
      userFacingEligible: false,
      errorCode: null,
      model: reranker.diagnostics().model,
      canonicalIds: [],
      shadowIds: [],
      ranked: [],
      comparison: { candidateCount: 0, overlapAtK: 0, jaccardAtK: 1 },
    };
  }

  const ranked = await reranker.rerank(query, memories.map(row => row.content));
  const canonicalIds = memories.map(row => row.id);
  if (!ranked.ok) {
    return {
      enabled: true,
      ok: false,
      userFacingEligible: false,
      errorCode: ranked.errorCode,
      model: ranked.model,
      canonicalIds,
      shadowIds: [],
      ranked: [],
      comparison: null,
      latencyMs: ranked.latencyMs,
      candidateCount: memories.length,
    };
  }

  const shadowIds = ranked.results.map(row => memories[row.index]?.id).filter((id): id is string => typeof id === 'string');
  const topK = Math.min(5, canonicalIds.length);
  const left = new Set(canonicalIds.slice(0, topK));
  const right = new Set(shadowIds.slice(0, topK));
  const overlap = [...left].filter(id => right.has(id)).length;
  const union = new Set([...left, ...right]).size;
  return {
    enabled: true,
    ok: true,
    userFacingEligible: false,
    errorCode: null,
    model: ranked.model,
    canonicalIds,
    shadowIds,
    ranked: ranked.results.map(row => ({
      id: memories[row.index].id,
      rank: ranked.results.findIndex(item => item.index === row.index) + 1,
      score: row.relevanceScore,
    })),
    comparison: {
      candidateCount: memories.length,
      overlapAtK: overlap,
      jaccardAtK: union ? overlap / union : 1,
      k: topK,
    },
    latencyMs: ranked.latencyMs,
  };
}
