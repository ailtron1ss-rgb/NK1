import assert from 'node:assert/strict';
import { InternalDialogueEngine, sanitizeInternalDialogueText } from '../src/organism/cognition/InternalDialogueEngine.ts';
import { buildCognitiveProposalPrompt } from '../src/organism/language/LanguageOrgan.ts';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';
import { bindCognitiveEventEvidence } from '../src/organism/cognition/CognitiveEventEvidenceBridge.ts';

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

const mixedCoverage = engine.deliberate({
  tick: 7, focus: 'Calibrate gaps across multiple candidates',
  claims: [
    { id: 'evidence-backed', action: 'verify', priorConfidence01: .6, supportingEvidenceIds: ['clear-outcome'] },
    { id: 'no-evidence', action: 'respond', priorConfidence01: .7 },
  ],
  evidence: [{ id: 'clear-outcome', kind: 'outcome', confidence01: 1, sourceGroup: 'run-one' }],
});
assert.ok(mixedCoverage.evidenceCoverage01 > .39 && mixedCoverage.evidenceCoverage01 < .41,
  'an unsupported candidate counts as one zero-coverage row, not a second multiplicative penalty');

const sameEvidenceConflict = engine.deliberate({
  tick: 8, focus: 'One evidence identity declared both supportive and contradictory',
  claims: [{ id: 'ambiguous', action: 'respond', priorConfidence01: .9, actionability01: .8, risk01: .1, supportingEvidenceIds: ['same-row'], contradictingEvidenceIds: ['same-row'] }],
  evidence: [{ id: 'same-row', kind: 'outcome', confidence01: .95 }],
});
assert.equal(sameEvidenceConflict.candidateScores[0].supportingEvidenceCount, 0,
  'contradiction wins when one identity is declared in both evidence sets');
assert.equal(sameEvidenceConflict.candidateScores[0].contradictingEvidenceCount, 1);
assert.equal(sameEvidenceConflict.recommendedNextStep, 'seek-evidence');

const contradictionOnlyOneSource = engine.deliberate({
  tick: 9, focus: 'Contradictions must not earn an independent-support bonus',
  claims: [{ id: 'bad', action: 'verify', priorConfidence01: .5, actionability01: .5, risk01: .5, contradictingEvidenceIds: ['bad-1'] }],
  evidence: [{ id: 'bad-1', kind: 'outcome', confidence01: .9, sourceGroup: 'bad-source-one' }],
});
const contradictionOnlyTwoSources = engine.deliberate({
  tick: 10, focus: 'Multiple contradictory sources must not improve the candidate score',
  claims: [{ id: 'bad', action: 'verify', priorConfidence01: .5, actionability01: .5, risk01: .5, contradictingEvidenceIds: ['bad-1', 'bad-2'] }],
  evidence: [
    { id: 'bad-1', kind: 'outcome', confidence01: .9, sourceGroup: 'bad-source-one' },
    { id: 'bad-2', kind: 'outcome', confidence01: .9, sourceGroup: 'bad-source-two' },
  ],
});
assert.equal(contradictionOnlyOneSource.candidateScores[0].score01, contradictionOnlyTwoSources.candidateScores[0].score01,
  'independent-source bonus counts support, never contradictions');

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
const causalFabric = new CognitiveEventFabric();
const stageIds = causalFabric.recordOperationalCycle({
  tick: 11,
  observation: { source: 'test-observation', external: true, confidence01: .94, payload: { source: 'independent-sensor' } },
  prediction: { source: 'test-prediction', confidence01: .7, payload: { action: 'verify' } },
  plan: { source: 'test-plan', confidence01: .85, payload: { action: 'verify' } },
  action: { source: 'test-action', confidence01: .85, payload: { action: 'verify' } },
  outcome: { source: 'test-outcome', external: true, confidence01: .94, payload: { success: true, reward: .92 } },
  learning: { source: 'test-learning', confidence01: .8, payload: { updated: true } },
  selfUpdate: { source: 'test-self-update', confidence01: .8, payload: { reflected: true } },
});
const causalSnapshot = causalFabric.snapshot();
const seedClaims = [
  { id: 'candidate-1', action: 'respond', supportingEvidenceIds: [], contradictingEvidenceIds: [] },
  { id: 'candidate-2', action: 'verify', supportingEvidenceIds: [], contradictingEvidenceIds: [] },
];
const linked = bindCognitiveEventEvidence(seedClaims, [], causalSnapshot);
assert.equal(linked.linkedOutcomeEvents, 1, 'causal outcome must bind only through a direct action parent and explicit action identity');
assert.ok(linked.claims.find((claim) => claim.id === 'candidate-2')?.supportingEvidenceIds?.length === 1);
assert.equal(linked.claims.find((claim) => claim.id === 'candidate-1')?.supportingEvidenceIds?.length, 0);
assert.equal(linked.evidence[0].kind, 'outcome');
const toolFabric = new CognitiveEventFabric();
const planIds = toolFabric.recordOperationalCycle({
  tick: 20,
  observation: { source: 'observation-source', confidence01: .8, payload: { seen: true } },
  prediction: { source: 'prediction-source', confidence01: .75, payload: { action: 'verify' } },
  plan: { source: 'plan-source', confidence01: .85, payload: { action: 'verify' } },
  action: { source: 'action-source', confidence01: .85, payload: { action: 'verify' } },
  outcome: { source: 'outcome-source', external: true, confidence01: .9, payload: { success: true, reward: .9 } },
  learning: { source: 'learning-source', confidence01: .8, payload: { learned: true } },
  selfUpdate: { source: 'self-update-source', confidence01: .8, payload: { reviewed: true } },
});
toolFabric.appendToolReceiptTrace({
  tick: 21, executionId: 'exec-internal-dialogue-1', toolId: 'device.inspect',
  decisionId: planIds.plan, ok: true, verified: false, outcomeClass: 'executed-unverified',
  confidence01: .68, verificationBasis: 'none', externalObservation: false,
  observationIntegrated: false, at: 200000,
});
const externalObservation = toolFabric.appendToolExternalObservation({
  tick: 22, executionId: 'exec-internal-dialogue-1', toolId: 'device.inspect',
  observationId: 'obs-independent-1', verified: true, confidence01: .97,
  sourceId: 'sensor-gamma', sourceClass: 'device', channel: 'sensor',
  independenceKey: 'sensor-bus-gamma', expectedPostcondition: 'position=ready',
  observedPostcondition: 'position=ready', at: 210000,
});
assert.equal(externalObservation.resolved, true);
const toolEvidenceSnapshot = toolFabric.snapshot();
const externalBound = bindCognitiveEventEvidence(seedClaims, [], toolEvidenceSnapshot);
assert.equal(externalBound.linkedIndependentObservations, 1, 'late independent observation must retain its causal tool-receipt lineage');
assert.ok(externalBound.claims.find((claim) => claim.id === 'candidate-2')?.supportingEvidenceIds?.length === 1);

assert.equal(externalBound.evidence[0].kind, 'observation');
const missingIndependenceSnapshot = structuredClone(toolEvidenceSnapshot);
const independentRow = missingIndependenceSnapshot.recent.find((row) => row.stage === 'external-evidence');
assert.ok(independentRow);
independentRow.payload.independenceKey = '';
assert.equal(bindCognitiveEventEvidence(seedClaims, [], missingIndependenceSnapshot).linkedIndependentObservations, 0,
  'an external observation without an independence key must not become evidence');
const danglingSnapshot = structuredClone(causalSnapshot);
const outcomeRow = danglingSnapshot.recent.find((row) => row.stage === 'outcome');
assert.ok(outcomeRow);
outcomeRow.parentIds = ['missing-action-parent'];
assert.equal(bindCognitiveEventEvidence(seedClaims, [], danglingSnapshot).linkedOutcomeEvents, 0,
  'an outcome without an exact action parent must not become evidence');
const proposalPrompt = buildCognitiveProposalPrompt(
  cycle,
  'A grounded observation about two competing action hypotheses.',
  entityContext,
  '',
  toolEvidenceSnapshot,
);
const wholePrompt = proposalPrompt.system + '\n' + proposalPrompt.user;
assert.match(wholePrompt, /INTERNAL DIALOGUE REVIEW/);
assert.match(wholePrompt, /advisoryOnly/);
assert.match(wholePrompt, /candidate-1/);
assert.match(wholePrompt, /cef_/ , 'linked causal evidence IDs should appear in the bounded internal audit');
assert.match(wholePrompt, /selected_action=reflect/);
assert.match(wholePrompt, /A verified memory says the user prefers clear technical explanations/);
assert.doesNotMatch(wholePrompt, /hunter2|curator@example\.com/);
assert.match(wholePrompt, /Do not expose the private turn notes/);
console.log('NK1_INTERNAL_DIALOGUE_WORKPASS319=PASS cases=13 bounded-dialogue=true evidence-ranking=true contradiction-audit=true privacy-filter=true proposal-wiring=true planner-authority-preserved=true');
