import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

// Regression: the shared five-character prefix "темпера" must not let a query
// about temperature retrieve an unrelated memory about temperament.
const now = 2_000_000_000_000;
const encode = (memory, id, content) => memory.encode({
  id, content, kind: 'semantic', source: 'concept-stem-precision-fixture', tags: [],
  context: {}, salience: .6, emotionalWeight: .2, identityRelevance: .2, goalRelevance: .2,
  socialRelevance: .1, predictionError: .1, confidence: .9, epistemicStatus: 'fact',
  entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [], contradictionLinks: [],
  validFromAt: now - 10_000, observedAt: now - 1_000,
});

const memory = new MemoryOS2();
encode(memory, 'ru-temperament', 'темперамент определяет характер и типичные реакции личности');
encode(memory, 'ru-interest', 'пользователь интересуется квантовой физикой');
encode(memory, 'ru-memory', 'память хранит и извлекает сведения');

const temperature = memory.retrieve('какова температура плавления кварца', 8, 0, 0, {
  temporalMode: 'at', asOfAt: now,
});
assert.deepEqual(
  temperature,
  [],
  'temperature must not retrieve temperament through an accidental five-character prefix',
);

const interest = memory.retrieve('чем интересуется пользователь', 8, 0, 0, {
  temporalMode: 'at', asOfAt: now,
});
assert.equal(interest[0]?.id, 'ru-interest', 'genuine Russian inflection must remain retrievable');

const generic = memory.retrieve('память', 8, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.equal(generic.length, 1, 'a single-concept query must not retrieve unrelated memories');

console.log('MEMORY_RETRIEVAL_CONCEPT_STEM_PRECISION=PASS', JSON.stringify({
  temperatureAbstained: temperature.length === 0,
  inflectionGrounded: interest[0]?.id === 'ru-interest',
  genericRecallSize: generic.length,
}));
