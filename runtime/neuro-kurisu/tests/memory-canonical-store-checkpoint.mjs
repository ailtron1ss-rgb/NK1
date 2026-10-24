import assert from 'node:assert/strict';
import { MemorySubsystemRuntime } from '../src/organism/core/MemorySubsystemRuntime.ts';
import { PersistenceProjectionCoordinator } from '../src/organism/core/PersistenceProjectionCoordinator.ts';

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
const item = restored.memoryOS.snapshot().items.find(row => row.id === 'canonical-memory-checkpoint-17');
assert.ok(item, 'canonical memory record must survive checkpoint restore');
assert.equal(item.content, 'The canonical store must preserve provenance and temporal validity across checkpoint restore.');
assert.equal(item.validFromAt, 1600);
assert.equal(item.evidenceSources[0].source, 'session:17');
assert.equal(item.epistemicStatus, 'fact');

console.log('MEMORY_CANONICAL_STORE_CHECKPOINT=PASS');
