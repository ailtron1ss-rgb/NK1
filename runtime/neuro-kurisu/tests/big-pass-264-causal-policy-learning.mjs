import assert from 'node:assert/strict';
import { B263RealActionCausality } from '../src/organism/cognition/B263RealActionCausality.ts';
import { B264CausalPolicyLearning } from '../src/organism/cognition/B264CausalPolicyLearning.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const truth=(before,action,t)=>{
  const a=actions.indexOf(action);
  const actionSignal=(a===2?0.18:(a===1?0.10:(a===4?-0.06:0)));
  return before.map((v,i)=>Math.tanh(v*.54 + actionSignal*Math.sin((i+1)*.17) + Math.cos(t*.05+i*.09)*.015));
};
const rewardOf=(context,action)=>{
  const phase=context[0]??.5;
  const verify=action==='verify' ? (.70+.20*phase) : 0;
  const explore=action==='explore' ? (.62+.12*(1-phase)) : 0;
  const reflect=action==='reflect' ? .51 : 0;
  return Math.max(.12,Math.min(.96,Math.max(verify,explore,reflect,.28)));
};
const state={needs:{energy:.82,cognitiveLoad:.22,uncertainty:.42,novelty:.55,goalPressure:.58,socialNeed:.22},predictionError:.18,selfPredictionError:.16,attentionBudget:.76,autonomyScore:.72};
const causal=new B263RealActionCausality();
const policy=new B264CausalPolicyLearning();
for(let i=0;i<280;i++){
  const before=Array.from({length:24},(_,j)=>Math.sin(i*.037+j*.13));
  const action=actions[i%actions.length];
  const after=truth(before,action,i);
  const reward=rewardOf([((i*37)%101)/100],action);
  causal.observe(before,action,after,reward,i,.12+(i%5)*.03);
  const ctx=Array.from({length:16},(_,j)=>j===0?((i*37)%101)/100:.2+(((i+j*11)%71)/100)*.5);
  const candidate={id:`c${i}`,action,score:.5,predictedUtility:.52,predictedNeedRelief:.5,predictedCost:.35,confidence:.65,generatedAt:i};
  const preview=policy.selectFromRealCandidates([candidate],causal,state,i);
  const rank=preview.rankings[0];
  policy.observeOutcome({tick:i,context:ctx,action,reward01:reward,predictedPolicy01:rank.score01,baselinePredicted01:rank.baseline01,causalMargin01:Math.abs(rank.score01-rank.baseline01),uncertainty01:rank.uncertainty01});
  if(i%40===0) policy.replay(8);
}
const benchmark=[];
for(let i=0;i<84;i++){
  const context=Array.from({length:16},(_,j)=>j===0?((i*43+17)%101)/100:.15+(((i*19+j*7)%83)/100)*.55);
  const candidates=actions.map((action,j)=>({id:`u${i}-${j}`,action,score:.5,predictedUtility:.52,predictedNeedRelief:.5,predictedCost:.30+(j%3)*.08,confidence:.62,generatedAt:1000+i}));
  const decision=policy.selectFromRealCandidates(candidates,causal,state,1000+i);
  const chosen=decision.chosen?.action;
  const chosenReward=rewardOf(context,chosen);
  const baselineAction=candidates.slice().sort((a,b)=>b.predictedUtility-a.predictedUtility)[0].action;
  const baselineReward=rewardOf(context,baselineAction);
  benchmark.push({context,selected:chosen,chosenReward,baselineReward});
}
const policyReward=benchmark.reduce((s,x)=>s+x.chosenReward,0)/benchmark.length;
const baselineReward=benchmark.reduce((s,x)=>s+x.baselineReward,0)/benchmark.length;
const improved=policyReward-baselineReward;
const holdout=policy.evaluateUnseenTask(benchmark.map(x=>({context:x.context,action:x.selected,reward01:x.chosenReward,baselineReward01:x.baselineReward,causalMargin01:.2})));
const replay=policy.replay(24);
const snap=policy.snapshot(); const restored=new B264CausalPolicyLearning(); restored.restore(snap);
const diag=policy.diagnostics();
assert.ok(diag.decisions>=364);
assert.ok(holdout.samples===benchmark.length);
assert.ok(policyReward>baselineReward+.03,`policy must beat baseline by >.03, got ${policyReward} vs ${baselineReward}`);
assert.ok(holdout.unseenTaskGain01>0.03);
assert.equal(restored.snapshot().policyUpdates,snap.policyUpdates);
console.log(JSON.stringify({ok:true,decisions:diag.decisions,policyUpdates:diag.policyUpdates,policyReward01:policyReward,baselineReward01:baselineReward,improvement01:improved,holdout,replay,diagnostics:diag,restorePreserved:true}));
