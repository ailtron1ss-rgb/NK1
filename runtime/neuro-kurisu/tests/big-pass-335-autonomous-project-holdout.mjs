import assert from 'node:assert/strict';
import { B335AutonomousProjectHoldoutGate } from '../src/organism/system/B335AutonomousProjectHoldoutGate.ts';

const g=new B335AutonomousProjectHoldoutGate();
g.setPhase('baseline');
let tick=1;
for(const action of ['explore','explore','verify','wait','explore']){
  g.observe({tick,at:tick,projectId:null,projectActive:false,externalInput:false,autonomous:true,contextKey:'base',selectedAction:action});
  tick++;
}
g.setPhase('training');
for(let i=0;i<4;i++){
  g.observe({tick,at:tick,projectId:'p1',projectActive:true,externalInput:false,autonomous:true,contextKey:'train',selectedAction:'explore'});
  assert.equal(g.recordVerifiedOutcome({tick,action:'explore',success01:.8,verified:false}),false);
  assert.equal(g.diagnostics().trainingVerifiedOutcomes,i);
  assert.equal(g.recordVerifiedOutcome({tick,action:'explore',success01:.8,verified:true}),true);
  tick++;
}
g.setPhase('holdout');
for(const action of ['verify','verify','rest','verify']){
  g.observe({tick,at:tick,projectId:'p1',projectActive:true,externalInput:false,autonomous:true,contextKey:'holdout',selectedAction:action});
  assert.equal(g.recordVerifiedOutcome({tick,action,success01:.72,verified:true}),true);
  tick++;
}
const d=g.diagnostics();
assert.equal(d.evaluation.eligible,true);
assert.equal(d.projectId,'p1');
assert.equal(d.strategyRetention01,1);
assert.equal(d.trainingVerifiedOutcomes,4);
assert.equal(d.holdoutVerifiedOutcomes,4);
const s=g.snapshot(); const r=new B335AutonomousProjectHoldoutGate(); r.restore(s); assert.deepEqual(r.snapshot(),s);
const bad=new B335AutonomousProjectHoldoutGate(); bad.setPhase('baseline');
let badTick=1;
for(let i=0;i<4;i++){bad.observe({tick:badTick,at:badTick,projectId:null,projectActive:false,externalInput:false,autonomous:true,contextKey:'base',selectedAction:'wait'});badTick++;}
bad.setPhase('training');
for(let i=0;i<3;i++){bad.observe({tick:badTick,at:badTick,projectId:'p2',projectActive:true,externalInput:false,autonomous:true,contextKey:'train',selectedAction:'wait'});bad.recordVerifiedOutcome({tick:badTick,action:'wait',success01:.8,verified:true});badTick++;}
bad.setPhase('holdout');
for(let i=0;i<4;i++){bad.observe({tick:badTick,at:badTick,projectId:'p2',projectActive:true,externalInput:false,autonomous:true,contextKey:'holdout',selectedAction:'wait'});bad.recordVerifiedOutcome({tick:badTick,action:'wait',success01:.8,verified:true});badTick++;}
assert.equal(bad.diagnostics().evaluation.eligible,false);
const external=new B335AutonomousProjectHoldoutGate();external.setPhase('baseline');
external.observe({tick:1,at:1,projectId:'p3',projectActive:true,externalInput:true,autonomous:false,contextKey:'base',selectedAction:'respond'});
assert.equal(external.diagnostics().baselineActions.length,0,'external actions cannot enter autonomous baseline');
console.log(JSON.stringify({pass:true,good:d.evaluation,bad:bad.diagnostics().evaluation,persistence:true},null,2));
