import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const now = 2_000_000_000_000;
const memory = new MemoryOS2();
const add = (id, content, extra = {}) => memory.encode({
  id, content, kind: 'semantic', source: 'fuzzy-retrieval-workpass32', tags: [], context: {},
  salience: extra.salience ?? .55, emotionalWeight: .1, identityRelevance: .1, goalRelevance: .1,
  socialRelevance: .1, predictionError: .1, confidence: .9, epistemicStatus: 'fact', entities: [],
  semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [], validFromAt: now - 1000,
  observedAt: now - 500, ...extra,
});

add('english-target', 'The memory retrieval mechanism preserves user preferences and correction history.');
add('russian-target', 'Датчики давления сохраняют измерения и историю калибровки.');
add('decoy-1', 'The runtime starts a network service and reports process health.');
add('decoy-2', 'Граф причинных связей хранит результаты предыдущих действий.');
add('decoy-3', 'The user interface opens a settings panel for visual preferences.');

const english = memory.previewRetrieve('memori retrival mechanizm prefernces', 5, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.equal(english[0]?.id, 'english-target', 'fuzzy n-gram retrieval should rescue misspelled English terms with no exact overlap');
const russian = memory.previewRetrieve('датчик давленя калибровка', 5, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.equal(russian[0]?.id, 'russian-target', 'fuzzy retrieval should tolerate common Russian inflection and spelling variants');

memory.retrieve('memori retrival mechanizm prefernces', 5, 0, 0, { temporalMode: 'at', asOfAt: now });
const diag = memory.retrievalDiagnostics();
assert.equal(diag.semanticVectorUsedForRanking, false, 'the hashed lexical projection must not masquerade as a true embedding ranker');
assert.equal(diag.semanticEmbeddingProvider, 'none');
assert.ok(diag.rrfSignals.includes('character-fuzzy'));
assert.ok(diag.rrfSignals.includes('bm25'));
assert.ok(diag.fuzzyCandidateCount > 0);

// Removing the only row that carries a vocabulary token must also remove that
// token from the character-gram vocabulary so stale fuzzy postings cannot leak.
add('temporary-token', 'transient floccinaucinihilipilification marker');
assert.equal(memory.forgetById('temporary-token', 'fuzzy-index-removal'), true);
const restored = new MemoryOS2();
restored.restore(memory.snapshot());
assert.equal(restored.indexDiagnostics().pass, true);
const afterRestore = restored.previewRetrieve('memori retrival mechanizm prefernces', 5, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.equal(afterRestore[0]?.id, 'english-target');
console.log('MEMORY_RETRIEVAL_FUZZY_WORKPASS32=PASS', JSON.stringify({ englishTop: english[0]?.id, russianTop: russian[0]?.id, fuzzyCandidates: diag.fuzzyCandidateCount, index: restored.indexDiagnostics() }));
