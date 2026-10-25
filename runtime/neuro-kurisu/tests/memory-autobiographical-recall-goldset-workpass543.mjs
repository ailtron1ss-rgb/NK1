import assert from 'node:assert/strict';
import { MemoryOS2, detectMemoryQueryIntent } from '../src/organism/developmental/MemoryOS2.ts';

const now = Date.now();
const sharedContent = 'neural memory experiment dialogue нейронная память эксперимент диалог';
const fixtures = [
  { query: 'Что ты помнишь обо мне и моих интересах?', intent: 'identity' },
  { query: 'Что ты знаешь обо мне и моих интересах?', intent: 'identity' },
  { query: 'Какие у меня интересы?', intent: 'identity' },
  { query: 'Что мне нравится?', intent: 'identity' },
  { query: 'Чем я интересуюсь?', intent: 'identity' },
  { query: 'What do you remember about me and my preferences?', intent: 'identity' },
  { query: 'What do you know about me?', intent: 'identity' },
  { query: 'What have you learned about me?', intent: 'identity' },
  { query: 'Что мы обсуждали в прошлый раз про нейронную память?', intent: 'episodic', lineageKey: 'sessionId' },
  { query: 'Вспомни, что мы обсуждали про эксперимент', intent: 'episodic', lineageKey: 'session_id' },
  { query: 'Что ты помнишь о нашем прошлом разговоре про эксперимент?', intent: 'episodic', lineageKey: 'session-id' },
  { query: 'Напомни, что мы обсуждали про память', intent: 'episodic', lineageKey: 'session id' },
  { query: 'Восстанови контекст нашего чата про эксперимент', intent: 'episodic', lineageKey: 'threadId' },
  { query: 'What do you remember about our previous conversation on memory?', intent: 'episodic', lineageKey: 'conversation_key' },
  { query: 'What did we discuss last time about memory?', intent: 'episodic', lineageKey: 'chat-id' },
  { query: 'Can you remind me what we discussed last time?', intent: 'episodic', lineageKey: 'transcriptId' },
  { query: 'Recall our previous discussion about memory', intent: 'episodic', lineageKey: 'dialogue_key' },
  { query: 'What happened in our previous conversation?', intent: 'episodic', lineageKey: 'sessionId' },
];

let intentCorrect = 0;
let hitsAtOne = 0;
let reciprocalRankTotal = 0;
const details = [];

for (const [index, fixture] of fixtures.entries()) {
  assert.equal(
    detectMemoryQueryIntent(fixture.query),
    fixture.intent,
    'intent classification: ' + fixture.query,
  );
  intentCorrect++;

  const memory = new MemoryOS2({ embeddingProvider: null });
  const targetId = 'z-gold-target-' + index;
  const isIdentity = fixture.intent === 'identity';
  memory.encode({
    id: targetId,
    content: sharedContent,
    kind: isIdentity ? 'identity' : 'social',
    source: 'goldset-fixture',
    context: isIdentity ? {} : { [fixture.lineageKey]: 'gold-session-' + index },
    tags: [],
    salience: .5,
    emotionalWeight: .2,
    identityRelevance: isIdentity ? .8 : .1,
    goalRelevance: .1,
    socialRelevance: .2,
    predictionError: .1,
    confidence: .9,
    epistemicStatus: 'fact',
    entities: [],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
  });
  memory.encode({
    id: 'a-semantic-decoy',
    content: sharedContent,
    kind: 'semantic',
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

  const rows = memory.retrieve(
    fixture.query,
    3,
    .1,
    isIdentity ? .9 : .1,
  );
  const rank = rows.findIndex(row => row.id === targetId);
  if (rank === 0) hitsAtOne++;
  if (rank >= 0) reciprocalRankTotal += 1 / (rank + 1);
  details.push({ intent: fixture.intent, targetRank: rank < 0 ? null : rank + 1, keyFormat: fixture.lineageKey ?? 'identity' });
}

const recallAt1 = hitsAtOne / fixtures.length;
const meanReciprocalRank = reciprocalRankTotal / fixtures.length;
const intentAccuracy = intentCorrect / fixtures.length;
assert.equal(intentAccuracy, 1, 'all supported recall phrasings must route correctly');
assert.equal(recallAt1, 1, 'all exact lexical-tie gold targets must win at rank 1');
assert.equal(meanReciprocalRank, 1, 'gold-target MRR must be 1 for the exact-tie fixture');

console.log('MEMORY_AUTOBIOGRAPHICAL_RECALL_GOLDSET_WORKPASS543=PASS', JSON.stringify({
  protocol: 'deterministic lexical-tie fixture, not a production-corpus estimate',
  queryCount: fixtures.length,
  intentAccuracy,
  recallAt1,
  meanReciprocalRank,
  details,
}));
