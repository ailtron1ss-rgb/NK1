import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const now = Date.now();
const makeMemory = (id, content, extras = {}) => ({
  id, content, kind: 'semantic', source: 'metadata-shadow-regression',
  tags: [], context: {}, salience: 0.6, emotionalWeight: 0.1,
  identityRelevance: 0.1, goalRelevance: 0.1, socialRelevance: 0.1,
  predictionError: 0.1, confidence: 0.9, epistemicStatus: 'fact',
  entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [],
  contradictionLinks: [], validFromAt: now - 10_000, observedAt: now - 1000,
  provenanceClass: 'external', sourceAuthority01: 0.9, ...extras,
});
function seed(memory) {
  memory.encode(makeMemory('m-hidden', 'A short note about reorganizing a bookshelf on Sunday.', {
    tags: ['indoor-garden', 'soil-care'],
    context: { topic: 'mycelium watering schedule', category: 'plant-care' },
    entities: ['Phalaenopsis'],
  }));
  memory.encode(makeMemory('m-budget', 'A note about reviewing a purchase order next month.', {
    tags: ['finance', 'quarterly-review'],
    context: { topic: 'quarterly budget planning', category: 'finance' },
    entities: ['Acme Accounts'],
  }));
  memory.encode(makeMemory('m-direct', 'Instructions for resetting a laptop after a system update.', {
    tags: ['computing'],
    context: { topic: 'device maintenance', category: 'technology' },
    entities: ['Laptop'],
  }));
}

const baseline = new MemoryOS2({ embeddingProvider: null });
const candidate = new MemoryOS2({ embeddingProvider: null, metadataRecallEnabled: true });
seed(baseline);
seed(candidate);
const baselineBefore = structuredClone(baseline.snapshot());
const candidateBefore = structuredClone(candidate.snapshot());

// Default behavior remains unchanged and does not fabricate an answer from metadata.
const baselineResult = baseline.previewRetrieveWithDiagnostics('mycelium', 3);
assert.equal(baselineResult.diagnostics.candidateSelection, 'idf-coverage-fuzzy-concept-rrf-stable-id');
assert.equal(baselineResult.items.some(row => row.id === 'm-hidden'), false,
  'the default path must not opt into metadata-only recall');
assert.deepEqual(baseline.snapshot(), baselineBefore,
  'read-only preview must not mutate canonical baseline state');

// The opt-in candidate can discover the item through curated topic metadata,
// even when the query word is absent from the content itself.
const candidateResult = candidate.previewRetrieveWithDiagnostics('mycelium', 3);
assert.equal(candidateResult.diagnostics.candidateSelection, 'idf-coverage-fuzzy-concept-metadata-rrf-stable-id');
assert.equal(candidateResult.items[0]?.id, 'm-hidden',
  'metadata candidate should surface the matching topic as top-1');
assert.equal(candidateResult.diagnostics.abstained, false,
  'direct metadata evidence may satisfy the opt-in answerability gate');
assert.deepEqual(candidate.snapshot(), candidateBefore,
  'candidate preview must not mutate canonical memory state');
assert.equal(candidate.indexDiagnostics().pass, true,
  'metadata postings must match canonical records');

const restored = new MemoryOS2({ embeddingProvider: null, metadataRecallEnabled: true });
restored.restore(candidate.snapshot());
assert.equal(restored.indexDiagnostics().pass, true,
  'metadata postings must rebuild consistently after restore');
assert.equal(restored.previewRetrieve('mycelium', 3)[0]?.id, 'm-hidden',
  'metadata recall should survive snapshot/restore');
console.log('MEMORYOS2_METADATA_RETRIEVAL=PASS', JSON.stringify({
  baselineTop1: baselineResult.items[0]?.id ?? null,
  metadataTop1: candidateResult.items[0]?.id ?? null,
  metadataIndex: candidate.indexDiagnostics().metadataTokenVocabulary,
  noLiveMutation: true,
}));
