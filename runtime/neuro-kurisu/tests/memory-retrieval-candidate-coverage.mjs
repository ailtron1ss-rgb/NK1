import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const now = 2_000_000_000_000;
const memory = new MemoryOS2();
for (let i = 0; i < 260; i++) {
  memory.encode({
    id: `row-${String(i).padStart(3, '0')}`,
    content: `shared common atlas observation ${i}`,
    kind: 'semantic', source: 'candidate-coverage-fixture', tags: [], context: {},
    salience: i === 0 ? .99 : .35, emotionalWeight: .1,
    identityRelevance: .1, goalRelevance: .1, socialRelevance: .1,
    predictionError: .1, confidence: .9, epistemicStatus: 'fact', entities: [],
    semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [],
    validFromAt: now - 1000, observedAt: now - i,
  });
}
const baseline = memory.snapshot();
const target = baseline.items.find(row => row.id === 'row-000');
assert.ok(target, 'target memory must exist');
target.lastAccessAt = now;
target.salience = .99;
for (const row of baseline.items) {
  if (row.id !== 'row-000') row.lastAccessAt = now - 30 * 86_400_000;
}

// Keep the target beyond the first 96 entries in the prior capped posting list.
const ordered = new MemoryOS2();
ordered.restore(structuredClone(baseline));
const reversed = new MemoryOS2();
reversed.restore({ ...structuredClone(baseline), items: [...baseline.items].reverse() });
const query = 'shared common atlas';
const a = ordered.retrieve(query, 8, 0, 0, { temporalMode: 'at', asOfAt: now }).map(row => row.id);
const b = reversed.retrieve(query, 8, 0, 0, { temporalMode: 'at', asOfAt: now }).map(row => row.id);
assert.ok(a.includes('row-000'), 'high-value match beyond the old 96-posting cap must remain retrievable');
assert.deepEqual(a, b, 'candidate and result ranking must remain independent of memory snapshot row order');
assert.equal(ordered.retrievalDiagnostics().candidateCount, 192);
assert.equal(ordered.retrievalDiagnostics().candidateSelection, 'idf-coverage-fuzzy-concept-metadata-rrf-stable-id');

// The query should materially separate true token overlap from unrelated records;
// this guards against giving orthogonal hashed vectors a free 0.5 semantic score.
const isolated = new MemoryOS2();
for (let i = 0; i < 16; i++) isolated.encode({
  id: `separate-${i}`, content: i === 0 ? 'violet compass migration' : `unrelated cloud storage note ${i}`,
  kind: 'semantic', source: 'cosine-floor-fixture', tags: [], context: {},
  salience: .5, emotionalWeight: .1, identityRelevance: .1, goalRelevance: .1, socialRelevance: .1,
  predictionError: .1, confidence: .9, epistemicStatus: 'fact', entities: [],
  semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [], validFromAt: now - 1000,
});
const exactFirst = isolated.retrieve('violet compass migration', 8, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.equal(exactFirst[0]?.id, 'separate-0', 'exact relevant memory must lead unrelated memories');

// High-value but unrelated recent memories must not be used to fabricate an answer.
// Without any lexical, fuzzy, concept or metadata posting, candidate count should stay zero.
const noEvidence = new MemoryOS2();
for (let i = 0; i < 12; i++) {
  noEvidence.encode({
    id: `unrelated-${i}`, content: `zebra keyboard orchard weather signal ${i}`,
    kind: 'semantic', source: 'abstention-fixture', tags: [], context: {},
    salience: .95, emotionalWeight: .1, identityRelevance: .9, goalRelevance: .9, socialRelevance: .1,
    predictionError: .1, confidence: .99, epistemicStatus: 'fact', entities: [],
    semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [],
    validFromAt: now - 1000, observedAt: now - 100 - i,
  });
}
const unsupportedQuery = 'quartz nebula credential archive';
const unsupportedRows = noEvidence.retrieve(unsupportedQuery, 8, 1, 1, { temporalMode: 'at', asOfAt: now });
assert.deepEqual(unsupportedRows, [],
  'without an evidence-bearing candidate, retrieval must abstain rather than return recent unrelated memories');
assert.equal(noEvidence.retrievalDiagnostics().candidateCount, 0,
  'zero-evidence queries must not be padded by recent-memory fallback');
const supportedRows = noEvidence.retrieve('zebra keyboard orchard', 8, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.ok(supportedRows.some(row => row.id === 'unrelated-0'),
  'evidence-backed retrieval must remain available after an abstention');

console.log('MEMORY_RETRIEVAL_CANDIDATE_COVERAGE=PASS', JSON.stringify({
  candidateCount: ordered.retrievalDiagnostics().candidateCount,
  resultOrderStable: JSON.stringify(a) === JSON.stringify(b),
  retainedTarget: a.includes('row-000'),
  exactFirst: exactFirst[0]?.id,
  unsupportedQueryResults: unsupportedRows.length,
  abstentionCandidateCount: noEvidence.retrievalDiagnostics().candidateCount,
  supportedQueryResults: supportedRows.length,
}));
