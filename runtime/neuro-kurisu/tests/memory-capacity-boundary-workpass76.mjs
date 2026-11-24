import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const SOURCE_ROWS = 10_000;
const ITEM_CAP = 1_600;
const SCAN_LIMIT = 100_000;
const now = Date.now();
const rows = Array.from({ length: SOURCE_ROWS }, (_, index) => {
  const isSearchTarget = index === SOURCE_ROWS - 1;
  return {
    id: 'capacity-row-' + String(index).padStart(5, '0'),
    content: isSearchTarget
      ? 'capacityprobe sentinelomega retained target record'
      : 'capacityprobe segment-' + index + ' stored record payload',
    kind: 'semantic',
    source: 'workpass76-capacity-boundary-fixture',
    createdAt: now - SOURCE_ROWS * 10 + index,
    lastAccessAt: now - SOURCE_ROWS * 10 + index,
    observedAt: now - SOURCE_ROWS * 10 + index,
    validFromAt: now - SOURCE_ROWS * 10,
    validUntilAt: null,
    salience: isSearchTarget ? .99 : .12,
    emotionalWeight: .1,
    identityRelevance: .1,
    goalRelevance: .1,
    socialRelevance: .1,
    predictionError: .1,
    temperature01: .2,
    confidence: .65,
    epistemicStatus: 'hypothesis',
    entities: [],
    tags: [],
    context: {},
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
    contradictionLinks: [],
    revisionHistory: [],
    dormant: false,
    retrievalCount: 0,
    semanticVector: [],
  };
});

const memory = new MemoryOS2({ embeddingProvider: null });
const emptySnapshot = memory.snapshot();
const restoreSnapshot = { ...emptySnapshot, items: rows };
const started = performance.now();
memory.restore(restoreSnapshot);
const restoreMs = performance.now() - started;
const diagnostics = memory.restoreDiagnostics();
const after = memory.snapshot();

assert.equal(diagnostics.sourceRows, SOURCE_ROWS);
assert.equal(diagnostics.invalidRowsDropped, 0);
assert.equal(diagnostics.acceptedRows, ITEM_CAP);
assert.equal(diagnostics.truncatedRows, SOURCE_ROWS - ITEM_CAP);
assert.equal(diagnostics.capacityOverrunRows, 0);
assert.equal(after.items.length, ITEM_CAP);

const targetId = 'capacity-row-' + String(SOURCE_ROWS - 1).padStart(5, '0');
assert.ok(after.items.some(item => item.id === targetId), 'high-value target must survive capacity selection');
const searchStarted = performance.now();
const result = memory.previewRetrieve('capacityprobe sentinelomega', 5);
const searchMs = performance.now() - searchStarted;
assert.equal(result[0]?.id, targetId, 'retained target must be searchable after restore');

const index = memory.indexDiagnostics();
assert.equal(index.pass, true, 'indexes must remain consistent after bounded 10k-row restore');

const tooMany = { ...emptySnapshot, items: new Array(SCAN_LIMIT + 1) };
assert.throws(
  () => new MemoryOS2({ embeddingProvider: null }).restore(tooMany),
  /safe scan limit of 100000 rows/,
  'restore must fail closed beyond the explicit scan ceiling',
);

console.log('MEMORY_CAPACITY_BOUNDARY_WORKPASS76=PASS', JSON.stringify({
  sourceRows: diagnostics.sourceRows,
  acceptedRows: diagnostics.acceptedRows,
  truncatedRows: diagnostics.truncatedRows,
  configuredItemCap: ITEM_CAP,
  scanLimit: SCAN_LIMIT,
  restoreMs: Number(restoreMs.toFixed(2)),
  retainedTargetSearchMs: Number(searchMs.toFixed(2)),
  retainedTargetSearchable: true,
  indexIntegrity: index.pass,
  indexItems: index.items,
  estimatedBytes: after.estimatedBytes,
  capacityStatus: '10k inputs scanned; only 1.6k rows retained/searchable by this MemoryOS2 instance',
}));
