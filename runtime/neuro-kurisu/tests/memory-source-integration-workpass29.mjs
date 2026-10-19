import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const base = Date.now() - 120_000;
const makeInput = (content, extra = {}) => ({
  content,
  kind: 'semantic',
  source: 'memory-source-integration-workpass29',
  tags: [], context: {},
  salience: .78, emotionalWeight: .18, identityRelevance: .25,
  goalRelevance: .45, socialRelevance: .12, predictionError: .2,
  confidence: .88, epistemicStatus: 'fact', entities: [],
  semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [],
  validFromAt: base - 10_000, observedAt: base - 10_000,
  ...extra,
});

// Memo's content-addressed de-duplication must not let restore order select an
// expired revision when the exact same content has later become current again.
const memoryOS = new MemoryOS2();
const v1Text = 'KURISU-29 service status is amber on the verified branch.';
const v1 = memoryOS.encode(makeInput(v1Text), { clone: false });
const v2 = memoryOS.reviseContent(v1.id, 'KURISU-29 service status is green on the verified branch.', {
  validAt: base + 10_000, reason: 'source-correction-v2',
});
assert.ok(v2, 'the second revision should be created');
const v3 = memoryOS.reviseContent(v2.id, v1Text, { validAt: base + 20_000, reason: 'source-correction-reversal' });
assert.ok(v3, 'a correction that returns to an older wording should create a new revision');
assert.notEqual(v3.id, v1.id, 're-used wording must get a new lineage-scoped revision identity');
assert.equal(memoryOS.temporalChain(v1.id).length, 3, 'all explicit revisions must remain in one canonical chain');

const restored = new MemoryOS2();
restored.restore(memoryOS.snapshot());
const beforeSize = restored.size();
const reconciled = restored.encode(makeInput(v1Text, { validFromAt: base + 30_000, observedAt: base + 30_000 }), { clone: false });
assert.equal(reconciled.id, v3.id, 'after restore, de-dup must choose the currently valid revision, not the oldest same-content row');
assert.equal(restored.size(), beforeSize, 'reconciling current content must not create a duplicate after restore');
assert.equal(restored.temporalAt(v1.id, base + 5_000)?.id, v1.id, 'canonical temporal lookup should return revision 1 before correction');
assert.equal(restored.temporalAt(v1.id, base + 15_000)?.id, v2.id, 'canonical temporal lookup should return revision 2 between corrections');
assert.equal(restored.temporalAt(v1.id, base + 25_000)?.id, v3.id, 'canonical temporal lookup should return revision 3 after reversal');
const diff = restored.temporalDiff(v1.id, base + 15_000, base + 25_000);
assert.equal(diff.changed, true, 'temporal diff should use canonical memory revisions');
assert.equal(diff.from?.id, v2.id);
assert.equal(diff.to?.id, v3.id);

// An identical correction is a no-op: it must not close a memory with itself.
const beforeNoOpRevisionCount = restored.temporalChain(v3.id).length;
const noOp = restored.reviseContent(v3.id, v1Text, { validAt: base + 40_000, reason: 'same-content-review' });
assert.equal(noOp?.id, v3.id, 'same-content correction should reuse the current revision');
assert.equal(restored.temporalChain(v3.id).length, beforeNoOpRevisionCount, 'same-content correction should not create a fake revision');
assert.equal(restored.snapshot().items.find(item => item.id === v3.id)?.validUntilAt, null, 'same-content correction must not expire the current item or self-link it');
assert.notEqual(restored.snapshot().items.find(item => item.id === v3.id)?.supersededById, v3.id);

// Re-observing only an expired record must preserve its historical row and
// create a separate active observation instead of overwriting the old ID.
const expiredAt = base - 5_000;
const expired = restored.encode(makeInput('KURISU-29 retired endpoint had the old response schema.', {
  validFromAt: base - 20_000, validUntilAt: expiredAt, observedAt: base - 20_000,
}), { clone: false });
const revived = restored.encode(makeInput('KURISU-29 retired endpoint had the old response schema.', {
  validFromAt: base + 50_000, validUntilAt: null, observedAt: base + 50_000,
}), { clone: false });
assert.notEqual(revived.id, expired.id, 'a new observation must not overwrite an expired record with the same stable-content ID');
assert.equal(restored.snapshot().items.find(item => item.id === expired.id)?.validUntilAt, expiredAt, 'expired validity boundary must be preserved');
assert.equal(restored.temporalAt(revived.id, Date.now())?.id, revived.id, 'new observation should be current');

// Bounded-memory eviction must rebuild de-dup indexes, not blindly delete a
// key that currently points to a newer row with the same content. Put an
// expired duplicate at the oldest edge so it is the exact row evicted next.
const capacitySeed = restored.snapshot();
const canonicalDuplicateText = 'WP29 capacity duplicate keeps the live canonical row.';
const template = structuredClone(capacitySeed.items.find(item => item.id === v3.id));
const liveDuplicate = { ...structuredClone(template), id: 'wp29-capacity-live-duplicate', content: canonicalDuplicateText, contentHash: template.contentHash, source: 'wp29-capacity', validFromAt: base - 10_000, validUntilAt: null, observedAt: base - 1_000, revisionGroupId: 'wp29-capacity-live-duplicate', revisionSequence: 1 };
const expiredDuplicate = { ...structuredClone(template), id: 'wp29-capacity-expired-duplicate', content: canonicalDuplicateText, contentHash: template.contentHash, source: 'wp29-capacity', validFromAt: base - 20_000, validUntilAt: base - 15_000, observedAt: base - 20_000, revisionGroupId: 'wp29-capacity-expired-duplicate', revisionSequence: 1 };
const fillers = Array.from({ length: 1598 }, (_, index) => ({
  ...structuredClone(template), id: `wp29-capacity-filler-${index}`, content: `WP29 unique bounded filler record ${index}`, source: 'wp29-capacity-filler',
  validFromAt: base - 10_000, validUntilAt: null, observedAt: base - 500 + index, revisionGroupId: `wp29-capacity-filler-${index}`, revisionSequence: 1,
}));
const bounded = new MemoryOS2();
bounded.restore({ ...capacitySeed, items: [liveDuplicate, ...fillers, expiredDuplicate] });
assert.equal(bounded.size(), 1600, 'capacity fixture fills the canonical memory budget');
bounded.encode(makeInput('WP29 capacity trigger record is unique.', { source: 'wp29-capacity-trigger' }), { clone: false });
assert.equal(bounded.size(), 1600, 'inserting above the cap evicts one oldest row');
assert.equal(bounded.get(expiredDuplicate.id), null, 'oldest expired duplicate should be evicted');
const afterEviction = bounded.encode(makeInput(canonicalDuplicateText, { source: 'wp29-capacity', validFromAt: base + 30_000, observedAt: base + 30_000 }), { clone: false });
assert.equal(afterEviction.id, liveDuplicate.id, 'evicting an expired duplicate must leave the live dedup index intact');
assert.equal(bounded.size(), 1600, 'canonical re-observation after eviction must not create an unnecessary duplicate');
assert.equal(bounded.indexDiagnostics().pass, true, 'all memory indexes remain coherent after duplicate eviction');

// Hexis is now an audit/review adapter over the same canonical memory timeline.
const core = new OrganismCore(new MemoryStateStore(), { performanceProfile: 'mobile', cycleResultMode: 'operational' });
await core.init();
const coreMemoryOS = core.memorySubsystem.memoryOS;
const coreOld = coreMemoryOS.encode(makeInput('HEXIS bridge value was initially 17 units.', { source: 'workpass29-hexis-bridge', validFromAt: base - 1_000, observedAt: base - 1_000 }), { clone: false });
const coreNew = coreMemoryOS.reviseContent(coreOld.id, 'HEXIS bridge value was corrected to 23 units.', { validAt: base + 10_000, reason: 'hexis-correction-bridge' });
assert.ok(coreNew);
const hexisPast = core.hexisTemporalAt(coreOld.id, base + 5_000);
const hexisNow = core.hexisTemporalAt(coreOld.id, base + 20_000);
assert.equal(hexisPast?.memoryId, coreOld.id, 'Hexis point-in-time view must delegate to canonical MemoryOS2 history');
assert.equal(hexisNow?.memoryId, coreNew.id, 'Hexis current temporal view must return the canonical active revision');
const hexisDiff = core.hexisTemporalDiff(coreOld.id, base + 5_000, base + 20_000);
assert.equal(hexisDiff.changed, true);
assert.equal(hexisDiff.from?.memoryId, coreOld.id);
assert.equal(hexisDiff.to?.memoryId, coreNew.id);

// Review defaults must use the most recently accessed current memories, not
// the tail of a newest-first array (which is where the oldest rows reside).
const reviewIds = [];
for (let index = 0; index < 16; index += 1) {
  const item = coreMemoryOS.encode(makeInput(`WP29-review-fixture-${String(index).padStart(2, '0')}: current semantic memory for review.`, {
    source: 'workpass29-review-fixture', validFromAt: base - 5_000, observedAt: base - 100_000 + index * 1_000,
  }), { clone: false });
  reviewIds.push(item.id);
}
const liveItems = coreMemoryOS.snapshot({ clone: false }).items;
for (let index = 0; index < reviewIds.length; index += 1) {
  const item = liveItems.find(row => row.id === reviewIds[index]);
  item.lastAccessAt = base - 100_000 + index * 1_000;
  item.observedAt = base - 100_000 + index * 1_000;
}
const review = core.hexisCreateLearningReview({ summary: 'WP29 current-memory review selection' });
const reviewSourceIds = new Set(review.items.map(item => item.sourceMemoryId));
assert.ok(reviewSourceIds.has(reviewIds[15]), 'default Hexis review must include the newest current fixture memory');
assert.ok(!reviewSourceIds.has(reviewIds[0]), 'default Hexis review must not select the oldest tail item just because of array order');
assert.ok(review.items.length <= 12, 'default review batch remains bounded');

console.log('MEMORY_SOURCE_INTEGRATION_WORKPASS29=PASS', JSON.stringify({
  revisionCount: restored.temporalChain(v1.id).length,
  restoreIndexStable: reconciled.id === v3.id,
  noopRevisionSafe: noOp.id === v3.id,
  staleObservationPreserved: restored.get(expired.id) !== null,
  capacityEvictionIndexStable: bounded.indexDiagnostics().pass && afterEviction.id === liveDuplicate.id,
  hexisDelegatesToCanonicalMemory: hexisPast?.memoryId === coreOld.id && hexisNow?.memoryId === coreNew.id,
  recentReviewSelection: review.items.length,
}));
