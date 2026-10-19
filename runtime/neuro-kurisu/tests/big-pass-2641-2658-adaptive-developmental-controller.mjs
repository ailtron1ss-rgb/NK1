import assert from 'node:assert/strict';
import { AdaptiveDevelopmentalController } from '../src/organism/cognition/AdaptiveDevelopmentalController.ts';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const mk=(t,n=24)=>Array.from({length:n},(_,i)=>Math.sin(t*.071+i*.17)*.5+.5);
const utilities=Object.fromEntries(actions.map((a,i)=>[a,.45+(i===tmod(0,actions.length)?0.18:0)]));
function tmod(a,b){return a%b}
const c=new AdaptiveDevelopmentalController();
let totalReward=0;
for(let t=1;t<=1800;t++){
  const uncertainty=.15+((t*37)%100)/170;
  const novelty=.12+((t*53)%100)/150;
  const err=t%17===0?.82:((t%13)/40);
  const goal=.35+((t%11)/30);
  const identityGap=t%29===0?.72:.18+(t%7)/60;
  const u=Object.fromEntries(actions.map((a,i)=>[a,.45+((i+t)%5)*.015]));
  const r=c.beforeDecision({tick:t,context:mk(t),identityVector:mk(t+3),goalPressure01:goal,identityGap01:identityGap,novelty01:novelty,uncertainty01:uncertainty,predictionError01:err,computeBudget01:t%23===0?.45:.86,baseUtilities:u,taskFreeCoverage01:.72,negativeTransfer01:t%31===0?.28:.04,risk01:err,recoveryAction:err>.72?'verify':null});
  const action=actions.slice().sort((a,b)=>(u[b]+r.actionBias[b])-(u[a]+r.actionBias[a]))[0];
  c.commitAction(action);
  const reward=Math.max(0,Math.min(1,.58+(action==='verify'&&err>.6?.22:0)-(action==='respond'&&err>.75?.18:0)+(t%19===0?.12:0)));
  c.afterOutcome({tick:t,context:mk(t),nextContext:mk(t+1),identityVector:mk(t+3),action,reward01:reward,predictionError01:err,verified01:err<.55?1:.25,goalPressure01:goal,identityGap01:identityGap,autonomous01:1,external01:1-err,fault01:err>.72?err:0,recovery01:err>.72?.84:.55});
  totalReward+=reward;
}

let baselineReward=0;
for(let t=1;t<=1800;t++){
  const uncertainty=.15+((t*37)%100)/170, novelty=.12+((t*53)%100)/150, err=t%17===0?.82:((t%13)/40);
  const u=Object.fromEntries(actions.map((a,i)=>[a,.45+((i+t)%5)*.015]));
  const action=actions.slice().sort((a,b)=>u[b]-u[a])[0];
  baselineReward+=Math.max(0,Math.min(1,.58+(action==='verify'&&err>.6?.22:0)-(action==='respond'&&err>.75?.18:0)+(t%19===0?.12:0)));
}
const adaptiveGain01=(totalReward-baselineReward)/Math.max(1,baselineReward);

const m=c.metrics();
assert.ok(m.goalCount>0,'goals must emerge');
assert.ok(m.prototypeCount>0,'task-free prototypes must emerge');
assert.ok(m.causalCredit01>.45,'causal credit must learn');
assert.ok(m.goalAutonomy01>.45,'goal autonomy must rise');
assert.ok(m.recoveryReadiness01>.45,'recovery readiness must learn');
assert.ok(m.developmentalCoherence01>.45,'cross-layer coherence must rise');
const fault=c.runFaultTest({tick:1900,context:mk(1900),baseUtilities:Object.fromEntries(actions.map(a=>[a,.5])),goalPressure01:.8,identityGap01:.6,novelty01:.8,uncertainty01:.9,computeBudget01:.8,faultAction:'respond',faultSeverity01:.91});
assert.notEqual(fault.recoveryAction,'respond','fault test should redirect from failed action');
const snap=c.snapshot(),restored=new AdaptiveDevelopmentalController();restored.restore(snap);assert.deepEqual(restored.snapshot(),snap,'controller persistence mismatch');

const branch=new NeuralExperienceBranch();
for(let t=1;t<=900;t++){
  const inp=mk(t,64), u=Object.fromEntries(actions.map((a,i)=>[a,.5+Math.sin(t*.03+i)*.03]));
  const out=branch.beforeDecision({tick:t,input:inp,baseUtilities:u,predictionError01:t%19===0?.76:.2,novelty01:.2+(t%10)/30,uncertainty01:.2+(t%17)/35,homeostasis01:.2,identityGap01:.2+(t%8)/50,goalPressure01:.45+(t%9)/40,reward01:.55,identityVector:mk(t+4,24),personalityVector:mk(t+8,24)});
  const a=actions.slice().sort((x,y)=>(u[y]+out.actionBias[y])-(u[x]+out.actionBias[x]))[0];branch.commitAction(a,u);
  branch.afterOutcome({tick:t,action:a,reward01:a==='verify'&&t%19===0?.82:.62,predictionError01:t%19===0?.76:.2,verified01:t%19===0?.8:.72,nextInput:mk(t+1,64),identityGap01:.2,goalPressure01:.5,identityVector:mk(t+4,24)});
}
const bm=branch.continuityMetrics();
assert.ok(bm.developmentalController?.outcomes>=800,'developmental controller not integrated into neural branch');
assert.ok((bm.developmentalController?.goalCount??0)>0,'integrated controller has no goals');
assert.ok((bm.developmentalController?.causalCredit01??0)>.4,'integrated causal credit did not learn');
console.log(JSON.stringify({standalone:{goals:m.goalCount,prototypes:m.prototypeCount,goalAutonomy01:m.goalAutonomy01,causalCredit01:m.causalCredit01,transferReadiness01:m.transferReadiness01,recoveryReadiness01:m.recoveryReadiness01,coherence01:m.developmentalCoherence01,externalTransfer01:m.externalTransfer01,totalReward,baselineReward,adaptiveGain01},fault,branch:{outcomes:bm.developmentalController.outcomes,goals:bm.developmentalController.goalCount,causalCredit01:bm.developmentalController.causalCredit01,coherence01:bm.developmentalController.developmentalCoherence01}}));
