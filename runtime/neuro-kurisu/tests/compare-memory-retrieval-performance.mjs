import { readFileSync } from 'node:fs';

function readReport(path) {
  const report = JSON.parse(readFileSync(path, 'utf8'));
  if (report.schemaVersion !== 1 || report.benchmark !== 'nk1-memory-retrieval-performance') {
    throw new Error(`Invalid performance report: ${path}`);
  }
  return report;
}
function pctChange(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after) || before === 0) return null;
  return Number(((after - before) / Math.abs(before) * 100).toFixed(2));
}
function safeRatio(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after) || after <= 0) return null;
  return Number((before / after).toFixed(3));
}
function equalJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const baseline = readReport(process.argv[2]);
const candidate = readReport(process.argv[3]);
const baselineBySize = new Map(baseline.results.map(row => [row.corpusSize, row]));
const comparisons = candidate.results.map(after => {
  const before = baselineBySize.get(after.corpusSize);
  if (!before) throw new Error(`No baseline result for corpus size ${after.corpusSize}`);
  const rankingChecks = Object.keys(before.topIds).map(query => ({
    query,
    sameTopFive: equalJson(before.topIds[query], after.topIds[query]),
  }));
  const rankingParity = rankingChecks.every(item => item.sameTopFive);
  const temporalChainParity = equalJson(before.temporalChainLookup.chainIds, after.temporalChainLookup.chainIds)
    && before.temporalChainLookup.chainLength === after.temporalChainLookup.chainLength;
  const temporalDiagnosticsParity = equalJson(before.temporalChainLookup.temporalDiagnostics.state, after.temporalChainLookup.temporalDiagnostics.state);
  const summarizeWorkload = key => ({
    baseline: before[key],
    candidate: after[key],
    p50ChangePercent: pctChange(before[key].p50Ms, after[key].p50Ms),
    p95ChangePercent: pctChange(before[key].p95Ms, after[key].p95Ms),
    p95SpeedupFactor: safeRatio(before[key].p95Ms, after[key].p95Ms),
    throughputChangePercent: pctChange(before[key].throughputPerSecond, after[key].throughputPerSecond),
  });
  return {
    corpusSize: after.corpusSize,
    mixedQuery: summarizeWorkload('mixedQuery'),
    repeatedQuery: summarizeWorkload('repeatedQuery'),
    temporalChainLookup: {
      baseline: before.temporalChainLookup.lookup,
      candidate: after.temporalChainLookup.lookup,
      p50ChangePercent: pctChange(before.temporalChainLookup.lookup.p50Ms, after.temporalChainLookup.lookup.p50Ms),
      p95ChangePercent: pctChange(before.temporalChainLookup.lookup.p95Ms, after.temporalChainLookup.lookup.p95Ms),
      p95SpeedupFactor: safeRatio(before.temporalChainLookup.lookup.p95Ms, after.temporalChainLookup.lookup.p95Ms),
      throughputChangePercent: pctChange(before.temporalChainLookup.lookup.throughputPerSecond, after.temporalChainLookup.lookup.throughputPerSecond),
      chainLength: after.temporalChainLookup.chainLength,
      chainIdsMatchBaseline: temporalChainParity,
      indexIntegrity: { baseline: before.temporalChainLookup.indexIntegrity, candidate: after.temporalChainLookup.indexIntegrity },
    },
    temporalChainParity,
    temporalDiagnostics: {
      baseline: before.temporalChainLookup.temporalDiagnostics.lookup,
      candidate: after.temporalChainLookup.temporalDiagnostics.lookup,
      p50ChangePercent: pctChange(before.temporalChainLookup.temporalDiagnostics.lookup.p50Ms, after.temporalChainLookup.temporalDiagnostics.lookup.p50Ms),
      p95ChangePercent: pctChange(before.temporalChainLookup.temporalDiagnostics.lookup.p95Ms, after.temporalChainLookup.temporalDiagnostics.lookup.p95Ms),
      p95SpeedupFactor: safeRatio(before.temporalChainLookup.temporalDiagnostics.lookup.p95Ms, after.temporalChainLookup.temporalDiagnostics.lookup.p95Ms),
      throughputChangePercent: pctChange(before.temporalChainLookup.temporalDiagnostics.lookup.throughputPerSecond, after.temporalChainLookup.temporalDiagnostics.lookup.throughputPerSecond),
      stateMatchesBaseline: temporalDiagnosticsParity,
    },
    temporalDiagnosticsParity,
    memory: {
      baseline: before.memory,
      candidate: after.memory,
      candidateHeapAfterVsBaselineBytes: after.memory.heapUsedAfterBytes - before.memory.heapUsedAfterBytes,
      candidateHeapAfterVsBaselinePercent: pctChange(before.memory.heapUsedAfterBytes, after.memory.heapUsedAfterBytes),
      candidateRssAfterVsBaselineBytes: after.memory.rssAfterBytes - before.memory.rssAfterBytes,
      candidateRssAfterVsBaselinePercent: pctChange(before.memory.rssAfterBytes, after.memory.rssAfterBytes),
    },
    baselineHeapDeltaBytes: before.memory.heapDeltaBytes,
    candidateHeapDeltaBytes: after.memory.heapDeltaBytes,
    baselineRssDeltaBytes: before.memory.rssDeltaBytes,
    candidateRssDeltaBytes: after.memory.rssDeltaBytes,
    baselineCache: before.caches,
    candidateCache: after.caches,
    rankingParity,
    changedTopFiveQueryCount: rankingChecks.filter(item => !item.sameTopFive).length,
    indexIntegrity: { baseline: before.indexIntegrity, candidate: after.indexIntegrity },
  };
});
const output = {
  schemaVersion: 1,
  benchmark: 'nk1-memory-retrieval-performance-comparison',
  baseline: { label: baseline.label, commit: baseline.commit, nodeVersion: baseline.nodeVersion },
  candidate: { label: candidate.label, commit: candidate.commit, nodeVersion: candidate.nodeVersion },
  methodology: 'same runner; same deterministic synthetic corpus and query schedule; warmup excluded from measured samples; percentile changes are descriptive, not a production guarantee',
  results: comparisons,
  allRankingParity: comparisons.every(row => row.rankingParity && row.temporalChainParity && row.temporalDiagnosticsParity),
};
console.log(JSON.stringify(output, null, 2));
if (!output.allRankingParity) {
  console.error('PERFORMANCE_BENCHMARK_RANKING_PARITY=FAIL');
  process.exitCode = 2;
} else {
  console.error('PERFORMANCE_BENCHMARK_RANKING_PARITY=PASS');
}
