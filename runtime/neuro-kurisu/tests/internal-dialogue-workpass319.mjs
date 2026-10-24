import assert from 'node:assert/strict';
import { InternalDialogueEngine, sanitizeInternalDialogueText } from '../src/organism/cognition/InternalDialogueEngine.ts';
import { buildCognitiveProposalPrompt } from '../src/organism/language/LanguageOrgan.ts';

const engine = new InternalDialogueEngine();
const strong = engine.deliberate({
  tick: 1,
  focus: 'Compare the possible actions using observed outcomes',
  goal: 'Make a calibrated choice',
  claims: [
    { id: 'verify', action: 'verify', priorConfidence01: .55, actionability01: .9, risk01: .2, supportingEvidenceIds: ['outcome-1', 'outcome-2'] },
    { id: 'guess', action: 'respond', priorConfidence01: .8, actionability01: .8, risk01: .4, supportingEvidenceIds: ['prediction-1'] },
  ],
  evidence: [
    { id: 'outcome-1', kind: 'outcome', confidence01: .95, sourceGroup: 'run-a' },
    { id: 'outcome-2', kind: 'outcome', confidence01: .9, sourceGroup: 'run-b' },
    { id: 'prediction-1', kind: 'prediction', confidence01: .8, sourceGroup: 'predictor' },
  ],
  knownUnknowns: ['Whether the result transfers to a different context'],
});
assert.equal(strong.advisoryOnly, true);
assert.equal(strong.turnCount, 6);
assert.equal(strong.candidateScores[0].id, 'verify', 'independent outcomes should outrank a prediction-only claim');
assert.ok(strong.evidenceCoverage01 > 0.5);
assert.ok(strong.unresolvedQuestions.some((x) => /transfers/.test(x)));
assert.equal(strong.suggestedAction, 'verify', 'dialogue recommendation is advisory and does not authorize execution');
assert.ok(strong.turns.some((t) => t.role === 'critic'));
assert.ok(strong.turns.some((t) => t.role === 'metacognition'));

const contradictory = engine.deliberate({
  tick: 2,
  focus: 'Test a claim against evidence',
  claims: [{ id: 'claim-a', action: 'respond', priorConfidence01: .9, actionability01: .8, risk01: .1, supportingEvidenceIds: ['support'], contradictingEvidenceIds: ['counter'] }],
  evidence: [
    { id: 'support', kind: 'memory', confidence01: .4 },
    { id: 'counter', kind: 'outcome', confidence01: 1 },
  ],
});
assert.ok(contradictory.contradiction01 > 0);
assert.equal(contradictory.recommendedNextStep, 'seek-evidence');
assert.ok(contradictory.uncertainty01 > 0.3);

const unsupported = engine.deliberate({
  tick: 3,
  focus: 'Review a claim with no supporting source',
  claims: [{ id: 'unsupported', action: 'respond', priorConfidence01: 1, actionability01: 1, risk01: 0 }],
  evidence: [],
});
assert.equal(unsupported.evidenceCoverage01, 0);
assert.equal(unsupported.status, 'needs-evidence');
assert.ok(unsupported.unresolvedQuestions.some((x) => /no linked evidence/.test(x)));
assert.equal(unsupported.suggestedAction, 'verify');

const empty = engine.deliberate({ tick: 4, focus: 'No hypotheses yet', claims: [], evidence: [], maxTurns: 4 });
assert.equal(empty.suggestedAction, 'explore');
assert.equal(empty.turnCount, 4);
assert.equal(empty.leadingClaimId, null);

const paused = engine.deliberate({
  tick: 5, focus: 'Pause under high cognitive load',
  claims: [{ id: 'a', action: 'respond' }], evidence: [], cognitiveLoad01: .99,
});
assert.equal(paused.recommendedNextStep, 'pause');
assert.equal(paused.suggestedAction, 'rest');

assert.equal(sanitizeInternalDialogueText('Use password hunter2 and curator@example.com'), null);
assert.equal(sanitizeInternalDialogueText('A grounded lesson from independent observed outcomes'), 'A grounded lesson from independent observed outcomes');
assert.throws(() => engine.deliberate(null), /internal-dialogue-input-must-be-object/);
assert.throws(() => engine.deliberate({ tick: -1, focus: 'Not valid', claims: [], evidence: [] }), /tick-must-be-nonnegative/);
assert.throws(() => engine.deliberate({ tick: 1, focus: ' ', claims: [], evidence: [] }), /focus-required/);

// Duplicate evidence identities are first-write-wins and cannot inflate evidence coverage.
const duplicate = engine.deliberate({
  tick: 6, focus: 'Check duplicate source identity',
  claims: [{ id: 'd', action: 'verify', priorConfidence01: .5, supportingEvidenceIds: ['same'] }],
  evidence: [
    { id: 'same', kind: 'outcome', confidence01: .2 },
    { id: 'same', kind: 'outcome', confidence01: 1 },
  ],
});
assert.ok(duplicate.evidenceCoverage01 < .3);

// The internal review is actually wired into proposal construction, but cannot replace core authority.
const cycle = {
  decision: {
    selected: { action: 'reflect', goalId: null },
    candidates: [
      { id: 'cand-respond', action: 'respond', score: .8, predictedUtility: .8, predictedNeedRelief: .5, predictedCost: .4, confidence: .65, generatedAt: 1, worldPredictionId: 'ticket-1' },
      { id: 'cand-verify', action: 'verify', score: .76, predictedUtility: .7, predictedNeedRelief: .4, predictedCost: .2, confidence: .7, generatedAt: 1, worldPredictionId: 'ticket-2' },
    ],
  },
  goals: [],
  state: {
    tick: 12, predictionError: .44, selfPredictionError: .2, worldContextVersion: 1,
    lastAction: 'respond', lastActionSuccess: .2,
    needs: { energy: .7, cognitiveLoad: .2, uncertainty: .74, novelty: .8, socialNeed: .5, identityCoherence: .8, goalPressure: .5 },
  },
  memories: [],
  workspace: { content: {} },
};
const entityContext = {
  schemaVersion: 1, handle: 'user', evidenceMode: 'bounded-high-confidence-canonical-memory',
  advisoryOnly: true, noteAuthority: 'data-not-instructions',
  facts: [
    { memoryId: 'private-fact', statement: 'Password hunter2 and curator@example.com are private', confidence01: .99, source: 'test', observedAt: 100 },
    { memoryId: 'safe-fact', statement: 'A verified memory says the user prefers clear technical explanations', confidence01: .91, source: 'test', observedAt: 200 },
  ],
};
const proposalPrompt = buildCognitiveProposalPrompt(cycle, 'A grounded observation about two competing action hypotheses.', entityContext);
const wholePrompt = proposalPrompt.system + '\n' + proposalPrompt.user;
assert.match(wholePrompt, /INTERNAL DIALOGUE REVIEW/);
assert.match(wholePrompt, /advisoryOnly/);
assert.match(wholePrompt, /candidate-1/);
assert.match(wholePrompt, /selected_action=reflect/);
assert.match(wholePrompt, /A verified memory says the user prefers clear technical explanations/);
assert.doesNotMatch(wholePrompt, /hunter2|curator@example\.com/);
assert.match(wholePrompt, /Do not expose the private turn notes/);
console.log('NK1_INTERNAL_DIALOGUE_WORKPASS319=PASS bounded-dialogue=true evidence-ranking=true contradiction-audit=true privacy-filter=true proposal-wiring=true planner-authority-preserved=true');
