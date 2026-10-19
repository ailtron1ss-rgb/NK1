import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const now = 2_000_000_000_000;
const memory = new MemoryOS2();
const encode = (id, content) => memory.encode({
  id, content, kind: 'semantic', source: 'numeric-retrieval-regression', tags: [], context: {},
  salience: .5, emotionalWeight: .1, identityRelevance: .1, goalRelevance: .1, socialRelevance: .1,
  predictionError: .1, confidence: .9, epistemicStatus: 'fact', entities: [], semanticLinks: [],
  temporalLinks: [], causalLinks: [], contradictionLinks: [], validFromAt: now - 1_000,
  observedAt: now - 500,
});

for (let value = 0; value <= 4; value++) {
  encode(`telemetry-${value}`, `telemetry module alpha status ${value} latency warning`);
}
for (let value = 0; value <= 4; value++) {
  encode(`sensor-${value}`, `датчик давление ${value} режим нормальный`);
}

const status = memory.previewRetrieve('status telemetry alpha 3', 5, 0, 0, { temporalMode: 'current', asOfAt: now });
assert.equal(status[0]?.id, 'telemetry-3', 'one-digit status codes must be indexed and ranked, not discarded');
assert.ok(status.findIndex(row => row.id === 'telemetry-3') < status.findIndex(row => row.id === 'telemetry-2'));

const russian = memory.previewRetrieve('давление датчик 4 режим', 5, 0, 0, { temporalMode: 'current', asOfAt: now });
assert.equal(russian[0]?.id, 'sensor-4', 'single-digit measurements must work with Unicode/Russian queries too');

// Numeric support is a ranking signal, not permission to return future or invalid memory.
const invalid = memory.snapshot();
invalid.items.find(row => row.id === 'telemetry-1').validUntilAt = now - 1;
const isolated = new MemoryOS2();
isolated.restore(invalid);
const afterExpiry = isolated.previewRetrieve('status telemetry alpha 1', 5, 0, 0, { temporalMode: 'current', asOfAt: now });
assert.ok(afterExpiry.every(row => row.id !== 'telemetry-1'), 'numeric matching must not bypass temporal validity');

console.log('MEMORY_RETRIEVAL_NUMERIC_TERMS=PASS', JSON.stringify({ statusTop: status[0]?.id, russianTop: russian[0]?.id, expiredExcluded: true }));
