import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const now = 2_000_000_000_000;
function encode(memory, input) {
  return memory.encode({
    id: input.id,
    content: input.content,
    kind: input.kind,
    source: 'grounded-abstention-fixture',
    tags: [],
    context: {},
    salience: .55,
    emotionalWeight: .15,
    identityRelevance: input.kind === 'identity' ? .95 : .1,
    goalRelevance: input.kind === 'working' ? .85 : .1,
    socialRelevance: .1,
    predictionError: .1,
    confidence: .9,
    epistemicStatus: 'fact',
    entities: [],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
    contradictionLinks: [],
    validFromAt: now - 10_000,
    observedAt: now - 10_000,
  });
}

// A populated corpus must not turn a no-match query into an answer merely because
// recent/high-salience rows are available as bounded fallback candidates.
const noMatch = new MemoryOS2();
encode(noMatch, {
  id: 'memory-identity-1',
  kind: 'identity',
  content: 'The user prefers concise Russian explanations and direct technical reasoning.',
});
encode(noMatch, {
  id: 'memory-episode-1',
  kind: 'episodic',
  content: 'The last discussion covered memory consolidation and retrieval quality.',
});
const unknownQuery = 'qzxv glarpen unikora orbital 9472 9xq';
const unsupported = noMatch.retrieve(unknownQuery, 8, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.deepEqual(unsupported, [], 'no grounded overlap must abstain instead of returning unrelated fallback memories');
const noMatchDiagnostics = noMatch.retrievalDiagnostics();
assert.equal(noMatchDiagnostics.answerabilityGate, 'direct-evidence-or-typed-recall-v1');
assert.equal(noMatchDiagnostics.abstained, true);
assert.equal(noMatchDiagnostics.groundedAfterGate, 0);
assert.equal(noMatchDiagnostics.abstentionReason, 'no-grounded-evidence');

// Category-specific recall intentionally works when the user asks for a memory
// category rather than mentioning its exact content in the prompt.
const profile = noMatch.retrieve('What do you remember about me?', 4, 0, 1, { temporalMode: 'at', asOfAt: now });
assert.equal(profile[0]?.id, 'memory-identity-1', 'identity recall should use a typed memory path');
const episode = noMatch.retrieve('What happened last time?', 4, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.equal(episode[0]?.id, 'memory-episode-1', 'episodic recall should remain available without exact content terms');
assert.equal(noMatch.retrievalDiagnostics().abstained, false);

// Stable identifier lookup is high-confidence evidence even when surrounding query
// words dilute lexical coverage. This is separate from broad, unsupported recall.
const identifierRecall = new MemoryOS2();
encode(identifierRecall, {
  id: 'run-501-memory',
  kind: 'semantic',
  content: 'RUN-501: Run 501 must prefer external-world evidence.',
});
encode(identifierRecall, {
  id: 'identifier-decoy',
  kind: 'semantic',
  content: 'Policy for mobile continuity verification and durable memory consistency.',
});
const explicitIdentifier = identifierRecall.retrieve('What is the policy for RUN-501?', 3, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.ok(
  explicitIdentifier.some(row => row.id === 'run-501-memory'),
  'exact identifier evidence must survive the answerability gate',
);

// Grounded lexical recall should remain ranked ahead of unrelated high-salience data.
const lexical = new MemoryOS2();
encode(lexical, {
  id: 'correct',
  kind: 'semantic',
  content: 'The violet compass migration moved the routing service to the new cluster.',
});
encode(lexical, {
  id: 'unrelated-high-salience',
  kind: 'semantic',
  content: 'A cloud storage note about unrelated backups and account maintenance.',
});
const found = lexical.retrieve('violet compass migration routing', 4, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.equal(found[0]?.id, 'correct');
assert.ok(found.every(row => row.id !== 'unrelated-high-salience' || /violet|compass|migration|routing/i.test(row.content)));
assert.equal(lexical.retrievalDiagnostics().groundedAfterGate, found.length);

console.log('MEMORY_RETRIEVAL_GROUNDED_ABSTENTION_WORKPASS579=PASS', JSON.stringify({
  noMatchReturned: unsupported.length,
  profileRecall: profile[0]?.id,
  episodicRecall: episode[0]?.id,
  groundedResultCount: found.length,
}));
