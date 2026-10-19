import assert from 'node:assert/strict';
import { B2502EINeuralReplayField } from '../src/organism/cognition/B2502EINeuralReplayField.ts';
import { B2503ActionablePredictiveField } from '../src/organism/cognition/B2503ActionablePredictiveField.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const base=(x)=>Object.fromEntries(A.map((a,k)=>[a,clamp(.48+(k===0?.06:0)+Math.sin((x*9+k)*1.7)*.045)]));
const state=(t)=>Array.from({length:24},(_,i)=>clamp(.5+.45*Math.sin(t*.17+i*.31)));
const target=(t)=>A[Math.floor((Math.abs(Math.sin(t*.17))*A.length))%A.length];
const run=(mode,episodes=500)=>{
  const b2=new B2502EINeuralReplayField(), b3=new B2503ActionablePredictiveField(); let reward=0,correct=0;
  for(let t=1;t<=episodes;t++){
    const x=state(t),bu=base(t); let action;
    if(mode==='base') action=A.reduce((best,a)=>bu[a]>bu[best]?a:best,A[0]);
    else {
      const r2=b2.beforeDecision({tick:t,context01:x.concat(x.slice(0,8)),baseUtilities:bu,latent01:x,uncertainty01:.38,novelty01:.45,predictionError01:.22,energy01:.72,motivation01:.58});
      const b2Utilities=Object.fromEntries(A.map(a=>[a,clamp(bu[a]+(r2.actionBias[a]??0))]));
      if(mode==='b2') action=r2.selectedAction;
      else {
        const r3=b3.beforeDecision({tick:t,state01:x,baseUtilities:mode==='combo'?b2Utilities:bu,uncertainty01:.34,predictionError01:.20,novelty01:.42,energy01:.72,goalPressure01:.58});
        action=r3.selectedAction;
        const r=action===target(t)?.94:.18;
        b3.afterOutcome({tick:t,action,reward01:r,nextState01:state(t+1),predictionError01:Math.abs(r-(r3.predictedUtility[action]??.5)),verified01:t%5===0,salience01:.6});
      }
      const r=action===target(t)?.94:.18; reward+=r; correct+=action===target(t)?1:0;
      b2.afterOutcome({tick:t,action,reward01:r,predictionError01:Math.abs(r-(r2.neuralUtility[action]??.5)),verified01:t%5===0,salience01:.6});
      continue;
    }
    const r=action===target(t)?.94:.18; reward+=r; correct+=action===target(t)?1:0;
  }
  return {meanReward:reward/episodes,accuracy:correct/episodes,b2:b2.diagnostics(),b3:b3.diagnostics()};
};
const rows=Object.fromEntries(['base','b2','b3','combo'].map(m=>[m,run(m)]));
for(const m of ['b2','b3','combo']) assert.ok(rows[m].meanReward>rows.base.meanReward && rows[m].accuracy>rows.base.accuracy);
const combinedVsBestSingle=rows.combo.meanReward-Math.max(rows.b2.meanReward,rows.b3.meanReward);
console.log(JSON.stringify({pass:true,status:'B2503_SYNTHETIC_HOLDOUT_PASS',rows,gains:{b2Reward:rows.b2.meanReward-rows.base.meanReward,b3Reward:rows.b3.meanReward-rows.base.meanReward,comboReward:rows.combo.meanReward-rows.base.meanReward,b2Accuracy:rows.b2.accuracy-rows.base.accuracy,b3Accuracy:rows.b3.accuracy-rows.base.accuracy,comboAccuracy:rows.combo.accuracy-rows.base.accuracy,comboVsBestSingleReward:combinedVsBestSingle},note:'Synthetic holdout only; not a claim about real-world task performance.'},null,2));
