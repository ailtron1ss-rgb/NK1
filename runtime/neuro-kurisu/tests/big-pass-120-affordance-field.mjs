import assert from 'node:assert/strict';
import { projectDecisionAgencyEvidence } from '../src/organism/system/AffordanceField.ts';

const actions = ['respond','explore','verify','rest','reflect','wait','defer','respond'];
const candidates = actions.map((action, i) => ({
  id: `candidate-${i}`, action, score: i === 7 ? .03 : .95 - i * .1,
  predictedUtility: .7 - i * .04, predictedNeedRelief: .2, predictedCost: .1 + i * .02,
  confidence: .8 - i * .03, generatedAt: 10, worldPredictionId: i % 2 ? `world-${i}` : undefined,
  ...(i === 3 ? { goalId: 'goal-verification' } : {}),
}));
const projected = projectDecisionAgencyEvidence({
  tick: 42, candidates, selected: candidates[7], attentionBudget01: .25,
  requestedAction: 'explore',
  predictedOutcomes: [{ action: 'explore', utility: .6, confidence: .7, reasons: ['evidence-needed'], worldEvidence: ['observation:fixture'], nextState: { energy: .5, cognitiveLoad: .4, uncertainty: .3, novelty: .2 } }],
});
assert.equal(projected.version, 1);
assert.equal(projected.affectsSelection, false, 'the projection cannot become a competing policy owner');
assert.equal(projected.selectionOwner, 'OrganismCore-canonical-arbiters');
assert.equal(projected.attentionWidth, 4);
assert.equal(projected.affordances.length, 4);
assert.ok(projected.affordances.some((row) => row.candidateId === 'candidate-7' && row.selected), 'selected row is retained when field is attention-bounded');
assert.equal(projected.candidateCount, 8);
assert.equal(projected.omittedCandidateIds.length, 4);
assert.equal(projected.selectedBelongsToCandidates, true);
assert.equal(projected.competition.contest, 'selected-below-best-score');
assert.ok(projected.affordances.some((row) => row.reasons.includes('evidence-needed')));
const missing = projectDecisionAgencyEvidence({ tick: 1, candidates: [], selected: { ...candidates[0], id: 'not-in-set' }, attentionBudget01: 0 });
assert.equal(missing.selectedBelongsToCandidates, false);
assert.equal(missing.competition.contest, 'selection-not-in-candidates');
console.log('BIG_PASS_120_AFFORDANCE_FIELD=PASS', JSON.stringify({ candidateCount: projected.candidateCount, surfaced: projected.affordances.length, width: projected.attentionWidth, contest: projected.competition.contest }));
