import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { rerankSemanticCandidates } from '../src/organism/developmental/MemorySemanticReranker.ts';

// CPU-only profile of the second-stage reranker over a fixed 10k-record candidate set.
// Embedding generation, vector-index I/O, MemoryFabric fetch and item cloning are excluded.
const candidates = Array.from({ length: 10_000 }, (_, index) => ({
  item: {
    id: `memory-${String(index).padStart(5, '0')}`,
    salience: ((index * 17) % 101) / 100,
    emotionalWeight: ((index * 29) % 97) / 96,
    identityRelevance: ((index * 11) % 89) / 88,
    goalRelevance: ((index * 23) % 83) / 82,
    socialRelevance: ((index * 7) % 79) / 78,
    predictionError: ((index * 31) % 73) / 72,
    confidence: ((index * 13) % 67) / 66,
  },
  score: .25 + ((index * 37) % 1000) / 1400,
  similarity: ((index * 41) % 1000) / 1000,
  lexicalRank: index % 113,
}));
const options = { limit: 8, goalRelevance: .72, identityRelevance: .64 };
for (let i = 0; i < 8; i++) {
  const warm = rerankSemanticCandidates(candidates, options);
  assert.equal(warm.length, 8);
}
const samples = [];
let finalRows = [];
for (let i = 0; i < 60; i++) {
  const started = performance.now();
  finalRows = rerankSemanticCandidates(candidates, options);
  samples.push(performance.now() - started);
}
const ordered = [...samples].sort((a, b) => a - b);
const percentile = (p) => ordered[Math.min(ordered.length - 1, Math.ceil(p * ordered.length) - 1)];
const report = {
  status: 'measured',
  benchmark: 'memory-semantic-affect-reranker',
  candidateCount: candidates.length,
  outputLimit: options.limit,
  warmupRuns: 8,
  measuredRuns: samples.length,
  p50Ms: Number(percentile(.50).toFixed(3)),
  p95Ms: Number(percentile(.95).toFixed(3)),
  maxMs: Number(Math.max(...samples).toFixed(3)),
  scope: 'CPU-only candidate normalization + semantic preselection + contextual reranking; excludes embeddings, vector I/O, MemoryFabric and cloning',
};
assert.equal(finalRows.length, options.limit);
assert.ok(finalRows.every((row) => Number.isFinite(row.score) && row.score >= 0 && row.score <= 1));
console.log(JSON.stringify(report));
assert.ok(percentile(.95) <= 30,
  `p95 ${percentile(.95).toFixed(3)}ms exceeds the 30ms/10k reranker component budget`);
