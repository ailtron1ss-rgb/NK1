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

const defaultProfile = new MemoryOS2({ embeddingProvider: null });
const lowClampProfile = new MemoryOS2({ embeddingProvider: null, itemCap: 1 });
const highClampProfile = new MemoryOS2({ embeddingProvider: null, itemCap: 50_000 });
assert.equal(defaultProfile.capacityDiagnostics().hardCap, ITEM_CAP,
  'omitting itemCap must preserve the mobile/default 1,600 row cap');
assert.equal(lowClampProfile.capacityDiagnostics().hardCap, 128,
  'itemCap must be clamped to the documented minimum');
assert.equal(highClampProfile.capacityDiagnostics().hardCap, SOURCE_ROWS,
  'itemCap must be clamped to the documented 10k maximum');

const extended = new MemoryOS2({ embeddingProvider: null, itemCap: SOURCE_ROWS });
const extendedStarted = performance.now();
extended.restore(restoreSnapshot);
const extendedRestoreMs = performance.now() - extendedStarted;
const extendedDiagnostics = extended.restoreDiagnostics();
const extendedIndex = extended.indexDiagnostics();
assert.equal(extendedDiagnostics.sourceRows, SOURCE_ROWS);
assert.equal(extendedDiagnostics.acceptedRows, SOURCE_ROWS,
  'the explicit 10k profile must retain all 10k valid rows');
assert.equal(extendedDiagnostics.truncatedRows, 0);
assert.equal(extended.capacityDiagnostics().hardCap, SOURCE_ROWS);
assert.equal(extendedIndex.pass, true);
assert.equal(extendedIndex.items, SOURCE_ROWS);

const directRetrievalTimes = [];
for (let iteration = 0; iteration < 16; iteration++) {
  const directStarted = performance.now();
  const direct = extended.retrieve('capacityprobe sentinelomega', 5);
  directRetrievalTimes.push(performance.now() - directStarted);
  assert.equal(direct[0]?.id, targetId,
    'the 10k configured profile must retrieve the retained high-value target');
}
const sortedDirectTimes = [...directRetrievalTimes].sort((a, b) => a - b);
const directP50Ms = sortedDirectTimes[Math.floor(sortedDirectTimes.length * .50)];
const directP95Ms = sortedDirectTimes[Math.min(sortedDirectTimes.length - 1, Math.ceil(sortedDirectTimes.length * .95) - 1)];
const previewStarted = performance.now();
const extendedPreview = extended.previewRetrieve('capacityprobe sentinelomega', 5);
const extendedPreviewMs = performance.now() - previewStarted;
assert.equal(extendedPreview[0]?.id, targetId,
  'preview cloning must preserve the configured 10k capacity');

const maintenance = extended.maintain({ maxItems: 9_000 });
assert.equal(maintenance.hardCap, 9_000);
assert.equal(maintenance.after, 9_000,
  'maintenance maxItems must be bounded by, and operate below, the configured 10k capacity');
assert.equal(extended.indexDiagnostics().pass, true,
  'maintenance eviction must keep all secondary indexes consistent');

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
  capacityStatus: 'default 1.6k cap is enforced; 10k profile is measured separately',
  extended10k: {
    acceptedRows: extendedDiagnostics.acceptedRows,
    truncatedRows: extendedDiagnostics.truncatedRows,
    restoreMs: Number(extendedRestoreMs.toFixed(2)),
    directRetrieveP50Ms: Number(directP50Ms.toFixed(2)),
    directRetrieveP95Ms: Number(directP95Ms.toFixed(2)),
    isolatedPreviewMs: Number(extendedPreviewMs.toFixed(2)),
    indexIntegrity: extendedIndex.pass,
    capacity: extended.capacityDiagnostics(),
    maintenance: { before: maintenance.before, after: maintenance.after, removed: maintenance.removedIds.length },
    capacityClamp: { default: ITEM_CAP, minimum: 128, maximum: highClampProfile.capacityDiagnostics().hardCap },
  },
}));
