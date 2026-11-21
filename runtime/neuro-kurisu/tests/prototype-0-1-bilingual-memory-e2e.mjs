import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const now = Date.now();
const memory = new MemoryOS2({ embeddingProvider: null });
const tempDir = await mkdtemp(path.join(os.tmpdir(), 'nk1-prototype-bilingual-memory-'));
const statePath = path.join(tempDir, 'memory-state.json');
const storeOptions = { encoding: 'json', backupEverySaves: 100 };

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

try {
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

  // Cross the actual on-disk persistence boundary, then load through a new store
  // instance and rebuild the canonical retrieval indexes in a fresh MemoryOS2.
  const store = new FileStateStore(statePath, storeOptions);
  await store.save(memory.snapshot());
  const firstRestartStore = new FileStateStore(statePath, storeOptions);
  const persisted = await firstRestartStore.load();
  assert.ok(persisted, 'file-backed memory snapshot must be readable after reopening the store');
  const restored = new MemoryOS2({ embeddingProvider: null });
  restored.restore(persisted);
  const restoredRussian = restored.snapshot().items.find(row => row.id === russian.id);
  assert.equal(restoredRussian?.context?.sessionId, 'prototype-session-ru-01');
  assert.equal(restoredRussian?.provenanceClass, 'user');
  assert.equal(restoredRussian?.independenceKey, 'session:prototype-session-ru-01');

  const restoredEnglishQuery = restored.retrieve('what is the user interested in', 5);
  assert.ok(restoredEnglishQuery.some(row => row.id === russian.id),
    'cross-language recall must survive file-backed restart');
  const restoredRussianQuery = restored.retrieve('что мне нравится изучать', 5);
  assert.ok(restoredRussianQuery.some(row => row.id === english.id),
    'reverse cross-language recall must survive file-backed restart');

  // A correction creates a new bitemporal revision in the same lineage.
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

  // Persist the correction and prove the corrected tip, not the stale revision,
  // is what a second fresh process-equivalent instance retrieves.
  await store.save(restored.snapshot());
  const correctedState = await new FileStateStore(statePath, storeOptions).load();
  assert.ok(correctedState, 'corrected memory snapshot must survive file storage');
  const correctedRestart = new MemoryOS2({ embeddingProvider: null });
  correctedRestart.restore(correctedState);
  const afterCorrection = correctedRestart.retrieve('what is the user interested in', 5);
  assert.ok(afterCorrection.some(row => row.id === corrected.id),
    'current retrieval must return the corrected revision after restart');
  assert.equal(afterCorrection.some(row => row.id === russian.id), false,
    'current retrieval must not return the superseded revision after restart');

  // Explicit forget must remove the corrected record and its retrieval index entries.
  assert.equal(correctedRestart.forgetById(corrected.id, 'explicit-user-forget'), true);
  assert.equal(correctedRestart.snapshot().items.some(row => row.id === corrected.id), false);
  assert.equal(correctedRestart.indexDiagnostics().conceptIndexMismatch, 0);

  // Persist forget as well; a third fresh instance must not resurrect the deleted fact.
  await store.save(correctedRestart.snapshot());
  const forgottenState = await new FileStateStore(statePath, storeOptions).load();
  assert.ok(forgottenState, 'forgotten memory snapshot must survive file storage');
  const forgottenRestart = new MemoryOS2({ embeddingProvider: null });
  forgottenRestart.restore(forgottenState);
  assert.equal(forgottenRestart.snapshot().items.some(row => row.id === corrected.id), false);
  assert.equal(forgottenRestart.indexDiagnostics().conceptIndexMismatch, 0);
  const afterForget = forgottenRestart.retrieve('what is the user interested in', 8);
  assert.equal(afterForget.some(row => row.id === corrected.id), false,
    'forgotten content must not be retrievable after restart');
  assert.equal(forgottenRestart.indexDiagnostics().conceptIndexMismatch, 0,
    'forget must leave all retrieval indexes consistent after restart');

  // Unanswerable queries must abstain rather than borrowing a nearby memory.
  const absent = forgottenRestart.retrieve('which avatar gesture conveys embodiment', 8);
  assert.deepEqual(absent, [], 'an absent concept must produce no fabricated memory hit');
  assert.equal(forgottenRestart.retrievalDiagnostics().abstained, true);

  console.log('PROTOTYPE_0_1_BILINGUAL_MEMORY_E2E=PASS', JSON.stringify({
    ruToEn: true,
    enToRu: true,
    fileBackedPersistence: true,
    correctionSurvivesRestart: true,
    explicitForgetSurvivesRestart: true,
    groundedAbstention: true,
  }));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
