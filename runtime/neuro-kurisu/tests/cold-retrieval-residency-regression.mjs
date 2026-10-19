import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const memory = new MemoryOS2({ embeddingProvider: null });
const now = Date.now();
for (let i = 0; i < 24; i++) {
  memory.encode({
    id: `cold-row-${i}`,
    content: i === 0 ? 'rare hippocampal memory retrieval marker' : `unrelated storage note ${i}`,
    kind: 'semantic', source: 'cold-retrieval-residency-regression', tags: [], context: {},
    salience: i === 0 ? .95 : .2, emotionalWeight: .1, identityRelevance: .2,
    goalRelevance: .2, socialRelevance: .1, predictionError: .1, confidence: .9,
    epistemicStatus: 'fact', entities: [], semanticLinks: [], temporalLinks: [],
    causalLinks: [], contradictionLinks: [], validFromAt: now - 1000, observedAt: now - 500,
  });
}
const coldSnapshot = memory.snapshot();
for (const item of coldSnapshot.items) {
  item.semanticVector = [];
  item.residencyTier = 'cold';
}
coldSnapshot.semanticHits = 7; // legacy persisted counter: retrieval must not increment it.
memory.restore(coldSnapshot);
const before = memory.snapshot();
const result = memory.retrieve('rare hippocampal memory retrieval marker', 4, 0, 0, { temporalMode: 'at', asOfAt: now });
const after = memory.snapshot();

assert.equal(result[0]?.id, 'cold-row-0', 'lexical retrieval must still return the relevant cold record');
assert.equal(after.semanticHits, before.semanticHits, 'ordinary retrieval must not count the legacy hash projection as semantic recall');
assert.ok(after.items.every(item => item.semanticVector.length === 0), 'ordinary retrieval must not materialize hash vectors for cold records');
assert.ok(after.items.every(item => item.residencyTier === 'cold'), 'ordinary retrieval must not promote cold records merely to compute ranking signals');
assert.equal(after.items.length, before.items.length, 'retrieval must not change the memory corpus size');
console.log('COLD_RETRIEVAL_RESIDENCY_REGRESSION=PASS', JSON.stringify({ resultTop: result[0]?.id, coldVectorsMaterialized: after.items.filter(item => item.semanticVector.length > 0).length, nonColdResidencies: after.items.filter(item => item.residencyTier !== 'cold').length, semanticHitsDelta: after.semanticHits - before.semanticHits }));
