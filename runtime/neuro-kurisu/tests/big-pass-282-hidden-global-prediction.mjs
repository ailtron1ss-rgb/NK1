import assert from 'node:assert/strict';
import { B282PredictiveGlobalWorkspace } from '../src/organism/cognition/B282PredictiveGlobalWorkspace.ts';
const make=(phase)=>({sensorium:phase?[1,0,1,1,0,0,1,0]:[0,1,0,1,1,0,0,0],memory:phase?[0,1,1,0,1,0,0,1]:[1,0,0,1,0,1,0,0],association:phase?[1,1,0,0,1,0,1,0]:[0,0,1,1,0,1,0,1],selfAction:phase?[0,0,1,1,0,1,1,0]:[1,0,0,0,1,0,1,1]});
const model=new B282PredictiveGlobalWorkspace();
const targetFor=(phase)=>Array.from({length:16},(_,i)=>phase?((i%5===0)?.8:.1):((i%4===0)?.7:.05));
let err=0, n=0;
for(let t=0;t<360;t++){
  const phase=(Math.floor(t/45)%2)===1;
  const r=model.step({tick:t,areaSpikes:make(phase),selfLatent:phase?[.7,.2,.1,.6,.2,.1,.7,.2]:[.1,.5,.6,.1,.4,.7,.1,.5],worldLatent:phase?[.8,.1,.2,.6,.1,.2,.7,.1]:[.2,.7,.1,.2,.6,.1,.2,.7],goalVector:phase?[.7,.1,.6,.2,.5,.1,.7,.2]:[.1,.7,.2,.6,.1,.7,.2,.5],novelty01:phase?.65:.25,uncertainty01:.2,predictionError01:.12,reward01:.62,autonomy01:.75,learningEnabled:true});
  if(t>140){ const target=targetFor(phase); const pred=r.globalLatent??[]; err+=1-(.5+.5*(pred.reduce((s,v,i)=>s+v*(target[i]??0),0)/(Math.sqrt(Math.max(1e-9,pred.reduce((s,v)=>s+v*v,0)))*Math.sqrt(Math.max(1e-9,target.reduce((s,v)=>s+v*v,0)))))); n++; }
}
const modelErr=err/Math.max(1,n); const baselineErr=.5;
assert(modelErr<baselineErr);
console.log(JSON.stringify({pass:true,hiddenSteps:220,modelError01:modelErr,baselineError01:baselineErr,gain01:baselineErr-modelErr,diagnostics:model.diagnostics()}));
