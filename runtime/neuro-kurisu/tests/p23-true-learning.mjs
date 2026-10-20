import assert from 'node:assert/strict';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';
import { AdaptivePolicyEngine } from '../src/organism/learning/AdaptivePolicyEngine.ts';

const learning = new P23LearningEngine();
const policy = new AdaptivePolicyEngine();
const baseNeeds = (overrides={}) => ({ energy:.72, cognitiveLoad:.24, uncertainty:.42, socialNeed:.32, novelty:.45, identityCoherence:.86, goalPressure:.22, ...overrides });
const stateBefore = (overrides={}) => ({ version:26,tick:1,at:1,needs:baseNeeds(overrides),predictionError:.2,attentionBudget:.8,lastAction:'wait',lastActionSuccess:null,autonomyScore:.2,selfPredictionError:.1,predictedNextAction:'reflect',lastPredictionConfidence:.6,worldContextVersion:1 });
const makeTrace = (tick, action, success, overrides={}) => ({
  id:`trace-${tick}`,tick,createdAt:tick,candidates:[{id:`c-${tick}`,goalId:undefined,action,score:.72,predictedUtility:.65,predictedNeedRelief:.5,predictedCost:.2,confidence:.7,generatedAt:tick}],
  selected:{id:`c-${tick}`,goalId:undefined,action,score:.72,predictedUtility:.65,predictedNeedRelief:.5,predictedCost:.2,confidence:.7,generatedAt:tick},
  stateBefore:stateBefore(overrides),reasoningSignals:{},userRequestedAction:null,autonomousOverride:false,predictedOutcomes:[{action,utility:.65,confidence:.7,reasons:['test'],nextState:{energy:.7,cognitiveLoad:.25,uncertainty:.4,novelty:.4},worldEvidence:[]}],
  outcome:{success,reward:success,surprise:Math.abs(success-.65),at:tick+1},
});

const traces=[];
for(let i=0;i<12;i++) traces.push(makeTrace(i+1,'verify',i<8?.92:.78,{uncertainty:.72}));
for(const t of traces) learning.recordExperience(t,{...t.stateBefore,tick:t.tick+1,needs:{...t.stateBefore.needs,uncertainty:.38}}, {success:t.outcome.success,reward:t.outcome.reward,surprise:t.outcome.surprise},policy);
assert.equal(learning.snapshot().experiences.length,12);
const firstReplay=learning.replayPending(traces,policy);
assert.ok(firstReplay>=1);
const secondReplay=learning.replayPending(traces,policy);
assert.equal(secondReplay,0);
assert.ok(learning.topSkills().some(s=>s.action==='verify'&&s.status==='promoted'));
assert.ok(learning.skillBias(stateBefore({uncertainty:.72}), 'verify') > 0, 'promoted skill must influence future ranking');
const nearbyTransfer=learning.skillBias(stateBefore({uncertainty:.42}), 'verify');
assert.ok(nearbyTransfer>0&&nearbyTransfer<learning.skillBias(stateBefore({uncertainty:.72}), 'verify'), 'a validated skill should transfer weakly to a one-bucket-neighbor context');
assert.equal(learning.skillBias(stateBefore({energy:.2,uncertainty:.42,novelty:.95,goalPressure:.9,socialNeed:.85}), 'verify'), 0, 'skills must not transfer across dissimilar contexts');

// Retention/forgetting: recently validated skills retain influence, old evidence
// decays, and evidence older than the retention horizon cannot bias selection.
const retentionState = learning.snapshot();
const recentSkill = retentionState.skills.find(s => s.status === 'promoted' && s.action === 'verify');
assert.ok(recentSkill, 'benchmark requires a promoted skill');
const recentBias = learning.skillBias(stateBefore({ uncertainty:.72 }), 'verify');
const agedState = structuredClone(retentionState);
const agedSkill = agedState.skills.find(s => s.id === recentSkill.id);
agedSkill.updatedAt = Date.now() - 90 * 24 * 60 * 60 * 1000;
const agedLearning = new P23LearningEngine();
agedLearning.restore(agedState);
const agedBias = agedLearning.skillBias(stateBefore({ uncertainty:.72 }), 'verify');
assert.ok(agedBias > 0 && agedBias < recentBias, 'stale skills must decay rather than remain permanently dominant');
agedSkill.updatedAt = Date.now() - 181 * 24 * 60 * 60 * 1000;
const forgottenLearning = new P23LearningEngine();
forgottenLearning.restore(agedState);
assert.equal(forgottenLearning.skillBias(stateBefore({ uncertainty:.72 }), 'verify'), 0, 'expired skill evidence must stop influencing action selection');

// Rollback on a deteriorating holdout window: a previously promoted action must
// lose its promoted status when later validation evidence contradicts it.
const rollbackLearning = new P23LearningEngine();
const rollbackPolicy = new AdaptivePolicyEngine();
for (let i = 1; i <= 8; i++) {
  const trace = makeTrace(300 + i, 'verify', .92, { uncertainty:.72 });
  rollbackLearning.recordExperience(trace, trace.stateBefore, { success:.92, reward:.92, surprise:.02 }, rollbackPolicy);
}
assert.ok(rollbackLearning.topSkills().some(s => s.action === 'verify'), 'strong initial evidence should promote the skill');
for (let i = 9; i <= 20; i++) {
  const trace = makeTrace(300 + i, 'verify', .08, { uncertainty:.72 });
  rollbackLearning.recordExperience(trace, trace.stateBefore, { success:.08, reward:.08, surprise:.57 }, rollbackPolicy);
}
assert.equal(rollbackLearning.topSkills().some(s => s.action === 'verify'), false, 'later negative validation evidence must revoke promotion');

// Failed skills should weakly discourage the same action in a tightly neighboring
// context, but must not leak into unrelated states.
const negativeLearning = new P23LearningEngine();
const negativePolicy = new AdaptivePolicyEngine();
for (let i = 0; i < 12; i++) {
  const trace = makeTrace(200 + i, 'verify', .12, { uncertainty:.72 });
  negativeLearning.recordExperience(
    trace,
    { ...trace.stateBefore, tick:trace.tick + 1, needs:{ ...trace.stateBefore.needs, uncertainty:.38 } },
    { success:.12, reward:.12, surprise:.53 },
    negativePolicy,
  );
}
assert.ok(negativeLearning.topSkills().length === 0);
assert.ok(negativeLearning.skillBias(stateBefore({ uncertainty:.72 }), 'verify') < 0, 'rejected local skills should carry a negative exact-context bias');
const negativeNeighbor = negativeLearning.skillBias(stateBefore({ uncertainty:.42 }), 'verify');
assert.ok(negativeNeighbor < 0 && negativeNeighbor > -.01, 'rejected skills should transfer only a very small negative bias to a nearby context');
assert.equal(negativeLearning.skillBias(stateBefore({ energy:.2, uncertainty:.42, novelty:.95, goalPressure:.9, socialNeed:.85 }), 'verify'), 0, 'negative skill evidence must not transfer to distant contexts');
assert.equal(learning.snapshot().shadow.length,12);
assert.equal(learning.snapshot().ablations.length,12);
const summary=learning.learningSummary();
assert.ok(summary.replayUpdates>0);
assert.ok(summary.decisionPredictionComparisons===12);
assert.equal(summary.counterfactualComparisons,12);
assert.equal(summary.alternativePredictionComparisons,12);
assert.ok(summary.predictionError01>=0&&summary.predictionError01<=1);
const material={tick:12,policy:policy.snapshot(),experiences:learning.snapshot().experiences.slice(-2)};
learning.sealChecksum(material,12);
assert.equal(learning.verifyChecksum(material),true);
assert.equal(learning.verifyChecksum({...material,tick:13}),false);
assert.equal(learning.snapshot().metrics.checksumFailures,1);
const debtBefore = learning.evidenceDebt().length;
const verifyTrace = makeTrace(99,'verify',.98,{uncertainty:.72});
learning.recordExperience(verifyTrace,{...verifyTrace.stateBefore,tick:100,needs:{...verifyTrace.stateBefore.needs,uncertainty:.25}}, {success:.98,reward:.98,surprise:.02},policy);
assert.ok(learning.snapshot().metrics.evidenceDebtOpen <= debtBefore);
assert.ok(learning.snapshot().evidenceDebt.some(x=>x.priority01 < 0.45) || learning.snapshot().metrics.evidenceDebtOpen===0);
// Non-finite feedback labels are rejected, not silently converted into a
// plausible zero-success observation that could poison future skill promotion.
const invalidEvidenceLearning = new P23LearningEngine();
const invalidEvidenceTrace = makeTrace(450, 'verify', .9, { uncertainty:.72 });
invalidEvidenceLearning.recordExperience(invalidEvidenceTrace, invalidEvidenceTrace.stateBefore, {success:NaN,reward:.9,surprise:.1}, new AdaptivePolicyEngine());
assert.equal(invalidEvidenceLearning.snapshot().experiences.length, 0, 'invalid outcome labels must not enter the learning dataset');

// Large consolidation queues are bounded and stratified rather than dominated
// by repeated examples from one easy context.
const replayBudgetLearning = new P23LearningEngine();
const replayBudgetPolicy = new AdaptivePolicyEngine();
const replayBudgetTraces = [];
const levels = [.05, .35, .65, .95];
const actionSet = ['respond','explore','verify','rest','reflect','wait','defer'];
for (let i = 0; i < 96; i++) {
  const needs = {
    energy:levels[i%4], cognitiveLoad:levels[Math.floor(i/4)%4],
    uncertainty:levels[Math.floor(i/16)%4], novelty:levels[Math.floor(i/8)%4],
    goalPressure:levels[Math.floor(i/32)%3], socialNeed:levels[(i*3)%4],
  };
  const trace = makeTrace(500 + i, actionSet[i%actionSet.length], (i%5)/5, needs);
  replayBudgetTraces.push(trace);
  replayBudgetLearning.recordExperience(trace, trace.stateBefore, {success:trace.outcome.success,reward:trace.outcome.reward,surprise:trace.outcome.surprise}, replayBudgetPolicy);
}
const boundedReplay = replayBudgetLearning.replayPending(replayBudgetTraces, replayBudgetPolicy);
assert.equal(boundedReplay, 64, 'large replay queues must respect the per-consolidation budget');
assert.equal(replayBudgetLearning.snapshot().replayUpdates.length, 64);

console.log(`P23_TRUE_LEARNING=PASS replay=${firstReplay} promoted=${learning.topSkills().length} checksumFailures=${learning.snapshot().metrics.checksumFailures}`);
