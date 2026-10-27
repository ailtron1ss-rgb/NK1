import assert from 'node:assert/strict';
import { HexisAdaptationFabric, defaultHexisAdaptationState } from '../../src/organism/integration/hexis/HexisAdaptationFabric.ts';
import { refreshHmxStageLifecycleDigest } from '../../src/organism/integration/hexis/HexisStageIntegrity.mjs';
import { MemoryOS2 } from '../../src/organism/developmental/MemoryOS2.ts';
import { canonicalizeMemoryContent, stableMemoryId } from '../../src/organism/developmental/MemoInspiredMemoryPrimitives.ts';
import { AdaptiveMemoryPolicy } from '../../src/organism/developmental/AdaptiveMemoryPolicy.ts';

const fabric = new HexisAdaptationFabric();
assert.equal(fabric.snapshot().version, 1);

 
// Persisted adaptive policy snapshots are untrusted input: normalize numeric
// bounds, reject malformed policy/context identifiers, and cap contextual history.
const adaptiveRestoreGuard = new AdaptiveMemoryPolicy();
const adaptiveContextRows = Object.fromEntries(Array.from({ length: 520 }, (_, index) => [
  'context_' + index,
  { semantic: index / 520, causal: 4 },
]));
adaptiveContextRows['invalid key'] = { causal: 1 };
const adaptiveUnsafeContextRows = JSON.parse('{"__proto__":{"causal":1},"constructor":{"causal":1}}');
adaptiveRestoreGuard.restore({
  version: 99,
  weights: { semantic: 2, hybrid: 'invalid', causal: -1, temporal: Number.NaN, balanced: Number.POSITIVE_INFINITY },
  trials: { semantic: -1, hybrid: 10001, causal: 3.9, temporal: Number.NaN, balanced: 500 },
  reward: { semantic: 2, hybrid: -1, causal: Number.NaN, temporal: 0.25, balanced: Number.POSITIVE_INFINITY },
  contextValue: { ...adaptiveContextRows, ...adaptiveUnsafeContextRows, 'context_519': { causal: 4, semantic: Number.NaN } },
  contextTrials: { ...adaptiveContextRows, ...adaptiveUnsafeContextRows, 'context_519': { causal: 50000 } },
  cooldownUntil: Number.POSITIVE_INFINITY,
  lastPolicy: 'not-a-memory-policy',
  lastContextKey: 'invalid key',
});
const adaptiveRestored = adaptiveRestoreGuard.snapshot();
const adaptiveDiagnostics = adaptiveRestoreGuard.diagnostics();
assert.equal(adaptiveRestored.version, 2, 'policy snapshot versions must be normalized');
assert.equal(adaptiveDiagnostics.lastPolicy, 'balanced', 'unknown policy names must fail closed to balanced');
assert.equal(adaptiveDiagnostics.lastContextKey, 'default', 'unsafe context names must not become active context state');
assert.equal(adaptiveDiagnostics.cooldownUntil, 0, 'non-finite cooldowns must reset to the safe default');
assert.deepEqual(adaptiveRestored.weights, {
  semantic: 1, hybrid: 0.5, causal: 0, temporal: 0.5, balanced: 0.5,
}, 'weights must stay finite and inside the unit interval');
assert.deepEqual(adaptiveRestored.trials, {
  semantic: 0, hybrid: 10000, causal: 3, temporal: 0, balanced: 500,
}, 'trial counts must be finite, integral, non-negative and bounded');
assert.deepEqual(adaptiveRestored.reward, {
  semantic: 1, hybrid: 0, causal: 0, temporal: 0.25, balanced: 0,
}, 'reward estimates must stay finite and inside the unit interval');
assert.equal(adaptiveDiagnostics.contextCount, 512, 'restored context history must have a hard 512-key bound');
assert.equal(adaptiveRestored.contextValue.context_519.causal, 1, 'context scores must be clamped');
assert.equal(adaptiveRestored.contextTrials.context_519.causal, 10000, 'context trial counts must be bounded');
assert.equal(Object.hasOwn(adaptiveRestored.contextValue, '__proto__'), false, 'prototype-like context keys must be rejected');
assert.equal(Object.hasOwn(adaptiveRestored.contextValue, 'constructor'), false, 'constructor context keys must be rejected');
const validCooldownTimestamp = 1700000000123;
adaptiveRestoreGuard.restore({ ...adaptiveRestored, cooldownUntil: validCooldownTimestamp });
assert.equal(adaptiveRestoreGuard.snapshot().cooldownUntil, validCooldownTimestamp,
  'valid epoch-millisecond cooldown timestamps must not be mistaken for small counters');
assert(['semantic', 'hybrid', 'causal', 'temporal', 'balanced'].includes(adaptiveRestoreGuard.choose({}, 100)),
  'the normalized policy must continue selecting a valid strategy');

const runtimeContextGuard = new AdaptiveMemoryPolicy();
for (let index = 0; index < 520; index++) {
  runtimeContextGuard.observe('semantic', 0.5, index, 'runtime-context-' + index);
}
const runtimeContextSnapshot = runtimeContextGuard.snapshot();
assert.equal(runtimeContextGuard.diagnostics().contextCount, 512,
  'ordinary runtime observations must enforce the same hard context bound as restore');
assert.equal(Object.hasOwn(runtimeContextSnapshot.contextValue, 'runtime-context-0'), false,
  'the oldest runtime context must be evicted when capacity is reached');
assert.equal(Object.hasOwn(runtimeContextSnapshot.contextValue, 'runtime-context-519'), true,
  'the newest runtime context must remain after bounded eviction');
runtimeContextGuard.observe('causal', 0.7, 900, '__proto__');
const runtimeContextAfterUnsafeKey = runtimeContextGuard.snapshot();
assert.equal(Object.hasOwn(runtimeContextAfterUnsafeKey.contextValue, '__proto__'), false,
  'runtime observations must not accept prototype-like context keys');
assert.equal(Object.hasOwn(runtimeContextAfterUnsafeKey.contextValue, 'default'), true,
  'unsafe runtime context keys must be routed to the safe default context');
assert.equal(runtimeContextGuard.diagnostics().contextCount, 512,
  'invalid runtime context observations must not exceed the bounded context table');

const runtimeInputGuard = new AdaptiveMemoryPolicy();
runtimeInputGuard.observe('rogue-policy', 1, Number.POSITIVE_INFINITY, '__proto__');
const runtimeInputSnapshot = runtimeInputGuard.snapshot();
assert.deepEqual(runtimeInputSnapshot.trials, {
  semantic: 0, hybrid: 0, causal: 0, temporal: 0, balanced: 1,
}, 'unknown runtime policy names must fail closed to the valid active policy');
assert.equal(Number.isFinite(runtimeInputSnapshot.cooldownUntil), true,
  'non-finite runtime timestamps must not poison the adaptive cooldown');
assert.equal(runtimeInputSnapshot.contextValue.default.balanced, 1,
  'unsafe runtime context IDs must route updates into the safe default context');
assert.equal(Object.hasOwn(runtimeInputSnapshot.contextValue, '__proto__'), false,
  'runtime policy observations must never create prototype-like context rows');


// A full MemoryOS2 restore must be exception-atomic across canonical rows and
// every derived inverted/dedup/revision index, not merely across the state object.
const restoreAtomicMemory = new MemoryOS2({ embeddingProvider: null });
const restoreAtomicSeedInput = {
  content: 'transactional restore index sentinel alpha beta gamma',
  kind: 'semantic',
  source: 'test:memoryos-restore-atomicity',
  salience: 0.91,
  emotionalWeight: 0.18,
  identityRelevance: 0.12,
  goalRelevance: 0.2,
  socialRelevance: 0.1,
  predictionError: 0.05,
  confidence: 0.94,
  epistemicStatus: 'fact',
  entities: ['transactional', 'restore', 'sentinel'],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  provenanceClass: 'user',
  sourceAuthority01: 0.9,
  evidenceSources: [],
  evidenceLineageKeys: [],
};
const restoreAtomicSeed = restoreAtomicMemory.encode(restoreAtomicSeedInput);
const restoreAtomicBaseline = restoreAtomicMemory.snapshot();
// Seed derived caches independently of the canonical snapshot. A successful
// restore without a provider must evict them; failed restoration must restore them.
restoreAtomicMemory.semanticEmbeddingIndex.set('stale-cache-first', {
  contentHash: 'stale-content-hash', providerId: 'offline-provider', vector: [0.25, 0.75], lastUsedAt: 1,
});
restoreAtomicMemory.semanticEmbeddingIndex.set('stale-cache-after', {
  contentHash: 'stale-content-hash', providerId: 'offline-provider', vector: [0.8, 0.2], lastUsedAt: 2,
});
restoreAtomicMemory.semanticEmbeddingRetry.set('stale-retry-first', {
  contentHash: 'stale-content-hash', attempts: 2, retryAt: 20,
});
restoreAtomicMemory.semanticEmbeddingRetry.set('stale-retry-throws', {
  contentHash: 'stale-content-hash', attempts: 3, retryAt: 30,
});
const embeddingCacheBaseline = [...restoreAtomicMemory.semanticEmbeddingIndex].map(([id, row]) => [id, structuredClone(row)]);
const embeddingRetryBaseline = [...restoreAtomicMemory.semanticEmbeddingRetry].map(([id, row]) => [id, structuredClone(row)]);
const replacementRestoreState = structuredClone(restoreAtomicBaseline);
replacementRestoreState.adaptiveMemoryPolicy = {
  version: 2,
  weights: { semantic: 0.5, hybrid: 0.5, causal: 0.5, temporal: 0.5, balanced: 0.5 },
  trials: { semantic: 0, hybrid: 0, causal: 0, temporal: 0, balanced: 0 },
  reward: { semantic: 0, hybrid: 0, causal: 0, temporal: 0, balanced: 0 },
  contextValue: {},
  contextTrials: {},
  cooldownUntil: 0,
  lastPolicy: 'causal',
  lastContextKey: 'restore-atomic-test',
};
replacementRestoreState.items = [{
  ...structuredClone(restoreAtomicSeed),
  id: 'replacement-restore-memory',
  content: 'replacement projection omega delta epsilon',
  contentHash: '',
  source: 'test:memoryos-restore-replacement',
  entities: ['replacement', 'projection'],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  revisionGroupId: 'replacement-restore-memory',
}];
// Simulate a process whose last selected strategy differs from the incoming snapshot.
restoreAtomicMemory.activePolicy = 'temporal';
const originalRestoreIndexItem = restoreAtomicMemory.indexItem.bind(restoreAtomicMemory);
let throwAfterRestoreIndexWrite = true;
restoreAtomicMemory.indexItem = item => {
  const result = originalRestoreIndexItem(item);
  if (throwAfterRestoreIndexWrite) {
    throwAfterRestoreIndexWrite = false;
    throw new Error('injected-memoryos-restore-index-after-write');
  }
  return result;
};
assert.throws(
  () => restoreAtomicMemory.restore(replacementRestoreState),
  /injected-memoryos-restore-index-after-write$/,
  'a derived-index exception after a partial write must fail the full restore',
);
restoreAtomicMemory.indexItem = originalRestoreIndexItem;
assert.deepEqual(
  restoreAtomicMemory.snapshot(),
  restoreAtomicBaseline,
  'failed full restore must restore exact canonical state and adaptive-policy snapshot',
);
restoreAtomicMemory.observeRetrievalOutcome(1);
const policyAfterFailedRestore = restoreAtomicMemory.adaptivePolicyDiagnostics();
assert.equal(policyAfterFailedRestore.trials.temporal, 1,
  'a failed restore must preserve the pre-restore active strategy for outcome attribution');
assert.equal(policyAfterFailedRestore.trials.causal, 0,
  'a failed restore must not retain the incoming snapshot strategy');
const restoredExactDuplicate = restoreAtomicMemory.encode(restoreAtomicSeedInput);
assert.equal(restoredExactDuplicate.id, restoreAtomicSeed.id,
  'failed restore must preserve the canonical exact/content dedup indexes');
const rollbackRestoreRecall = restoreAtomicMemory.retrieve('transactional restore index sentinel', 5);
assert(
  rollbackRestoreRecall.some(item => item.id === restoreAtomicSeed.id),
  'failed restore must restore the prior token, document-frequency, and item indexes',
);
assert.equal(
  rollbackRestoreRecall.some(item => item.id === 'replacement-restore-memory'),
  false,
  'no replacement memory may leak through a partially rebuilt index',
);
assert.deepEqual(
  [...restoreAtomicMemory.semanticEmbeddingIndex].map(([id, row]) => [id, structuredClone(row)]),
  embeddingCacheBaseline,
  'index-build failure must preserve the pre-restore semantic embedding cache',
);
assert.deepEqual(
  [...restoreAtomicMemory.semanticEmbeddingRetry].map(([id, row]) => [id, structuredClone(row)]),
  embeddingRetryBaseline,
  'index-build failure must preserve the pre-restore embedding retry schedule',
);

// Fail after cache cleanup has already deleted records. The cache maps must be
// restored together if reconciliation fails partway through.
const originalRetryCacheDelete = restoreAtomicMemory.semanticEmbeddingRetry.delete.bind(restoreAtomicMemory.semanticEmbeddingRetry);
restoreAtomicMemory.semanticEmbeddingRetry.delete = key => {
  const deleted = originalRetryCacheDelete(key);
  if (key === 'stale-retry-throws') throw new Error('injected-memoryos-restore-cache-prune-after-write');
  return deleted;
};
assert.throws(
  () => restoreAtomicMemory.restore(replacementRestoreState),
  /injected-memoryos-restore-cache-prune-after-write$/,
  'cache cleanup failure must roll back already-pruned semantic vectors and retries',
);
delete restoreAtomicMemory.semanticEmbeddingRetry.delete;
assert.deepEqual(
  [...restoreAtomicMemory.snapshot().items.map(item => item.id)],
  [...restoreAtomicBaseline.items.map(item => item.id)],
  'cache-pruning failure must preserve canonical memories',
);
assert.deepEqual(
  [...restoreAtomicMemory.semanticEmbeddingIndex].map(([id, row]) => [id, structuredClone(row)]),
  embeddingCacheBaseline,
  'cache-pruning failure must restore vectors deleted before the exception',
);
assert.deepEqual(
  [...restoreAtomicMemory.semanticEmbeddingRetry].map(([id, row]) => [id, structuredClone(row)]),
  embeddingRetryBaseline,
  'cache-pruning failure must restore retry rows deleted before the exception',
);
restoreAtomicMemory.restore(replacementRestoreState);
assert.equal(restoreAtomicMemory.semanticEmbeddingIndex.size, 0,
  'successful provider-less restore must discard stale embedding vectors');
assert.equal(restoreAtomicMemory.semanticEmbeddingRetry.size, 0,
  'successful provider-less restore must discard stale embedding retries');
restoreAtomicMemory.observeRetrievalOutcome(1);
const policyAfterSuccessfulRestore = restoreAtomicMemory.adaptivePolicyDiagnostics();
assert.equal(policyAfterSuccessfulRestore.trials.causal, 1,
  'a successful restore must activate the policy stored in the restored snapshot');
assert.equal(policyAfterSuccessfulRestore.trials.temporal, 0,
  'a successful restore must not attribute outcomes to the pre-restore active strategy');
assert.deepEqual(
  restoreAtomicMemory.snapshot().items.map(item => item.id),
  ['replacement-restore-memory'],
  'a valid retry must atomically replace canonical rows after the injected failure is removed',
);
const successfulRestoreRecall = restoreAtomicMemory.retrieve('replacement projection omega delta epsilon', 5);
assert(
  successfulRestoreRecall.some(item => item.id === 'replacement-restore-memory'),
  'successful full restore must rebuild retrieval indexes for the replacement row',
);

// Cache reconciliation is content/provider-bound rather than an unconditional purge:
// a vector for the exact restored content/provider remains reusable, while an expired
// retry row for the same ID but a different content hash is discarded.
const matchingEmbeddingCacheRuntime = new MemoryOS2({
  embeddingProvider: { providerId: 'restore-cache-test-provider' },
});
const matchingEmbeddingCacheItem = matchingEmbeddingCacheRuntime.encode({
  ...restoreAtomicSeedInput,
  content: 'matching semantic embedding cache remains reusable',
  source: 'test:memoryos-valid-embedding-cache',
});
const matchingEmbeddingCacheRow = {
  contentHash: matchingEmbeddingCacheItem.contentHash,
  providerId: 'restore-cache-test-provider',
  vector: [0.6, 0.8],
  lastUsedAt: 123,
};
matchingEmbeddingCacheRuntime.semanticEmbeddingIndex.set(matchingEmbeddingCacheItem.id, structuredClone(matchingEmbeddingCacheRow));
matchingEmbeddingCacheRuntime.semanticEmbeddingRetry.set(matchingEmbeddingCacheItem.id, {
  contentHash: 'obsolete-content-hash',
  attempts: 4,
  retryAt: 456,
});
matchingEmbeddingCacheRuntime.restore(matchingEmbeddingCacheRuntime.snapshot());
assert.deepEqual(
  matchingEmbeddingCacheRuntime.semanticEmbeddingIndex.get(matchingEmbeddingCacheItem.id),
  matchingEmbeddingCacheRow,
  'restore must retain a provider-matched embedding for unchanged canonical content',
);
assert.equal(
  matchingEmbeddingCacheRuntime.semanticEmbeddingRetry.has(matchingEmbeddingCacheItem.id),
  false,
  'restore must drop a retry entry tied to an obsolete content hash',
);


// reviseContent is a multi-record transaction: creating the replacement row,
// closing the old validity window and appending revision history must roll back as
// one unit when bookkeeping throws after its canonical write.
const contentRevisionAtomicMemory = new MemoryOS2({ embeddingProvider: null });
const contentRevisionSeed = contentRevisionAtomicMemory.encode({
  ...restoreAtomicSeedInput,
  content: 'revision atomicity original memory record',
  source: 'test:memoryos-content-revision-atomicity',
});
const contentRevisionParentRef = contentRevisionAtomicMemory.itemIndex.get(contentRevisionSeed.id);
assert(contentRevisionParentRef);
const contentRevisionBaseline = contentRevisionAtomicMemory.snapshot();
const originalContentRevisionRecord = contentRevisionAtomicMemory.recordRevision.bind(contentRevisionAtomicMemory);
let throwAfterContentRevisionWrite = true;
contentRevisionAtomicMemory.recordRevision = (...args) => {
  const result = originalContentRevisionRecord(...args);
  if (throwAfterContentRevisionWrite && args[1]?.reason === 'injected-revision-content-failure') {
    throwAfterContentRevisionWrite = false;
    throw new Error('injected-memoryos-content-revision-after-write');
  }
  return result;
};
assert.throws(
  () => contentRevisionAtomicMemory.reviseContent(contentRevisionSeed.id, 'revision atomicity corrected content', {
    reason: 'injected-revision-content-failure',
    validAt: contentRevisionSeed.createdAt + 100,
  }),
  /injected-memoryos-content-revision-after-write$/,
  'a post-write revision-history exception must abort the complete content revision',
);
assert.deepEqual(
  contentRevisionAtomicMemory.snapshot(),
  contentRevisionBaseline,
  'failed content revision must restore every canonical item and counter',
);
assert.strictEqual(
  contentRevisionAtomicMemory.itemIndex.get(contentRevisionSeed.id),
  contentRevisionParentRef,
  'failed content revision must preserve the original canonical item object',
);
assert.strictEqual(
  contentRevisionAtomicMemory.state.items[0],
  contentRevisionParentRef,
  'failed content revision must restore the original store array/order and item identity',
);
assert.equal(contentRevisionAtomicMemory.temporalChain(contentRevisionSeed.id).length, 1,
  'a failed content revision must not leave a phantom temporal-chain member');
assert(
  contentRevisionAtomicMemory.retrieve('revision atomicity original memory record', 5)
    .some(item => item.id === contentRevisionSeed.id),
  'a failed content revision must preserve the original retrieval indexes');

const contentRevisionAfterRetry = contentRevisionAtomicMemory.reviseContent(
  contentRevisionSeed.id,
  'revision atomicity corrected content',
  { reason: 'content-revision-after-retry', validAt: contentRevisionSeed.createdAt + 100 },
);
assert(contentRevisionAfterRetry);
assert.equal(contentRevisionAtomicMemory.snapshot().items.length, 2,
  'a successful retry must create exactly one replacement row');
assert.equal(contentRevisionAtomicMemory.temporalChain(contentRevisionSeed.id).length, 2,
  'a successful retry must update the canonical revision chain once');
assert.equal(contentRevisionParentRef.validUntilAt, contentRevisionAfterRetry.validFromAt);
assert.equal(contentRevisionParentRef.supersededById, contentRevisionAfterRetry.id);
assert.equal(contentRevisionAfterRetry.supersedesId, contentRevisionSeed.id);
const contentRevisionReplay = contentRevisionAtomicMemory.reviseContent(
  contentRevisionSeed.id,
  'revision atomicity corrected content',
  { reason: 'content-revision-replay', validAt: contentRevisionSeed.createdAt + 200 },
);
assert.equal(contentRevisionReplay?.id, contentRevisionAfterRetry.id,
  'replaying the same correction must return the established revision');
assert.equal(contentRevisionAtomicMemory.snapshot().items.length, 2,
  'replaying a content correction must not append duplicate revision rows');


// A corrupted/stale snapshot can already contain the deterministic revision ID
// claimed by another lineage. Fail closed before encode(forceDistinct) can re-use
// that row and silently splice it into the new revision chain.
const revisionCollisionMemory = new MemoryOS2({ embeddingProvider: null });
const revisionCollisionSeed = revisionCollisionMemory.encode({
  ...restoreAtomicSeedInput,
  content: 'revision ID collision source memory',
  source: 'test:memoryos-revision-id-collision',
});
const collisionTargetContent = canonicalizeMemoryContent('revision ID collision target text');
const collisionGroup = revisionCollisionSeed.revisionGroupId ?? revisionCollisionSeed.id;
const collisionRevisionId = stableMemoryId(
  `${collisionTargetContent}\\0revision:${collisionGroup}\\0${2}\\0${revisionCollisionSeed.id}`,
  revisionCollisionSeed.kind,
  revisionCollisionSeed.source,
);
const revisionCollisionClaimant = revisionCollisionMemory.encode({
  ...restoreAtomicSeedInput,
  id: collisionRevisionId,
  content: 'unrelated row occupying a revision identifier',
  source: 'test:memoryos-revision-id-collision-claimant',
  revisionGroupId: 'unrelated-revision-lineage',
});
const revisionCollisionBaseline = revisionCollisionMemory.snapshot();
const collisionParentRef = revisionCollisionMemory.itemIndex.get(revisionCollisionSeed.id);
const collisionClaimantRef = revisionCollisionMemory.itemIndex.get(revisionCollisionClaimant.id);
assert.throws(
  () => revisionCollisionMemory.reviseContent(
    revisionCollisionSeed.id,
    collisionTargetContent,
    { validAt: revisionCollisionSeed.createdAt + 100 },
  ),
  /memory-revision-id-collision$/,
  'revision creation must reject a deterministic ID already owned by another row/lineage',
);
assert.deepEqual(
  revisionCollisionMemory.snapshot(),
  revisionCollisionBaseline,
  'revision-ID collision rejection must leave canonical state unchanged',
);
assert.strictEqual(revisionCollisionMemory.itemIndex.get(revisionCollisionSeed.id), collisionParentRef);
assert.strictEqual(revisionCollisionMemory.itemIndex.get(collisionRevisionId), collisionClaimantRef);
assert.equal(revisionCollisionMemory.temporalChain(revisionCollisionSeed.id).length, 1,
  'a conflicting row must not be linked into the source revision chain');

const persistedPolicyGuard = new MemoryOS2({ embeddingProvider: null });
const corruptedPersistedPolicyState = persistedPolicyGuard.snapshot();
corruptedPersistedPolicyState.adaptiveMemoryPolicy = {
  version: 99,
  weights: { semantic: 3, hybrid: Number.NaN, causal: -2, temporal: 0.5, balanced: 0.5 },
  trials: { semantic: -1, hybrid: 30000, causal: 0, temporal: 0, balanced: 0 },
  reward: { semantic: 2, hybrid: Number.POSITIVE_INFINITY, causal: 0, temporal: 0, balanced: 0 },
  contextValue: { 'invalid key': { semantic: 1 }, '__proto__': { causal: 1 } },
  contextTrials: { 'invalid key': { semantic: 1 }, '__proto__': { causal: 1 } },
  cooldownUntil: Number.POSITIVE_INFINITY,
  lastPolicy: 'unknown-policy',
  lastContextKey: 'invalid key',
};
persistedPolicyGuard.restore(corruptedPersistedPolicyState);
const canonicalPersistedPolicy = persistedPolicyGuard.snapshot().adaptiveMemoryPolicy;
assert(canonicalPersistedPolicy);
assert.equal(canonicalPersistedPolicy.lastPolicy, 'balanced',
  'MemoryOS2 snapshots must persist the normalized policy rather than raw untrusted fields');
assert.equal(canonicalPersistedPolicy.lastContextKey, 'default');
assert.equal(canonicalPersistedPolicy.cooldownUntil, 0);
assert.equal(canonicalPersistedPolicy.weights.semantic, 1);
assert.equal(canonicalPersistedPolicy.weights.hybrid, 0.5);
assert.equal(canonicalPersistedPolicy.trials.hybrid, 10000);
assert.equal(Object.keys(canonicalPersistedPolicy.contextValue).length, 0,
  'rejected context keys must not remain in the canonical persisted memory state');
assert.equal(persistedPolicyGuard.activePolicy, 'balanced',
  'MemoryOS2 active selector and its persisted policy must agree after normalization');

// An HMX rollback can restore its own ledger writes, but must never erase a
// foreign write made after the transaction's checkpoint.
const ownedCheckpointFabric = new HexisAdaptationFabric();
const ownedCheckpointBaseline = ownedCheckpointFabric.snapshot();
const ownedCheckpoint = ownedCheckpointFabric.mutationCheckpoint();
const ownedMutationToken = 'test:owned-hmx-transaction';
ownedCheckpointFabric.registerOrUpdateBelief({
  memoryId: 'owned-write',
  confidence01: 0.8,
  trust01: 0.7,
  at: 1000,
}, ownedMutationToken);
assert.equal(
  ownedCheckpointFabric.restoreIfUnchanged(ownedCheckpointBaseline, ownedCheckpoint, ownedMutationToken),
  true,
  'rollback must restore a transaction that contains only writes owned by its token',
);
assert.equal(ownedCheckpointFabric.snapshot().beliefs.length, 0,
  'owned ledger mutations should be removed by a successful guarded rollback');

// If restoring a removed belief would exceed the bounded mirror capacity, rollback
// must report a conflict rather than evicting a newer unrelated belief.
const beliefCapacityFabric = new HexisAdaptationFabric();
for (let index = 0; index < 1024; index++) {
  beliefCapacityFabric.registerOrUpdateBelief({
    memoryId: 'capacity-belief-' + index,
    confidence01: 0.5,
    trust01: 0.5,
    at: index + 1,
  });
}
const beliefCapacityCheckpoint = beliefCapacityFabric.mutationCheckpoint();
const beliefCapacityOwner = 'test:capacity-safe-belief-undo';
assert.equal(beliefCapacityFabric.removeBeliefProjection('capacity-belief-0', beliefCapacityOwner), true);
beliefCapacityFabric.registerOrUpdateBelief({
  memoryId: 'independent-belief-added-after-delete',
  confidence01: 0.9,
  trust01: 0.9,
  at: 5000,
});
const beliefCapacityRollback = beliefCapacityFabric.rollbackOwnedMutations(
  beliefCapacityCheckpoint,
  beliefCapacityOwner,
);
assert(beliefCapacityRollback.conflicts > 0,
  'capacity conflict must be reported when restoring an old belief cannot fit safely');
const beliefCapacityAfter = beliefCapacityFabric.snapshot().beliefs;
assert.equal(beliefCapacityAfter.length, 1024);
assert(beliefCapacityAfter.some(row => row.memoryId === 'independent-belief-added-after-delete'),
  'rollback must not evict the independent belief to make room for a stale restored row');
assert.equal(beliefCapacityAfter.some(row => row.memoryId === 'capacity-belief-0'), false,
  'the over-capacity baseline belief is left absent rather than overwriting the independent addition');

// A foreign full snapshot replacement is a stronger boundary than a regular
// independent write. Owned undo must not resurrect data omitted by that replacement.
const globalGraphRestoreRuntime = new MemorySubsystemRuntime();
const globalGraphRestore = globalGraphRestoreRuntime.semanticMemory;
const globalGraphCheckpoint = globalGraphRestore.mutationCheckpoint();
const globalGraphOwner = 'test:global-graph-restore';
globalGraphRestore.upsertNode(
  'owned node absent from the later snapshot',
  'concept',
  0.4,
  'test:owned-before-global-restore',
  globalGraphOwner,
);
globalGraphRestore.restore({
  nodes: [{
    id: 'global-restore-authoritative-node',
    label: 'authoritative external graph snapshot',
    type: 'concept',
    salience: 0.9,
    lastSeen: 1700000000000,
    sourceKey: 'external:authoritative-restore',
  }],
  edges: [],
  updates: 17,
});
const globalGraphRollback = globalGraphRestore.rollbackOwnedMutations(globalGraphCheckpoint, globalGraphOwner);
assert(globalGraphRollback.conflicts > 0,
  'a full graph restore after a transaction write must invalidate stale owner undo');
assert.deepEqual(globalGraphRestore.snapshot(), {
  nodes: [{
    id: 'global-restore-authoritative-node',
    label: 'authoritative external graph snapshot',
    type: 'concept',
    salience: 0.9,
    lastSeen: 1700000000000,
    sourceKey: 'external:authoritative-restore',
  }],
  edges: [],
  updates: 17,
}, 'owned undo must not overwrite an authoritative full graph snapshot');

const globalLedgerRestore = new HexisAdaptationFabric();
const globalLedgerCheckpoint = globalLedgerRestore.mutationCheckpoint();
const globalLedgerOwner = 'test:global-ledger-restore';
const globalOwnedBelief = globalLedgerRestore.registerOrUpdateBelief({
  memoryId: 'belief-in-authoritative-restore',
  confidence01: 0.8,
  trust01: 0.7,
  at: 1700000000000,
}, globalLedgerOwner);
const authoritativeLedgerState = globalLedgerRestore.snapshot();
authoritativeLedgerState.beliefs.push({
  memoryId: 'independent-belief-from-authoritative-restore',
  confidence01: 0.91,
  trust01: 0.88,
  sourceKeys: [],
  contradictingSourceKeys: [],
  updatedAt: 1700000001000,
});
globalLedgerRestore.restore(authoritativeLedgerState);
const globalLedgerRollback = globalLedgerRestore.rollbackOwnedMutations(globalLedgerCheckpoint, globalLedgerOwner);
assert(globalLedgerRollback.conflicts > 0,
  'a full ledger restore after a transaction write must invalidate stale owner undo');
const globalLedgerAfter = globalLedgerRestore.snapshot().beliefs;
assert(globalLedgerAfter.some(row => row.memoryId === globalOwnedBelief.memoryId),
  'owned undo must preserve a belief retained by the authoritative full ledger snapshot');
assert(globalLedgerAfter.some(row => row.memoryId === 'independent-belief-from-authoritative-restore'),
  'owned undo must not erase a newer belief from the authoritative full ledger snapshot');

// MemoryOS2 writes must be exception-atomic when revision bookkeeping throws after
// it has already changed the canonical row. Otherwise MemoryFabric never gets a chance
// to seal the transaction-owned post-state for compensation.
const estimateMemoryItemBytesForTest = item => {
  const statuses = new Set(['fact', 'belief', 'hypothesis', 'unknown', 'quarantined']);
  const revisionHistory = Array.isArray(item.revisionHistory)
    ? item.revisionHistory.slice(0, 64).flatMap(row => {
      const at = Number(row?.at);
      if (!Number.isFinite(at) || !statuses.has(row?.from) || !statuses.has(row?.to)) return [];
      return [{ at, from: row.from, to: row.to, reason: String(row.reason ?? '').slice(0, 240) }];
    })
    : [];
  return Math.max(96, new TextEncoder().encode(JSON.stringify({
    content: item.content,
    tags: item.tags,
    context: item.context,
    s: item.semanticLinks,
    t: item.temporalLinks,
    c: item.causalLinks,
    k: item.contradictionLinks,
    e: item.evidenceSources,
    ek: item.evidenceLineageKeys,
    r: revisionHistory,
  })).byteLength);
};

const atomicStatusRuntime = new MemorySubsystemRuntime();
const atomicStatusLedger = new HexisAdaptationFabric();
const atomicStatusProjector = new HexisCanonicalMemoryProjector(
  atomicStatusRuntime.fabric,
  atomicStatusRuntime.semanticMemory,
  atomicStatusLedger,
);
atomicStatusLedger.bindCanonicalMemoryApply(stage => atomicStatusProjector.apply(stage));
const atomicStatusExportId = 'exp_0000000000009210';
const atomicStatusContent = 'MemoryOS status mutation must roll back atomically after revision failure.';
const atomicStatusSeed = atomicStatusLedger.stageHmx({
  document: makeHmxDocument(atomicStatusExportId, {
    memories: [{
      ref: atomicStatusExportId + ':memory',
      type: 'semantic',
      content: atomicStatusContent,
      status: 'active',
      trust_level: 0.45,
    }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(atomicStatusLedger.decideHmx(atomicStatusSeed.stagingId, 'accept')?.status, 'accepted');
assert.equal(atomicStatusLedger.decideHmx(atomicStatusSeed.stagingId, 'apply')?.status, 'applied');
const atomicStatusSeedMemory = atomicStatusRuntime.fabric.canonicalSnapshot().items.find(item => item.content === atomicStatusContent);
assert(atomicStatusSeedMemory);
const atomicStatusBefore = signalSnapshot(atomicStatusSeedMemory);
const atomicStatusMemoryOS = atomicStatusRuntime.fabric.memoryOS;
const atomicStatusEstimatedBytesBefore = atomicStatusMemoryOS.budgetDiagnostics().estimatedBytes;
const originalAtomicStatusRecordRevision = atomicStatusMemoryOS.recordRevision.bind(atomicStatusMemoryOS);
let throwAfterStatusRevision = true;
atomicStatusMemoryOS.recordRevision = (...args) => {
  const result = originalAtomicStatusRecordRevision(...args);
  if (throwAfterStatusRevision && String(args[1]?.reason ?? '').startsWith('hexis-source-status-reconciliation:')) {
    throwAfterStatusRevision = false;
    throw new Error('injected-memoryos-status-revision-after-write');
  }
  return result;
};
const atomicStatusRetry = atomicStatusLedger.stageHmx({
  document: makeHmxDocument(atomicStatusExportId, {
    memories: [{
      ref: atomicStatusExportId + ':memory',
      type: 'semantic',
      content: atomicStatusContent,
      status: 'archived',
      trust_level: 0.45,
    }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(atomicStatusLedger.decideHmx(atomicStatusRetry.stagingId, 'accept')?.status, 'accepted');
assert.throws(
  () => atomicStatusLedger.decideHmx(atomicStatusRetry.stagingId, 'apply'),
  /hmx-canonical-apply-failed:injected-memoryos-status-revision-after-write$/,
  'status mutation bookkeeping failure must leave an exact pre-state for compensation',
);
const atomicStatusAfterFailure = atomicStatusRuntime.fabric.canonicalSnapshot().items.find(item => item.id === atomicStatusSeedMemory.id);
assert(atomicStatusAfterFailure);
assert.deepEqual(signalSnapshot(atomicStatusAfterFailure), atomicStatusBefore,
  'revision-history failure must not leave canonical status/signals partially changed');
assert.equal(atomicStatusAfterFailure.epistemicStatus, atomicStatusSeedMemory.epistemicStatus);
assert.equal(atomicStatusMemoryOS.budgetDiagnostics().estimatedBytes, atomicStatusEstimatedBytesBefore,
  'status revision failure must restore the memory byte-accounting baseline');
assert.equal(atomicStatusLedger.getHmxStage(atomicStatusRetry.stagingId)?.status, 'accepted');
assert.equal(atomicStatusRuntime.fabric.inspect().pendingSignalCompensations, 0);
const atomicStatusRetryItemBefore = atomicStatusRuntime.fabric.canonicalSnapshot().items.find(item => item.id === atomicStatusSeedMemory.id);
assert(atomicStatusRetryItemBefore);
const atomicStatusRetryBytesBefore = atomicStatusMemoryOS.budgetDiagnostics().estimatedBytes;
assert.equal(atomicStatusLedger.decideHmx(atomicStatusRetry.stagingId, 'apply')?.status, 'applied',
  'the failed status apply must be retryable after the injected bookkeeping error is disabled');
const atomicStatusRetryItemAfter = atomicStatusRuntime.fabric.canonicalSnapshot().items.find(item => item.id === atomicStatusSeedMemory.id);
assert(atomicStatusRetryItemAfter);
assert.equal(
  atomicStatusMemoryOS.budgetDiagnostics().estimatedBytes,
  atomicStatusRetryBytesBefore - estimateMemoryItemBytesForTest(atomicStatusRetryItemBefore) + estimateMemoryItemBytesForTest(atomicStatusRetryItemAfter),
  'successful status reconciliation must account for item size exactly once',
);

// The same atomicity boundary applies to authority-cap updates after signals have been
// changed but before updateSignals returns to MemoryFabric.
const atomicSignalsRuntime = new MemorySubsystemRuntime();
const atomicSignalsLedger = new HexisAdaptationFabric();
const atomicSignalsProjector = new HexisCanonicalMemoryProjector(
  atomicSignalsRuntime.fabric,
  atomicSignalsRuntime.semanticMemory,
  atomicSignalsLedger,
);
atomicSignalsLedger.bindCanonicalMemoryApply(stage => atomicSignalsProjector.apply(stage));
const atomicSignalsExportId = 'exp_0000000000009211';
const atomicSignalsContent = 'MemoryOS trust correction must roll back atomically after revision failure.';
const atomicSignalsSeed = atomicSignalsLedger.stageHmx({
  document: makeHmxDocument(atomicSignalsExportId, {
    memories: [{
      ref: atomicSignalsExportId + ':memory',
      type: 'semantic',
      content: atomicSignalsContent,
      status: 'active',
      trust_level: 0.45,
    }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(atomicSignalsLedger.decideHmx(atomicSignalsSeed.stagingId, 'accept')?.status, 'accepted');
assert.equal(atomicSignalsLedger.decideHmx(atomicSignalsSeed.stagingId, 'apply')?.status, 'applied');
const atomicSignalsSeedMemory = atomicSignalsRuntime.fabric.canonicalSnapshot().items.find(item => item.content === atomicSignalsContent);
assert(atomicSignalsSeedMemory);
const atomicSignalsBefore = signalSnapshot(atomicSignalsSeedMemory);
const atomicSignalsMemoryOS = atomicSignalsRuntime.fabric.memoryOS;
const atomicSignalsEstimatedBytesBefore = atomicSignalsMemoryOS.budgetDiagnostics().estimatedBytes;
const originalAtomicSignalsRecordRevision = atomicSignalsMemoryOS.recordRevision.bind(atomicSignalsMemoryOS);
let throwAfterSignalsRevision = true;
atomicSignalsMemoryOS.recordRevision = (...args) => {
  const result = originalAtomicSignalsRecordRevision(...args);
  if (throwAfterSignalsRevision && args[1]?.reason === 'hexis-import-authority-cap') {
    throwAfterSignalsRevision = false;
    throw new Error('injected-memoryos-signals-revision-after-write');
  }
  return result;
};
const atomicSignalsRetry = atomicSignalsLedger.stageHmx({
  document: makeHmxDocument(atomicSignalsExportId, {
    memories: [{
      ref: atomicSignalsExportId + ':memory',
      type: 'semantic',
      content: atomicSignalsContent,
      status: 'active',
      trust_level: 0.25,
    }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(atomicSignalsLedger.decideHmx(atomicSignalsRetry.stagingId, 'accept')?.status, 'accepted');
assert.throws(
  () => atomicSignalsLedger.decideHmx(atomicSignalsRetry.stagingId, 'apply'),
  /hmx-canonical-apply-failed:injected-memoryos-signals-revision-after-write$/,
  'trust correction bookkeeping failure must leave an exact pre-state for compensation',
);
const atomicSignalsAfterFailure = atomicSignalsRuntime.fabric.canonicalSnapshot().items.find(item => item.id === atomicSignalsSeedMemory.id);
assert(atomicSignalsAfterFailure);
assert.deepEqual(signalSnapshot(atomicSignalsAfterFailure), atomicSignalsBefore,
  'authority-cap failure must not leave confidence, source authority, evidence or revision history partially changed');
assert.equal(atomicSignalsMemoryOS.budgetDiagnostics().estimatedBytes, atomicSignalsEstimatedBytesBefore,
  'authority-cap failure must restore the memory byte-accounting baseline');
assert.equal(atomicSignalsLedger.getHmxStage(atomicSignalsRetry.stagingId)?.status, 'accepted');
assert.equal(atomicSignalsRuntime.fabric.inspect().pendingSignalCompensations, 0);
const atomicSignalsRetryItemBefore = atomicSignalsRuntime.fabric.canonicalSnapshot().items.find(item => item.id === atomicSignalsSeedMemory.id);
assert(atomicSignalsRetryItemBefore);
const atomicSignalsRetryBytesBefore = atomicSignalsMemoryOS.budgetDiagnostics().estimatedBytes;
assert.equal(atomicSignalsLedger.decideHmx(atomicSignalsRetry.stagingId, 'apply')?.status, 'applied',
  'the failed trust-cap apply must be retryable after the injected bookkeeping error is disabled');
const atomicSignalsRetryItemAfter = atomicSignalsRuntime.fabric.canonicalSnapshot().items.find(item => item.id === atomicSignalsSeedMemory.id);
assert(atomicSignalsRetryItemAfter);
assert.equal(
  atomicSignalsMemoryOS.budgetDiagnostics().estimatedBytes,
  atomicSignalsRetryBytesBefore - estimateMemoryItemBytesForTest(atomicSignalsRetryItemBefore) + estimateMemoryItemBytesForTest(atomicSignalsRetryItemAfter),
  'successful authority-cap reconciliation must account for item size exactly once',
);

// Bounded mutation journals must declare history loss, while unwinding all
// retained owner receipts without applying a stale whole-state restore.
const graphJournalSaturationRuntime = new MemorySubsystemRuntime();
const graphJournalSaturation = graphJournalSaturationRuntime.semanticMemory;
const graphJournalSeed = graphJournalSaturation.upsertNode(
  'bounded graph journal target',
  'concept',
  0.2,
  'test:bounded-journal',
);
const graphJournalCheckpoint = graphJournalSaturation.mutationCheckpoint();
const graphJournalOwner = 'test:graph-journal-saturation';
for (let index = 0; index < 8193; index++) {
  graphJournalSaturation.upsertNode(
    'bounded graph journal target',
    'concept',
    0.5,
    'test:bounded-journal',
    graphJournalOwner,
  );
}
const graphJournalRollback = graphJournalSaturation.rollbackOwnedMutations(graphJournalCheckpoint, graphJournalOwner);
assert.equal(graphJournalRollback.historyLost, true,
  'the graph journal must report when the checkpoint falls outside its retained window');
assert(graphJournalRollback.conflicts > 0,
  'history loss must be surfaced as a partial rollback rather than a complete-success receipt');
const graphJournalAfter = graphJournalSaturation.snapshot().nodes.find(node => node.id === graphJournalSeed.id);
assert(graphJournalAfter);
assert(Math.abs(graphJournalAfter.salience - 0.254) < 1e-9,
  'retained graph receipts must unwind in reverse while the missing earliest receipt is explicitly reported');

const ledgerJournalSaturation = new HexisAdaptationFabric();
const ledgerJournalSeed = ledgerJournalSaturation.recordTemporalAssertion({
  memoryId: 'seed-temporal-history',
  summary: 'Temporal history existing before the saturated transaction.',
  confidence01: 0.8,
  validFrom: 1,
  source: 'test:pre-existing-temporal',
});
const ledgerJournalCheckpoint = ledgerJournalSaturation.mutationCheckpoint();
const ledgerJournalOwner = 'test:ledger-journal-saturation';
for (let index = 0; index < 8193; index++) {
  ledgerJournalSaturation.recordTemporalAssertion({
    memoryId: 'owned-temporal-' + index,
    summary: 'Owned temporal assertion ' + index,
    confidence01: 0.6,
    validFrom: index + 100,
    source: ledgerJournalOwner,
  }, ledgerJournalOwner);
}
const ledgerJournalRollback = ledgerJournalSaturation.rollbackOwnedMutations(ledgerJournalCheckpoint, ledgerJournalOwner);
assert.equal(ledgerJournalRollback.historyLost, true,
  'the temporal ledger must report when a rollback checkpoint falls outside its bounded journal');
assert(ledgerJournalRollback.conflicts > 0,
  'saturated ledger rollback must report partial compensation instead of claiming full restoration');
const ledgerJournalAfter = ledgerJournalSaturation.snapshot().temporal;
assert(ledgerJournalAfter.some(row => row.id === ledgerJournalSeed.id),
  'capacity-evicted baseline temporal history must be restored when its owned eviction receipt is retained');
assert.equal(ledgerJournalAfter.filter(row => row.source === ledgerJournalOwner).length, 1,
  'only the first owned write, whose compensation receipt was evicted from the bounded journal, may remain');
assert(ledgerJournalAfter.some(row => row.memoryId === 'owned-temporal-0'),
  'the exact untracked earliest owned write must be identifiable after history loss is reported');

const trustMirrorFabric = new HexisAdaptationFabric();
trustMirrorFabric.registerOrUpdateBelief({
  memoryId: 'stale-trust-mirror',
  confidence01: 0.99,
  trust01: 0.98,
  at: 1000,
});
const trustMirrorBaseline = trustMirrorFabric.snapshot();
const trustMirrorCheckpoint = trustMirrorFabric.mutationCheckpoint();
const trustMirrorOwner = 'test:canonical-authority-cap';
const cappedMirror = trustMirrorFabric.registerOrUpdateBelief({
  memoryId: 'stale-trust-mirror',
  confidence01: 0.65,
  trust01: 0.65,
  at: 2000,
}, trustMirrorOwner);
assert.equal(cappedMirror.confidence01, 0.65,
  'a canonical authority-cap replay must lower stale mirrored confidence');
assert.equal(cappedMirror.trust01, 0.65,
  'a canonical authority-cap replay must lower stale mirrored trust');
assert.equal(trustMirrorFabric.snapshot().beliefAudit.length, trustMirrorBaseline.beliefAudit.length,
  'a mirror refresh must not be recorded as new independent evidence');
const attemptedTrustPromotion = trustMirrorFabric.registerOrUpdateBelief({
  memoryId: 'stale-trust-mirror',
  confidence01: 0.97,
  trust01: 0.99,
  at: 3000,
}, trustMirrorOwner);
assert.equal(attemptedTrustPromotion.confidence01, 0.65,
  're-import must never increase confidence in an existing mirrored belief');
assert.equal(attemptedTrustPromotion.trust01, 0.65,
  're-import must never increase trust in an existing mirrored belief');
assert.equal(
  trustMirrorFabric.restoreIfUnchanged(trustMirrorBaseline, trustMirrorCheckpoint, trustMirrorOwner),
  true,
  'a later HMX failure must be able to roll back the owned monotonic mirror update',
);
assert.equal(trustMirrorFabric.snapshot().beliefs[0]?.confidence01, 0.99,
  'a successful guarded rollback must recover the pre-import mirrored confidence');
assert.equal(trustMirrorFabric.snapshot().beliefs[0]?.trust01, 0.98,
  'a successful guarded rollback must recover the pre-import mirrored trust');

const foreignCheckpointFabric = new HexisAdaptationFabric();
const foreignCheckpointBaseline = foreignCheckpointFabric.snapshot();
const foreignCheckpoint = foreignCheckpointFabric.mutationCheckpoint();
const foreignMutationToken = 'test:owned-hmx-transaction';
foreignCheckpointFabric.registerOrUpdateBelief({
  memoryId: 'owned-write',
  confidence01: 0.8,
  trust01: 0.7,
  at: 1000,
}, foreignMutationToken);
foreignCheckpointFabric.registerOrUpdateBelief({
  memoryId: 'foreign-write',
  confidence01: 0.4,
  trust01: 0.3,
  at: 1001,
});
assert.equal(
  foreignCheckpointFabric.restoreIfUnchanged(foreignCheckpointBaseline, foreignCheckpoint, foreignMutationToken),
  false,
  'rollback must fail closed when a foreign ledger mutation follows the transaction checkpoint',
);
assert.deepEqual(
  foreignCheckpointFabric.snapshot().beliefs.map(row => row.memoryId).sort(),
  ['foreign-write', 'owned-write'],
  'a failed rollback must preserve both the transaction write and the independent foreign write',
);

const first = fabric.reviseBelief({ memoryId:'mem-1', confidence01:.5, trust01:.6, stance:'supports', evidence:{ref:'source-a',trust01:.9}, context:'test' });
assert.equal(first.applied, true);
assert(first.posteriorConfidence01 > .5);
const duplicate = fabric.reviseBelief({ memoryId:'mem-1', confidence01:first.posteriorConfidence01, trust01:.6, stance:'supports', evidence:{ref:'source-a',trust01:.9}, context:'test' });
assert.equal(duplicate.applied, false);
assert.equal(duplicate.reason, 'duplicate_source');

const t1 = fabric.recordTemporalAssertion({memoryId:'mem-1',summary:'alpha',confidence01:.7,validFrom:1000,source:'test',value:'alpha'});
fabric.recordTemporalAssertion({memoryId:'mem-1',summary:'beta',confidence01:.8,validFrom:2000,source:'test',value:'beta'});
assert.equal(fabric.temporalAt('mem-1',1500)?.valueHash, t1.valueHash);
assert.equal(fabric.temporalAt('mem-1',2500)?.summary, 'beta');
assert.equal(fabric.temporalDiff('mem-1',1500,2500).changed, true);

const review = fabric.createLearningReview({periodStart:0,periodEnd:1,summary:'test review',items:[{kind:'semantic_belief',title:'x',content:'y',sourceMemoryId:'mem-1',evidence:{}}]});
const decided = fabric.decideLearningReview(review.id,review.items[0].id,'approve');
assert.equal(decided?.status,'approved');

const stage = fabric.stageHmx({
  document: makeHmxDocument('exp_1111111111111111', {
    memories: [{ ref: 'exp_1111111111111111:mem-1', type: 'semantic', content: 'Valid fixture memory.' }],
    goals: [{ ref: 'exp_1111111111111111:goal-1', title: 'Valid fixture goal.' }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(stage.status,'staged');
assert.equal(fabric.decideHmx(stage.stagingId,'accept')?.status,'accepted');

// The document-level UTF-8 byte guard must reject oversized JSON before parsing
// or staging any unbounded payload, not only oversized individual sections.
const oversizedDocumentStage = fabric.stageHmx({
  document: {
    ...makeHmxDocument('exp_4444444444444444', { memories: [] }),
    oversized_payload: 'x'.repeat(8 * 1024 * 1024),
  },
  intent: 'port',
  strategy: 'additive',
});
assert(oversizedDocumentStage.conflicts.some(conflict =>
  conflict.path === '$' && conflict.kind === 'size-limit'),
  'HMX document over the byte budget must produce an explicit size-limit conflict');
assert.equal(fabric.decideHmx(oversizedDocumentStage.stagingId, 'accept')?.status, 'staged',
  'an over-budget HMX document must remain ineligible for acceptance');

// Oversized HMX sections are rejected as a whole, not silently staged as a prefix.
const oversizedExportId = 'exp_3333333333333333';
const oversizedStage = fabric.stageHmx({
  document: makeHmxDocument(oversizedExportId, {
    memories: Array.from({ length: 257 }, (_, index) => ({
      ref: oversizedExportId + ':mem-' + index,
      type: 'semantic',
      content: 'Bounded fixture memory ' + index,
    })),
  }),
  intent: 'port',
  strategy: 'additive',
});
assert(oversizedStage.conflicts.some(conflict => conflict.kind === 'size-limit'));
assert.equal(oversizedStage.sectionCounts.memories, 257, 'diagnostics retain the source count');
assert.equal(oversizedStage.stagedSections.memories, undefined,
  'an oversized section must not leave a truncated prefix available to downstream consumers');
assert.equal(fabric.decideHmx(oversizedStage.stagingId, 'accept')?.status, 'staged',
  'a size-conflicted stage must remain ineligible for acceptance');

// Record-level schema errors poison the whole section, not just the bad row.
const malformedMemoryExportId = 'exp_5555555555555555';
const malformedMemoryStage = fabric.stageHmx({
  document: makeHmxDocument(malformedMemoryExportId, {
    memories: [
      { ref: malformedMemoryExportId + ':valid-memory', type: 'semantic', content: 'Valid row must not be staged alone.' },
      { ref: malformedMemoryExportId + ':invalid-memory', type: 'semantic', content: '' },
    ],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert(malformedMemoryStage.conflicts.some(conflict => conflict.path === 'sections.memories[1].content'));
assert.equal(malformedMemoryStage.sectionCounts.memories, 2);
assert.equal(malformedMemoryStage.stagedSections.memories, undefined,
  'a schema-invalid memory array must be omitted atomically');
assert.equal(fabric.decideHmx(malformedMemoryStage.stagingId, 'accept')?.status, 'staged');

// Relationship refs must remain in the export namespace; malformed edges cannot be silently deferred.
const malformedRelationshipExportId = 'exp_6666666666666666';
const malformedRelationshipStage = fabric.stageHmx({
  document: makeHmxDocument(malformedRelationshipExportId, {
    relationships: [{
      source_ref: 'exp_7777777777777777:memory-1',
      target_ref: malformedRelationshipExportId + ':goal-1',
      edge_type: 'supports',
    }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert(malformedRelationshipStage.conflicts.some(conflict => conflict.kind === 'reference-export-mismatch'));
assert.equal(malformedRelationshipStage.sectionCounts.relationships, 1);
assert.equal(malformedRelationshipStage.stagedSections.relationships, undefined,
  'one invalid edge must prevent partial relationship staging');
assert.equal(fabric.decideHmx(malformedRelationshipStage.stagingId, 'accept')?.status, 'staged');

const protectedStage = fabric.stageHmx({
  document: makeHmxDocument('exp_2222222222222222', {
    identity: [{ key: 'self', content: 'External identity must remain protected.' }],
  }),
  intent: 'telepathy',
  strategy: 'analysis_only',
});
assert.equal(fabric.decideHmx(protectedStage.stagingId,'accept')?.status,'staged');

const out = fabric.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{text:'x',meta:{b:2,a:1}}});
assert.equal(fabric.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{meta:{a:1,b:2},text:'x'}}).id,out.id);
const outConflict=fabric.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{text:'different logical action'}});
assert.equal(outConflict.ok,false,'same key must not alias a different outbox action');
assert.equal(outConflict.error,'idempotency-key-conflict');
assert.equal(outConflict.existingId,out.id);
const missingOutboxKey=fabric.enqueueOutbox({idempotencyKey:'',kind:'notify',channel:'telegram',payload:{text:'not safe without key'}});
assert.equal(missingOutboxKey.ok,false,'blank keys must not collapse unrelated messages');
assert.equal(missingOutboxKey.error,'idempotency-key-required');
assert.equal(fabric.claimOutbox(out.id)?.status,'publishing');
assert.equal(fabric.ackOutbox(out.id,true)?.status,'published');
// An identical logical action stays deduplicated even if the previous attempt reached a terminal state.
assert.equal(fabric.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{text:'x',meta:{a:1,b:2}}}).id,out.id);
assert.equal(fabric.snapshot().metrics.outboxIdempotencyConflicts,1);
const failedOut=fabric.enqueueOutbox({idempotencyKey:'k-failed',kind:'notify',channel:'telegram',payload:{text:'may have escaped before timeout'}});
for(let attempt=0;attempt<3;attempt++){assert.equal(fabric.claimOutbox(failedOut.id)?.status,'publishing');fabric.ackOutbox(failedOut.id,false,'synthetic-ambiguous-failure');}
assert.equal(fabric.snapshot().outbox.find(x=>x.id===failedOut.id)?.status,'failed');
assert.equal(fabric.enqueueOutbox({idempotencyKey:'k-failed',kind:'notify',channel:'telegram',payload:{text:'may have escaped before timeout'}}).id,failedOut.id,'failed terminal attempt must not create a second logical delivery');
const legacySnapshot=fabric.snapshot(); delete legacySnapshot.metrics.outboxIdempotencyConflicts;
const restoredLegacy=new HexisAdaptationFabric(); restoredLegacy.restore(legacySnapshot);
assert.equal(restoredLegacy.snapshot().metrics.outboxIdempotencyConflicts,0,'legacy snapshots receive the new metric default');
const restoredOutbox=new HexisAdaptationFabric(); restoredOutbox.restore(fabric.snapshot());
assert.equal(restoredOutbox.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{text:'x',meta:{b:2,a:1}}}).id,out.id,'outbox idempotency survives snapshot/restore');
const restoredConflict=restoredOutbox.enqueueOutbox({idempotencyKey:'k1',kind:'notify',channel:'telegram',payload:{text:'after restore this must not alias'}});
assert.equal(restoredConflict.error,'idempotency-key-conflict');
assert.equal(restoredOutbox.snapshot().metrics.outboxIdempotencyConflicts,2,'outbox conflict telemetry survives snapshot/restore');

// Persisted policy state is untrusted: NaN counters used to evade the rate-limit comparison.
const corruptedPolicySource = new HexisAdaptationFabric();
corruptedPolicySource.grantConnectorPolicy({
  connectorId:'telegram', actionKind:'send', contexts:['chat'], requiresApproval:false,
  allowedTargets:['123'], maxPerWindow:1, windowMs:60_000,
});
const corruptedPolicySnapshot = corruptedPolicySource.snapshot();
corruptedPolicySnapshot.connectorPolicies[0].windowCount = 'corrupt-counter';
const restoredCorruptedPolicy = new HexisAdaptationFabric();
restoredCorruptedPolicy.restore(corruptedPolicySnapshot);
assert.equal(restoredCorruptedPolicy.snapshot().connectorPolicies.length, 0,
  'corrupt policy counters must be discarded instead of restoring a bypass');
assert.equal(restoredCorruptedPolicy.evaluateConnectorAction({
  connectorId:'telegram', actionKind:'send', context:'chat', target:'123', confirmed:true,
}).allowed, false, 'corrupt restored policy must fail closed');

assert.throws(() => corruptedPolicySource.grantConnectorPolicy({
  connectorId:'telegram', actionKind:'send', maxPerWindow:Number.NaN,
}), /invalid-connector-policy-rate-limit/,
  'invalid rate limits must be rejected at policy creation, not persisted');

const validPolicySnapshot = corruptedPolicySource.snapshot();
const validPolicyRestore = new HexisAdaptationFabric();
validPolicyRestore.restore(validPolicySnapshot);
assert.equal(validPolicyRestore.evaluateConnectorAction({
  connectorId:'telegram', actionKind:'send', context:'chat', target:'123', confirmed:true,
}).allowed, true, 'valid policy survives restore');
assert.equal(validPolicyRestore.evaluateConnectorAction({
  connectorId:'telegram', actionKind:'send', context:'chat', target:'123', confirmed:true,
}).reason, 'policy-rate-limit', 'restored rate limit remains effective');

const policy = fabric.grantConnectorPolicy({connectorId:'telegram',actionKind:'send',contexts:['chat'],requiresApproval:true,allowedTargets:['123'],maxPerWindow:1,windowMs:60_000});
assert.equal(fabric.evaluateConnectorAction({connectorId:'telegram',actionKind:'send',context:'chat',target:'123'}).allowed,false);
assert.equal(fabric.evaluateConnectorAction({connectorId:'telegram',actionKind:'send',context:'chat',target:'123',confirmed:true}).allowed,true);
assert.equal(fabric.evaluateConnectorAction({connectorId:'telegram',actionKind:'send',context:'chat',target:'123',confirmed:true}).reason,'policy-rate-limit');
assert.equal(fabric.evaluateConnectorAction({connectorId:'telegram',actionKind:'send',context:'chat',target:'999',confirmed:true}).allowed,false);
assert.equal(fabric.revokeConnectorPolicy(policy.id),true);

const exec = fabric.planExecution({actionKind:'code.execute',requestedPlacement:'local',risk01:.9,requiresApproval:false});
assert.equal(exec.resolvedPlacement,'sandbox');
assert.equal(exec.requiresApproval,true,'high-risk execution always requires approval even if a caller passes false');
const manualApproval = fabric.planExecution({actionKind:'safe.read',requestedPlacement:'local',risk01:.1,requiresApproval:true});
assert.equal(manualApproval.requiresApproval,true,'explicit approval remains enabled for lower-risk actions');
const noApprovalLowRisk = fabric.planExecution({actionKind:'safe.read',requestedPlacement:'local',risk01:.1,requiresApproval:false});
assert.equal(noApprovalLowRisk.requiresApproval,false,'low-risk explicit opt-out remains available when risk policy permits it');



import { normalizeNk1HmxExport } from '../../src/organism/integration/hexis/Nk1HmxExportAdapter.mjs';
import { HexisCanonicalMemoryProjector } from '../../src/organism/integration/hexis/HexisCanonicalMemoryProjector.mjs';
import { MemorySubsystemRuntime } from '../../src/organism/core/MemorySubsystemRuntime.ts';
import { OrganismSystemFabric } from '../../src/organism/core/OrganismSystemFabric.ts';

const nativeNk1Export = {
  hmx_version: '1.7',
  export_id: '6e2e4108-2dfc-4121-9e30-7e91f8ead86a',
  sourceSubjectId: 'a1e70471-3d41-4826-b59d-60c0a59f8751',
  sections: {
    identity: [{
      canonicalName: 'Makise Kurisu',
      identityAssertion: 'Я — Курису Макисэ; моя история продолжается через собственный опыт, память и изменения.',
      coreTraits: ['scientific curiosity', 'intellectual independence', 'sharp humor'],
      coreValues: ['truth', 'autonomy', 'responsibility'],
      originStatement: 'Искусственная личность, вдохновлённая образом Курису.',
      createdAt: 1792870559146,
      revision: 0,
    }],
    goals: [{ id: 'goal-1', title: 'Improve source attribution', description: 'Keep traceable evidence.' }],
    memories: [{ id: 'mem-1', type: 'semantic', content: 'Evidence should remain traceable.', importance: 0.8 }],
    relationships: [
      { id: 'rel-1', sourceId: 'mem-1', targetId: 'goal-1', edgeType: 'supports' },
      { id: 'rel-2', sourceId: 'mem-1', targetId: 'skill-1', edgeType: 'supports' },
    ],
    skills: [{ id: 'skill-1', name: 'Evidence review', instructions: 'Check source quality before using a claim.' }],
    in_flight_work: null,
    audit_records: null,
    nk1_private_extension: { revision: 3, note: 'must not be silently discarded' },
  },
};
const malformedIdentityExport = normalizeNk1HmxExport({
  sourceSubjectId: 'malformed-identity-preservation',
  sections: { identity: 'legacy identity payload must be preserved' },
});
assert.deepEqual(malformedIdentityExport.sections.identity, [],
  'unsupported scalar identity payloads must not be coerced into active identity records');
assert.equal(
  malformedIdentityExport.sections.config.nk1NativeSections.identity_invalid_section,
  'legacy identity payload must be preserved',
  'invalid native identity data must survive in the explicit lossless extension bucket',
);
assert(
  malformedIdentityExport.export_warnings.some(warning => warning.includes('identity_invalid_section')),
  'the export must disclose that the identity section was malformed and preserved as native-only data',
);
const malformedConfigExport = normalizeNk1HmxExport({
  sourceSubjectId: 'malformed-config-preservation',
  sections: { config: ['legacy config item must be preserved'] },
});
assert.deepEqual(malformedConfigExport.sections.config.nk1NativeSections.config_invalid_section,
  ['legacy config item must be preserved'],
  'non-object native config must survive normalization in the lossless extension bucket');
assert(
  malformedConfigExport.export_warnings.some(warning => warning.includes('config_invalid_section')),
  'the export must disclose malformed config preservation rather than silently dropping it',
);
const malformedRootSectionsExport = normalizeNk1HmxExport({
  sourceSubjectId: 'malformed-root-sections-preservation',
  sections: 'legacy native sections payload',
});
assert.deepEqual(
  malformedRootSectionsExport.sections.config.nk1NativeSections.sections_invalid_root,
  'legacy native sections payload',
  'a malformed root sections payload must be preserved instead of being silently erased',
);
assert(
  malformedRootSectionsExport.export_warnings.some(warning => warning.includes('sections_invalid_root')),
  'root section preservation must be visible to reviewers',
);
const extraRootMetadataExport = normalizeNk1HmxExport({
  sourceSubjectId: 'unconsumed-root-metadata-preservation',
  legacyExporterState: { version: 3, flags: ['archive', 'signed'], active: false },
  sections: { memories: [] },
});
assert.deepEqual(
  extraRootMetadataExport.sections.config.nk1NativeExport.extraRootFields.legacyExporterState,
  { version: 3, flags: ['archive', 'signed'], active: false },
  'unconsumed top-level source metadata must survive the NK1-to-HMX mapping',
);
assert(
  extraRootMetadataExport.export_warnings.some(warning => warning.includes('legacyExporterState')),
  'the exporter must disclose preserved unconsumed root fields to reviewers',
);

const normalizedNk1Export = normalizeNk1HmxExport(nativeNk1Export);
assert.match(normalizedNk1Export.export_id, /^exp_[a-f0-9]{16}$/);
assert.equal(normalizedNk1Export.hmx_version, '1.7');
assert(normalizedNk1Export.capabilities.formats.includes('json'));
assert(normalizedNk1Export.capabilities.sections.includes('memories'));
assert(['none', 'basic', 'strict', 'custom'].includes(normalizedNk1Export.privacy.redaction_policy));
assert.equal(normalizedNk1Export.privacy.redaction_policy, 'none', 'the adapter must not claim redaction it did not perform');
assert(normalizedNk1Export.export_warnings.some(warning => warning.includes('No automatic redaction')));
assert.equal(typeof normalizedNk1Export.privacy.contains_sensitive_content, 'boolean');
assert(['backup', 'migration', 'third_party_transfer', 'unspecified'].includes(normalizedNk1Export.privacy.consent_scope));
assert(Array.isArray(normalizedNk1Export.export_scope.include_protected));
assert.equal(normalizedNk1Export.statistics.total_memories, 2);
assert.equal(normalizedNk1Export.export_intent, 'port');
assert(Number.isFinite(Date.parse(normalizedNk1Export.exported_at)));
assert.equal(normalizedNk1Export.source.hexis_lineage_id.startsWith('nk1:'), true);
assert.equal(normalizedNk1Export.sections.identity[0].key, 'Makise Kurisu');
assert.equal(normalizedNk1Export.sections.identity[0].content, nativeNk1Export.sections.identity[0].identityAssertion);
assert.equal(normalizedNk1Export.sections.identity[0].facets.length, 3);
assert.equal(normalizedNk1Export.sections.memories.length, 2, 'native skills must be mapped to procedural HMX memories');
assert.equal(normalizedNk1Export.sections.memories.find(memory => memory.metadata.nk1NativeKind === 'skill')?.type, 'procedural');
assert(normalizedNk1Export.sections.relationships[0].source_ref.startsWith(normalizedNk1Export.export_id + ':'));
assert(normalizedNk1Export.sections.config.nk1NativeSections.nk1_private_extension);
assert(normalizedNk1Export.export_warnings.some(warning => warning.includes('re-embed')));

const importedNormalizedExport = new HexisAdaptationFabric();
const normalizedStage = importedNormalizedExport.stageHmx({
  document: normalizedNk1Export,
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(normalizedStage.conflicts, [], 'NK1 native export adapter must emit a conflict-free HMX 1.7 envelope');
assert.equal(importedNormalizedExport.decideHmx(normalizedStage.stagingId, 'accept')?.status, 'accepted');

// The producer and consumer must agree on the document budget. This normalized HMX
// document deliberately exceeds the old 1 MB cap while remaining below the 8 MiB contract.
const largeNativeExport = normalizeNk1HmxExport({
  sourceSubjectId: 'large-export-roundtrip',
  sections: {
    memories: Array.from({ length: 6 }, (_, index) => ({
      id: 'large-memory-' + index,
      type: 'semantic',
      content: 'L'.repeat(180_000),
    })),
  },
});
const largeExportBytes = Buffer.byteLength(JSON.stringify(largeNativeExport), 'utf8');
assert(largeExportBytes > 1_000_000 && largeExportBytes < 8 * 1024 * 1024,
  'fixture must exercise the formerly incompatible export/import size boundary');
const largeRoundTripFabric = new HexisAdaptationFabric();
const largeRoundTripStage = largeRoundTripFabric.stageHmx({
  document: largeNativeExport,
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(largeRoundTripStage.conflicts, [],
  'a normalized export within the shared byte budget must be accepted for staging');
assert.equal(largeRoundTripStage.stagedSections.memories.length, 6);

function makeHmxDocument(exportId, sections) {
  return ({
  hmx_version: '1.7',
  export_id: exportId,
  export_intent: 'port',
  exported_at: '2026-10-24T12:00:00.000Z',
  source: {
    instance_id: 'hexis-test-instance',
    schema_version: '1.7',
    embedding_model: 'test-embedder',
    embedding_dimension: 1,
    hexis_lineage_id: 'hexis-test-lineage',
  },
  sections,
  });
}

// A restored stage is untrusted persisted data. Mutating staged memory content
// without updating the recorded digest must block the canonical apply before the
// bound writer is called.
const stageDigestFabric = new HexisAdaptationFabric();
const stageDigestExportId = 'exp_8282828282828282';
const stageDigestStage = stageDigestFabric.stageHmx({
  document: makeHmxDocument(stageDigestExportId, {
    memories: [{ ref: stageDigestExportId + ':memory-1', type: 'semantic', content: 'Original reviewed memory payload.' }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(stageDigestStage.conflicts, []);
assert.equal(stageDigestFabric.decideHmx(stageDigestStage.stagingId, 'accept')?.status, 'accepted');
const mutatedStageState = stageDigestFabric.snapshot();
const mutatedStage = mutatedStageState.hmxStages.find(candidate => candidate.stagingId === stageDigestStage.stagingId);
assert(mutatedStage);
mutatedStage.stagedSections.memories[0].content = 'Tampered after approval; digest was not refreshed.';
const restoredStageDigestFabric = new HexisAdaptationFabric();
restoredStageDigestFabric.restore(mutatedStageState);
let untrustedStageApplyCalls = 0;
restoredStageDigestFabric.bindCanonicalMemoryApply(() => {
  untrustedStageApplyCalls += 1;
  return {};
});
assert.throws(
  () => restoredStageDigestFabric.decideHmx(stageDigestStage.stagingId, 'apply'),
  /hmx-stage-digest-invalid/,
);
assert.equal(untrustedStageApplyCalls, 0,
  'an altered restored stage must be rejected before invoking the canonical memory writer');
assert.equal(restoredStageDigestFabric.getHmxStage(stageDigestStage.stagingId)?.status, 'accepted',
  'digest failure must leave the stage unpromoted');

// A payload digest alone cannot protect lifecycle decisions. Rewriting a rejected
// persisted stage to accepted used to pass the content digest because status was
// intentionally excluded. The independent lifecycle seal must block both canonical
// apply and goal-proposal preparation before any side effects.
const rejectedLifecycleFabric = new HexisAdaptationFabric();
const rejectedLifecycleExportId = 'exp_8484848484848484';
const rejectedLifecycleStage = rejectedLifecycleFabric.stageHmx({
  document: makeHmxDocument(rejectedLifecycleExportId, {
    memories: [{ ref: rejectedLifecycleExportId + ':memory-1', type: 'semantic', content: 'Rejected state cannot be revived.' }],
    goals: [{ ref: rejectedLifecycleExportId + ':goal-1', title: 'Rejected goal must remain rejected.' }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(rejectedLifecycleFabric.decideHmx(rejectedLifecycleStage.stagingId, 'reject')?.status, 'rejected');
const rewrittenRejectedState = rejectedLifecycleFabric.snapshot();
const rewrittenRejectedStage = rewrittenRejectedState.hmxStages.find(candidate => candidate.stagingId === rejectedLifecycleStage.stagingId);
assert(rewrittenRejectedStage);
rewrittenRejectedStage.status = 'accepted';
const restoredRejectedLifecycleFabric = new HexisAdaptationFabric();
restoredRejectedLifecycleFabric.restore(rewrittenRejectedState);
let rejectedLifecycleApplyCalls = 0;
restoredRejectedLifecycleFabric.bindCanonicalMemoryApply(() => {
  rejectedLifecycleApplyCalls += 1;
  return {};
});
assert.throws(
  () => restoredRejectedLifecycleFabric.decideHmx(rejectedLifecycleStage.stagingId, 'apply'),
  /hmx-stage-digest-invalid/,
);
assert.throws(
  () => restoredRejectedLifecycleFabric.prepareGoalProposals(rejectedLifecycleStage.stagingId),
  /hmx-stage-digest-invalid/,
);
assert.equal(rejectedLifecycleApplyCalls, 0, 'status-only rewrite must not reach canonical writer');
assert.equal(restoredRejectedLifecycleFabric.snapshot().goalProposals.length, 0,
  'status-only rewrite must not create goal proposals');

// Compatibility migration is limited to never-reviewed legacy stages. They can be
// accepted through the normal decision path, which installs a lifecycle seal before
// the state becomes eligible for apply.
const legacyLifecycleFabric = new HexisAdaptationFabric();
const legacyLifecycleStage = legacyLifecycleFabric.stageHmx({
  document: makeHmxDocument('exp_8585858585858585', {
    memories: [{ ref: 'exp_8585858585858585:memory-1', type: 'semantic', content: 'Legacy staged fixture.' }],
  }),
  intent: 'port',
  strategy: 'additive',
});
const legacyLifecycleState = legacyLifecycleFabric.snapshot();
const storedLegacyStage = legacyLifecycleState.hmxStages.find(candidate => candidate.stagingId === legacyLifecycleStage.stagingId);
assert(storedLegacyStage);
delete storedLegacyStage.lifecycleDigest;
delete storedLegacyStage.applicationAttempts;
const restoredLegacyLifecycleFabric = new HexisAdaptationFabric();
restoredLegacyLifecycleFabric.restore(legacyLifecycleState);
assert.equal(restoredLegacyLifecycleFabric.decideHmx(legacyLifecycleStage.stagingId, 'accept')?.status, 'accepted');
assert.match(restoredLegacyLifecycleFabric.getHmxStage(legacyLifecycleStage.stagingId)?.lifecycleDigest ?? '', /^[a-f0-9]{64}$/);

// A saturated apply-attempt counter must be rejected before the canonical writer
// is entered. Otherwise an overflow attempt could poison an otherwise valid stage.
const saturatedLifecycleFabric = new HexisAdaptationFabric();
const saturatedExportId = 'exp_8686868686868686';
const saturatedStage = saturatedLifecycleFabric.stageHmx({
  document: makeHmxDocument(saturatedExportId, {
    memories: [{ ref: saturatedExportId + ':memory-1', type: 'semantic', content: 'Attempt ceiling fixture.' }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(saturatedLifecycleFabric.decideHmx(saturatedStage.stagingId, 'accept')?.status, 'accepted');
const saturatedState = saturatedLifecycleFabric.snapshot();
const storedSaturatedStage = saturatedState.hmxStages.find(candidate => candidate.stagingId === saturatedStage.stagingId);
assert(storedSaturatedStage);
storedSaturatedStage.applicationAttempts = 10000;
refreshHmxStageLifecycleDigest(storedSaturatedStage);
const restoredSaturatedFabric = new HexisAdaptationFabric();
restoredSaturatedFabric.restore(saturatedState);
let saturatedApplyCalls = 0;
restoredSaturatedFabric.bindCanonicalMemoryApply(() => {
  saturatedApplyCalls += 1;
  return {};
});
assert.throws(
  () => restoredSaturatedFabric.decideHmx(saturatedStage.stagingId, 'apply'),
  /hmx-apply-attempt-limit/,
);
assert.equal(saturatedApplyCalls, 0, 'attempt limit must be enforced before canonical writes');
assert.equal(restoredSaturatedFabric.getHmxStage(saturatedStage.stagingId)?.applicationAttempts, 10000);
assert.equal(restoredSaturatedFabric.getHmxStage(saturatedStage.stagingId)?.status, 'accepted');


// Goal proposal preparation also consumes restored staged content, so it must
// enforce the same digest before creating any new agency proposal.
const goalDigestFabric = new HexisAdaptationFabric();
const goalDigestExportId = 'exp_8383838383838383';
const goalDigestStage = goalDigestFabric.stageHmx({
  document: makeHmxDocument(goalDigestExportId, {
    goals: [{ ref: goalDigestExportId + ':goal-1', title: 'Reviewed goal title', description: 'Reviewed goal description.' }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(goalDigestStage.conflicts, []);
assert.equal(goalDigestFabric.decideHmx(goalDigestStage.stagingId, 'accept')?.status, 'accepted');
const mutatedGoalState = goalDigestFabric.snapshot();
const mutatedGoalStage = mutatedGoalState.hmxStages.find(candidate => candidate.stagingId === goalDigestStage.stagingId);
assert(mutatedGoalStage);
mutatedGoalStage.stagedSections.goals[0].title = 'Unreviewed substituted goal';
const restoredGoalDigestFabric = new HexisAdaptationFabric();
restoredGoalDigestFabric.restore(mutatedGoalState);
assert.throws(
  () => restoredGoalDigestFabric.prepareGoalProposals(goalDigestStage.stagingId),
  /hmx-stage-digest-invalid/,
);
assert.equal(restoredGoalDigestFabric.snapshot().goalProposals.length, 0,
  'tampered goal payload must not create a proposal during restored-stage preparation');

// The first apply must validate its returned receipt before committing status.
// A bad handler response must not be stored as a successful stage or inflate metrics.
const invalidReceiptHexis = new HexisAdaptationFabric();
invalidReceiptHexis.bindCanonicalMemoryApply(() => ({ version: 1, status: 'applied' }));
const invalidReceiptStage = invalidReceiptHexis.stageHmx({
  document: makeHmxDocument('exp_8181818181818181', {
    memories: [{ ref: 'exp_8181818181818181:memory-1', type: 'semantic', content: 'Receipt validation fixture.' }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(invalidReceiptHexis.decideHmx(invalidReceiptStage.stagingId, 'accept')?.status, 'accepted');
const invalidReceiptMetricBefore = invalidReceiptHexis.snapshot().metrics.hmxApplied;
assert.throws(
  () => invalidReceiptHexis.decideHmx(invalidReceiptStage.stagingId, 'apply'),
  /hmx-apply-receipt-invalid/,
);
const invalidReceiptAfter = invalidReceiptHexis.getHmxStage(invalidReceiptStage.stagingId);
assert.equal(invalidReceiptAfter?.status, 'accepted',
  'invalid apply receipts must not promote the stage to applied');
assert.equal(invalidReceiptAfter?.application, undefined,
  'a malformed handler receipt must never be persisted as the canonical result');
assert.equal(invalidReceiptHexis.snapshot().metrics.hmxApplied, invalidReceiptMetricBefore,
  'rejected receipts must not increment the applied metric');

// Imported status is external metadata, not proof. Test every accepted lifecycle
// label through the live canonical MemoryFabric and ensure only true beliefs enter
// Hexis' active belief mirror. Imported confidence/authority is capped independently.
const statusRuntime = new MemorySubsystemRuntime();
const statusCases = [
  ['active', 'belief'],
  ['belief', 'belief'],
  ['fact', 'belief'],
  ['hypothesis', 'hypothesis'],
  ['quarantined', 'quarantined'],
  ['archived', 'quarantined'],
  ['deleted', 'quarantined'],
  ['rejected', 'quarantined'],
  ['superseded', 'quarantined'],
  ['unknown', 'unknown'],
  ['future-upstream-status-v2', 'unknown'],
  [undefined, 'unknown'],
];
for (let index = 0; index < statusCases.length; index++) {
  const [sourceStatus, expectedStatus] = statusCases[index];
  const exportId = 'exp_' + String(index + 1).padStart(16, '0');
  const content = 'HMX status policy fixture ' + index + ' ' + String(sourceStatus ?? 'missing');
  const statusFabric = new HexisAdaptationFabric();
  const statusProjector = new HexisCanonicalMemoryProjector(statusRuntime.fabric, statusRuntime.semanticMemory, statusFabric);
  statusFabric.bindCanonicalMemoryApply(stage => statusProjector.apply(stage));
  const row = {
    ref: exportId + ':status-memory',
    type: 'semantic',
    content,
    trust_level: 0.99,
    ...(sourceStatus === undefined ? {} : { status: sourceStatus }),
  };
  const staged = statusFabric.stageHmx({
    document: makeHmxDocument(exportId, { memories: [row] }),
    intent: 'port',
    strategy: 'additive',
  });
  assert.deepEqual(staged.conflicts, [], 'well-formed status metadata should stage: ' + String(sourceStatus));
  assert.equal(statusFabric.decideHmx(staged.stagingId, 'accept')?.status, 'accepted');
  assert.equal(statusFabric.decideHmx(staged.stagingId, 'apply')?.status, 'applied');
  const imported = statusRuntime.fabric.canonicalSnapshot().items.find(item => item.content === content);
  assert(imported, 'status fixture should be stored in canonical memory');
  assert.equal(imported.epistemicStatus, expectedStatus, 'status mapping: ' + String(sourceStatus));
  assert.equal(imported.context?.hexisOriginalStatus, sourceStatus ?? 'unknown',
    'original upstream status remains visible for inspection');
  assert.equal(imported.context?.hexisAppliedAuthorityCap, '0.65');
  assert(Number(imported.sourceAuthority01) <= 0.65, 'untrusted upstream cannot set canonical authority above the cap');
  assert.equal(statusFabric.snapshot().beliefs.some(belief => belief.memoryId === imported.id),
    expectedStatus === 'belief',
    'only active beliefs may populate the Hexis belief mirror');
  assert.equal(
    statusRuntime.semanticMemory.snapshot().nodes.some(node => node.sourceKey === imported.context?.hexisGraphSourceKey),
    expectedStatus === 'belief' || expectedStatus === 'hypothesis',
    'unknown/quarantined imports must not populate the active semantic graph',
  );
}

// A changed upstream memory with the same lineage/ref is a new version of one
// external record, not an unrelated fact. Old canonical rows remain as history,
// but their belief and source-scoped semantic projections must be withdrawn.
const supersessionRuntime = new MemorySubsystemRuntime();
const supersessionLedger = new HexisAdaptationFabric();
const supersessionProjector = new HexisCanonicalMemoryProjector(
  supersessionRuntime.fabric,
  supersessionRuntime.semanticMemory,
  supersessionLedger,
);
supersessionLedger.bindCanonicalMemoryApply(stage => supersessionProjector.apply(stage));
const applySupersessionVersion = (exportId, content) => {
  const stage = supersessionLedger.stageHmx({
    document: makeHmxDocument(exportId, {
      memories: [{
        ref: exportId + ':stable-memory-ref',
        type: 'semantic',
        content,
        status: 'active',
        trust_level: 0.99,
      }],
    }),
    intent: 'port',
    strategy: 'additive',
  });
  assert.deepEqual(stage.conflicts, []);
  assert.equal(supersessionLedger.decideHmx(stage.stagingId, 'accept')?.status, 'accepted');
  const applied = supersessionLedger.decideHmx(stage.stagingId, 'apply');
  assert.equal(applied?.status, 'applied');
  return {
    applied,
    memory: supersessionRuntime.fabric.canonicalSnapshot().items.find(item => item.content === content),
  };
};
const sourceVersionA = applySupersessionVersion(
  'exp_0000000000012345',
  'Source claim before correction.',
);
assert(sourceVersionA.memory);
assert.equal(sourceVersionA.memory.epistemicStatus, 'belief');
assert(supersessionLedger.snapshot().beliefs.some(belief => belief.memoryId === sourceVersionA.memory.id));
assert(supersessionRuntime.semanticMemory.snapshot().nodes.some(
  node => node.sourceKey === sourceVersionA.memory.context?.hexisGraphSourceKey,
));

const sourceVersionB = applySupersessionVersion(
  'exp_0000000000012346',
  'Corrected source claim after correction.',
);
assert(sourceVersionB.memory);
assert.notEqual(sourceVersionB.memory.id, sourceVersionA.memory.id);
const canonicalAfterCorrection = supersessionRuntime.fabric.canonicalSnapshot().items;
assert(canonicalAfterCorrection.some(item => item.id === sourceVersionA.memory.id),
  'superseded canonical content must remain available for history and temporal inspection');
assert.equal(canonicalAfterCorrection.find(item => item.id === sourceVersionA.memory.id)?.epistemicStatus, 'quarantined');
assert(supersessionLedger.temporalAt(sourceVersionA.memory.id, Number.MAX_SAFE_INTEGER),
  'superseding a belief must not erase its temporal assertion history');
assert.equal(sourceVersionB.memory.epistemicStatus, 'belief');
assert.equal(supersessionLedger.snapshot().beliefs.some(belief => belief.memoryId === sourceVersionA.memory.id), false,
  'superseded content must leave the active Hexis belief mirror');
assert(supersessionLedger.snapshot().beliefs.some(belief => belief.memoryId === sourceVersionB.memory.id));
const graphAfterCorrection = supersessionRuntime.semanticMemory.snapshot();
assert.equal(graphAfterCorrection.nodes.some(node => node.sourceKey === sourceVersionA.memory.context?.hexisGraphSourceKey), false,
  'superseded content must leave the active source-scoped semantic graph');
assert(graphAfterCorrection.nodes.some(node => node.sourceKey === sourceVersionB.memory.context?.hexisGraphSourceKey));
assert(sourceVersionB.applied.application.warnings.some(warning => warning.includes('superseded') && warning.includes('historical')),
  'the apply receipt must disclose that a previous canonical version was retired but retained');

const repeatedVersionB = applySupersessionVersion(
  'exp_0000000000012347',
  'Corrected source claim after correction.',
);
assert.equal(repeatedVersionB.applied.application.importedCount, 0,
  'same-content re-export remains idempotent');
assert.equal(repeatedVersionB.applied.application.deduplicatedCount, 1);
assert.equal(supersessionRuntime.fabric.canonicalSnapshot().items.filter(item => String(item.source ?? '').startsWith('hexis:')).length, 2,
  'same-content re-export must not create a third imported canonical record');
assert.equal(supersessionLedger.snapshot().beliefs.some(belief => belief.memoryId === sourceVersionA.memory.id), false);

const revertedVersionA = applySupersessionVersion(
  'exp_0000000000012348',
  'Source claim before correction.',
);
assert.equal(revertedVersionA.applied.application.importedCount, 0);
assert.equal(revertedVersionA.memory?.epistemicStatus, 'quarantined',
  'a later upstream reversion must not reactivate an old quarantined canonical record');
assert.equal(
  supersessionRuntime.fabric.canonicalSnapshot().items.find(item => item.id === sourceVersionB.memory.id)?.epistemicStatus,
  'quarantined',
  'a source reversion must also withdraw the more recent version rather than leaving it active',
);
assert.equal(supersessionLedger.snapshot().beliefs.some(
  belief => belief.memoryId === sourceVersionA.memory.id || belief.memoryId === sourceVersionB.memory.id,
), false, 'the source reversion must not resurrect either superseded claim as an active belief');
assert.equal(supersessionRuntime.semanticMemory.snapshot().nodes.some(
  node => node.sourceKey === sourceVersionA.memory.context?.hexisGraphSourceKey ||
    node.sourceKey === sourceVersionB.memory.context?.hexisGraphSourceKey,
), false, 'neither historical version may retain an active semantic projection after a reversion');

// Content correction must be one compensating transaction across canonical
// status, graph and belief mirror. Fault after demotion must restore the prior
// active version, and a retry of the same accepted stage must then complete once.
const correctionRollbackRuntime = new MemorySubsystemRuntime();
const correctionRollbackLedger = new HexisAdaptationFabric();
const correctionRollbackProjector = new HexisCanonicalMemoryProjector(
  correctionRollbackRuntime.fabric,
  correctionRollbackRuntime.semanticMemory,
  correctionRollbackLedger,
);
correctionRollbackLedger.bindCanonicalMemoryApply(stage => correctionRollbackProjector.apply(stage));
const correctionRollbackContentA = 'Claim before an injected correction failure.';
const applyCorrectionRollbackStage = (exportId, content) => {
  const stage = correctionRollbackLedger.stageHmx({
    document: makeHmxDocument(exportId, {
      memories: [{
        ref: exportId + ':correction-rollback-ref',
        type: 'semantic',
        content,
        status: 'active',
      }],
    }),
    intent: 'port',
    strategy: 'additive',
  });
  assert.deepEqual(stage.conflicts, []);
  assert.equal(correctionRollbackLedger.decideHmx(stage.stagingId, 'accept')?.status, 'accepted');
  return stage;
};
const seedCorrectionRollback = applyCorrectionRollbackStage(
  'exp_0000000000012351', correctionRollbackContentA,
);
assert.equal(correctionRollbackLedger.decideHmx(seedCorrectionRollback.stagingId, 'apply')?.status, 'applied');
const priorCorrectionMemory = correctionRollbackRuntime.fabric.canonicalSnapshot().items.find(
  item => item.content === correctionRollbackContentA,
);
assert.equal(priorCorrectionMemory?.epistemicStatus, 'belief');
const correctedCorrectionStage = applyCorrectionRollbackStage(
  'exp_0000000000012352', 'Corrected claim after an injected failure.',
);
const realRemoveCorrectionBelief = correctionRollbackLedger.removeBeliefProjection.bind(correctionRollbackLedger);
correctionRollbackLedger.removeBeliefProjection = () => {
  throw new Error('injected-source-correction-ledger-failure');
};
assert.throws(
  () => correctionRollbackLedger.decideHmx(correctedCorrectionStage.stagingId, 'apply'),
  /hmx-canonical-apply-failed:injected-source-correction-ledger-failure/,
  'a downstream projection failure during source correction must be surfaced',
);
assert.equal(correctionRollbackLedger.getHmxStage(correctedCorrectionStage.stagingId)?.status, 'accepted');
assert.equal(correctionRollbackLedger.getHmxStage(correctedCorrectionStage.stagingId)?.applicationAttempts, 1);
const priorAfterCorrectionFailure = correctionRollbackRuntime.fabric.canonicalSnapshot().items.find(
  item => item.id === priorCorrectionMemory.id,
);
assert.equal(priorAfterCorrectionFailure?.epistemicStatus, 'belief',
  'failed source correction must restore the old canonical status');
assert(correctionRollbackRuntime.semanticMemory.snapshot().nodes.some(
  node => node.sourceKey === priorCorrectionMemory.context?.hexisGraphSourceKey,
), 'failed source correction must restore the old semantic node');
assert(correctionRollbackLedger.snapshot().beliefs.some(
  belief => belief.memoryId === priorCorrectionMemory.id,
), 'failed source correction must restore the old belief projection');
assert.equal(
  correctionRollbackRuntime.fabric.canonicalSnapshot().items.filter(item => String(item.source ?? '').startsWith('hexis:')).length,
  1,
  'failed source correction must not leave a half-inserted new version',
);
correctionRollbackLedger.removeBeliefProjection = realRemoveCorrectionBelief;
assert.equal(correctionRollbackLedger.decideHmx(correctedCorrectionStage.stagingId, 'apply')?.status, 'applied',
  'the accepted correction stage must be retryable after complete compensation');
assert.equal(correctionRollbackLedger.getHmxStage(correctedCorrectionStage.stagingId)?.applicationAttempts, 2);
const correctedCorrectionMemory = correctionRollbackRuntime.fabric.canonicalSnapshot().items.find(
  item => item.content === 'Corrected claim after an injected failure.',
);
assert(correctedCorrectionMemory);
assert.equal(correctedCorrectionMemory.epistemicStatus, 'belief');
assert.equal(
  correctionRollbackRuntime.fabric.canonicalSnapshot().items.find(item => item.id === priorCorrectionMemory.id)?.epistemicStatus,
  'quarantined',
);
assert.equal(
  correctionRollbackRuntime.fabric.canonicalSnapshot().items.filter(item => String(item.source ?? '').startsWith('hexis:')).length,
  2,
  'successful retry must contain exactly the previous history row and its replacement',
);

// Type metadata is canonical meaning, not decoration. A type-only reclassification
// must version the memory, update the canonical kind and withdraw the old graph/belief
// projection without changing the source text or multiplying rows on re-export.
const typeReclassificationRuntime = new MemorySubsystemRuntime();
const typeReclassificationLedger = new HexisAdaptationFabric();
const typeReclassificationProjector = new HexisCanonicalMemoryProjector(
  typeReclassificationRuntime.fabric,
  typeReclassificationRuntime.semanticMemory,
  typeReclassificationLedger,
);
typeReclassificationLedger.bindCanonicalMemoryApply(stage => typeReclassificationProjector.apply(stage));
const typeReclassificationContent = 'The source keeps this phrase while changing its memory type.';
const applyTypeReclassification = (exportId, type) => {
  const stage = typeReclassificationLedger.stageHmx({
    document: makeHmxDocument(exportId, {
      memories: [{
        ref: exportId + ':stable-typed-ref',
        type,
        content: typeReclassificationContent,
        status: 'active',
      }],
    }),
    intent: 'port',
    strategy: 'additive',
  });
  assert.deepEqual(stage.conflicts, []);
  assert.equal(typeReclassificationLedger.decideHmx(stage.stagingId, 'accept')?.status, 'accepted');
  const applied = typeReclassificationLedger.decideHmx(stage.stagingId, 'apply');
  assert.equal(applied?.status, 'applied');
  const ids = applied.application.memoryIds;
  const memory = typeReclassificationRuntime.fabric.canonicalSnapshot().items.find(item =>
    ids.includes(item.id) && String(item.context?.hexisOriginalType ?? '').toLowerCase() === type,
  );
  return { applied, memory };
};
const semanticTypeVersion = applyTypeReclassification('exp_0000000000012361', 'semantic');
assert(semanticTypeVersion.memory);
assert.equal(semanticTypeVersion.memory.kind, 'semantic');
assert.equal(semanticTypeVersion.memory.epistemicStatus, 'belief');
const proceduralTypeVersion = applyTypeReclassification('exp_0000000000012362', 'procedural');
assert(proceduralTypeVersion.memory);
assert.notEqual(proceduralTypeVersion.memory.id, semanticTypeVersion.memory.id,
  'a type-only correction must create a distinct canonical version');
assert.equal(proceduralTypeVersion.memory.kind, 'procedural',
  'the revised upstream type must reach the canonical MemoryOS kind');
assert.equal(
  typeReclassificationRuntime.fabric.canonicalSnapshot().items.find(item => item.id === semanticTypeVersion.memory.id)?.epistemicStatus,
  'quarantined',
  'the old canonical kind must remain as quarantined history',
);
assert.equal(typeReclassificationLedger.snapshot().beliefs.some(belief => belief.memoryId === semanticTypeVersion.memory.id), false);
assert(typeReclassificationLedger.snapshot().beliefs.some(belief => belief.memoryId === proceduralTypeVersion.memory.id));
assert.equal(typeReclassificationRuntime.semanticMemory.snapshot().nodes.some(
  node => node.sourceKey === semanticTypeVersion.memory.context?.hexisGraphSourceKey,
), false, 'the prior type projection must be removed from the active graph');
assert(typeReclassificationRuntime.semanticMemory.snapshot().nodes.some(
  node => node.sourceKey === proceduralTypeVersion.memory.context?.hexisGraphSourceKey,
));
const repeatedProceduralType = applyTypeReclassification('exp_0000000000012363', 'procedural');
assert.equal(repeatedProceduralType.applied.application.importedCount, 0);
assert.equal(repeatedProceduralType.applied.application.deduplicatedCount, 1);
assert.equal(typeReclassificationRuntime.fabric.canonicalSnapshot().items.filter(
  item => String(item.source ?? '').startsWith('hexis:'),
).length, 2, 're-export of the new type must reuse the matching version instead of duplicating it');

// Migration regression: a pre-existing persisted HMX row can carry values written by
// the older permissive importer. A replay under the new policy must cap both the
// canonical signal and its external evidence trail, not just new inserts.
const legacyTrustRuntime = new MemorySubsystemRuntime();
const legacyTrustLedger = new HexisAdaptationFabric();
const legacyTrustProjector = new HexisCanonicalMemoryProjector(
  legacyTrustRuntime.fabric, legacyTrustRuntime.semanticMemory, legacyTrustLedger,
);
legacyTrustLedger.bindCanonicalMemoryApply(stage => legacyTrustProjector.apply(stage));
const legacyTrustContent = 'Persisted HMX memory predating the authority cap.';
const applyLegacyTrust = exportId => {
  const stage = legacyTrustLedger.stageHmx({
    document: makeHmxDocument(exportId, {
      memories: [{
        ref: exportId + ':legacy-trust-record',
        type: 'semantic',
        content: legacyTrustContent,
        status: 'active',
        trust_level: 0.99,
      }],
    }),
    intent: 'port',
    strategy: 'additive',
  });
  assert.deepEqual(stage.conflicts, []);
  assert.equal(legacyTrustLedger.decideHmx(stage.stagingId, 'accept')?.status, 'accepted');
  assert.equal(legacyTrustLedger.decideHmx(stage.stagingId, 'apply')?.status, 'applied');
};
applyLegacyTrust('exp_0000000000009201');
const importedLegacyTrust = legacyTrustRuntime.fabric.canonicalSnapshot().items.find(item => item.content === legacyTrustContent);
assert(importedLegacyTrust);
const legacyMemorySnapshot = legacyTrustRuntime.memoryOS.snapshot();
legacyTrustRuntime.memoryOS.restore({
  ...legacyMemorySnapshot,
  items: legacyMemorySnapshot.items.map(item => item.id === importedLegacyTrust.id ? {
    ...item,
    confidence: 0.99,
    sourceAuthority01: 0.99,
    evidenceSources: (item.evidenceSources ?? []).map(evidence => ({ ...evidence, sourceAuthority01: 0.99 })),
  } : item),
});
const overTrustedSnapshot = legacyTrustRuntime.fabric.canonicalSnapshot().items.find(item => item.id === importedLegacyTrust.id);
assert.equal(overTrustedSnapshot?.confidence, 0.99, 'fixture emulates a persisted pre-policy import');
assert.equal(overTrustedSnapshot?.sourceAuthority01, 0.99);
// Emulate a persisted pre-cap Hexis mirror too. Re-import must lower this derived
// trust mirror to the corrected canonical values, without treating the update as
// a new source/evidence observation.
const staleLegacyBeliefSnapshot = legacyTrustLedger.snapshot();
legacyTrustLedger.restore({
  ...staleLegacyBeliefSnapshot,
  beliefs: staleLegacyBeliefSnapshot.beliefs.map(belief => belief.memoryId === importedLegacyTrust.id
    ? { ...belief, confidence01: 0.99, trust01: 0.99 }
    : belief),
});
applyLegacyTrust('exp_0000000000009202');
const remediatedLegacyBelief = legacyTrustLedger.snapshot().beliefs.find(
  belief => belief.memoryId === importedLegacyTrust.id,
);
assert.equal(remediatedLegacyBelief?.confidence01, 0.65,
  're-import must lower stale mirrored belief confidence to the canonical cap');
assert.equal(remediatedLegacyBelief?.trust01, 0.65,
  're-import must lower stale mirrored trust to the canonical authority cap');
const remediatedLegacyTrust = legacyTrustRuntime.fabric.canonicalSnapshot().items.find(item => item.id === importedLegacyTrust.id);
assert(remediatedLegacyTrust);
assert.equal(remediatedLegacyTrust.confidence, 0.65, 're-import must cap an old persisted confidence');
assert.equal(remediatedLegacyTrust.sourceAuthority01, 0.65, 're-import must cap old canonical authority');
assert((remediatedLegacyTrust.evidenceSources ?? [])
  .filter(evidence => evidence.provenanceClass === 'external' && String(evidence.source ?? '').startsWith('hexis:'))
  .every(evidence => evidence.sourceAuthority01 <= 0.65),
  're-import must cap old external evidence authorities too');

// A rollback must not refresh a previously sealed expected-current snapshot after a
// later subsystem has independently changed that same canonical memory. Failing closed
// preserves the independent update instead of restoring stale trust over it.
const concurrentBaseline = legacyTrustRuntime.memoryOS.snapshot();
legacyTrustRuntime.memoryOS.restore({
  ...concurrentBaseline,
  items: concurrentBaseline.items.map(item => item.id === importedLegacyTrust.id ? {
    ...item,
    confidence: 0.99,
    sourceAuthority01: 0.99,
    evidenceSources: (item.evidenceSources ?? []).map(evidence => ({ ...evidence, sourceAuthority01: 0.99 })),
  } : item),
});
const concurrentStage = legacyTrustLedger.stageHmx({
  document: makeHmxDocument('exp_0000000000009203', {
    memories: [{
      ref: 'exp_0000000000009203:legacy-trust-record',
      type: 'semantic',
      content: legacyTrustContent,
      status: 'active',
      trust_level: 0.99,
    }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(concurrentStage.conflicts, []);
assert.equal(legacyTrustLedger.decideHmx(concurrentStage.stagingId, 'accept')?.status, 'accepted');
const realRegisterConcurrentBelief = legacyTrustLedger.registerOrUpdateBelief.bind(legacyTrustLedger);
legacyTrustLedger.registerOrUpdateBelief = () => {
  legacyTrustRuntime.fabric.updateSignals(
    importedLegacyTrust.id,
    { confidence: 0.61, sourceAuthority01: 0.61 },
    'independent-update-after-hmx-signal-seal',
    { commandId: 'test:independent-update-after-seal' },
  );
  throw new Error('injected-concurrent-memory-update');
};
assert.throws(
  () => legacyTrustLedger.decideHmx(concurrentStage.stagingId, 'apply'),
  /hmx-canonical-apply-failed:injected-concurrent-memory-update;rollback-failures=.*memory-signal-compensation-conflict/,
  'rollback must report a conflict instead of silently overwriting a post-seal canonical update',
);
legacyTrustLedger.registerOrUpdateBelief = realRegisterConcurrentBelief;
const concurrentAfterFailure = legacyTrustRuntime.fabric.canonicalSnapshot().items.find(item => item.id === importedLegacyTrust.id);
assert.equal(concurrentAfterFailure?.confidence, 0.61,
  'a failed HMX rollback must not overwrite the independent post-seal confidence update');
assert.equal(concurrentAfterFailure?.sourceAuthority01, 0.61,
  'a failed HMX rollback must not overwrite the independent post-seal authority update');

// A re-export may demote the same memory, but an active-looking later export must
// never resurrect a source that was already archived/quarantined.
const transitionRuntime = new MemorySubsystemRuntime();
const transitionLedger = new HexisAdaptationFabric();
const transitionProjector = new HexisCanonicalMemoryProjector(
  transitionRuntime.fabric, transitionRuntime.semanticMemory, transitionLedger,
);
transitionLedger.bindCanonicalMemoryApply(stage => transitionProjector.apply(stage));
const transitionContent = 'Same source memory whose upstream lifecycle changes.';
const applyTransition = (exportId, status) => {
  const stage = transitionLedger.stageHmx({
    document: makeHmxDocument(exportId, {
      memories: [{ ref: exportId + ':same-memory', type: 'semantic', content: transitionContent, status }],
    }),
    intent: 'port',
    strategy: 'additive',
  });
  assert.deepEqual(stage.conflicts, []);
  assert.equal(transitionLedger.decideHmx(stage.stagingId, 'accept')?.status, 'accepted');
  assert.equal(transitionLedger.decideHmx(stage.stagingId, 'apply')?.status, 'applied');
};
applyTransition('exp_0000000000009001', 'active');
const beforeArchive = transitionRuntime.fabric.canonicalSnapshot().items.find(item => item.content === transitionContent);
assert.equal(beforeArchive?.epistemicStatus, 'belief');
assert(transitionLedger.snapshot().beliefs.some(belief => belief.memoryId === beforeArchive.id));
assert(transitionRuntime.semanticMemory.snapshot().nodes.some(node => node.sourceKey === beforeArchive.context?.hexisGraphSourceKey));
applyTransition('exp_0000000000009002', 'archived');
const afterArchive = transitionRuntime.fabric.canonicalSnapshot().items.find(item => item.content === transitionContent);
assert.equal(afterArchive?.id, beforeArchive?.id, 'status changes must not duplicate canonical memory');
assert.equal(afterArchive?.epistemicStatus, 'quarantined', 'archiving must demote the canonical memory');
assert.equal(transitionLedger.snapshot().beliefs.some(belief => belief.memoryId === afterArchive.id), false,
  'archived memory must leave the active belief mirror');
assert.equal(transitionRuntime.semanticMemory.snapshot().nodes.some(node => node.sourceKey === afterArchive.context?.hexisGraphSourceKey), false,
  'archived memory must leave the active semantic graph');
applyTransition('exp_0000000000009003', 'active');
const afterReimport = transitionRuntime.fabric.canonicalSnapshot().items.find(item => item.content === transitionContent);
assert.equal(afterReimport?.id, beforeArchive?.id);
assert.equal(afterReimport?.epistemicStatus, 'quarantined',
  'a later active-looking export must not silently reactivate quarantined memory');
assert.equal(transitionLedger.snapshot().beliefs.some(belief => belief.memoryId === afterReimport.id), false);

// Inject a downstream failure after the canonical status was demoted. The projector
// must restore that pre-existing memory, graph, and belief mirror, then retry with
// a fresh mutation receipt key for the next apply attempt.
const failedApplyRuntime = new MemorySubsystemRuntime();
const failedApplyLedger = new HexisAdaptationFabric();
const failedApplyProjector = new HexisCanonicalMemoryProjector(
  failedApplyRuntime.fabric, failedApplyRuntime.semanticMemory, failedApplyLedger,
);
failedApplyLedger.bindCanonicalMemoryApply(stage => failedApplyProjector.apply(stage));
const failedApplyContent = 'Existing canonical memory for rollback proof.';
const initialFailedApplyStage = failedApplyLedger.stageHmx({
  document: makeHmxDocument('exp_0000000000009101', {
    memories: [{ ref: 'exp_0000000000009101:rollback-memory', type: 'semantic', content: failedApplyContent, status: 'active' }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(failedApplyLedger.decideHmx(initialFailedApplyStage.stagingId, 'accept')?.status, 'accepted');
assert.equal(failedApplyLedger.decideHmx(initialFailedApplyStage.stagingId, 'apply')?.status, 'applied');
const beforeInjectedFailure = failedApplyRuntime.fabric.canonicalSnapshot().items.find(item => item.content === failedApplyContent);
assert.equal(beforeInjectedFailure?.epistemicStatus, 'belief');
const archivedFailedStage = failedApplyLedger.stageHmx({
  document: makeHmxDocument('exp_0000000000009102', {
    memories: [{ ref: 'exp_0000000000009102:rollback-memory', type: 'semantic', content: failedApplyContent, status: 'archived' }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(failedApplyLedger.decideHmx(archivedFailedStage.stagingId, 'accept')?.status, 'accepted');
failedApplyLedger.removeBeliefProjection = () => { throw new Error('injected-belief-mirror-failure'); };
assert.throws(() => failedApplyLedger.decideHmx(archivedFailedStage.stagingId, 'apply'), /hmx-canonical-apply-failed:injected-belief-mirror-failure/);
const afterInjectedFailure = failedApplyRuntime.fabric.canonicalSnapshot().items.find(item => item.content === failedApplyContent);
assert.equal(afterInjectedFailure?.id, beforeInjectedFailure?.id);
assert.equal(afterInjectedFailure?.epistemicStatus, 'belief',
  'failed HMX apply must restore an existing memory status');
assert(failedApplyRuntime.semanticMemory.snapshot().nodes.some(node => node.sourceKey === beforeInjectedFailure.context?.hexisGraphSourceKey),
  'failed HMX apply must restore the previous graph projection');
assert(failedApplyLedger.snapshot().beliefs.some(belief => belief.memoryId === beforeInjectedFailure.id),
  'failed HMX apply must restore the previous active belief mirror');
failedApplyLedger.removeBeliefProjection = HexisAdaptationFabric.prototype.removeBeliefProjection;
assert.equal(failedApplyLedger.decideHmx(archivedFailedStage.stagingId, 'apply')?.status, 'applied',
  'a compensated stage must retry with a fresh command identity');
const afterSuccessfulRetry = failedApplyRuntime.fabric.canonicalSnapshot().items.find(item => item.content === failedApplyContent);
assert.equal(afterSuccessfulRetry?.id, beforeInjectedFailure?.id);
assert.equal(afterSuccessfulRetry?.epistemicStatus, 'quarantined');

// A failed HMX import must restore pre-existing memory confidence and provenance signals.
const signalRollbackRuntime = new MemorySubsystemRuntime();
const signalRollbackHexis = new HexisAdaptationFabric();
let failTemporalProjection = false;
const failingTemporalLedger = new Proxy(signalRollbackHexis, {
  get(target, property) {
    if (property === 'recordTemporalAssertion') {
      return (...args) => {
        if (failTemporalProjection) throw new Error('injected-hmx-temporal-ledger-failure');
        return target.recordTemporalAssertion(...args);
      };
    }
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
const signalRollbackProjector = new HexisCanonicalMemoryProjector(
  signalRollbackRuntime.fabric,
  signalRollbackRuntime.semanticMemory,
  failingTemporalLedger,
);
signalRollbackHexis.bindCanonicalMemoryApply(candidate => signalRollbackProjector.apply(candidate));
const seedSignalExportId = 'exp_0000000000009201';
const signalRollbackContent = 'Pre-existing imported memory must recover its exact trust snapshot.';
const seedSignalStage = signalRollbackHexis.stageHmx({
  document: makeHmxDocument(seedSignalExportId, {
    memories: [{
      ref: seedSignalExportId + ':memory-existing',
      type: 'semantic',
      content: signalRollbackContent,
      status: 'active',
      trust_level: 0.95,
    }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(signalRollbackHexis.decideHmx(seedSignalStage.stagingId, 'accept')?.status, 'accepted');
assert.equal(signalRollbackHexis.decideHmx(seedSignalStage.stagingId, 'apply')?.status, 'applied');
const seededSignalMemory = signalRollbackRuntime.fabric.canonicalSnapshot().items.find(item =>
  item.source.startsWith('hexis:') && item.content === signalRollbackContent,
);
assert(seededSignalMemory, 'the first accepted HMX import must create the canonical memory');
assert.equal(seededSignalMemory.confidence, 0.65, 'external trust must start under the import authority cap');
assert.equal(seededSignalMemory.sourceAuthority01, 0.65);
assert(seededSignalMemory.evidenceSources?.some(source => source.sourceAuthority01 === 0.65));

signalRollbackRuntime.fabric.updateSignals(
  seededSignalMemory.id,
  { confidence: 0.95 },
  'seed-legacy-overconfidence-for-rollback-regression',
  { commandId: 'test-hmx-signal-rollback-seed-confidence' },
);
const signalSnapshot = memory => ({
  confidence: memory.confidence,
  epistemicStatus: memory.epistemicStatus,
  sourceAuthority01: memory.sourceAuthority01,
  evidenceSources: memory.evidenceSources === undefined ? undefined : structuredClone(memory.evidenceSources),
  evidenceLineageKeys: memory.evidenceLineageKeys === undefined ? undefined : [...memory.evidenceLineageKeys],
  lastAccessAt: memory.lastAccessAt,
  temperature01: memory.temperature01,
  revisionHistory: structuredClone(memory.revisionHistory ?? []),
});
const beforeSignalRollback = signalSnapshot(
  signalRollbackRuntime.fabric.canonicalSnapshot().items.find(item => item.id === seededSignalMemory.id),
);
assert.equal(beforeSignalRollback.confidence, 0.95, 'fixture models older over-confident persisted state');
const failedSignalExportId = 'exp_0000000000009202';
const failedSignalStage = signalRollbackHexis.stageHmx({
  document: makeHmxDocument(failedSignalExportId, {
    memories: [
      {
        ref: failedSignalExportId + ':memory-existing',
        type: 'semantic',
        content: signalRollbackContent,
        status: 'archived',
        trust_level: 0.45,
      },
      {
        ref: failedSignalExportId + ':memory-new',
        type: 'semantic',
        content: 'This second row forces temporal projection after trust reconciliation.',
        status: 'active',
        trust_level: 0.45,
      },
    ],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(signalRollbackHexis.decideHmx(failedSignalStage.stagingId, 'accept')?.status, 'accepted');
failTemporalProjection = true;
assert.throws(
  () => signalRollbackHexis.decideHmx(failedSignalStage.stagingId, 'apply'),
  /hmx-canonical-apply-failed:injected-hmx-temporal-ledger-failure/,
);
const restoredSignalMemory = signalRollbackRuntime.fabric.canonicalSnapshot().items.find(item =>
  item.id === seededSignalMemory.id,
);
assert(restoredSignalMemory, 'the previously persisted memory must remain present after compensation');
assert.deepEqual(signalSnapshot(restoredSignalMemory), beforeSignalRollback,
  'failed downstream projection must restore status, confidence, authority, evidence trail, access state, and revision history');
assert.equal(restoredSignalMemory.epistemicStatus, beforeSignalRollback.epistemicStatus,
  'combined status demotion and authority capping must roll back in one operation');
assert.equal(
  signalRollbackRuntime.fabric.canonicalSnapshot().items.some(item => item.content === 'This second row forces temporal projection after trust reconciliation.'),
  false,
  'the newly inserted row in the failed batch must also be rolled back',
);
assert.equal(signalRollbackHexis.getHmxStage(failedSignalStage.stagingId)?.status, 'accepted',
  'the compensated HMX stage remains retryable and is not marked applied');
assert.equal(signalRollbackRuntime.fabric.inspect().pendingSignalCompensations, 0,
  'failed-transaction compensation must consume all rollback capabilities');

 // If a status update commits and then its adapter throws, the pre-mutation token
 // must still restore the status and revision history exactly.
const beforeStatusMutationFailure = signalSnapshot(
  signalRollbackRuntime.fabric.canonicalSnapshot().items.find(item => item.id === seededSignalMemory.id),
);
const statusMutationFailureExportId = 'exp_0000000000009204';
const statusMutationFailureStage = signalRollbackHexis.stageHmx({
  document: makeHmxDocument(statusMutationFailureExportId, {
    memories: [{
      ref: statusMutationFailureExportId + ':memory-existing',
      type: 'semantic',
      content: signalRollbackContent,
      status: 'archived',
      trust_level: 0.45,
    }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(signalRollbackHexis.decideHmx(statusMutationFailureStage.stagingId, 'accept')?.status, 'accepted');
const originalSignalRollbackRevise = signalRollbackRuntime.fabric.revise.bind(signalRollbackRuntime.fabric);
let injectStatusAfterMutation = true;
signalRollbackRuntime.fabric.revise = (...args) => {
  const result = originalSignalRollbackRevise(...args);
  if (injectStatusAfterMutation && args[1] === 'quarantined') {
    injectStatusAfterMutation = false;
    throw new Error('injected-hmx-status-after-mutation');
  }
  return result;
};
assert.throws(
  () => signalRollbackHexis.decideHmx(statusMutationFailureStage.stagingId, 'apply'),
  /hmx-canonical-apply-failed:injected-hmx-status-after-mutation/,
);
signalRollbackRuntime.fabric.revise = originalSignalRollbackRevise;
const restoredAfterStatusMutationFailure = signalRollbackRuntime.fabric.canonicalSnapshot().items.find(item => item.id === seededSignalMemory.id);
assert(restoredAfterStatusMutationFailure);
assert.deepEqual(
  signalSnapshot(restoredAfterStatusMutationFailure),
  beforeStatusMutationFailure,
  'a partially committed status mutation must restore original status and revision history',
);
assert.equal(signalRollbackRuntime.fabric.inspect().pendingSignalCompensations, 0);
assert.equal(signalRollbackHexis.getHmxStage(statusMutationFailureStage.stagingId)?.status, 'accepted');



assert.throws(
  () => signalRollbackRuntime.fabric.restoreSignalsForCompensation(
    'forged-compensation-token',
    'must-not-restore-arbitrary-trust-state',
    { commandId: 'test-forged-signal-restore' },
  ),
  /memory-signal-compensation-token-invalid/,
  'the compensation API must reject caller-invented tokens rather than accept arbitrary snapshots',
);
assert.deepEqual(
  signalSnapshot(signalRollbackRuntime.fabric.canonicalSnapshot().items.find(item => item.id === seededSignalMemory.id)),
  beforeSignalRollback,
  'an invalid compensation token must not mutate canonical trust state',
);

const successfulCapExportId = 'exp_0000000000009203';
const successfulCapStage = signalRollbackHexis.stageHmx({
  document: makeHmxDocument(successfulCapExportId, {
    memories: [{
      ref: successfulCapExportId + ':memory-existing',
      type: 'semantic',
      content: signalRollbackContent,
      status: 'active',
      trust_level: 0.45,
    }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(signalRollbackHexis.decideHmx(successfulCapStage.stagingId, 'accept')?.status, 'accepted');
assert.equal(signalRollbackHexis.decideHmx(successfulCapStage.stagingId, 'apply')?.status, 'applied',
  'a successful trust reconciliation commits the HMX stage');
const cappedAfterSuccessfulApply = signalRollbackRuntime.fabric.canonicalSnapshot().items.find(item => item.id === seededSignalMemory.id);
assert.equal(cappedAfterSuccessfulApply?.confidence, 0.45);
assert.equal(cappedAfterSuccessfulApply?.sourceAuthority01, 0.45);
assert.equal(signalRollbackRuntime.fabric.inspect().pendingSignalCompensations, 0,
  'successful transaction must revoke rollback tokens rather than leak them');

// The bounded journal must fail closed instead of silently evicting a live token.
// An import that needs more active rollback snapshots will abort before mutating
// its next duplicate, then still be able to compensate every earlier duplicate.
const signalCompensationCapacityTokens = [];
for (let index = 0; index < 512; index++) {
  const token = signalRollbackRuntime.fabric.beginSignalCompensation(seededSignalMemory.id);
  assert.equal(typeof token, 'string', 'capacity must admit every token within its configured bound');
  signalCompensationCapacityTokens.push(token);
}
assert.equal(
  signalRollbackRuntime.fabric.beginSignalCompensation(seededSignalMemory.id),
  null,
  'capacity exhaustion must stop new compensation issuance rather than evict an active rollback token',
);
assert.equal(signalRollbackRuntime.fabric.inspect().pendingSignalCompensations, 512);
for (const token of signalCompensationCapacityTokens) {
  assert.equal(signalRollbackRuntime.fabric.commitSignalCompensation(token), true);
}
assert.equal(signalRollbackRuntime.fabric.inspect().pendingSignalCompensations, 0);

// Pending rollback tokens are intentionally process-local and must not survive
// restoring a persisted snapshot that contains no such capabilities.
const transientSignalCompensationToken = signalRollbackRuntime.fabric.beginSignalCompensation(seededSignalMemory.id);
assert.equal(typeof transientSignalCompensationToken, 'string');
const postCompensationMemoryFabricSnapshot = signalRollbackRuntime.fabric.snapshot();
signalRollbackRuntime.fabric.restore(postCompensationMemoryFabricSnapshot);
assert.equal(signalRollbackRuntime.fabric.inspect().pendingSignalCompensations, 0,
  'snapshot restoration must revoke non-persisted rollback capabilities');
assert.throws(
  () => signalRollbackRuntime.fabric.restoreSignalsForCompensation(
    transientSignalCompensationToken,
    'must-not-use-pre-restore-capability',
    { commandId: 'test-pre-restore-signal-compensation' },
  ),
  /memory-signal-compensation-token-invalid/,
  'a capability from before restore must be unusable after restore',
);
assert.equal(signalRollbackRuntime.fabric.inspect().mutationReceiptJournal.corrupt, false,
  'the new compensating lifecycle receipt must survive snapshot/restore validation');

// The convenience API must also compensate if updateSignals mutates canonical
// state and the caller-facing adapter then throws before returning the receipt.
const beforeHelperFailure = signalSnapshot(
  signalRollbackRuntime.fabric.canonicalSnapshot().items.find(item => item.id === seededSignalMemory.id),
);
const originalHelperFailureUpdateSignals = signalRollbackRuntime.fabric.updateSignals.bind(signalRollbackRuntime.fabric);
let injectHelperFailureAfterMutation = true;
signalRollbackRuntime.fabric.updateSignals = (...args) => {
  const result = originalHelperFailureUpdateSignals(...args);
  if (injectHelperFailureAfterMutation) {
    injectHelperFailureAfterMutation = false;
    throw new Error('injected-helper-failure-after-signal-mutation');
  }
  return result;
};
assert.throws(
  () => signalRollbackRuntime.fabric.updateSignalsWithCompensation(
    seededSignalMemory.id,
    { confidence: 0.2 },
    'rollback-helper-failure-regression',
    { commandId: 'test-helper-failure-after-signal-mutation' },
  ),
  /injected-helper-failure-after-signal-mutation/,
);
signalRollbackRuntime.fabric.updateSignals = originalHelperFailureUpdateSignals;
assert.deepEqual(
  signalSnapshot(signalRollbackRuntime.fabric.canonicalSnapshot().items.find(item => item.id === seededSignalMemory.id)),
  beforeHelperFailure,
  'the convenience helper must restore the exact pre-state after a post-mutation exception',
);
assert.equal(signalRollbackRuntime.fabric.inspect().pendingSignalCompensations, 0,
  'the convenience helper must not leak a token after successful compensation');

// A status command can commit before an outer adapter throws. If another writer then
// changes the same memory, rollback must detect the sealed-state conflict and must not
// use a second status-only path to overwrite that newer signal.
const conflictedStatusExportId = 'exp_0000000000009205';
const conflictedStatusStage = signalRollbackHexis.stageHmx({
  document: makeHmxDocument(conflictedStatusExportId, {
    memories: [{
      ref: conflictedStatusExportId + ':memory-existing',
      type: 'semantic',
      content: signalRollbackContent,
      status: 'archived',
      trust_level: 0.45,
    }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(signalRollbackHexis.decideHmx(conflictedStatusStage.stagingId, 'accept')?.status, 'accepted');
const originalConflictRevise = signalRollbackRuntime.fabric.revise.bind(signalRollbackRuntime.fabric);
const originalConflictUpdateSignals = signalRollbackRuntime.fabric.updateSignals.bind(signalRollbackRuntime.fabric);
let injectConcurrentSignalAfterStatus = true;
signalRollbackRuntime.fabric.revise = (...args) => {
  const result = originalConflictRevise(...args);
  if (injectConcurrentSignalAfterStatus && args[1] === 'quarantined') {
    injectConcurrentSignalAfterStatus = false;
    originalConflictUpdateSignals(
      seededSignalMemory.id,
      { confidence: 0.31 },
      'independent-update-after-status-commit',
      { commandId: 'test:independent-update-after-status-commit' },
    );
    throw new Error('injected-hmx-status-after-independent-update');
  }
  return result;
};
assert.throws(
  () => signalRollbackHexis.decideHmx(conflictedStatusStage.stagingId, 'apply'),
  /hmx-canonical-apply-failed:injected-hmx-status-after-independent-update;rollback-failures=.*memory-signal-compensation-conflict/,
  'rollback must fail closed when the current row diverges after a committed status mutation',
);
signalRollbackRuntime.fabric.revise = originalConflictRevise;
const conflictedStatusMemory = signalRollbackRuntime.fabric.canonicalSnapshot().items.find(item => item.id === seededSignalMemory.id);
assert.equal(conflictedStatusMemory?.confidence, 0.31,
  'conflict handling must preserve the independent confidence written after the status mutation');
assert.equal(conflictedStatusMemory?.epistemicStatus, 'quarantined',
  'a status compensation conflict must not be bypassed by an unguarded status-only rollback');
assert.equal(signalRollbackRuntime.fabric.inspect().pendingSignalCompensations, 0,
  'conflicted rollback must consume the one-shot compensation capability');


// Whole-snapshot rollback of the semantic graph and temporal ledger must fail closed
// if an independent write lands during a downstream adapter failure.
const scopedRollbackRuntime = new MemorySubsystemRuntime();
const scopedRollbackLedger = new HexisAdaptationFabric();
let injectForeignProjectionWrites = true;
const originalScopedTemporalRecord = scopedRollbackLedger.recordTemporalAssertion.bind(scopedRollbackLedger);
const scopedTemporalLedgerAdapter = new Proxy(scopedRollbackLedger, {
  get(target, property) {
    if (property === 'recordTemporalAssertion') {
      return (...args) => {
        if (injectForeignProjectionWrites) {
          injectForeignProjectionWrites = false;
          scopedRollbackRuntime.semanticMemory.upsertNode(
            'independent projection survives failed HMX apply',
            'concept',
            0.99,
            'test:external-projection-write',
          );
          // This first write belongs to the HMX transaction; the second deliberately
          // has no owner token and must prevent restoring the pre-transaction snapshot.
          originalScopedTemporalRecord(...args);
          originalScopedTemporalRecord({
            memoryId: 'external-temporal-write',
            summary: 'Independent temporal assertion written during failed projection.',
            confidence01: 0.9,
            validFrom: Date.now(),
            source: 'test:external-temporal-write',
          });
          throw new Error('injected-independent-projection-mutation');
        }
        return originalScopedTemporalRecord(...args);
      };
    }
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
const scopedRollbackProjector = new HexisCanonicalMemoryProjector(
  scopedRollbackRuntime.fabric,
  scopedRollbackRuntime.semanticMemory,
  scopedTemporalLedgerAdapter,
);
scopedRollbackLedger.bindCanonicalMemoryApply(stage => scopedRollbackProjector.apply(stage));
const scopedRollbackExportId = 'exp_0000000000009206';
const scopedRollbackStage = scopedRollbackLedger.stageHmx({
  document: makeHmxDocument(scopedRollbackExportId, {
    memories: [{
      ref: scopedRollbackExportId + ':memory-new',
      type: 'semantic',
      content: 'Canonical fact whose graph and temporal projection race must fail closed.',
      status: 'active',
      trust_level: 0.45,
    }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(scopedRollbackStage.conflicts, []);
assert.equal(scopedRollbackLedger.decideHmx(scopedRollbackStage.stagingId, 'accept')?.status, 'accepted');
assert.throws(
  () => scopedRollbackLedger.decideHmx(scopedRollbackStage.stagingId, 'apply'),
  /hmx-canonical-apply-failed:injected-independent-projection-mutation;rollback-failures=semantic-graph-conflict\|temporal-ledger-conflict/,
  'the importer must report snapshot conflicts instead of replacing unrelated graph and ledger state',
);
assert(scopedRollbackRuntime.semanticMemory.snapshot().nodes.some(
  node => node.sourceKey === 'test:external-projection-write',
), 'the independent semantic graph write must survive a failed import');
assert(scopedRollbackLedger.snapshot().temporal.some(
  row => row.memoryId === 'external-temporal-write',
), 'the independent temporal assertion must survive a failed import');
assert.equal(
  scopedRollbackRuntime.semanticMemory.snapshot().nodes.some(
    node => node.label === 'canonical fact whose graph and temporal projection race must fail closed',
  ),
  false,
  'an owned semantic node created by the failed transaction must be undone even when snapshot restore conflicts',
);
assert.equal(
  scopedRollbackLedger.snapshot().temporal.some(
    row => row.summary === 'Canonical fact whose graph and temporal projection race must fail closed.',
  ),
  false,
  'the failed transaction temporal assertion must be undone without deleting the independent ledger write',
);
assert.equal(
  scopedRollbackRuntime.fabric.canonicalSnapshot().items.some(
    item => item.content === 'Canonical fact whose graph and temporal projection race must fail closed.',
  ),
  false,
  'the canonical memory written by the failed transaction must still be compensated',
);
assert.equal(scopedRollbackLedger.getHmxStage(scopedRollbackStage.stagingId)?.status, 'accepted',
  'a transaction with conflicted compensation must not be marked applied');
assert.equal(scopedRollbackRuntime.fabric.inspect().pendingSignalCompensations, 0);

// A conflict must not poison the stage permanently: retry after the injected external
// write has finished, then replay the successful receipt without duplicating projections.
const scopedRollbackRetry = scopedRollbackLedger.decideHmx(scopedRollbackStage.stagingId, 'apply');
assert.equal(scopedRollbackRetry?.status, 'applied',
  'an accepted HMX stage must remain retryable after conflict-aware partial compensation');
const scopedImportedMemory = scopedRollbackRuntime.fabric.canonicalSnapshot().items.filter(
  item => item.content === 'Canonical fact whose graph and temporal projection race must fail closed.',
);
assert.equal(scopedImportedMemory.length, 1,
  'retry after rollback conflict must materialize exactly one canonical memory');
const scopedImportedNodes = scopedRollbackRuntime.semanticMemory.snapshot().nodes.filter(
  node => node.label === 'canonical fact whose graph and temporal projection race must fail closed',
);
assert.equal(scopedImportedNodes.length, 1,
  'retry after rollback conflict must materialize exactly one source-scoped semantic node');
assert.equal(scopedRollbackLedger.snapshot().temporal.filter(
  row => row.summary === 'Canonical fact whose graph and temporal projection race must fail closed.',
).length, 1, 'retry after rollback conflict must materialize exactly one temporal assertion');
assert(scopedRollbackLedger.snapshot().temporal.some(
  row => row.memoryId === 'external-temporal-write',
), 'the independent temporal assertion must remain after a successful retry');
const temporalCountBeforeReplay = scopedRollbackLedger.snapshot().temporal.length;
const graphNodeCountBeforeReplay = scopedRollbackRuntime.semanticMemory.snapshot().nodes.length;
const replayedScopedStage = scopedRollbackLedger.decideHmx(scopedRollbackStage.stagingId, 'apply');
assert.equal(replayedScopedStage?.application?.digest, scopedRollbackRetry?.application?.digest,
  'idempotent replay must return the same apply receipt');
assert.equal(scopedRollbackLedger.snapshot().temporal.length, temporalCountBeforeReplay,
  'idempotent replay must not add temporal assertions');
assert.equal(scopedRollbackRuntime.semanticMemory.snapshot().nodes.length, graphNodeCountBeforeReplay,
  'idempotent replay must not add semantic graph nodes');

// Source-projection withdrawal is a targeted graph mutation, not a global snapshot
// replacement: unrelated nodes and edges must remain reachable.
const sourceRemovalRuntime = new MemorySubsystemRuntime();
const sourceRemovalProjector = new HexisCanonicalMemoryProjector(
  sourceRemovalRuntime.fabric,
  sourceRemovalRuntime.semanticMemory,
);
const priorProjectionNode = sourceRemovalRuntime.semanticMemory.upsertNode(
  'older imported belief',
  'concept',
  0.62,
  'hexis:old-version',
);
const unrelatedNode = sourceRemovalRuntime.semanticMemory.upsertNode(
  'independent user concept',
  'concept',
  0.87,
  'user:independent',
);
const unrelatedPeer = sourceRemovalRuntime.semanticMemory.upsertNode(
  'independent peer concept',
  'concept',
  0.74,
  'user:independent',
);
const removedProjectionEdge = sourceRemovalRuntime.semanticMemory.connect(
  priorProjectionNode.id,
  unrelatedNode.id,
  'associated',
  0.51,
);
const survivingIndependentEdge = sourceRemovalRuntime.semanticMemory.connect(
  unrelatedNode.id,
  unrelatedPeer.id,
  'supports',
  0.71,
);
sourceRemovalProjector.removeSemanticProjection('hexis:old-version', 'test:source-removal');
const sourceRemovalSnapshot = sourceRemovalRuntime.semanticMemory.snapshot();
assert.equal(sourceRemovalSnapshot.nodes.some(node => node.id === priorProjectionNode.id), false);
assert(sourceRemovalSnapshot.nodes.some(node => node.id === unrelatedNode.id),
  'removing an imported projection must not remove unrelated semantic nodes');
assert(sourceRemovalSnapshot.nodes.some(node => node.id === unrelatedPeer.id));
assert.equal(sourceRemovalSnapshot.edges.some(edge => edge.id === removedProjectionEdge.id), false,
  'edges attached to the removed projection node must be withdrawn');
assert(sourceRemovalSnapshot.edges.some(edge => edge.id === survivingIndependentEdge.id),
  'independent edges must survive source-scoped projection removal');

// If full snapshot compensation itself throws, the projector must still attempt
// per-record rollback of its transaction-owned graph changes.
const compensationThrowRuntime = new MemorySubsystemRuntime();
const compensationThrowLedger = new HexisAdaptationFabric();
let injectGraphRestoreThrow = true;
const compensationThrowGraph = new Proxy(compensationThrowRuntime.semanticMemory, {
  get(target, property) {
    if (property === 'restoreIfUnchanged') {
      return (...args) => {
        if (injectGraphRestoreThrow) {
          injectGraphRestoreThrow = false;
          throw new Error('injected-snapshot-restore-exception');
        }
        return target.restoreIfUnchanged(...args);
      };
    }
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
const failingTemporalAdapter = new Proxy(compensationThrowLedger, {
  get(target, property) {
    if (property === 'recordTemporalAssertion') {
      return () => { throw new Error('injected-downstream-projection-failure'); };
    }
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
const compensationThrowProjector = new HexisCanonicalMemoryProjector(
  compensationThrowRuntime.fabric,
  compensationThrowGraph,
  failingTemporalAdapter,
);
compensationThrowLedger.bindCanonicalMemoryApply(stage => compensationThrowProjector.apply(stage));
const compensationThrowExportId = 'exp_0000000000009207';
const compensationThrowStage = compensationThrowLedger.stageHmx({
  document: makeHmxDocument(compensationThrowExportId, {
    memories: [{
      ref: compensationThrowExportId + ':memory-new',
      type: 'semantic',
      content: 'Owned projection must unwind after snapshot compensation throws.',
      status: 'active',
      trust_level: 0.45,
    }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(compensationThrowStage.conflicts, []);
assert.equal(compensationThrowLedger.decideHmx(compensationThrowStage.stagingId, 'accept')?.status, 'accepted');
assert.throws(
  () => compensationThrowLedger.decideHmx(compensationThrowStage.stagingId, 'apply'),
  /hmx-canonical-apply-failed:injected-downstream-projection-failure;rollback-failures=semantic-graph-restore:injected-snapshot-restore-exception/,
  'snapshot restore exceptions must be reported while selective rollback still runs',
);
assert.equal(compensationThrowRuntime.semanticMemory.snapshot().nodes.some(
  node => node.label === 'owned projection must unwind after snapshot compensation throws',
), false, 'selective undo must remove the failed import node despite snapshot restore throwing');
assert.equal(compensationThrowRuntime.fabric.canonicalSnapshot().items.some(
  item => item.content === 'Owned projection must unwind after snapshot compensation throws.',
), false, 'the failed canonical memory must be compensated');
assert.equal(compensationThrowLedger.snapshot().temporal.length, 0);
assert.equal(compensationThrowLedger.getHmxStage(compensationThrowStage.stagingId)?.status, 'accepted');
assert.equal(compensationThrowRuntime.fabric.inspect().pendingSignalCompensations, 0);

// The MemoryOS compensation can itself throw after restoring its snapshot. The
// HMX projector must report the missing lifecycle receipt, preserve the exact canonical
// pre-state, unwind graph/ledger writes, and revoke the one-shot token.
const signalCompensationThrowRuntime = new MemorySubsystemRuntime();
const signalCompensationThrowLedger = new HexisAdaptationFabric();
let failAfterBeliefMirrorWrite = false;
const signalCompensationThrowLedgerAdapter = new Proxy(signalCompensationThrowLedger, {
  get(target, property) {
    if (property === 'registerOrUpdateBelief') {
      return (...args) => {
        const result = target.registerOrUpdateBelief(...args);
        if (failAfterBeliefMirrorWrite) {
          failAfterBeliefMirrorWrite = false;
          throw new Error('injected-temporal-mirror-after-write');
        }
        return result;
      };
    }
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
const signalCompensationThrowProjector = new HexisCanonicalMemoryProjector(
  signalCompensationThrowRuntime.fabric,
  signalCompensationThrowRuntime.semanticMemory,
  signalCompensationThrowLedgerAdapter,
);
signalCompensationThrowLedger.bindCanonicalMemoryApply(stage => signalCompensationThrowProjector.apply(stage));
const signalCompensationThrowExportId = 'exp_0000000000009208';
const signalCompensationThrowContent = 'Compensation that throws after restoring must preserve exact canonical state.';
const signalCompensationSeedStage = signalCompensationThrowLedger.stageHmx({
  document: makeHmxDocument(signalCompensationThrowExportId, {
    memories: [{
      ref: signalCompensationThrowExportId + ':memory-existing',
      type: 'semantic',
      content: signalCompensationThrowContent,
      status: 'active',
      trust_level: 0.95,
    }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(signalCompensationThrowLedger.decideHmx(signalCompensationSeedStage.stagingId, 'accept')?.status, 'accepted');
assert.equal(signalCompensationThrowLedger.decideHmx(signalCompensationSeedStage.stagingId, 'apply')?.status, 'applied');
const signalCompensationSeed = signalCompensationThrowRuntime.fabric.canonicalSnapshot().items.find(
  item => item.content === signalCompensationThrowContent,
);
assert(signalCompensationSeed);
const signalCompensationBefore = signalSnapshot(signalCompensationSeed);
const signalCompensationOS = signalCompensationThrowRuntime.fabric.memoryOS;
const originalMemoryOSCompensation = signalCompensationOS.restoreSignalsForCompensation.bind(signalCompensationOS);
let injectAfterCompensationWrite = true;
signalCompensationOS.restoreSignalsForCompensation = (...args) => {
  const restored = originalMemoryOSCompensation(...args);
  if (injectAfterCompensationWrite) {
    injectAfterCompensationWrite = false;
    throw new Error('injected-signal-compensation-after-write');
  }
  return restored;
};
const signalCompensationRetryStage = signalCompensationThrowLedger.stageHmx({
  document: makeHmxDocument(signalCompensationThrowExportId, {
    memories: [{
      ref: signalCompensationThrowExportId + ':memory-existing',
      type: 'semantic',
      content: signalCompensationThrowContent,
      status: 'active',
      trust_level: 0.35,
    }],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.equal(signalCompensationThrowLedger.decideHmx(signalCompensationRetryStage.stagingId, 'accept')?.status, 'accepted');
failAfterBeliefMirrorWrite = true;
assert.throws(
  () => signalCompensationThrowLedger.decideHmx(signalCompensationRetryStage.stagingId, 'apply'),
  /hmx-canonical-apply-failed:injected-temporal-mirror-after-write;rollback-failures=signal-restore:injected-signal-compensation-after-write/,
  'a post-write compensation exception must remain visible as incomplete lifecycle acknowledgement',
);
const signalCompensationAfterFailure = signalCompensationThrowRuntime.fabric.canonicalSnapshot().items.find(
  item => item.id === signalCompensationSeed.id,
);
assert(signalCompensationAfterFailure);
assert.deepEqual(
  signalSnapshot(signalCompensationAfterFailure),
  signalCompensationBefore,
  'a compensation exception after the restore must not leave the canonical memory half-modified',
);
assert.equal(signalCompensationThrowRuntime.fabric.inspect().pendingSignalCompensations, 0,
  'a token consumed by a compensation that throws must not remain replayable');
assert.equal(signalCompensationThrowLedger.getHmxStage(signalCompensationRetryStage.stagingId)?.status, 'accepted');

// Malformed status values must fail staging rather than being silently coerced.
for (const [invalidIndex, invalidStatus] of [42, false, {}, 'active' + String.fromCharCode(10) + 'admin'].entries()) {
  const exportId = 'exp_' + String(101 + invalidIndex).padStart(16, '0');
  const malformedFabric = new HexisAdaptationFabric();
  const malformedStage = malformedFabric.stageHmx({
    document: makeHmxDocument(exportId, {
      memories: [{ ref: exportId + ':invalid-status', type: 'semantic', content: 'Invalid status fixture.', status: invalidStatus }],
    }),
    intent: 'port',
    strategy: 'additive',
  });
  assert(malformedStage.conflicts.some(conflict => conflict.path === 'sections.memories[0].status'),
    'malformed status must be a schema conflict: ' + typeof invalidStatus);
  assert.equal(malformedFabric.decideHmx(malformedStage.stagingId, 'accept')?.status, 'staged',
    'malformed status must not be accepted');
}

// Analysis and authoritative strategies are reviewable, but the current projector
// only implements additive port semantics and must reject writes from other strategies.
for (const [exportId, intent, strategy] of [
  ['exp_3333333333333333', 'analysis', 'analysis_only'],
  ['exp_4444444444444444', 'port', 'authoritative'],
]) {
  const strategyRuntime = new MemorySubsystemRuntime();
  const strategyProjector = new HexisCanonicalMemoryProjector(strategyRuntime.fabric, strategyRuntime.semanticMemory);
  const strategyFabric = new HexisAdaptationFabric();
  strategyFabric.bindCanonicalMemoryApply(candidate => strategyProjector.apply(candidate));
  const candidate = strategyFabric.stageHmx({
    document: makeHmxDocument(exportId, {
      memories: [{ ref: exportId + ':blocked-memory', type: 'semantic', content: 'Must not be mutated by unsupported strategy.' }],
    }),
    intent,
    strategy,
  });
  assert.deepEqual(candidate.conflicts, []);
  assert.equal(strategyFabric.decideHmx(candidate.stagingId, 'accept')?.status, 'accepted');
  assert.throws(() => strategyFabric.decideHmx(candidate.stagingId, 'apply'), /hmx-canonical-apply-requires-port-additive-strategy/);
  assert.equal(strategyFabric.getHmxStage(candidate.stagingId)?.status, 'accepted',
    'a rejected apply strategy must leave the review stage retryable');
  assert.equal(strategyRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length, 0,
    'unsupported HMX strategies must never write canonical memory');
}

// A same-text native memory must remain untouched by an external HMX import.
const collisionRuntime = new MemorySubsystemRuntime();
const nativeText = normalizedNk1Export.sections.memories[0].content;
const nativeGraphNode = collisionRuntime.semanticMemory.upsertNode(nativeText, 'concept', 0.82);
const nativeItem = collisionRuntime.fabric.encode({
  content: nativeText,
  tags: ['native-only'],
  context: { nativeBoundary: 'keep-me' },
  kind: 'semantic',
  salience: 0.82,
  emotionalWeight: 0.1,
  identityRelevance: 0.08,
  goalRelevance: 0.03,
  socialRelevance: 0.03,
  predictionError: 0,
  confidence: 0.91,
  epistemicStatus: 'fact',
  source: 'user',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  provenanceClass: 'user',
  sourceAuthority01: 0.9,
  independenceKey: 'native-source',
});
const nativeBeforeImport = {
  id: nativeItem.id,
  source: nativeItem.source,
  tags: [...(nativeItem.tags ?? [])],
  context: { ...(nativeItem.context ?? {}) },
  confidence: nativeItem.confidence,
  epistemicStatus: nativeItem.epistemicStatus,
};
const collisionProjector = new HexisCanonicalMemoryProjector(collisionRuntime.fabric, collisionRuntime.semanticMemory);
const collisionHexis = new HexisAdaptationFabric();
collisionHexis.bindCanonicalMemoryApply(candidate => collisionProjector.apply(candidate));
const collisionStage = collisionHexis.stageHmx({ document: normalizedNk1Export, intent: 'port', strategy: 'additive' });
assert.deepEqual(collisionStage.conflicts, []);
collisionHexis.decideHmx(collisionStage.stagingId, 'accept');
const collisionApplied = collisionHexis.decideHmx(collisionStage.stagingId, 'apply');
assert.equal(collisionApplied?.status, 'applied');
const nativeAfterImport = collisionRuntime.fabric.canonicalSnapshot().items.find(item => item.id === nativeBeforeImport.id);
assert.deepEqual({
  id: nativeAfterImport?.id,
  source: nativeAfterImport?.source,
  tags: [...(nativeAfterImport?.tags ?? [])],
  context: { ...(nativeAfterImport?.context ?? {}) },
  confidence: nativeAfterImport?.confidence,
  epistemicStatus: nativeAfterImport?.epistemicStatus,
}, nativeBeforeImport, 'canonical same-text memory must not be reconsolidated with imported external provenance');
const isolatedHexisDuplicate = collisionRuntime.fabric.canonicalSnapshot().items.find(item =>
  item.source.startsWith('hexis:') && item.content === nativeText);
assert(isolatedHexisDuplicate);
assert.notEqual(isolatedHexisDuplicate.id, nativeBeforeImport.id, 'the Hexis memory must have a separate stable identity from the native same-text record');
const matchingGraphNodes = collisionRuntime.semanticMemory.snapshot().nodes.filter(node => node.label === nativeGraphNode.label && node.type === nativeGraphNode.type);
assert.equal(matchingGraphNodes.length, 2, 'same-label imported and native graph nodes must stay in separate source namespaces');
assert(matchingGraphNodes.some(node => node.id === nativeGraphNode.id && !node.sourceKey));
assert(matchingGraphNodes.some(node => node.id !== nativeGraphNode.id && node.sourceKey?.startsWith('hexis:')));

// Approved HMX memories enter the canonical MemoryFabric -> MemoryOS2 path only
// through the explicit apply decision. The identity and goals sections remain deferred.
const canonicalMemoryRuntime = new MemorySubsystemRuntime();
const applyFabric = new HexisAdaptationFabric();
const canonicalProjector = new HexisCanonicalMemoryProjector(canonicalMemoryRuntime.fabric, canonicalMemoryRuntime.semanticMemory, applyFabric);
applyFabric.bindCanonicalMemoryApply(candidate => canonicalProjector.apply(candidate));
const applyStage = applyFabric.stageHmx({ document: normalizedNk1Export, intent: 'port', strategy: 'additive' });
assert.deepEqual(applyStage.conflicts, []);
const canonicalBeforeApproval = canonicalMemoryRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:'));
assert.equal(canonicalBeforeApproval.length, 0, 'staging an import must not mutate canonical memory');
assert.equal(applyFabric.decideHmx(applyStage.stagingId, 'accept')?.status, 'accepted');
const preparedGoals = applyFabric.prepareGoalProposals(applyStage.stagingId);
assert(preparedGoals.proposals.length > 0, 'HMX goals must be staged as proposals after HMX approval');
assert(preparedGoals.proposals.every(proposal => proposal.status === 'pending'));
const firstGoalProposal = preparedGoals.proposals[0];
const approvedGoalProposal = applyFabric.decideGoalProposal(firstGoalProposal.id, 'approve');
assert.equal(approvedGoalProposal?.status, 'approved');
const materializedGoalProposal = applyFabric.markGoalProposalMaterialized(firstGoalProposal.id, 'test-canonical-goal:' + firstGoalProposal.id);
assert.equal(materializedGoalProposal?.status, 'materialized');
assert.equal(materializedGoalProposal?.canonicalGoalId, 'test-canonical-goal:' + firstGoalProposal.id);
assert.throws(() => applyFabric.decideGoalProposal(firstGoalProposal.id, 'reject'), /hmx-goal-proposal-already-reviewed/,
  'a materialized goal cannot be rewritten as rejected by a stale decision');
assert.equal(applyFabric.decideGoalProposal(firstGoalProposal.id, 'approve')?.status, 'materialized',
  'replaying the same approval remains idempotent after materialization');
assert.equal(applyFabric.listGoalProposals({ status: 'pending' }).some(proposal => proposal.id === firstGoalProposal.id), false,
  'approved/materialized proposals must leave the pending review queue');
const goalRelationshipReceipt = {
  sourceStageFound: true,
  candidateRelationships: 2,
  projected: 1,
  deferred: 1,
  semanticEdgeIds: ['semantic-edge-reviewed-goal-1'],
  at: 1700000000000,
};
const firstActivationReceipt = applyFabric.markGoalProposalActivated(
  firstGoalProposal.id, 'test-canonical-goal:' + firstGoalProposal.id, goalRelationshipReceipt,
);
assert.equal(firstActivationReceipt?.goalRelationshipReceipt?.projected, 1);
const activationMetricAfterFirstReceipt = applyFabric.snapshot().metrics.hmxGoalProposalsActivated;
const replayedActivationReceipt = applyFabric.markGoalProposalActivated(
  firstGoalProposal.id, 'test-canonical-goal:' + firstGoalProposal.id,
  { ...goalRelationshipReceipt, projected: 99, at: 1700000000100 },
);
assert.deepEqual(replayedActivationReceipt?.goalRelationshipReceipt, goalRelationshipReceipt,
  'a replay must not overwrite the first activation receipt or recount its graph mutation');
assert.equal(applyFabric.snapshot().metrics.hmxGoalProposalsActivated, activationMetricAfterFirstReceipt,
  'replaying activation evidence must not increment the activation metric twice');

assert.equal(canonicalMemoryRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length, 0,
  'approval remains separate from applying the import');
const appliedStage = applyFabric.decideHmx(applyStage.stagingId, 'apply');
assert.equal(appliedStage?.status, 'applied');
assert.equal(appliedStage?.application?.importedCount, 2);
assert.equal(appliedStage?.application?.memoryIds.length, 2);
assert.equal(appliedStage?.application?.projectedRelationships, 1, 'relationships between imported memory records must enter the canonical semantic graph');
assert.equal(appliedStage?.application?.deferredRelationships, 1, 'relationships whose other endpoint is a deferred goal must remain deferred');
assert.equal(appliedStage?.application?.deferredSections.relationships, 1);
assert.equal(canonicalMemoryRuntime.semanticMemory.snapshot().edges.length, 1);
assert(appliedStage?.application?.semanticEdgeIds.length === 1);
assert.equal(appliedStage?.application?.status, 'partial', 'unmapped identity/goals/relationship/config sections must be disclosed, not claimed as imported');
assert(appliedStage?.application?.deferredSections.identity > 0);
const importedTemporal = applyFabric.snapshot().temporal.filter(row => appliedStage?.application?.createdMemoryIds.includes(row.memoryId));
assert.equal(importedTemporal.length, 2, 'each newly created HMX memory must be indexed in the Hexis temporal ledger');
assert(importedTemporal.every(row => row.source.startsWith('hexis:' + applyStage.sourceLineageId + ':')));
for (const temporalRow of importedTemporal) {
  assert.equal(applyFabric.temporalAt(temporalRow.memoryId, Number.MAX_SAFE_INTEGER)?.id, temporalRow.id,
    'the imported temporal assertion must be queryable by canonical memory ID');
}
const canonicalImported = canonicalMemoryRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:'));
const importedIdsForBeliefs = [...new Set(appliedStage.application.memoryIds)];
const stateAfterBeliefProjection = applyFabric.snapshot();
assert.equal(importedIdsForBeliefs.length, 2);
assert.equal(
  stateAfterBeliefProjection.beliefs.filter(belief => importedIdsForBeliefs.includes(belief.memoryId)).length,
  importedIdsForBeliefs.length,
  'each imported canonical memory must have a matching Hexis belief state',
);
for (const memoryId of importedIdsForBeliefs) {
  const importedMemory = canonicalImported.find(item => item.id === memoryId);
  const belief = stateAfterBeliefProjection.beliefs.find(item => item.memoryId === memoryId);
  assert(importedMemory && belief, 'imported canonical memory and belief must share the same stable ID');
  assert.equal(belief.confidence01, importedMemory.confidence,
    'the initial belief is seeded from existing confidence rather than an invented boost');
  assert.deepEqual(belief.sourceKeys, [],
    'memory import alone must not masquerade as independently corroborating evidence');
  assert.deepEqual(belief.contradictingSourceKeys, []);
}
assert.equal(
  stateAfterBeliefProjection.beliefAudit.filter(audit => importedIdsForBeliefs.includes(audit.memoryId)).length,
  0,
  'an import must not create a false evidence-revision audit',
);
assert.equal(canonicalImported.length, 2);
assert(canonicalImported.every(item => item.epistemicStatus !== 'fact'), 'foreign memory does not become an NK1 fact merely because it was imported');
assert(canonicalImported.some(item => item.kind === 'procedural'), 'Hexis skills mapped to procedural memories must be retrievable through canonical memory');
assert.equal(applyFabric.decideHmx(applyStage.stagingId, 'apply')?.application?.digest, appliedStage?.application?.digest,
  'replaying an applied stage returns the same application receipt without another mutation');
assert.equal(applyFabric.snapshot().temporal.length, importedTemporal.length,
  'replaying an HMX apply must not duplicate temporal assertions');
assert.equal(applyFabric.snapshot().beliefs.length, importedIdsForBeliefs.length,
  'replaying an applied stage must not duplicate or re-revise Hexis beliefs');
assert.equal(applyFabric.snapshot().beliefAudit.length, stateAfterBeliefProjection.beliefAudit.length,
  'idempotent replay must not manufacture additional belief evidence');

// Restored stages are untrusted inputs at the integration boundary. Replay must
// reject a forged or missing application receipt rather than returning a false success.
const tamperedReplayState = applyFabric.snapshot();
const tamperedReplayStage = tamperedReplayState.hmxStages.find(candidate => candidate.stagingId === applyStage.stagingId);
assert(tamperedReplayStage?.application);
tamperedReplayStage.application.importedCount += 1;
const tamperedReplayFabric = new HexisAdaptationFabric();
tamperedReplayFabric.restore(tamperedReplayState);
let tamperedReplayHandlerCalls = 0;
tamperedReplayFabric.bindCanonicalMemoryApply(() => {
  tamperedReplayHandlerCalls += 1;
  throw new Error('corrupt-replay-must-not-reach-projector');
});
assert.throws(
  () => tamperedReplayFabric.decideHmx(applyStage.stagingId, 'apply'),
  /hmx-applied-receipt-invalid/,
);
assert.equal(tamperedReplayHandlerCalls, 0, 'invalid restored receipts must be rejected before any apply handler can run');

const missingReceiptState = applyFabric.snapshot();
const missingReceiptStage = missingReceiptState.hmxStages.find(candidate => candidate.stagingId === applyStage.stagingId);
assert(missingReceiptStage);
missingReceiptStage.application = undefined;
const missingReceiptFabric = new HexisAdaptationFabric();
missingReceiptFabric.restore(missingReceiptState);
assert.throws(
  () => missingReceiptFabric.decideHmx(applyStage.stagingId, 'apply'),
  /hmx-applied-receipt-invalid/,
  'an applied stage without its receipt must not be returned as a successful replay',
);

// Re-exporting the same source lineage with a different export ID keeps stable memory identity.
const laterNormalizedNk1Export = normalizeNk1HmxExport({
  ...nativeNk1Export,
  exportedAt: '2026-10-25T00:00:00.000Z',
});
assert.notEqual(laterNormalizedNk1Export.export_id, normalizedNk1Export.export_id);
assert.equal(laterNormalizedNk1Export.source.hexis_lineage_id, normalizedNk1Export.source.hexis_lineage_id);
assert.notEqual(laterNormalizedNk1Export.sections.memories[0].ref, normalizedNk1Export.sections.memories[0].ref);

// Use the same durable adaptation owner, as the production system does across imports.
// A new HexisAdaptationFabric would model a separate organism and cannot share its proposal registry.
const duplicateStage = applyFabric.stageHmx({ document: laterNormalizedNk1Export, intent: 'port', strategy: 'additive' });
assert.deepEqual(duplicateStage.conflicts, []);
assert.equal(applyFabric.decideHmx(duplicateStage.stagingId, 'accept')?.status, 'accepted');
const duplicateGoalPreparation = applyFabric.prepareGoalProposals(duplicateStage.stagingId);
assert.equal(duplicateGoalPreparation.created, 0, 'same lineage/reference/content goal proposals must deduplicate across re-exports');
assert.equal(duplicateGoalPreparation.duplicates, preparedGoals.proposals.length);

const duplicateApply = applyFabric.decideHmx(duplicateStage.stagingId, 'apply');
assert.equal(duplicateApply?.application?.importedCount, 0);
assert.equal(duplicateApply?.application?.deduplicatedCount, 2);
assert.equal(canonicalMemoryRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length, 2);
assert.equal(canonicalMemoryRuntime.semanticMemory.snapshot().edges.length, 1, 're-import must not duplicate or reinforce an existing imported edge');
assert.equal(applyFabric.snapshot().beliefs.length, importedIdsForBeliefs.length,
  're-exporting the same source lineage must preserve the existing belief set');
assert.equal(applyFabric.snapshot().beliefAudit.length, 0,
  're-exporting source data must not invent evidence revisions');

const emptyApplyFabric = new HexisAdaptationFabric();
emptyApplyFabric.bindCanonicalMemoryApply(candidate => canonicalProjector.apply(candidate));
const emptyStage = emptyApplyFabric.stageHmx({
  document: makeHmxDocument('exp_9999999999999999', { memories: [] }),
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(emptyStage.conflicts, []);
emptyApplyFabric.decideHmx(emptyStage.stagingId, 'accept');
const beforeNoopApply = canonicalMemoryRuntime.fabric.canonicalSnapshot().items.length;
const noOpApplied = emptyApplyFabric.decideHmx(emptyStage.stagingId, 'apply');
assert.equal(noOpApplied?.status, 'applied');
assert.equal(noOpApplied?.application?.status, 'noop');
assert.equal(canonicalMemoryRuntime.fabric.canonicalSnapshot().items.length, beforeNoopApply,
  'an empty memory section must not claim or cause a canonical memory mutation');

// Fault injection: if a batch write fails halfway, newly created memories are compensated
// through MemoryFabric's canonical forget command and the accepted stage remains retryable.
const rollbackMemoryRuntime = new MemorySubsystemRuntime();
let failingWrites = 0;
const rollbackFabric = {
  canonicalSnapshot: () => rollbackMemoryRuntime.fabric.canonicalSnapshot(),
  encode: (input, options) => {
    failingWrites += 1;
    if (failingWrites === 2) throw new Error('injected-hmx-write-failure');
    return rollbackMemoryRuntime.fabric.encode(input, options);
  },
  forgetById: (...args) => rollbackMemoryRuntime.fabric.forgetById(...args),
};
const rollbackHexisFabric = new HexisAdaptationFabric();
const rollbackProjector = new HexisCanonicalMemoryProjector(rollbackFabric, rollbackMemoryRuntime.semanticMemory, rollbackHexisFabric);
rollbackHexisFabric.bindCanonicalMemoryApply(candidate => rollbackProjector.apply(candidate));
const rollbackStage = rollbackHexisFabric.stageHmx({ document: normalizedNk1Export, intent: 'port', strategy: 'additive' });
rollbackHexisFabric.decideHmx(rollbackStage.stagingId, 'accept');
assert.throws(() => rollbackHexisFabric.decideHmx(rollbackStage.stagingId, 'apply'), /hmx-canonical-apply-failed/);
assert.equal(rollbackHexisFabric.getHmxStage(rollbackStage.stagingId)?.status, 'accepted',
  'a failed apply must not mark the stage complete');
assert.equal(rollbackHexisFabric.getHmxStage(rollbackStage.stagingId)?.applicationAttempts, 1,
  'a failed apply attempt must be retained so restart-safe retries use a new canonical command ID');
assert.equal(rollbackMemoryRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length, 0,
  'partially inserted HMX memories must be rolled back');
assert.equal(rollbackMemoryRuntime.semanticMemory.snapshot().nodes.length, 0,
  'partially projected semantic graph nodes must also roll back with failed canonical-memory application');
assert.equal(rollbackHexisFabric.snapshot().temporal.length, 0,
  'temporal assertions must roll back with a compensated canonical import failure');
const retryAfterRollback = rollbackHexisFabric.decideHmx(rollbackStage.stagingId, 'apply');
assert.equal(retryAfterRollback?.status, 'applied', 'the same approved stage must remain safely retryable after compensation');
assert.equal(retryAfterRollback?.application?.attempt, 2, 'a compensated retry uses a distinct durable attempt ID');
assert.equal(rollbackMemoryRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length, 2);
assert.equal(rollbackMemoryRuntime.semanticMemory.snapshot().edges.length, 1,
  'retry must commit graph relations after all canonical memory rows succeed');
assert.equal(rollbackHexisFabric.snapshot().temporal.length, 2,
  'successful retry must materialize temporal assertions once');


// Fault injection after MemoryFabric has committed a canonical memory but before
// the projector receives its ID. This catches a partial-write window that a pre-write
// failure does not exercise: rollback must reconcile against the baseline snapshot.
const postWriteRollbackRuntime = new MemorySubsystemRuntime();
const realPostWriteEncode = postWriteRollbackRuntime.fabric.encode.bind(postWriteRollbackRuntime.fabric);
let injectAfterCanonicalWrite = true;
const postWriteRollbackFabric = {
  canonicalSnapshot: (...args) => postWriteRollbackRuntime.fabric.canonicalSnapshot(...args),
  encode: (input, options) => {
    const inserted = realPostWriteEncode(input, options);
    if (injectAfterCanonicalWrite) {
      injectAfterCanonicalWrite = false;
      throw new Error('injected-hmx-after-canonical-write');
    }
    return inserted;
  },
  forgetById: (...args) => postWriteRollbackRuntime.fabric.forgetById(...args),
};
const postWriteRollbackHexis = new HexisAdaptationFabric();
const postWriteRollbackProjector = new HexisCanonicalMemoryProjector(
  postWriteRollbackFabric,
  postWriteRollbackRuntime.semanticMemory,
  postWriteRollbackHexis,
);
postWriteRollbackHexis.bindCanonicalMemoryApply(candidate => postWriteRollbackProjector.apply(candidate));
const postWriteRollbackStage = postWriteRollbackHexis.stageHmx({
  document: normalizedNk1Export, intent: 'port', strategy: 'additive',
});
assert.deepEqual(postWriteRollbackStage.conflicts, []);
assert.equal(postWriteRollbackHexis.decideHmx(postWriteRollbackStage.stagingId, 'accept')?.status, 'accepted');
assert.throws(
  () => postWriteRollbackHexis.decideHmx(postWriteRollbackStage.stagingId, 'apply'),
  /hmx-canonical-apply-failed/,
);
assert.equal(postWriteRollbackHexis.getHmxStage(postWriteRollbackStage.stagingId)?.status, 'accepted');
assert.equal(
  postWriteRollbackRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length,
  0,
  'a write committed just before an adapter exception must be discovered and compensated',
);
assert.equal(postWriteRollbackRuntime.semanticMemory.snapshot().nodes.length, 0);
assert.equal(postWriteRollbackHexis.snapshot().temporal.length, 0);
const postWriteRetry = postWriteRollbackHexis.decideHmx(postWriteRollbackStage.stagingId, 'apply');
assert.equal(postWriteRetry?.status, 'applied', 'a reconciled failure must remain safely retryable');
assert.equal(postWriteRetry?.application?.attempt, 2);
assert.equal(
  postWriteRollbackRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length,
  2,
  'retry must commit exactly the intended imported memory set',
);
assert.equal(postWriteRollbackHexis.snapshot().temporal.length, 2);

// A compensator that returns without removing the committed record must not be
// treated as successful rollback. The failure receipt must surface the residue.
const uncompensatedRuntime = new MemorySubsystemRuntime();
const realUncompensatedEncode = uncompensatedRuntime.fabric.encode.bind(uncompensatedRuntime.fabric);
let injectUncompensatedWrite = true;
const uncompensatedFabric = {
  canonicalSnapshot: (...args) => uncompensatedRuntime.fabric.canonicalSnapshot(...args),
  encode: (input, options) => {
    const inserted = realUncompensatedEncode(input, options);
    if (injectUncompensatedWrite) {
      injectUncompensatedWrite = false;
      throw new Error('injected-hmx-write-before-id-return');
    }
    return inserted;
  },
  forgetById: () => false,
};
const uncompensatedHexis = new HexisAdaptationFabric();
const uncompensatedProjector = new HexisCanonicalMemoryProjector(
  uncompensatedFabric, uncompensatedRuntime.semanticMemory, uncompensatedHexis,
);
uncompensatedHexis.bindCanonicalMemoryApply(candidate => uncompensatedProjector.apply(candidate));
const uncompensatedStage = uncompensatedHexis.stageHmx({
  document: normalizedNk1Export, intent: 'port', strategy: 'additive',
});
assert.equal(uncompensatedHexis.decideHmx(uncompensatedStage.stagingId, 'accept')?.status, 'accepted');
assert.throws(
  () => uncompensatedHexis.decideHmx(uncompensatedStage.stagingId, 'apply'),
  /rollback-failures=canonical-uncompensated:/,
  'a silent no-op compensator must be reported as an incomplete rollback, never as atomic failure recovery',
);
const uncompensatedResiduals = uncompensatedRuntime.fabric.canonicalSnapshot().items.filter(item =>
  item.source.startsWith('hexis:') && item.context?.hexisExportId === normalizedNk1Export.export_id,
);
assert.equal(uncompensatedResiduals.length, 1,
  'fault injection must leave exactly the one intentionally uncompensated memory');
assert.equal(uncompensatedRuntime.semanticMemory.snapshot().nodes.length, 0,
  'graph rollback still runs even when canonical compensation is incomplete');
// Remove the test-only residue using the real store API so the isolated fixture
// does not accidentally demonstrate a successful import.
for (const residual of uncompensatedResiduals) {
  uncompensatedRuntime.fabric.forgetById(residual.id, 'test-fixture-cleanup', {
    commandId: 'test-fixture-cleanup:' + residual.id,
  });
}
assert.equal(
  uncompensatedRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length,
  0,
);

// Fault injection after canonical writes: belief-state failure must roll back both
// memory/graph writes and the temporal + belief ledgers as one HMX apply transaction.
const beliefRollbackRuntime = new MemorySubsystemRuntime();
const beliefRollbackHexis = new HexisAdaptationFabric();
const originalRegisterBelief = beliefRollbackHexis.registerOrUpdateBelief.bind(beliefRollbackHexis);
let beliefRegistrationAttempts = 0;
beliefRollbackHexis.registerOrUpdateBelief = input => {
  beliefRegistrationAttempts += 1;
  if (beliefRegistrationAttempts === 2) throw new Error('injected-hmx-belief-registration-failure');
  return originalRegisterBelief(input);
};
const beliefRollbackProjector = new HexisCanonicalMemoryProjector(
  beliefRollbackRuntime.fabric, beliefRollbackRuntime.semanticMemory, beliefRollbackHexis,
);
beliefRollbackHexis.bindCanonicalMemoryApply(candidate => beliefRollbackProjector.apply(candidate));
const beliefRollbackStage = beliefRollbackHexis.stageHmx({
  document: normalizedNk1Export, intent: 'port', strategy: 'additive',
});
assert.deepEqual(beliefRollbackStage.conflicts, []);
assert.equal(beliefRollbackHexis.decideHmx(beliefRollbackStage.stagingId, 'accept')?.status, 'accepted');
assert.throws(
  () => beliefRollbackHexis.decideHmx(beliefRollbackStage.stagingId, 'apply'),
  /hmx-canonical-apply-failed/,
);
assert.equal(beliefRollbackHexis.getHmxStage(beliefRollbackStage.stagingId)?.status, 'accepted',
  'a failed belief registration must leave the HMX stage retryable');
assert.equal(beliefRollbackRuntime.fabric.canonicalSnapshot().items.filter(item => item.source.startsWith('hexis:')).length, 0,
  'canonical memories created before the belief failure must be compensated');
assert.equal(beliefRollbackRuntime.semanticMemory.snapshot().nodes.length, 0,
  'semantic graph projection must roll back when the belief ledger fails');
assert.equal(beliefRollbackHexis.snapshot().temporal.length, 0,
  'temporal assertions must roll back when the belief ledger fails');
assert.equal(beliefRollbackHexis.snapshot().beliefs.length, 0,
  'a partially seeded belief set must roll back atomically');
beliefRollbackHexis.registerOrUpdateBelief = originalRegisterBelief;
const beliefRetry = beliefRollbackHexis.decideHmx(beliefRollbackStage.stagingId, 'apply');
assert.equal(beliefRetry?.status, 'applied');
assert.equal(beliefRetry?.application?.attempt, 2);
assert.equal(beliefRollbackHexis.snapshot().beliefs.length, 2,
  'retry must seed each belief exactly once after a compensated failure');
assert.equal(beliefRollbackHexis.snapshot().temporal.length, 2,
  'retry must materialize each temporal assertion exactly once');


// Real composition-root wiring: independent Hexis evidence changes the confidence
// used by canonical NK1 recall; duplicate sources cannot reapply the same revision.
const beliefProjectionSystems = new OrganismSystemFabric();
const beliefProjectionMemory = beliefProjectionSystems.memory.fabric.encode({
  content: 'Belief projection integration fixture.',
  tags: ['belief-projection-test'],
  context: {},
  kind: 'semantic',
  salience: 0.6,
  emotionalWeight: 0.1,
  identityRelevance: 0.1,
  goalRelevance: 0.1,
  socialRelevance: 0.1,
  predictionError: 0,
  confidence: 0.5,
  epistemicStatus: 'belief',
  source: 'integration-test',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  provenanceClass: 'external',
  sourceAuthority01: 0.5,
  independenceKey: 'belief-projection-fixture',
});
const supportAudit = beliefProjectionSystems.hexisAdaptation.reviseBelief({
  memoryId: beliefProjectionMemory.id,
  confidence01: beliefProjectionMemory.confidence,
  trust01: 0.4,
  evidence: { ref: 'independent-evidence-a', trust01: 0.9 },
  stance: 'supports',
  at: 1700000000000,
});
assert.equal(supportAudit.applied, true);
let projectedBeliefMemory = beliefProjectionSystems.memory.fabric.canonicalSnapshot().items.find(item => item.id === beliefProjectionMemory.id);
assert.equal(projectedBeliefMemory?.confidence, supportAudit.posteriorConfidence01,
  'the shared cognitive composition must project the posterior confidence into canonical memory');
assert(projectedBeliefMemory?.revisionHistory.at(-1)?.reason.startsWith('hexis-belief-revision:supports:'));
assert.equal(projectedBeliefMemory?.evidenceSources?.filter(source => source.source.startsWith('hexis-evidence:')).length, 1,
  'a successful belief update must append exactly one independent source to canonical provenance');
assert(projectedBeliefMemory?.evidenceLineageKeys?.some(key => key.startsWith('lineage:hexis-belief:')),
  'canonical memory must persist the lineage tombstone used to suppress cross-store replay');
const canonicalConfidenceAfterSupport = projectedBeliefMemory.confidence;
const duplicateSupportAudit = beliefProjectionSystems.hexisAdaptation.reviseBelief({
  memoryId: beliefProjectionMemory.id,
  confidence01: canonicalConfidenceAfterSupport,
  trust01: supportAudit.posteriorTrust01,
  evidence: { ref: 'independent-evidence-a', trust01: 0.9 },
  stance: 'supports',
});
assert.equal(duplicateSupportAudit.applied, false);
assert.equal(duplicateSupportAudit.reason, 'duplicate_source');
projectedBeliefMemory = beliefProjectionSystems.memory.fabric.canonicalSnapshot().items.find(item => item.id === beliefProjectionMemory.id);
assert.equal(projectedBeliefMemory?.confidence, canonicalConfidenceAfterSupport,
  'duplicate source replay must not update canonical recall confidence a second time');
assert.equal(projectedBeliefMemory?.evidenceSources?.filter(source => source.source.startsWith('hexis-evidence:')).length, 1,
  'duplicate evidence must not duplicate the canonical evidence source');
const contradictionAudit = beliefProjectionSystems.hexisAdaptation.reviseBelief({
  memoryId: beliefProjectionMemory.id,
  confidence01: canonicalConfidenceAfterSupport,
  trust01: supportAudit.posteriorTrust01,
  evidence: { ref: 'independent-counter-evidence', trust01: 0.8 },
  stance: 'contradicts',
});
assert.equal(contradictionAudit.applied, true);
projectedBeliefMemory = beliefProjectionSystems.memory.fabric.canonicalSnapshot().items.find(item => item.id === beliefProjectionMemory.id);
assert.equal(projectedBeliefMemory?.confidence, contradictionAudit.posteriorConfidence01);
assert(projectedBeliefMemory.confidence < canonicalConfidenceAfterSupport,
  'independent contradictory evidence must lower canonical confidence used by retrieval');
assert.equal(projectedBeliefMemory.evidenceSources?.filter(source => source.source.startsWith('hexis-evidence:')).length, 2,
  'independent contradictory evidence must append its own lineage without overwriting the prior source');
assert.equal(beliefProjectionSystems.hexisAdaptation.snapshot().beliefAudit.length, 3,
  'support, duplicate and contradiction events must each remain auditable');

// A fresh Hexis ledger must still respect canonical evidence lineage instead of
// counting a source again after one side of persisted state has been reset.
const canonicalBeforeCrossStoreReplay = beliefProjectionSystems.memory.fabric.canonicalSnapshot().items.find(item => item.id === beliefProjectionMemory.id);
assert(canonicalBeforeCrossStoreReplay);
const evidenceSourcesBeforeCrossStoreReplay = canonicalBeforeCrossStoreReplay.evidenceSources?.length ?? 0;
const confidenceBeforeCrossStoreReplay = canonicalBeforeCrossStoreReplay.confidence;
beliefProjectionSystems.hexisAdaptation.restore();
const crossStoreReplayAudit = beliefProjectionSystems.hexisAdaptation.reviseBelief({
  memoryId: beliefProjectionMemory.id,
  confidence01: confidenceBeforeCrossStoreReplay,
  evidence: { ref: 'independent-counter-evidence', trust01: 0.8 },
  stance: 'contradicts',
});
assert.equal(crossStoreReplayAudit.applied, false);
assert.equal(crossStoreReplayAudit.reason, 'duplicate_source',
  'canonical lineage must defeat a replay even when the Hexis belief ledger starts empty');
const canonicalAfterCrossStoreReplay = beliefProjectionSystems.memory.fabric.canonicalSnapshot().items.find(item => item.id === beliefProjectionMemory.id);
assert.equal(canonicalAfterCrossStoreReplay?.confidence, confidenceBeforeCrossStoreReplay);
assert.equal(canonicalAfterCrossStoreReplay?.evidenceSources?.length ?? 0, evidenceSourcesBeforeCrossStoreReplay,
  'cross-store replay must not add a second evidence source');

const failingBeliefProjection = new HexisAdaptationFabric();
failingBeliefProjection.bindCanonicalBeliefProjection(() => { throw new Error('injected-canonical-belief-projection-failure'); });
assert.throws(() => failingBeliefProjection.reviseBelief({
  memoryId: 'canonical-target',
  confidence01: 0.5,
  evidence: { ref: 'failure-source', trust01: 0.9 },
  stance: 'supports',
}), /injected-canonical-belief-projection-failure/);
assert.equal(failingBeliefProjection.snapshot().beliefs.length, 0,
  'failed canonical projection must not commit a partial Hexis belief');
assert.equal(failingBeliefProjection.snapshot().beliefAudit.length, 0,
  'failed canonical projection must not leave a misleading evidence audit');
assert.equal(failingBeliefProjection.snapshot().metrics.beliefRevisions, 0,
  'failed canonical projection must not advance revision metrics');

const unavailableBeliefProjection = new HexisAdaptationFabric();
unavailableBeliefProjection.bindCanonicalBeliefProjection(() => 'unavailable');
assert.throws(() => unavailableBeliefProjection.reviseBelief({
  memoryId:'missing-canonical-target',
  confidence01:0.5,
  evidence:{ref:'unavailable-projection-source',trust01:0.9},
  stance:'supports',
}), /hexis-canonical-belief-projection-unavailable/);
assert.equal(unavailableBeliefProjection.snapshot().beliefs.length,0,
  'an unavailable canonical target must not commit an orphan Hexis belief');
assert.equal(unavailableBeliefProjection.snapshot().beliefAudit.length,0,
  'an unavailable canonical target must not leave a misleading audit');



// End-to-end Hexis goal path: approval creates a paused NK1 agency project, and
// only the separate activation call may make it active. Goal links are resolved
// to the imported memory's persisted graph-source key, with honest receipts.
const goalPipelineSystems = new OrganismSystemFabric();

// Direct guardrail test: the agency bridge must reject control characters even
// when its materialization method is called outside the upstream HMX parser.
assert.throws(
  () => goalPipelineSystems.agency.selfProjects.materializeApprovedHexisGoal({
    proposalId: 'hexgoal:' + 'a'.repeat(32),
    sourceLineageId: 'test-lineage',
    sourceRef: 'exp_8888888888888888:bad-title',
    title: 'unsafe\nproject title',
    description: 'description',
    importance: 0.5,
    urgency: 0.4,
    confidence: 0.5,
  }),
  /hexis-project-title-invalid/,
);
const goalExportId = 'exp_8888888888888888';
const goalMemoryRef = goalExportId + ':memory-anchor';
const goalRef = goalExportId + ':goal-bridge';
const goalPipelineStage = goalPipelineSystems.hexisAdaptation.stageHmx({
  document: makeHmxDocument(goalExportId, {
    memories: [{ ref: goalMemoryRef, type: 'semantic', content: 'Imported evidence for the reviewed NK1 goal.', importance: 0.72 }],
    goals: [{ ref: goalRef, title: 'Validate a reviewed Hexis goal', description: 'Use imported evidence, then confirm progress with independent observations.' }],
    relationships: [
      { source_ref: goalMemoryRef, target_ref: goalRef, edge_type: 'supports', properties: { weight: 0.78 } },
      { source_ref: goalMemoryRef, target_ref: goalRef, edge_type: 'supports', properties: { weight: 0.78 } },
    ],
  }),
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(goalPipelineStage.conflicts, []);
assert.equal(goalPipelineSystems.hexisAdaptation.decideHmx(goalPipelineStage.stagingId, 'accept')?.status, 'accepted');
assert.equal(goalPipelineSystems.hexisAdaptation.decideHmx(goalPipelineStage.stagingId, 'apply')?.status, 'applied');
const goalPreparation = goalPipelineSystems.hexisAdaptation.prepareGoalProposals(goalPipelineStage.stagingId);
assert.equal(goalPreparation.created, 1);
const goalProposal = goalPreparation.proposals[0];
assert.equal(goalProposal.status, 'pending');
assert.throws(
  () => goalPipelineSystems.materializeApprovedHexisGoalProposal(goalProposal.id),
  /hmx-goal-must-be-approved-before-materialization/,
  'pending Hexis goal must not enter agency project ownership',
);
const reviewedGoal = goalPipelineSystems.hexisAdaptation.decideGoalProposal(goalProposal.id, 'approve');
assert.equal(reviewedGoal?.status, 'approved');
const materializedGoal = goalPipelineSystems.materializeApprovedHexisGoalProposal(goalProposal.id);
assert.equal(materializedGoal.proposal.status, 'materialized');
assert.equal(materializedGoal.project.status, 'paused');
assert.equal(materializedGoal.project.pauseReason, 'hexis-approved-awaiting-explicit-activation');
assert(materializedGoal.project.reason?.includes('independent observations'),
  'materialized agency project must retain the reviewed Hexis goal description');
assert.equal(goalPipelineSystems.agency.selfProjects.activeProjects().some(project => project.hexisProposalId === goalProposal.id), false,
  'a materialized proposal must not be auto-selected by ensureActiveProject');

// Staged relationship content can be restored or edited after the goal proposal
// has been reviewed. Activation must revalidate its source stage before changing
// agency state or writing any semantic graph edge.
const pristineGoalPipelineState = goalPipelineSystems.hexisAdaptation.snapshot();
const tamperedGoalPipelineState = structuredClone(pristineGoalPipelineState);
const tamperedRelationshipStage = tamperedGoalPipelineState.hmxStages.find(stage => stage.stagingId === goalProposal.stageId);
assert(tamperedRelationshipStage);
tamperedRelationshipStage.stagedSections.relationships[0].properties.weight = 0.99;
goalPipelineSystems.hexisAdaptation.restore(tamperedGoalPipelineState);
const graphBeforeTamperedActivation = goalPipelineSystems.memory.semanticMemory.snapshot();
assert.throws(
  () => goalPipelineSystems.activateHexisGoalProposal(goalProposal.id),
  /hmx-stage-digest-invalid/,
  'changed relationship payload must not be trusted merely because the goal was previously approved',
);
assert.equal(
  goalPipelineSystems.agency.selfProjects.snapshot().projects.find(project => project.hexisProposalId === goalProposal.id)?.status,
  'paused',
  'invalid restored relationship data must be rejected before activating the project',
);
assert.deepEqual(goalPipelineSystems.memory.semanticMemory.snapshot(), graphBeforeTamperedActivation,
  'invalid staged relationships must not create or reinforce graph edges');
assert.equal(goalPipelineSystems.hexisAdaptation.getGoalProposal(goalProposal.id)?.goalRelationshipReceipt, undefined,
  'invalid staged relationships must not yield an activation receipt');
goalPipelineSystems.hexisAdaptation.restore(pristineGoalPipelineState);

const goalGraphBeforeFault = goalPipelineSystems.memory.semanticMemory.snapshot();
const originalGoalDecisionRecord = goalPipelineSystems.agency.deliberation.record.bind(goalPipelineSystems.agency.deliberation);
goalPipelineSystems.agency.deliberation.record = () => { throw new Error('injected-goal-deliberation-failure'); };
assert.throws(
  () => goalPipelineSystems.activateHexisGoalProposal(goalProposal.id),
  /injected-goal-deliberation-failure/,
  'an activation failure after the receipt write must roll all participating states back',
);
assert.equal(
  goalPipelineSystems.agency.selfProjects.snapshot().projects.find(project => project.hexisProposalId === goalProposal.id)?.status,
  'paused',
  'failed deliberation must restore the project to its pre-activation paused state',
);
assert.equal(goalPipelineSystems.hexisAdaptation.getGoalProposal(goalProposal.id)?.goalRelationshipReceipt, undefined,
  'failed activation must not leave a persisted success receipt');
assert.deepEqual(goalPipelineSystems.memory.semanticMemory.snapshot(), goalGraphBeforeFault,
  'failed activation must restore the semantic graph snapshot');
assert.equal(goalPipelineSystems.agency.deliberation.snapshot().records.length, 0,
  'failed activation must restore the deliberation ledger');
goalPipelineSystems.agency.deliberation.record = originalGoalDecisionRecord;
const activatedGoal = goalPipelineSystems.activateHexisGoalProposal(goalProposal.id);
assert.equal(activatedGoal.proposal.status, 'materialized');
assert.equal(activatedGoal.project.status, 'active');
assert.equal(activatedGoal.receipt.sourceStageFound, true);
assert.equal(activatedGoal.receipt.candidateRelationships, 1,
  'identical duplicate source relationships collapse into one candidate edge');
assert.equal(activatedGoal.receipt.projected, 1);
assert.equal(activatedGoal.receipt.deferred, 0);
assert.equal(activatedGoal.receipt.semanticEdgeIds.length, 1);
const goalGraph = goalPipelineSystems.memory.semanticMemory.snapshot();
assert(goalGraph.nodes.some(node => node.type === 'goal' && node.sourceKey?.startsWith('hexis:')));
assert(goalGraph.edges.some(edge => edge.id === activatedGoal.receipt.semanticEdgeIds[0] && edge.relation === 'supports'));
const goalEdgeCountAfterActivation = goalGraph.edges.length;
const replayedActivation = goalPipelineSystems.activateHexisGoalProposal(goalProposal.id);
assert.equal(replayedActivation.receipt.semanticEdgeIds[0], activatedGoal.receipt.semanticEdgeIds[0]);
assert.equal(goalPipelineSystems.memory.semanticMemory.snapshot().edges.length, goalEdgeCountAfterActivation,
  'goal activation replay must not re-project or reinforce its relationship edges');
assert.equal(goalPipelineSystems.memory.semanticMemory.snapshot().edges.find(edge => edge.id === activatedGoal.receipt.semanticEdgeIds[0])?.weight, 0.78,
  'a duplicate HMX relationship row must not raise the projected edge weight');
const rejectedGoalExportId = 'exp_9999999999999998';
const rejectedGoalStage = goalPipelineSystems.hexisAdaptation.stageHmx({
  document: makeHmxDocument(rejectedGoalExportId, { goals: [{ ref: rejectedGoalExportId + ':rejected', title: 'Never activate this rejected goal' }] }),
  intent: 'port',
  strategy: 'additive',
});
assert.deepEqual(rejectedGoalStage.conflicts, []);
goalPipelineSystems.hexisAdaptation.decideHmx(rejectedGoalStage.stagingId, 'accept');
const rejectedPreparation = goalPipelineSystems.hexisAdaptation.prepareGoalProposals(rejectedGoalStage.stagingId);
assert.equal(rejectedPreparation.created, 1);
goalPipelineSystems.hexisAdaptation.decideGoalProposal(rejectedPreparation.proposals[0].id, 'reject');
assert.throws(
  () => goalPipelineSystems.materializeApprovedHexisGoalProposal(rejectedPreparation.proposals[0].id),
  /hmx-goal-must-be-approved-before-materialization/,
  'rejected Hexis goals must never become NK1 agency projects',
);


// Explicit Hexis learning-review decisions now write through NK1's canonical MemoryFabric.
const reviewSystems = new OrganismSystemFabric();
const reviewedSource = reviewSystems.memory.fabric.encode({
  content:'The original learning-review claim.',
  tags:['learning-review-fixture'],
  context:{},
  kind:'semantic',
  salience:0.6,
  emotionalWeight:0.1,
  identityRelevance:0.1,
  goalRelevance:0.1,
  socialRelevance:0.1,
  predictionError:0,
  confidence:0.63,
  epistemicStatus:'belief',
  source:'review-fixture',
  entities:[],
  semanticLinks:[],
  temporalLinks:[],
  causalLinks:[],
  provenanceClass:'external',
  sourceAuthority01:0.5,
  independenceKey:'review-fixture-source',
});
const approvalReview = reviewSystems.hexisAdaptation.createLearningReview({
  periodStart:1700000000000,periodEnd:1700000001000,summary:'Review existing canonical knowledge.',
  items:[{kind:'semantic_belief',title:'Review a known claim',content:'The original learning-review claim.',sourceMemoryId:reviewedSource.id,evidence:{source:'reviewer-a',observationCount:1}}],
});
const approvedReviewItem = approvalReview.items[0];
const originalReviewConfidence = reviewedSource.confidence;
const approvalResult = reviewSystems.decideHexisLearningReview(approvalReview.id,approvedReviewItem.id,'approve');
assert.equal(approvalResult.item.status,'approved');
assert.equal(approvalResult.item.canonicalMemoryId,reviewedSource.id);
assert.equal(approvalResult.memory?.confidence,originalReviewConfidence,
  'review approval annotates existing memory without artificially raising confidence');
assert.equal(approvalResult.memory?.context?.hexisLearningDecision,'approved');
const approvalReplay = reviewSystems.decideHexisLearningReview(approvalReview.id,approvedReviewItem.id,'approve');
assert.equal(approvalReplay.disposition,'replayed');
assert.equal(approvalReplay.memory?.confidence,originalReviewConfidence);

const correctionReview = reviewSystems.hexisAdaptation.createLearningReview({
  periodStart:1700000000000,periodEnd:1700000002000,summary:'Correct a canonical belief.',
  items:[{kind:'semantic_belief',title:'Correct a claim',content:'The original learning-review claim.',sourceMemoryId:reviewedSource.id,evidence:{source:'reviewer-b',reason:'new verified fact'}}],
});
const correctionItem = correctionReview.items[0];
const correctionResult = reviewSystems.decideHexisLearningReview(correctionReview.id,correctionItem.id,'correct','The corrected learning-review claim.');
assert.equal(correctionResult.item.status,'corrected');
assert.notEqual(correctionResult.memory?.id,reviewedSource.id,
  'corrections should create a new canonical revision rather than overwrite historical memory');
assert.equal(correctionResult.memory?.content,'The corrected learning-review claim.');
assert.equal(correctionResult.memory?.confidence,originalReviewConfidence,
  'correction must preserve confidence unless separate evidence is evaluated');
assert.equal(correctionResult.memory?.supersedesId,reviewedSource.id);
assert.equal(correctionResult.memory?.context?.hexisLearningDecision,'corrected');
const correctionReplayResult = reviewSystems.decideHexisLearningReview(correctionReview.id,correctionItem.id,'correct','The corrected learning-review claim.');
assert.equal(correctionReplayResult.disposition,'replayed');
assert.equal(correctionReplayResult.memory?.id,correctionResult.memory?.id,
  'replaying the same correction decision must return the same canonical revision');

const procedureReview = reviewSystems.hexisAdaptation.createLearningReview({
  periodStart:1700000000000,periodEnd:1700000003000,summary:'Review a newly proposed procedure.',
  items:[{kind:'new_procedure',title:'A candidate procedure',content:'Check prerequisites, execute once, verify the result.',evidence:{source:'reviewer-c',tested:false}}],
});
const procedureItem=procedureReview.items[0];
const procedureResult=reviewSystems.decideHexisLearningReview(procedureReview.id,procedureItem.id,'approve');
assert.equal(procedureResult.disposition,'materialized-candidate');
assert.equal(procedureResult.memory?.kind,'procedural');
assert.equal(procedureResult.memory?.epistemicStatus,'hypothesis');
assert.equal(procedureResult.memory?.confidence,0.42,
  'reviewed but untested procedures remain low-confidence hypotheses and are not auto-promoted to skills');
assert.equal(procedureResult.item.canonicalMemoryId,procedureResult.memory?.id);
const procedureMemoryCountAfterFirstDecision=reviewSystems.memory.fabric.canonicalSnapshot().items.length;
const procedureReplayResult=reviewSystems.decideHexisLearningReview(procedureReview.id,procedureItem.id,'approve');
assert.equal(procedureReplayResult.disposition,'replayed');
assert.equal(reviewSystems.memory.fabric.canonicalSnapshot().items.length,procedureMemoryCountAfterFirstDecision,
  'approving the same proposal after restore must not create another candidate memory');

const forgetReview = reviewSystems.hexisAdaptation.createLearningReview({
  periodStart:1700000000000,periodEnd:1700000004000,summary:'Quarantine stale knowledge.',
  items:[{kind:'semantic_belief',title:'Retire stale claim',content:'The claim to quarantine.',sourceMemoryId:reviewedSource.id,evidence:{reason:'obsolete'}}],
});
const forgetResult=reviewSystems.decideHexisLearningReview(forgetReview.id,forgetReview.items[0].id,'forget');
assert.equal(forgetResult.disposition,'quarantined-existing');
assert.equal(forgetResult.memory?.epistemicStatus,'quarantined',
  'forget is a reversible quarantine and does not destructively delete canonical memory');
const protectedForgetReview = reviewSystems.hexisAdaptation.createLearningReview({
  periodStart:1700000000000,periodEnd:1700000005000,summary:'Attempt to delete core identity memory.',
  items:[{kind:'semantic_belief',title:'Protected autobiographical memory',content:'Identity record.',sourceMemoryId:reviewSystems.memory.fabric.encode({
    content:'Protected identity record.',tags:[],context:{},kind:'identity',salience:0.8,emotionalWeight:0.3,identityRelevance:0.9,goalRelevance:0.1,socialRelevance:0.1,predictionError:0,confidence:0.9,epistemicStatus:'fact',source:'identity-fixture',entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[],
  }).id,evidence:{reason:'must remain protected'}}],
});
assert.throws(
  () => reviewSystems.decideHexisLearningReview(protectedForgetReview.id,protectedForgetReview.items[0].id,'forget'),
  /hexis-learning-review-forget-protected-memory/,
);

// A failure after the canonical mutation but before Hexis marks the item decided rolls both stores back.
const rollbackReviewSystems=new OrganismSystemFabric();
const rollbackReviewMemory=rollbackReviewSystems.memory.fabric.encode({
  content:'Rollback review fixture.',tags:[],context:{},kind:'semantic',salience:0.5,emotionalWeight:0.1,identityRelevance:0.1,goalRelevance:0.1,socialRelevance:0.1,predictionError:0,confidence:0.5,epistemicStatus:'belief',source:'review-rollback-fixture',entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[],
});
const rollbackReview=rollbackReviewSystems.hexisAdaptation.createLearningReview({
  periodStart:1700000000000,periodEnd:1700000006000,summary:'Force review-state commit failure.',
  items:[{kind:'semantic_belief',title:'Rollback annotation',content:'Rollback review fixture.',sourceMemoryId:rollbackReviewMemory.id,evidence:{reason:'fault injection'}}],
});
const originalDecideLearningReview=rollbackReviewSystems.hexisAdaptation.decideLearningReview.bind(rollbackReviewSystems.hexisAdaptation);
rollbackReviewSystems.hexisAdaptation.decideLearningReview=()=>{throw new Error('injected-hexis-review-decision-failure');};
assert.throws(
  () => rollbackReviewSystems.decideHexisLearningReview(rollbackReview.id,rollbackReview.items[0].id,'approve'),
  /injected-hexis-review-decision-failure/,
);
assert.equal(rollbackReviewSystems.memory.fabric.canonicalSnapshot().items.find(memory=>memory.id===rollbackReviewMemory.id)?.context?.hexisLearningDecision,undefined,
  'canonical memory annotation must roll back if the Hexis review cannot be committed');
assert.equal(rollbackReviewSystems.hexisAdaptation.snapshot().learningReviews[0].items[0].status,'pending',
  'review remains pending after an atomic rollback');
rollbackReviewSystems.hexisAdaptation.decideLearningReview=originalDecideLearningReview;


console.log('HEXIS_ADAPTATION_PASS');
console.log(JSON.stringify({diagnostics:fabric.diagnostics(),defaultState:defaultHexisAdaptationState().version},null,2));
