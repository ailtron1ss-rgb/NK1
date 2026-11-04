import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

// Regression for the concept-stem precision guard. A flat five-character stem made
// "температура" (temperature) share a stem with the alias "темперамент"
// (temperament), so an unanswerable question about temperature grounded a memory
// about personality. The guard must keep real inflections while rejecting
// coincidental prefixes.
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

// The alias "темперамент" must NOT be matched by an unrelated "температура" query.
const temperature = memory.retrieve('какова температура плавления унобтания', 8, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.deepEqual(temperature, [], 'a temperature question must not ground a temperament memory via a shared stem');

// The real inflection must still match: "интересуется" is the alias "интерес".
const interest = memory.retrieve('чем интересуется пользователь', 8, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.equal(interest[0]?.id, 'ru-interest', 'a genuine inflection must still ground the concept memory');

// A generic single-token question must not drag the whole corpus in.
const generic = memory.retrieve('память', 8, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.equal(generic.length, 1, 'a single-concept query must return only the memory that expresses it');

console.log('MEMORY_RETRIEVAL_CONCEPT_STEM_PRECISION=PASS', JSON.stringify({
  temperatureAbstained: true,
  inflectionGrounded: interest[0]?.id,
  genericRecallSize: generic.length,
}));
