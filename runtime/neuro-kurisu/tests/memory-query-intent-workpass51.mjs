import assert from 'node:assert/strict';
import { MemoryOS2, detectMemoryQueryIntent } from '../src/organism/developmental/MemoryOS2.ts';

const now = Date.now();
const encode = (memory, row) => memory.encode({
  id: row.id, content: row.content, kind: row.kind, source: `workpass51-${row.id}`,
  tags: ['query-intent-fixture'], context: row.context ?? {},
  salience: .5, emotionalWeight: .2, identityRelevance: row.identityRelevance ?? .2,
  goalRelevance: row.goalRelevance ?? .2, socialRelevance: .1, predictionError: .1,
  confidence: .9, epistemicStatus: 'fact', entities: [], semanticLinks: [], temporalLinks: [],
  causalLinks: row.causalLinks ?? [], contradictionLinks: [], provenanceClass: 'external', sourceAuthority01: .8,
  observedAt: now - 1000, validFromAt: now - 5000, independenceKey: `source-${row.id}`,
});

const cases = [
  { intent: 'episodic', query: 'Что произошло про нейронную память и следующий эксперимент?', correct: 'episodic', content: 'нейронная память следующий эксперимент результат недавнего события' },
  { intent: 'procedural', query: 'Как настроить нейронную память: инструкция и следующий эксперимент', correct: 'procedural', content: 'нейронная память инструкция следующий эксперимент настройка' },
  { intent: 'identity', query: 'Что мне нравится в нейронной памяти и личных интересах?', correct: 'identity', content: 'нейронная память личные интересы нравятся предпочтения' },
  { intent: 'goal', query: 'Что мне осталось сделать по цели нейронной памяти и следующему эксперименту?', correct: 'working', content: 'нейронная память следующий эксперимент незавершённая цель', correctContext: { goalId: 'goal-memory' }, correctGoal: .9 },
  { intent: 'causal', query: 'Почему нейронная память изменила следующий эксперимент и к чему это привело?', correct: 'episodic', content: 'нейронная память следующий эксперимент результат причина последствие', correctCausal: ['prior-experiment'] },
  { intent: 'factual', query: 'Что такое нейронная память: дай определение', correct: 'semantic', decoyKind: 'episodic', content: 'нейронная память определение свойства базовые факты' },
];
const reports = [];
for (const [index, fixture] of cases.entries()) {
  assert.equal(detectMemoryQueryIntent(fixture.query), fixture.intent, `intent detector: ${fixture.intent}`);
  const memory = new MemoryOS2({ embeddingProvider: null });
  // The decoy intentionally has the lexicographically earlier ID and the same
  // lexical content. Only a bounded query-intent signal should break the tie.
  const content = fixture.content;
  encode(memory, { id: 'a-semantic-decoy', kind: fixture.decoyKind ?? 'semantic', content });
  encode(memory, { id: `z-correct-${index}`, kind: fixture.correct, content,
    context: fixture.correctContext, goalRelevance: fixture.correctGoal,
    causalLinks: fixture.correctCausal });
  const got = memory.retrieve(fixture.query, 1, fixture.correctGoal ?? .1, fixture.intent === 'identity' ? .9 : .1);
  assert.equal(got.length, 1);
  assert.equal(got[0].id, `z-correct-${index}`, `${fixture.intent} query should prefer the corresponding memory kind`);
  const diagnostics = memory.retrievalDiagnostics();
  assert.equal(diagnostics.queryIntentMode, fixture.intent);
  assert.ok(diagnostics.maxQueryIntentBoost01 > 0);
  reports.push({ intent: fixture.intent, selectedKind: got[0].kind, appliedBoost: diagnostics.maxQueryIntentBoost01 });
}
const generalMemory = new MemoryOS2({ embeddingProvider: null });
encode(generalMemory, { id: 'general-one', kind: 'semantic', content: 'нейронная память следующий эксперимент' });
const generalRows = generalMemory.retrieve('нейронная память следующий эксперимент', 1);
assert.equal(generalRows.length, 1);
assert.equal(generalMemory.retrievalDiagnostics().queryIntentMode, 'general');
assert.equal(generalMemory.retrievalDiagnostics().maxQueryIntentBoost01, 0, 'general search must not get an intent preference');
console.log('MEMORY_QUERY_INTENT_WORKPASS51=PASS', JSON.stringify({ cases: reports, general: 'no-intent-bonus' }));
