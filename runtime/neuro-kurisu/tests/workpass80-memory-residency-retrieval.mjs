import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const now = Date.now();
const makeInput = (content, index, extra = {}) => ({
  content,
  kind: 'semantic',
  source: 'workpass80-residency-retrieval',
  tags: ['workpass80', 'retrieval'],
  context: {},
  salience: index === 0 ? 0.01 : 0.72,
  emotionalWeight: 0.1,
  identityRelevance: 0.1,
  goalRelevance: 0.1,
  socialRelevance: 0.1,
  predictionError: 0.1,
  confidence: index === 0 ? 0.2 : 0.8,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: now - 60_000,
  observedAt: now - 60_000 + index,
  ...extra,
});

const memory = new MemoryOS2();
const targetText = 'WP80 rare-hippocampal marker qzv-731 stores the bilingual retrieval sentinel.';
const target = memory.encode(makeInput(targetText, 0), { clone: false });
for (let i = 1; i < 140; i += 1) {
  memory.encode(makeInput(`WP80 distractor record ${i} describes routine topic ${i % 11} with unrelated vocabulary.`, i), { clone: false });
}

const beforePlan = memory.residencyDiagnostics();
assert.equal(memory.size(), 140);
const plan = memory.applyResidencyPlan({ hotBudget: 16, warmBudget: 64, coldBudget: 768, pressure01: 0 });
const targetStored = memory.snapshot({ clone: false }).items.find(item => item.id === target.id);
assert.ok(targetStored, 'the target memory must remain canonical');
assert.equal(targetStored.residencyTier, 'cold', 'old low-salience target should be cold after the residency plan');
assert.equal(targetStored.semanticVector.length, 0, 'cold residency must release the materialized vector');
assert.ok(plan.tierCounts.cold > 0);
const coldBefore = memory.residencyDiagnostics();

const query = 'rare-hippocampal marker qzv-731 bilingual retrieval sentinel';
const hits = memory.retrieve(query, 5, 0, 0, {}, false);
assert.ok(hits.some(item => item.id === target.id), 'a lexical retrieval hit must remain discoverable while cold');
assert.equal(targetStored.residencyTier, 'cold', 'ordinary retrieval must not silently promote a cold memory');
assert.equal(targetStored.semanticVector.length, 0, 'ordinary retrieval must not materialize a cold vector');
const coldAfter = memory.residencyDiagnostics();
assert.equal(coldAfter.materializedVectors, coldBefore.materializedVectors,
  'retrieval must not increase the number of resident semantic vectors');
assert.equal(memory.retrievalDiagnostics().semanticVectorUsedForRanking, false,
  'the legacy hashed token projection must not be advertised as semantic ranking');
assert.equal(memory.retrievalDiagnostics().candidateCount <= 192, true,
  'candidate discovery must remain inside the documented mobile budget');
assert.equal(memory.indexDiagnostics().pass, true, 'retrieval must preserve canonical index invariants');

// Snapshot/restore must preserve the cold tier and its no-vector invariant.
const restored = new MemoryOS2();
restored.restore(memory.snapshot());
const restoredTarget = restored.snapshot({ clone: false }).items.find(item => item.id === target.id);
assert.equal(restoredTarget?.residencyTier, 'cold');
assert.equal(restoredTarget?.semanticVector.length, 0);
const restoredHits = restored.retrieve(query, 5, 0, 0, {}, false);
assert.ok(restoredHits.some(item => item.id === target.id), 'cold memory remains recallable after restore');
assert.equal(restoredTarget?.semanticVector.length, 0, 'restore plus retrieval must not warm the vector');
assert.equal(restored.indexDiagnostics().pass, true);

console.log('WORKPASS80_MEMORY_RESIDENCY_RETRIEVAL=PASS', JSON.stringify({
  corpus: memory.size(),
  tiers: plan.tierCounts,
  coldVectorCountBefore: coldBefore.materializedVectors,
  coldVectorCountAfter: coldAfter.materializedVectors,
  targetRecall: hits.some(item => item.id === target.id),
  restoreRecall: restoredHits.some(item => item.id === target.id),
  candidateBudget: memory.retrievalDiagnostics().candidateCount,
  indexIntegrity: memory.indexDiagnostics().pass,
  semanticQualityUpliftClaimed: false,
}));
