import { performance } from 'node:perf_hooks';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const CORPUS_SIZES = [256, 800, 1600];
const WARMUP_QUERIES = 16;
const MEASURED_QUERIES = 100;
const REPEATED_WARMUP = 8;
const REPEATED_SAMPLES = 50;
const QUERIES = [
  'telemetry subsystem route status 7 latency 11',
  'sensor pressure region 17 temperature 4',
  'project aurora status 5 timeout recovery',
  'memory retrieval cache path 12 canonical',
  'subsystem 38 telemetry route 4 sensor',
  'why did subsystem 46 retry after cache miss',
  'модуль датчик давление 24 температура режим',
  'project delta route 23 latency status',
  'bootstrap learning agent 29 schedule',
  'region 15 diagnostic 6 telemetry',
];

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)].toFixed(4));
}
function summarize(values) {
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / Math.max(1, values.length);
  return {
    samples: values.length,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    meanMs: Number(mean.toFixed(4)),
    minMs: Number(Math.min(...values).toFixed(4)),
    maxMs: Number(Math.max(...values).toFixed(4)),
    throughputPerSecond: Number((1000 / Math.max(0.0001, mean)).toFixed(2)),
  };
}
function memoryInput(i, now) {
  const project = ['aurora', 'delta', 'elm', 'lumen', 'neuro'][i % 5];
  return {
    id: `perf-memory-${i}`,
    content: `Project ${project} telemetry subsystem ${i % 47} route ${i % 31} status ${i % 11} latency ${i % 17} sensor pressure region ${i % 29} temperature ${i % 7} memory retrieval cache path ${i % 23} agent bootstrap schedule ${i % 13} diagnostic ${i % 9}. Датчик давление ${i % 29} температура ${i % 7} модуль режим ${i % 11}.`,
    kind: 'semantic',
    source: 'nk1-retrieval-performance-fixture-v1',
    tags: ['performance-fixture', project],
    context: { fixture: 'synthetic-v1', project },
    salience: 0.35 + (i % 5) * 0.1,
    emotionalWeight: 0.1,
    identityRelevance: (i % 7) / 10,
    goalRelevance: (i % 9) / 10,
    socialRelevance: 0.1,
    predictionError: (i % 4) / 10,
    confidence: 0.75 + (i % 4) * 0.05,
    epistemicStatus: 'fact',
    entities: [],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
    contradictionLinks: [],
    validFromAt: now - 60_000,
    observedAt: now - 30_000,
  };
}
function buildMemory(size) {
  const now = Date.now();
  const memory = new MemoryOS2({ embeddingProvider: null });
  for (let i = 0; i < size; i++) memory.encode(memoryInput(i, now), { clone: false });
  return { memory, now };
}
function runQuery(memory, query, now) {
  const started = performance.now();
  const rows = memory.retrieve(query, 8, 0, 0, { temporalMode: 'at', asOfAt: now });
  return { elapsedMs: Math.max(0, performance.now() - started), topIds: rows.slice(0, 5).map(row => row.id) };
}
function benchmarkSize(size) {
  const { memory, now } = buildMemory(size);
  if (typeof globalThis.gc === 'function') globalThis.gc();
  const before = process.memoryUsage();
  const first = runQuery(memory, QUERIES[0], now);
  for (let i = 0; i < WARMUP_QUERIES; i++) runQuery(memory, QUERIES[i % QUERIES.length], now);
  const mixedLatencies = [];
  const topIds = {};
  for (let i = 0; i < MEASURED_QUERIES; i++) {
    const query = QUERIES[i % QUERIES.length];
    const sample = runQuery(memory, query, now);
    mixedLatencies.push(sample.elapsedMs);
    if (topIds[query] === undefined) topIds[query] = sample.topIds;
  }
  const repeatedQuery = QUERIES[0];
  for (let i = 0; i < REPEATED_WARMUP; i++) runQuery(memory, repeatedQuery, now);
  const repeatedLatencies = [];
  for (let i = 0; i < REPEATED_SAMPLES; i++) repeatedLatencies.push(runQuery(memory, repeatedQuery, now).elapsedMs);
  if (typeof globalThis.gc === 'function') globalThis.gc();
  const after = process.memoryUsage();
  const diagnostics = memory.indexDiagnostics?.();
  return {
    corpusSize: size,
    firstQueryMs: Number(first.elapsedMs.toFixed(4)),
    mixedQuery: summarize(mixedLatencies),
    repeatedQuery: summarize(repeatedLatencies),
    memory: {
      heapUsedBeforeBytes: before.heapUsed,
      heapUsedAfterBytes: after.heapUsed,
      heapDeltaBytes: after.heapUsed - before.heapUsed,
      rssBeforeBytes: before.rss,
      rssAfterBytes: after.rss,
      rssDeltaBytes: after.rss - before.rss,
    },
    caches: {
      tokenCacheEntries: memory.tokenCache?.size ?? null,
      termFrequencyCacheEntries: memory.termFrequencyCache?.size ?? 0,
      termFrequencyCacheLimit: memory.termFrequencyCache ? 512 : null,
    },
    indexIntegrity: diagnostics?.pass ?? null,
    topIds,
  };
}

const report = {
  schemaVersion: 1,
  benchmark: 'nk1-memory-retrieval-performance',
  label: process.env.NK1_PERF_LABEL ?? 'unspecified',
  commit: process.env.GITHUB_SHA ?? process.env.NK1_PERF_COMMIT ?? 'local',
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
  methodology: {
    dataset: 'deterministic synthetic bilingual memory corpus; performance-only, not a production workload',
    corpusSizes: CORPUS_SIZES,
    warmupQueries: WARMUP_QUERIES,
    measuredMixedQueries: MEASURED_QUERIES,
    repeatedQueryWarmup: REPEATED_WARMUP,
    repeatedQuerySamples: REPEATED_SAMPLES,
    queryCount: QUERIES.length,
    timers: 'node:perf_hooks performance.now; nearest-rank p50/p95',
    rankingComparison: 'top-five IDs recorded per query to detect retrieval drift',
    note: 'Run baseline and candidate in the same CI job and runner; noisy heap/RSS values are descriptive only.',
  },
  results: CORPUS_SIZES.map(benchmarkSize),
};
console.log(JSON.stringify(report));
