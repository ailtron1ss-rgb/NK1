import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

// Tip-of-tongue partial activation. Adapted from Hexis's find_partial_activations
// (MIT, db/18_functions_tip_of_tongue.sql): report a concept the query activates
// while no stored memory carries it. In NK1 the "cluster" is a compact bilingual
// concept group and the member test is lexical presence, so the signal is
// embedding-free and can only *name* an unanswerable topic -- it never fabricates
// recall. It is exposed on retrieval diagnostics for an abstained query and must be
// empty whenever retrieval is grounded.

const now = 2_000_000_000_000;
const encode = (memory, content, kind = 'semantic') => memory.encode({
  content,
  kind,
  source: 'tip-of-tongue-fixture',
  validFromAt: now - 10_000,
  observedAt: now - 10_000,
});

// Corpus is entirely about memory/recall; the query asks about goals/plans, a
// concept group the corpus does not carry.
const memory = new MemoryOS2();
encode(memory, 'The last discussion covered memory consolidation and retrieval quality.');
encode(memory, 'A note about memory recall and past recollections.');

const abstained = memory.retrieve('what are my unfinished goals and plans', 8, 0, 0, { temporalMode: 'at', asOfAt: now });
const abstainedDiagnostics = memory.retrievalDiagnostics();
assert.deepEqual(abstained, [], 'an unsupported concept query must still abstain');
assert.equal(abstainedDiagnostics.abstained, true);
assert.equal(abstainedDiagnostics.abstentionReason, 'no-grounded-evidence');
assert.ok(abstainedDiagnostics.partialActivations.length >= 1, 'abstention must name the concept the query activates');
const goalActivation = abstainedDiagnostics.partialActivations.find(entry => entry.queryTermMatches.some(term => term === 'goal' || term === 'unfinished' || term === 'plan' || term === 'цель'));
assert.ok(goalActivation, 'the goal/plan concept group must be reported as a partial activation');
assert.equal(goalActivation.bestLexicalSupport01, 0, 'a partial activation has no stored memory supporting it');

// A grounded query must not report partial activations: the concept was answerable.
const grounded = memory.retrieve('memory consolidation retrieval quality', 8, 0, 0, { temporalMode: 'at', asOfAt: now });
assert.ok(grounded.length > 0, 'the lexical query must return memories');
assert.deepEqual(memory.retrievalDiagnostics().partialActivations, [], 'grounded recall reports no partial activation');

// Partial activation must not leak recall: an unrelated concept still returns nothing.
assert.deepEqual(memory.retrieve('avatar body gesture pose motion', 8, 0, 0, { temporalMode: 'at', asOfAt: now }), []);

console.log('MEMORY_TIP_OF_TONGUE_PARTIAL_ACTIVATION=PASS', JSON.stringify({
  abstained: abstainedDiagnostics.abstained,
  partialGroups: abstainedDiagnostics.partialActivations.length,
  groundedPartial: memory.retrievalDiagnostics().partialActivations.length,
}));
