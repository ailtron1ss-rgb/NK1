import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

/**
 * Latency budget guard for canonical retrieval (prompt target: <= 30 ms p95 on
 * 10,000 records).
 *
 * Finding (WorkPass72): the live MemoryOS2 store has a hard residency cap of
 * 1600 rows (`items.length > 1600 -> pop()` in encode). Encoding 10,000 records
 * therefore leaves the live store holding exactly 1600; the "10,000 records"
 * latency target can only be met by whatever storage tier serves beyond the cap,
 * which is not implemented. This test therefore:
 *   1. pins the documented 1600-row cap so a change to it is surfaced, and
 *   2. asserts the <= 30 ms p95 budget over the live resident set.
 * It asserts a generous p95 ceiling to stay stable on slower CI runners while
 * still catching order-of-magnitude regressions.
 */
const now = 2_000_000_000_000;
const ENCODE_ATTEMPTS = 10_000;
const LIVE_CAP = 1600;
const QUERIES = 40;
const P95_BUDGET_MS = 30;

const memory = new MemoryOS2();
for (let i = 0; i < ENCODE_ATTEMPTS; i++) {
  memory.encode({
    id: `m${i}`,
    content: `project-elm telemetry route ${i % 97} status ${i % 5} latency ${i % 3} sensor ${i % 11}`,
    kind: 'semantic', source: 'latency-fixture', tags: ['latency'],
    context: { fixture: 'workpass72-latency' },
    salience: .6, emotionalWeight: .2, identityRelevance: .2, goalRelevance: .2, socialRelevance: .1,
    predictionError: .1, confidence: .9, epistemicStatus: 'fact',
    entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [],
    validFromAt: now - 10000, provenanceClass: 'external', sourceAuthority01: .9, observedAt: now - 1000,
  });
}
const liveRecords = memory.snapshot().items.length;
assert.equal(liveRecords, LIVE_CAP, `live store should cap at ${LIVE_CAP} rows, held ${liveRecords}`);

// Warm up so the first-query JIT/alloc cost does not dominate the sample.
for (let i = 0; i < 5; i++) memory.retrieve(`project elm telemetry route ${i} warmup`, 5, 0, 0, { temporalMode: 'at', asOfAt: now }, true);

const latencies = [];
for (let i = 0; i < QUERIES; i++) {
  const query = `project elm telemetry route ${i % 97} status ${i % 5} latency sample ${i}`;
  const start = performance.now();
  const items = memory.retrieve(query, 5, 0, 0, { temporalMode: 'at', asOfAt: now }, true);
  latencies.push(performance.now() - start);
  assert.ok(Array.isArray(items), 'retrieve must return an array');
}

latencies.sort((a, b) => a - b);
const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))];
const average = latencies.reduce((a, b) => a + b, 0) / latencies.length;
const p50 = percentile(.5);
const p95 = percentile(.95);
const p99 = percentile(.99);
const max = latencies[latencies.length - 1];

assert.ok(p95 <= P95_BUDGET_MS, `retrieval p95 ${p95.toFixed(2)}ms exceeded ${P95_BUDGET_MS}ms budget at ${liveRecords} records`);
assert.ok(p50 <= P95_BUDGET_MS, `retrieval median ${p50.toFixed(2)}ms exceeded ${P95_BUDGET_MS}ms budget`);

console.log('WORKPASS72_MEMORY_RETRIEVAL_LATENCY=PASS');
console.log(JSON.stringify({
  encodeAttempts: ENCODE_ATTEMPTS, liveRecords, liveCap: LIVE_CAP, queries: QUERIES, budgetP95Ms: P95_BUDGET_MS,
  avgMs: +average.toFixed(3), p50Ms: +p50.toFixed(3), p95Ms: +p95.toFixed(3),
  p99Ms: +p99.toFixed(3), maxMs: +max.toFixed(3),
  tenKTargetValidated: false,
  note: 'live store caps at 1600 rows; the 10k-record target needs a storage tier beyond the cap',
}));
