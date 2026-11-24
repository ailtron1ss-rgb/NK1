import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

// Warm the JIT and caches before measuring; keep warm-up samples out of percentiles.
for (let iteration = 0; iteration < 12; iteration++) {
  const warm = extended.retrieve('capacityprobe sentinelomega', 5);
  assert.equal(warm[0]?.id, targetId);
}
const directRetrievalTimes = [];
for (let iteration = 0; iteration < 64; iteration++) {
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

const originalItemCapEnv = process.env.NEURO_MEMORY_ITEM_CAP;
const originalByteBudgetEnv = process.env.NEURO_MEMORY_BYTE_BUDGET;
let canonicalRuntime;
let canonicalMaintenance;
let canonicalIndex;
let canonicalAccounting;
let canonicalLifecycle;
let canonicalDurableRoundTrip;
let canonicalFileBackedRoundTrip;
try {
  process.env.NEURO_MEMORY_ITEM_CAP = String(SOURCE_ROWS);
  process.env.NEURO_MEMORY_BYTE_BUDGET = String(7_200_000);
  canonicalRuntime = new MemorySubsystemRuntime();
  assert.equal(canonicalRuntime.memoryItemCap, SOURCE_ROWS);
  assert.equal(canonicalRuntime.memoryByteBudget, 7_200_000);
  canonicalRuntime.memoryOS.restore(restoreSnapshot);
  assert.equal(canonicalRuntime.memoryOS.size(), SOURCE_ROWS);
  canonicalMaintenance = canonicalRuntime.fabric.maintain({
    tick: 76,
    pressure01: .1,
    maxItems: canonicalRuntime.memoryItemCap,
    byteBudget: canonicalRuntime.memoryByteBudget,
  });
  assert.equal(canonicalRuntime.memoryOS.size(), SOURCE_ROWS,
    'the canonical MemoryFabric maintenance path must preserve the explicit 10k profile under the paired byte budget');
  assert.equal(canonicalMaintenance.byteBudget.budget, 7_200_000);
  assert.equal(canonicalMaintenance.byteBudget.evicted.length, 0,
    'no row should be byte-evicted when the derived 7.2 MB profile covers this 10k fixture');
  canonicalIndex = canonicalRuntime.memoryOS.indexDiagnostics();
  canonicalAccounting = canonicalRuntime.memoryOS.memoryAccountingDiagnostics();
  assert.equal(canonicalIndex.pass, true);
  assert.equal(canonicalAccounting.exact, true,
    'canonical byte accounting must reconcile after 10k-row maintenance');

  // Exercise the actual P70 -> CanonicalMemoryLifecycleAuthority -> MemoryFabric path.
  const lifecycleResult = canonicalRuntime.memoryLifecycleAuthority.run({
    tick: 77,
    at: now + 77,
    traces: 0,
    events: 0,
    goals: 0,
    memories: SOURCE_ROWS,
    semanticItems: 0,
    workingSet01: 1,
    energy01: 1,
    pressure01: .1,
    canonicalCapacity: canonicalRuntime.memoryItemCap,
    byteBudget: canonicalRuntime.memoryByteBudget,
  });
  assert.ok(lifecycleResult.plan.budgets.memories > 8_000,
    'P70 must scale lifecycle retention with an explicit expanded capacity');
  assert.equal(canonicalRuntime.memoryOS.size(), lifecycleResult.plan.budgets.memories,
    'the real lifecycle authority must retain the expanded count target rather than applying the legacy 640-row limit');
  assert.equal(lifecycleResult.maintenance.byteBudget.budget, 7_200_000);
  assert.equal(lifecycleResult.maintenance.byteBudget.evicted.length, 0);
  canonicalLifecycle = {
    targetItems: lifecycleResult.plan.budgets.memories,
    afterItems: canonicalRuntime.memoryOS.size(),
    byteBudget: lifecycleResult.maintenance.byteBudget.budget,
    byteEvictions: lifecycleResult.maintenance.byteBudget.evicted.length,
    indexIntegrity: canonicalRuntime.memoryOS.indexDiagnostics().pass,
    accountingExact: canonicalRuntime.memoryOS.memoryAccountingDiagnostics().exact,
  };
  assert.equal(canonicalLifecycle.indexIntegrity, true);
  assert.equal(canonicalLifecycle.accountingExact, true);

  // Serialize the entire MemorySubsystemRuntime snapshot through the same V8-backed
  // state store used by embedded runtimes, then restore the canonical memory subsystem.
  const persistedRuntimeSnapshot = canonicalRuntime.snapshot();
  const durableStore = new MemoryStateStore();
  await durableStore.save(persistedRuntimeSnapshot);
  const reloadedRuntimeSnapshot = await durableStore.load();
  assert.ok(reloadedRuntimeSnapshot, 'the 10k-profile runtime snapshot must survive a durable state-store round trip');
  assert.deepEqual(
    reloadedRuntimeSnapshot.memoryOS.items.map(item => item.id),
    persistedRuntimeSnapshot.memoryOS.items.map(item => item.id),
    'durable serialization must preserve the exact ordered canonical memory identity set',
  );
  assert.equal(
    reloadedRuntimeSnapshot.memoryOS.estimatedBytes,
    persistedRuntimeSnapshot.memoryOS.estimatedBytes,
    'durable serialization must preserve canonical byte accounting metadata',
  );

  // Also exercise the production file-backed JSON path: temp write, file fsync,
  // atomic rename, file read, and runtime restore from the decoded payload.
  const fileStoreDirectory = await mkdtemp(join(tmpdir(), 'nk1-workpass76-capacity-'));
  let fileReloadedRuntimeSnapshot;
  let fileStoreMetrics;
  try {
    const fileStore = new FileStateStore(join(fileStoreDirectory, 'organism-state.json'), {
      encoding: 'json',
      backupEverySaves: 1,
      directoryFsyncEverySaves: 1,
    });
    await fileStore.save(reloadedRuntimeSnapshot);
    fileReloadedRuntimeSnapshot = await fileStore.load();
    fileStoreMetrics = fileStore.metrics();
    assert.ok(fileReloadedRuntimeSnapshot,
      'the file-backed JSON state store must reload the explicit 10k runtime snapshot');
    assert.deepEqual(
      fileReloadedRuntimeSnapshot.memoryOS.items.map(item => item.id),
      persistedRuntimeSnapshot.memoryOS.items.map(item => item.id),
      'file-backed JSON persistence must preserve the exact ordered canonical ID set',
    );
    assert.equal(fileReloadedRuntimeSnapshot.memoryOS.estimatedBytes,
      persistedRuntimeSnapshot.memoryOS.estimatedBytes);
    assert.equal(fileStoreMetrics.saves, 1);
    assert.ok(fileStoreMetrics.bytesWritten > 0);
    assert.ok(fileStoreMetrics.fsyncs >= 1,
      'file-backed state persistence must fsync the new state payload');
  } finally {
    await rm(fileStoreDirectory, { recursive: true, force: true });
  }

  const restartedRuntime = new MemorySubsystemRuntime();
  restartedRuntime.restoreFromPersisted({
    memory: {
      autobiographicalMemories: fileReloadedRuntimeSnapshot.memories,
      semanticGraph: fileReloadedRuntimeSnapshot.semanticGraph,
    },
    advanced: {
      memoryOS: fileReloadedRuntimeSnapshot.memoryOS,
      memoryFabric: fileReloadedRuntimeSnapshot.fabric,
      unifiedMemory: fileReloadedRuntimeSnapshot.unifiedMemory,
      p47: fileReloadedRuntimeSnapshot.p47,
      p59MemoryOperatingSystem: fileReloadedRuntimeSnapshot.p59,
      p62MemoryFabric: fileReloadedRuntimeSnapshot.p62,
      p65EpistemicLedger: fileReloadedRuntimeSnapshot.p65,
      hexisSourceMonitor: fileReloadedRuntimeSnapshot.hexisSourceMonitor,
      p70MemoryLifecycleGovernor: fileReloadedRuntimeSnapshot.p70,
      p75MemoryContinuumOS: fileReloadedRuntimeSnapshot.p75,
      experienceContinuum: fileReloadedRuntimeSnapshot.experienceContinuum,
      hippocampal: fileReloadedRuntimeSnapshot.hippocampal,
      hippocampalFormation: fileReloadedRuntimeSnapshot.hippocampalFormation,
      consolidationController: fileReloadedRuntimeSnapshot.consolidationController,
      memoryLifecycleAuthority: fileReloadedRuntimeSnapshot.memoryLifecycleAuthority,
      memoryRetentionEconomy: fileReloadedRuntimeSnapshot.memoryRetentionEconomy,
      memoryCausalEconomy: fileReloadedRuntimeSnapshot.memoryCausalEconomy,
      causalLifeGraph: fileReloadedRuntimeSnapshot.causalLifeGraph,
      memoryWorldCausalBridge: fileReloadedRuntimeSnapshot.memoryWorldCausalBridge,
    },
  });
  assert.equal(restartedRuntime.memoryItemCap, SOURCE_ROWS);
  assert.equal(restartedRuntime.memoryByteBudget, 7_200_000);
  assert.equal(restartedRuntime.memoryOS.size(), canonicalLifecycle.targetItems,
    'the canonical memory count must survive MemorySubsystemRuntime persistence and restore');
  assert.deepEqual(
    restartedRuntime.memoryOS.snapshot().items.map(item => item.id),
    persistedRuntimeSnapshot.memoryOS.items.map(item => item.id),
    'restart must preserve the exact canonical IDs and their deterministic order');
  assert.equal(restartedRuntime.memoryOS.indexDiagnostics().pass, true,
    'restored 10k profile indexes must be rebuilt consistently');
  assert.equal(restartedRuntime.memoryOS.memoryAccountingDiagnostics().exact, true,
    'restored 10k profile byte accounting must remain exact');

  const postRestartMaintenance = restartedRuntime.fabric.maintain({
    tick: 78,
    pressure01: .1,
    maxItems: restartedRuntime.memoryItemCap,
    byteBudget: restartedRuntime.memoryByteBudget,
  });
  assert.equal(restartedRuntime.memoryOS.size(), canonicalLifecycle.targetItems,
    'the first post-restart maintenance tick must not fall back to the legacy 1,600-row cap');
  assert.equal(postRestartMaintenance.byteBudget.evicted.length, 0,
    'post-restart byte-budget enforcement must not evict the 10k profile fixture');
  canonicalDurableRoundTrip = {
    serializedBytes: durableStore.metrics().lastPayloadBytes,
    itemsAfterRestore: restartedRuntime.memoryOS.size(),
    byteBudget: restartedRuntime.memoryByteBudget,
    indexIntegrity: restartedRuntime.memoryOS.indexDiagnostics().pass,
    accountingExact: restartedRuntime.memoryOS.memoryAccountingDiagnostics().exact,
    postRestartByteEvictions: postRestartMaintenance.byteBudget.evicted.length,
    exactOrderedIdsPreserved: true,
  };
  canonicalFileBackedRoundTrip = {
    serializedBytes: fileStoreMetrics.lastPayloadBytes,
    saveMs: fileStoreMetrics.lastSaveMs,
    fsyncs: fileStoreMetrics.fsyncs,
    itemsAfterRestore: restartedRuntime.memoryOS.size(),
    indexIntegrity: restartedRuntime.memoryOS.indexDiagnostics().pass,
    accountingExact: restartedRuntime.memoryOS.memoryAccountingDiagnostics().exact,
  };
} finally {
  if (originalItemCapEnv === undefined) delete process.env.NEURO_MEMORY_ITEM_CAP;
  else process.env.NEURO_MEMORY_ITEM_CAP = originalItemCapEnv;
  if (originalByteBudgetEnv === undefined) delete process.env.NEURO_MEMORY_BYTE_BUDGET;
  else process.env.NEURO_MEMORY_BYTE_BUDGET = originalByteBudgetEnv;
}

const protectedRows = rows.slice(0, 130).map((row, index) => ({
  ...row,
  kind: index < 65 ? 'identity' : 'semantic',
  epistemicStatus: index < 65 ? 'fact' : 'quarantined',
}));
const protectedProfile = new MemoryOS2({ embeddingProvider: null, itemCap: 128 });
protectedProfile.restore({ ...emptySnapshot, items: protectedRows });
const protectedBefore = protectedProfile.snapshot().items.map(item => item.id).sort();
const protectedRestore = protectedProfile.restoreDiagnostics();
assert.equal(protectedProfile.snapshot().items.length, 130,
  'restore must never evict protected identity/quarantined rows to satisfy the ordinary count cap');
assert.equal(protectedRestore.capacityOverrunRows, 2);
assert.equal(protectedProfile.capacityDiagnostics().overCapacityRows, 2);
assert.equal(protectedProfile.capacityDiagnostics().protectedRows, 130);
const sourceItem = protectedProfile.snapshot().items[0];
assert.throws(() => protectedProfile.encode({
  ...sourceItem,
  id: 'capacity-protected-overrun-new-write',
  content: 'a new ordinary semantic row must not displace protected identity knowledge',
  kind: 'semantic',
  epistemicStatus: 'fact',
  revisionHistory: [],
}), /Memory capacity exhausted/,
'ordinary writes must fail closed when every existing row is protected');
assert.deepEqual(protectedProfile.snapshot().items.map(item => item.id).sort(), protectedBefore,
  'a failed over-capacity write must leave all protected memories unchanged');
assert.equal(protectedProfile.capacityDiagnostics().protectedRows, 130);

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
    directRetrieveSamples: directRetrievalTimes.length,
    warmupSamples: 12,
    isolatedPreviewMs: Number(extendedPreviewMs.toFixed(2)),
    indexIntegrity: extendedIndex.pass,
    capacity: extended.capacityDiagnostics(),
    maintenance: { before: maintenance.before, after: maintenance.after, removed: maintenance.removedIds.length },
    capacityClamp: { default: ITEM_CAP, minimum: 128, maximum: highClampProfile.capacityDiagnostics().hardCap },
    protectedOverflow: { retained: protectedBefore.length, overrunRows: protectedRestore.capacityOverrunRows, failedWritePreservedAll: true },
    canonicalFabric10k: { items: SOURCE_ROWS, byteBudget: canonicalMaintenance.byteBudget.budget, byteEvictions: canonicalMaintenance.byteBudget.evicted.length, indexIntegrity: canonicalIndex.pass, accountingExact: canonicalAccounting.exact },
    canonicalLifecycle10k: canonicalLifecycle,
    canonicalDurableRoundTrip10k: canonicalDurableRoundTrip,
    canonicalFileBackedRoundTrip10k: canonicalFileBackedRoundTrip,
  },
}));
