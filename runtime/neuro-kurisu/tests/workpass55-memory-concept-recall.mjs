import assert from 'node:assert/strict';
import { MemoryOS2, detectMemoryQueryIntent } from '../src/organism/developmental/MemoryOS2.ts';

const now = 2_000_000_000_000;
const memory = new MemoryOS2();
function add(id, content, kind, extra = {}) {
  return memory.encode({
    id, content, kind, source: 'workpass55-behavioral-fixture', tags: [], context: {},
    salience: .56, emotionalWeight: .25, identityRelevance: kind === 'identity' ? .84 : .18,
    goalRelevance: kind === 'working' ? .86 : .2, socialRelevance: .1, predictionError: .35,
    confidence: .9, epistemicStatus: 'fact', entities: [], semanticLinks: [], temporalLinks: [],
    causalLinks: [], contradictionLinks: [], validFromAt: now - 10_000, observedAt: now - 2_000,
    provenanceClass: 'user', sourceAuthority01: .9, ...extra,
  });
}
add('interest-physics', 'Kurisu likes discussing theoretical physics and difficult scientific ideas.', 'identity');
add('action-failure', 'The research command failed because its approval ticket expired before execution.', 'episodic', { context: { decisionId: 'decision-55', observationId: 'receipt-55', outcomeDirection: 'negative' }, causalLinks: ['approval-expiry'] });
add('next-goal', 'The plan is to finish the Live2D audio body integration next.', 'working', { context: { goalId: 'goal-audio' } });
add('unrelated-camera', 'The camera capture succeeded after a second attempt.', 'episodic');
add('identity-core', 'Her stable personality includes scientific skepticism, sarcasm, willpower and a strong sense of independence.', 'identity', { identityRelevance: .96 });
add('learning-history', 'The correction improved the coding skill after a failed first implementation.', 'episodic', { context: { decisionId: 'decision-learning', observationId: 'receipt-learning', outcomeDirection: 'positive' } });

const retrieve = (query) => memory.previewRetrieve(query, 4, .25, .25, { temporalMode: 'at', asOfAt: now });
const interestEn = retrieve('What topics am I curious about?');
assert.equal(interestEn[0]?.id, 'interest-physics', 'interest paraphrase should recall the identity memory');
const interestRu = retrieve('Что мне нравится обсуждать?');
assert.equal(interestRu[0]?.id, 'interest-physics', 'Russian query should recall an English phrased interest memory');
const causeRu = retrieve('Почему исследовательский запуск закончился неудачей?');
assert.equal(causeRu[0]?.id, 'action-failure', 'causal paraphrase should recall the failure episode');
const goalEn = retrieve('What did I intend to finish next?');
const identityRu = retrieve('Какие у меня черты характера?');
const learningRu = retrieve('Какой навык я улучшил после исправления?');
assert.equal(goalEn[0]?.id, 'next-goal', 'goal paraphrase should recall the active goal');
assert.equal(identityRu[0]?.id, 'identity-core', 'Russian personality query should recall the English identity memory');
assert.equal(learningRu[0]?.id, 'learning-history', 'Russian learning query should recall the English learning episode');
assert.equal(detectMemoryQueryIntent('What did I intend to finish next?'), 'goal');
assert.equal(detectMemoryQueryIntent('What topics am I curious about?'), 'identity');
assert.equal(detectMemoryQueryIntent('Чем я увлекаюсь?'), 'identity');
assert.equal(detectMemoryQueryIntent('Почему исследовательский запуск закончился неудачей?'), 'causal');
assert.equal(memory.snapshot().items.length, 6, 'preview retrieval must not mutate the canonical live memory snapshot');
console.log('WORKPASS55_MEMORY_CONCEPT_RECALL=PASS', JSON.stringify({ queries: 6, bilingual: 4, typedIntent: 3, causalRecall: causeRu[0]?.id, goalRecall: goalEn[0]?.id }));
