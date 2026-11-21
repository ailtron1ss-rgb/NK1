import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const now = Date.now();
const memory = new MemoryOS2({ embeddingProvider: null });

const encode = (id, content, language, sessionId) => memory.encode({
  id,
  content,
  kind: 'semantic',
  source: 'user-approved-memory',
  tags: ['prototype-0.1', language],
  context: { sessionId, language },
  salience: 0.8,
  emotionalWeight: 0.1,
  identityRelevance: 0.5,
  goalRelevance: 0.1,
  socialRelevance: 0.1,
  predictionError: 0.05,
  confidence: 0.95,
  epistemicStatus: 'fact',
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
  validFromAt: now,
  observedAt: now,
  recordedFromAt: now,
  provenanceClass: 'user',
  sourceAuthority01: 0.95,
  independenceKey: `session:${sessionId}`,
});

const russian = encode(
  'prototype-ru-interest',
  'пользователь интересуется квантовой физикой',
  'ru',
  'prototype-session-ru-01',
);
const english = encode(
  'prototype-en-interest',
  'the user enjoys studying computational neuroscience',
  'en',
  'prototype-session-en-01',
);

assert.equal(russian.provenanceClass, 'user');
assert.equal(russian.context?.sessionId, 'prototype-session-ru-01');
assert.equal(russian.independenceKey, 'session:prototype-session-ru-01');

// RU memory -> EN query, and EN memory -> RU query.
const enQuery = memory.retrieve('what is the user interested in', 5);
assert.ok(enQuery.some(row => row.id === russian.id),
  'English retrieval must find the Russian user-approved memory');
const ruQuery = memory.retrieve('что мне нравится изучать', 5);
assert.ok(ruQuery.some(row => row.id === english.id),
  'Russian retrieval must find the English user-approved memory');

// A process restart is represented by restoring the persisted canonical snapshot
// into a fresh MemoryOS2 instance, not by reusing the original object.
const persisted = structuredClone(memory.snapshot());
const restored = new MemoryOS2({ embeddingProvider: null });
restored.restore(persisted);
const restoredEnglishQuery = restored.retrieve('what is the user interested in', 5);
assert.ok(restoredEnglishQuery.some(row => row.id === russian.id),
  'cross-language recall must survive snapshot/restore');
const restoredRussianQuery = restored.retrieve('что мне нравится изучать', 5);
assert.ok(restoredRussianQuery.some(row => row.id === english.id),
  'reverse cross-language recall must survive snapshot/restore');

// A correction creates a new bitemporal revision in the same lineage. Current
// recall must return the corrected fact, while the old revision remains historical.
const corrected = restored.reviseContent(
  russian.id,
  'пользователь интересуется вычислительной нейробиологией',
  {
    reason: 'user-corrected-memory',
    source: 'user-approved-memory-correction',
    validAt: Date.now(),
    recordedAt: Date.now(),
  },
);
assert.ok(corrected, 'correction must create a canonical replacement');
assert.equal(corrected.supersedesId, russian.id);
assert.equal(corrected.revisionGroupId, russian.revisionGroupId ?? russian.id);
const afterCorrection = restored.retrieve('what is the user interested in', 5);
assert.ok(afterCorrection.some(row => row.id === corrected.id),
  'current retrieval must return the corrected revision');
assert.equal(afterCorrection.some(row => row.id === russian.id), false,
  'current retrieval must not return the superseded revision');

// Explicit forget must remove the corrected record and its retrieval index entries.
assert.equal(restored.forgetById(corrected.id, 'explicit-user-forget'), true);
assert.equal(restored.snapshot().items.some(row => row.id === corrected.id), false);
assert.equal(restored.indexDiagnostics().conceptIndexMismatch, 0);
const afterForget = restored.retrieve('what is the user interested in', 8);
assert.equal(afterForget.some(row => row.id === corrected.id), false,
  'forgotten content must not be retrievable');
assert.equal(restored.indexDiagnostics().conceptIndexMismatch, 0,
  'forget must leave all retrieval indexes consistent');

// Unanswerable queries must abstain rather than borrowing a nearby memory.
const absent = restored.retrieve('which avatar gesture conveys embodiment', 8);
assert.deepEqual(absent, [], 'an absent concept must produce no fabricated memory hit');
assert.equal(restored.retrievalDiagnostics().abstained, true);

console.log('PROTOTYPE_0_1_BILINGUAL_MEMORY_E2E=PASS', JSON.stringify({
  ruToEn: true,
  enToRu: true,
  persistence: true,
  correction: true,
  explicitForget: true,
  groundedAbstention: true,
}));
