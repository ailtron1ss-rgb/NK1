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
console.log(`P23_TRUE_LEARNING=PASS replay=${firstReplay} promoted=${learning.topSkills().length} checksumFailures=${learning.snapshot().metrics.checksumFailures}`);
