import assert from 'node:assert/strict';
import { CausalExperienceStream } from '../src/organism/learning/CausalExperienceStream.ts';
import { P26TrueLearningEngine } from '../src/organism/learning/P26TrueLearningEngine.ts';
const cx=new CausalExperienceStream(128);
const makeState=(tick)=>({tick,needs:{energy:.72,cognitiveLoad:.18,uncertainty:.42,novelty:.35,goalPressure:.58,socialNeed:.2,identityCoherence:.82},predictionError:.28,attentionBudget:.76,selfPredictionError:.22,lastAction:'none',lastActionSuccess:null});
for(let i=0;i<24;i++){
  const stateBefore={...structuredClone(state),tick:i};
  const trace={id:`replay-trace-${i}`,tick:i,stateBefore,selected:{action:i%2?'verify':'explore',goalId:'replay-goal'},predictedOutcomes:[],userRequestedAction:false};
  const success01=i%2?.82:.38;
  const after=structuredClone(stateBefore);
  after.tick=i+1; after.lastAction=trace.selected.action; after.lastActionSuccess=success01;
  after.needs.uncertainty=Math.max(.05,stateBefore.needs.uncertainty-(i%3===0?.08:.015)); after.needs.novelty=Math.min(1,stateBefore.needs.novelty+(i%4===0?.04:0));
  cx.observe(trace); cx.recordOutcome(trace,after,{reward01:i%2?.78:.34,success01,surprise01:i%5===0?.7:.18,novelty01:after.needs.novelty});
}
const candidates=cx.policyReplayCandidates(24); assert.ok(candidates.length>=20); const p26=new P26TrueLearningEngine(); const before=p26.snapshot().policy.updates; const r=p26.replayCausalRecords(candidates);
assert.ok(r.updates>=10); assert.ok(p26.snapshot().policy.updates>before); assert.ok(Number.isFinite(r.holdoutDelta01));
console.log('BIG_PASS_115_CAUSAL_REPLAY=PASS',JSON.stringify({candidates:candidates.length,updates:r.updates,holdoutDelta01:Number(r.holdoutDelta01.toFixed(4)),loss01:Number(r.meanLoss01.toFixed(4))}));
