import assert from 'node:assert/strict';
import { MemoryOS2, detectMemoryQueryIntent } from '../src/organism/developmental/MemoryOS2.ts';

const sharedBaseContent = 'neural memory experiment dialogue нейронная память эксперимент диалог';
const fixtures = [
  {
    "query": "Что ты помнишь обо мне и моих интересах?",
    "intent": "identity",
    "targetKind": "identity"
  },
  {
    "query": "Что ты знаешь обо мне и моих интересах?",
    "intent": "identity",
    "targetKind": "identity"
  },
  {
    "query": "Какие у меня интересы?",
    "intent": "identity",
    "targetKind": "identity"
  },
  {
    "query": "Что мне нравится?",
    "intent": "identity",
    "targetKind": "identity"
  },
  {
    "query": "Чем я интересуюсь?",
    "intent": "identity",
    "targetKind": "identity"
  },
  {
    "query": "What do you remember about me and my preferences?",
    "intent": "identity",
    "targetKind": "identity"
  },
  {
    "query": "What do you know about me?",
    "intent": "identity",
    "targetKind": "identity"
  },
  {
    "query": "What have you learned about me?",
    "intent": "identity",
    "targetKind": "identity"
  },
  {
    "query": "Что мы обсуждали в прошлый раз про нейронную память?",
    "intent": "episodic",
    "targetKind": "social",
    "lineageKey": "sessionId"
  },
  {
    "query": "Вспомни, что мы обсуждали про эксперимент",
    "intent": "episodic",
    "targetKind": "social",
    "lineageKey": "session_id"
  },
  {
    "query": "Что ты помнишь о нашем прошлом разговоре про эксперимент?",
    "intent": "episodic",
    "targetKind": "social",
    "lineageKey": "session-id"
  },
  {
    "query": "Напомни, что мы обсуждали про память",
    "intent": "episodic",
    "targetKind": "social",
    "lineageKey": "session id"
  },
  {
    "query": "Восстанови контекст нашего чата про эксперимент",
    "intent": "episodic",
    "targetKind": "social",
    "lineageKey": "threadId"
  },
  {
    "query": "What do you remember about our previous conversation on memory?",
    "intent": "episodic",
    "targetKind": "social",
    "lineageKey": "conversation_key"
  },
  {
    "query": "What did we discuss last time about memory?",
    "intent": "episodic",
    "targetKind": "social",
    "lineageKey": "chat-id"
  },
  {
    "query": "Can you remind me what we discussed last time?",
    "intent": "episodic",
    "targetKind": "social",
    "lineageKey": "transcriptId"
  },
  {
    "query": "Recall our previous discussion about memory",
    "intent": "episodic",
    "targetKind": "social",
    "lineageKey": "dialogue_key"
  },
  {
    "query": "What happened in our previous conversation?",
    "intent": "episodic",
    "targetKind": "social",
    "lineageKey": "sessionId"
  },
  {
    "query": "How do I configure memory before an experiment?",
    "intent": "procedural",
    "targetKind": "procedural"
  },
  {
    "query": "Как настроить нейронную память для эксперимента?",
    "intent": "procedural",
    "targetKind": "procedural"
  },
  {
    "query": "Пошаговая инструкция по сохранению памяти",
    "intent": "procedural",
    "targetKind": "procedural"
  },
  {
    "query": "What remains unfinished for the memory experiment?",
    "intent": "goal",
    "targetKind": "working"
  },
  {
    "query": "Какие планы остались по эксперименту памяти?",
    "intent": "goal",
    "targetKind": "working"
  },
  {
    "query": "Что дальше по моей цели памяти?",
    "intent": "goal",
    "targetKind": "working"
  },
  {
    "query": "Why did the memory experiment change the outcome?",
    "intent": "causal",
    "targetKind": "episodic"
  },
  {
    "query": "Почему эксперимент изменил результат?",
    "intent": "causal",
    "targetKind": "episodic"
  },
  {
    "query": "What is the cause of the memory failure?",
    "intent": "causal",
    "targetKind": "episodic"
  },
  {
    "query": "What is episodic memory?",
    "intent": "factual",
    "targetKind": "semantic"
  },
  {
    "query": "Что такое эпизодическая память?",
    "intent": "factual",
    "targetKind": "semantic"
  },
  {
    "query": "Дай определение семантической памяти",
    "intent": "factual",
    "targetKind": "semantic"
  }
];

let intentCorrect = 0;
let hitsAtOne = 0;
let reciprocalRankTotal = 0;
const details = [];

for (const [index, fixture] of fixtures.entries()) {
  // Keep lexical evidence identical across target and decoys so this suite isolates intent/type ranking.
  // The independent grounded-abstention suite separately verifies that unsupported queries are rejected.
  const sharedContent = `${sharedBaseContent} ${fixture.query}`;
  assert.equal(detectMemoryQueryIntent(fixture.query), fixture.intent, 'intent classification: ' + fixture.query);
  intentCorrect++;

  const memory = new MemoryOS2({ embeddingProvider: null });
  const targetId = 'z-gold-target-' + index;
  const isIdentity = fixture.intent === 'identity';
  const isGoal = fixture.intent === 'goal';
  const isCausal = fixture.intent === 'causal';
  const targetContext = isIdentity
    ? {}
    : fixture.lineageKey
      ? { [fixture.lineageKey]: 'gold-session-' + index }
      : isGoal
        ? { goalId: 'gold-goal-' + index }
        : isCausal
          ? { observationId: 'gold-observation-' + index, decisionId: 'gold-decision-' + index, outcomeDirection: 'positive' }
          : {};
  memory.encode({
    id: targetId,
    content: sharedContent,
    kind: fixture.targetKind,
    source: 'goldset-fixture',
    context: targetContext,
    tags: [],
    salience: .5,
    emotionalWeight: .2,
    identityRelevance: isIdentity ? .8 : .1,
    goalRelevance: isGoal ? .9 : .1,
    socialRelevance: .2,
    predictionError: .1,
    confidence: .9,
    epistemicStatus: 'fact',
    entities: [],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: isCausal ? ['gold-cause-' + index] : [],
  });
  memory.encode({
    id: 'a-semantic-decoy',
    content: sharedContent,
    kind: fixture.intent === 'factual' ? 'episodic' : 'semantic',
    source: 'goldset-decoy',
    context: {},
    tags: [],
    salience: .5,
    emotionalWeight: .2,
    identityRelevance: .1,
    goalRelevance: .1,
    socialRelevance: .1,
    predictionError: .1,
    confidence: .9,
    epistemicStatus: 'fact',
    entities: [],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
  });
  memory.encode({
    id: 'b-fragment-only-decoy',
    content: sharedContent,
    kind: 'social',
    source: 'goldset-decoy',
    context: { relationshipId: 'relationship-' + index, conversationRole: 'assistant', messageIndex: '3', turnSequence: '7' },
    tags: [],
    salience: .5,
    emotionalWeight: .2,
    identityRelevance: .1,
    goalRelevance: .1,
    socialRelevance: .1,
    predictionError: .1,
    confidence: .9,
    epistemicStatus: 'fact',
    entities: [],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
  });

  const rows = memory.retrieve(fixture.query, 3, isGoal ? .9 : .1, isIdentity ? .9 : .1);
  const rank = rows.findIndex(row => row.id === targetId);
  if (rank === 0) hitsAtOne++;
  if (rank >= 0) reciprocalRankTotal += 1 / (rank + 1);
  details.push({ intent: fixture.intent, targetRank: rank < 0 ? null : rank + 1, keyFormat: fixture.lineageKey ?? (isGoal ? 'goalId' : isCausal ? 'decisionId+observationId' : fixture.targetKind) });
}

const recallAt1 = hitsAtOne / fixtures.length;
const meanReciprocalRank = reciprocalRankTotal / fixtures.length;
const intentAccuracy = intentCorrect / fixtures.length;
assert.equal(intentAccuracy, 1, 'all supported recall phrasings must route correctly');
assert.equal(recallAt1, 1, 'all exact lexical-tie gold targets must win at rank 1');
assert.equal(meanReciprocalRank, 1, 'gold-target MRR must be 1 for the exact-tie fixture');

console.log('MEMORY_RECALL_GOLDSET_WORKPASS568=PASS', JSON.stringify({
  protocol: 'deterministic lexical-tie fixture, not a production-corpus estimate',
  queryCount: fixtures.length,
  intentsCovered: [...new Set(fixtures.map(fixture => fixture.intent))],
  queriesPerIntent: Object.fromEntries([...new Set(fixtures.map(fixture => fixture.intent))].map(intent => [intent, fixtures.filter(fixture => fixture.intent === intent).length])),
  intentAccuracy,
  recallAt1,
  meanReciprocalRank,
  details,
}));
