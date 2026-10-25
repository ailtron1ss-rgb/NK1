import assert from 'node:assert/strict';
import { CausalExperienceStream } from '../src/organism/learning/CausalExperienceStream.ts';
import { P26TrueLearningEngine } from '../src/organism/learning/P26TrueLearningEngine.ts';
const cx=new CausalExperienceStream(128);
const makeState=(tick)=>({tick,needs:{energy:.72,cognitiveLoad:.18,uncertainty:.42,novelty:.35,goalPressure:.58,socialNeed:.2,identityCoherence:.82},predictionError:.28,attentionBudget:.76,selfPredictionError:.22,lastAction:'none',lastActionSuccess:null});
for(let i=0;i<24;i++){
  const before=makeState(i);
  const action=i%2?'verify':'explore';
  const success01=i%2?.82:.38;
  const trace={id:`replay-trace-${i}`,tick:i,stateBefore:before,selected:{action,goalId:'replay-goal'},predictedOutcomes:[],userRequestedAction:false};
  const after=structuredClone(before);
  after.tick=i+1;
  after.needs.uncertainty=Math.max(.05,before.needs.uncertainty-(i%3===0?.08:.015));
  after.needs.novelty=Math.min(1,before.needs.novelty+(i%4===0?.04:0));
  // Causal learning requires an observed state transition attributed to the
  // selected action, not an arbitrary changed after-state.
  after.lastAction=action;
  after.lastActionSuccess=success01;
  cx.observe(trace);
  const record=cx.recordOutcome(trace,after,{reward01:i%2?.78:.34,success01,surprise01:i%5===0?.7:.18,novelty01:after.needs.novelty});
  assert.ok(record, `grounded replay outcome ${i} should be admitted`);
}
const candidates=cx.policyReplayCandidates(24); assert.ok(candidates.length>=20); const p26=new P26TrueLearningEngine(); const before=p26.snapshot().policy.updates; const r=p26.replayCausalRecords(candidates);
assert.ok(r.updates>=10); assert.ok(p26.snapshot().policy.updates>before); assert.ok(Number.isFinite(r.holdoutDelta01));
console.log('BIG_PASS_115_CAUSAL_REPLAY=PASS',JSON.stringify({candidates:candidates.length,updates:r.updates,holdoutDelta01:Number(r.holdoutDelta01.toFixed(4)),loss01:Number(r.meanLoss01.toFixed(4))}));
