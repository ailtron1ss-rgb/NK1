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

console.log('MEMORY_CANONICAL_STORE_CHECKPOINT=PASS');
