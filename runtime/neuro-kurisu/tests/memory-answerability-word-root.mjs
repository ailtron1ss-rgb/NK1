import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

// The answerability gate must treat a shared word-root as grounding evidence even
// when the root is only four characters ("live"/"lives") and stopwords dilute
// average lexical coverage. A fixed five-character prefix rule previously
// abstained on these questions, so the current revision became unreachable.

const now = 2_000_000_000_000;
function encode(memory, input) {
  return memory.encode({
    id: input.id,
    content: input.content,
    kind: input.kind ?? 'semantic',
    source: 'answerability-word-root-fixture',
    tags: [],
    context: {},
    salience: .6,
    emotionalWeight: .1,
    identityRelevance: .2,
    goalRelevance: .2,
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

// A four-character stem ("live" → "lives") must ground the memory.
const shortStem = new MemoryOS2();
encode(shortStem, { id: 'alice-paris', content: 'Alice lives in Paris' });
const liveResult = shortStem.retrieve('where does Alice live?', 4, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.ok(
  liveResult.some(row => row.id === 'alice-paris'),
  'a four-character word root must ground a legitimate question',
);
assert.equal(shortStem.retrievalDiagnostics().abstained, false);

// A longer inflectional stem ("authenticate" → "authentication") must also ground.
const longStem = new MemoryOS2();
encode(longStem, { id: 'credential-recovery', content: 'Login credential recovery restores account access when authentication is lost.' });
encode(longStem, { id: 'palette-decoy', content: 'The avatar palette uses a blue background and compact interface controls.' });
const authResult = longStem.retrieve('I cannot authenticate to my user profile', 4, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.equal(authResult[0]?.id, 'credential-recovery');

// Unrelated short words must NOT be treated as a shared root: the gate still
// abstains for a genuinely unmatched query over a populated corpus.
const noMatch = new MemoryOS2();
encode(noMatch, { id: 'unrelated', content: 'The report describes orbital mechanics and payload staging.' });
const unmatched = noMatch.retrieve('qzxv glarpen unikora orbital 9472 9xq', 4, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.deepEqual(unmatched, [], 'unrelated queries must still abstain');

console.log('MEMORY_ANSWERABILITY_WORD_ROOT=PASS', JSON.stringify({
  liveHits: liveResult.map(row => row.id),
  authTop: authResult[0]?.id,
  abstainedUnrelated: noMatch.retrievalDiagnostics().abstained,
}));
