import assert from 'node:assert/strict';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';
import { PersistenceProjectionCoordinator } from '../src/organism/core/PersistenceProjectionCoordinator.ts';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const runtime = new MemorySubsystemRuntime();
runtime.memoryOS.restore({
  version: 7,
  byteBudget: 524288,
  items: [{
    id: 'canonical-memory-checkpoint-17',
    content: 'The canonical store must preserve provenance and temporal validity across checkpoint restore.',
    kind: 'episodic',
    createdAt: 1700,
    lastAccessAt: 1700,
    salience: 0.9,
    emotionalWeight: 0.2,
    identityRelevance: 0.7,
    goalRelevance: 0.6,
    socialRelevance: 0.1,
    predictionError: 0.25,
    temperature01: 0.2,
    confidence: 0.93,
    epistemicStatus: 'fact',
    source: 'user-session-17',
    entities: [],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
    contradictionLinks: [],
    revisionHistory: [],
    validFromAt: 1600,
    validUntilAt: null,
    observedAt: 1700,
    supersedesId: null,
    supersededById: null,
    revisionGroupId: 'canonical-memory-checkpoint-17',
    revisionSequence: 1,
    provenanceClass: 'user',
    sourceAuthority01: 0.7,
    independenceKey: 'session-17',
    evidenceFreshnessAt: 1700,
    evidenceSources: [{
      source: 'session:17',
      provenanceClass: 'user',
      sourceAuthority01: 0.7,
      independenceKey: 'session-17',
      observedAt: 1700,
      evidenceFreshnessAt: 1700,
      stance: 'supports',
    }],
    evidenceLineageKeys: ['session:17'],
    confidenceRevisionHistory: [],
    dormant: false,
    retrievalCount: 0,
    semanticVector: [],
    tags: ['checkpoint', 'provenance'],
    context: { session: '17' },
  }],
});

const snapshotProvider = value => ({ snapshot: () => structuredClone(value) });
const target = {
  state: { tick: 17, needs: { energy: 0.8, cognitiveLoad: 0.2 } },
  traces: [],
  facets: {
    memory: {},
    learning: {},
    cognition: {},
    embodiment: {},
    consciousness: {},
    evolution: {},
    advanced: {},
  },
  system: {},
};
const context = {
  persistenceBudgetController: {
    decide: () => ({
      traceLimit: 32,
      eventLimit: 64,
      compatibilityMemoryLimit: 16,
      p62HistoryLimit: 8,
    }),
  },
  memorySubsystem: runtime,
  worldSubsystem: { world: { persisted: () => ({ tick: 17 }) } },
  selfSubsystem: {},
  embodimentSubsystem: {},
  agencySubsystem: {},
  governanceSubsystem: {
    selfGovernance: snapshotProvider({ consequences: [] }),
  },
  advancedProjectionScheduler: {
    shouldMaterialize: group => group === 'memory',
    mark: () => {},
  },
  revisionGraph: {
    changed: group => group === 'memory',
    markMaterialized: () => {},
    currentSnapshot: () => ({}),
  },
  revisionTokens: { markMaterialized: () => {} },
};

new PersistenceProjectionCoordinator().sync(target, context, true, false);

const projected = target.facets.advanced.memoryOS;
assert.ok(projected, 'canonical MemoryOS2 state must be part of the durable memory projection');
assert.equal(projected.items[0].id, 'canonical-memory-checkpoint-17');
assert.equal(projected.items[0].validFromAt, 1600);
assert.equal(projected.items[0].evidenceSources[0].source, 'session:17');

const restored = new MemorySubsystemRuntime();
restored.restoreFromPersisted({
  memory: target.facets.memory,
  advanced: target.facets.advanced,
});
const restoredItems = restored.memoryOS.snapshot().items;
assert.equal(
  restoredItems.length,
  1,
  'canonical checkpoints must not re-import lossy compatibility rows as duplicate memories',
);
const item = restoredItems.find(row => row.id === 'canonical-memory-checkpoint-17');
assert.ok(item, 'canonical memory record must survive checkpoint restore');
assert.equal(item.content, 'The canonical store must preserve provenance and temporal validity across checkpoint restore.');
assert.equal(item.validFromAt, 1600);
assert.equal(item.evidenceSources[0].source, 'session:17');
assert.equal(item.source, 'user-session-17');
assert.equal(item.provenanceClass, 'user');
assert.equal(item.epistemicStatus, 'fact');

// Hot-ID restore is a bounded read-model projection of canonical memory, not a
// second authority. Missing and duplicate IDs must not survive a checkpoint.
const fabricSnapshotWithStaleHotIds = restored.fabric.snapshot();
restored.fabric.restore({
  ...fabricSnapshotWithStaleHotIds,
  hotIds: [item.id, 'evicted-memory-that-no-longer-exists', item.id],
});
assert.deepEqual(
  restored.fabric.hotIdsSnapshot(),
  [item.id],
  'restored hot IDs must be canonical, unique, and bounded',
);

// Legacy checkpoints without MemoryOS2 still need compatibility migration.
const legacy = new MemorySubsystemRuntime();
legacy.restoreFromPersisted({
  memory: {
    autobiographicalMemories: [{
      id: 'legacy-episode-01',
      kind: 'episode',
      summary: 'A preserved observation from an older checkpoint.',
      salience: 0.75,
      evidence: ['legacy-journal'],
      createdAt: 1500,
      timescale: 'episodic',
      retrievalCount: 2,
      lastRetrievedAt: 1550,
      confidence: 0.8,
      sourceEventIds: [],
      associationIds: [],
    }],
  },
  advanced: {
    memoryLifecycleAuthority: {
      version: 1,
      cycles: 5,
      maintenanceRuns: 1,
      consolidationRuns: 0,
      lastTick: 44,
      lastConsolidation: [],
      meanPressure01: 0.3,
      meanMemoryLoad01: 0.4,
    },
  },
});
const migrated = legacy.memoryOS.snapshot().items.find(row => row.context?.originalId === 'legacy-episode-01');
assert.ok(migrated, 'legacy compatibility rows must still migrate when no canonical snapshot exists');
assert.equal(migrated.provenanceClass, 'derived');
assert.equal(migrated.source, 'multi-timescale-compatibility');
assert.ok(
  legacy.events.recent(64).some(event => event.type === 'memory-created' && event.tick === 44),
  'legacy migration events must use the restored lifecycle tick, not the fresh runtime default',
);


// Restore is a persistence ingress, so stale byte counters must not bypass the live
// budget. Older/edited snapshots can hold more data than their saved estimate admits.
const oversizedSource = new MemoryOS2({ signalFusionProfile: 'balanced' });
for (let index = 0; index < 3; index++) {
  oversizedSource.encode({
    content: `restore budget record ${index}: ${String.fromCharCode(97 + index).repeat(6000)}`,
    kind: 'episodic',
    source: `restore-budget-${index}`,
    tags: ['restore-budget'],
    salience: 0.12,
    emotionalWeight: 0.05,
    identityRelevance: 0.04,
    goalRelevance: 0.08,
    socialRelevance: 0.02,
    predictionError: 0.01,
    confidence: 0.25,
    epistemicStatus: 'fact',
    entities: [],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
    contradictionLinks: [],
  }, { clone: false });
}
const oversizedSnapshot = oversizedSource.snapshot();
assert.ok(oversizedSnapshot.estimatedBytes > 16384, 'fixture must exceed the minimum supported memory budget');
oversizedSnapshot.byteBudget = 16384;
oversizedSnapshot.estimatedBytes = 1; // Simulate a stale pre-provenance accounting value.
const boundedRestore = new MemoryOS2({ signalFusionProfile: 'balanced' });
boundedRestore.restore(oversizedSnapshot);
const restoredBudget = boundedRestore.budgetDiagnostics();
assert.ok(restoredBudget.budgetEvictions >= 1, 'restore must evict eligible low-value records above budget');
assert.ok(
  restoredBudget.estimatedBytes <= restoredBudget.byteBudget,
  'restored canonical memory must respect its effective byte budget',
);
assert.equal(boundedRestore.indexDiagnostics().pass, true, 'budget eviction after restore must keep memory indexes consistent');


// Reusing a runtime for checkpoint recovery must not preserve mutation receipts from
// the previous organism state when the optional MemoryFabric facet is absent.
const reusedRuntime = new MemorySubsystemRuntime();
const retryableInput = {
  content: 'A command receipt from the previous organism state must not suppress a fresh write.',
  kind: 'episodic',
  source: 'runtime-reuse-restore-regression',
  tags: ['restore', 'idempotency'],
  salience: 0.7,
  emotionalWeight: 0.1,
  identityRelevance: 0.3,
  goalRelevance: 0.5,
  socialRelevance: 0.1,
  predictionError: 0.2,
  confidence: 0.8,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
};
const firstWrite = reusedRuntime.fabric.encode(retryableInput, {
  tick: 9,
  commandId: 'runtime-reuse-restore-regression',
  emitEvent: false,
});
assert.ok(firstWrite.id);
assert.equal(reusedRuntime.memoryOS.size(), 1);
assert.equal(reusedRuntime.fabric.snapshot().stats.encodes, 1);
reusedRuntime.restoreFromPersisted({ advanced: {} });
assert.equal(reusedRuntime.memoryOS.size(), 0, 'missing canonical memory must restore as an empty store');
assert.equal(reusedRuntime.fabric.snapshot().stats.encodes, 0, 'missing fabric facet must reset old runtime counters');
const retriedWrite = reusedRuntime.fabric.encode(retryableInput, {
  tick: 9,
  commandId: 'runtime-reuse-restore-regression',
  emitEvent: false,
});
assert.ok(retriedWrite.id, 'the old command receipt must not suppress writes into the restored organism');
assert.equal(reusedRuntime.memoryOS.size(), 1, 'a fresh state must accept the same external command ID');
assert.equal(reusedRuntime.fabric.snapshot().stats.encodes, 1);


// Ordinary writes must obey the same byte budget as restored checkpoints.
const writeBudgetMemory = new MemoryOS2({ signalFusionProfile: 'balanced' });
writeBudgetMemory.state.byteBudget = 16384;
for (let index = 0; index < 4; index++) {
  writeBudgetMemory.encode({
    content: `live write budget record ${index}: ${String.fromCharCode(100 + index).repeat(7000)}`,
    kind: 'episodic',
    source: `live-write-budget-${index}`,
    tags: ['live-write-budget'],
    salience: 0.1,
    emotionalWeight: 0.02,
    identityRelevance: 0.03,
    goalRelevance: 0.05,
    socialRelevance: 0.01,
    predictionError: 0.01,
    confidence: 0.2,
    epistemicStatus: 'fact',
    entities: [],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
    contradictionLinks: [],
  });
}
const liveWriteBudget = writeBudgetMemory.budgetDiagnostics();
assert.ok(liveWriteBudget.budgetEvictions >= 1, 'normal encode must evict records when the byte budget is exceeded');
assert.ok(liveWriteBudget.estimatedBytes <= liveWriteBudget.byteBudget, 'normal writes must keep canonical memory within its byte budget');
assert.equal(writeBudgetMemory.indexDiagnostics().pass, true, 'encode-time budget enforcement must preserve indexes');

console.log('MEMORY_CANONICAL_STORE_CHECKPOINT=PASS');
