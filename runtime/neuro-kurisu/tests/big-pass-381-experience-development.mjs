import assert from 'node:assert/strict';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const ctx=Object.fromEntries(actions.map(a=>[a,{worldUtility01:a==='explore'?.56:.48,worldConfidence01:.85,worldUncertainty01:.15,needRelief01:a==='rest'?.7:.3,predictedCost01:a==='explore'?.2:.1}]));
const vector=Array.from({length:64},(_,i)=>Math.tanh(.2*Math.sin(i*.19)+.08*Math.cos(i*.37)));
function policy(net,tick=500){return net.step({tick,vector,novelty01:.42,uncertainty01:.33,predictionError01:.18,goalPressure01:.31,autonomy01:.73,learningEnabled:false,actionContext:ctx}).actionProbabilities;}
const fresh=new B365UnifiedNeuroCausalCore(); policy(fresh,1); const baseline=policy(fresh,2);
const trained=new B365UnifiedNeuroCausalCore(); policy(trained,1); policy(trained,2);
let rejected=0,accepted=0;
const beforeUnverified=trained.snapshot();
const pBeforeUnverified=policy(trained,240);
trained.restore(beforeUnverified);
for(let i=1;i<=220;i++){
  const bad=trained.consolidateExperience({tick:10+i,action:'explore',reward01:.15,predictionError01:.82,salience01:.72,verified01:0,independent01:0,evidenceQuality01:.1,continuity01:.85,goalId:'goal-test'});
  assert.equal(bad.updated,false); rejected++;
}
const afterUnverified=policy(trained,240);
const l1Unverified=actions.reduce((s,a)=>s+Math.abs(afterUnverified[a]-pBeforeUnverified[a]),0);
assert.ok(l1Unverified<1e-9,`unverified changed policy: ${l1Unverified}`);
const beforeVerified=trained.snapshot();
const pBeforeVerified=policy(trained,500);
trained.restore(beforeVerified);
for(let i=1;i<=220;i++){
  const out=trained.consolidateExperience({tick:300+i,action:'explore',reward01:.92,predictionError01:.06,salience01:.78,verified01:1,independent01:1,evidenceQuality01:.98,continuity01:.93,goalId:'goal-test'});
  assert.equal(out.verified,true); accepted++;
}
const developedState=trained.snapshot(); const developed=policy(trained,1000);
const l1Developed=actions.reduce((s,a)=>s+Math.abs(developed[a]-pBeforeVerified[a]),0);
assert.ok(l1Developed>0.003,`verified development divergence too small: ${l1Developed}`);
const off=new B365UnifiedNeuroCausalCore(); off.restore({...beforeVerified,developmentalMemory:{...beforeVerified.developmentalMemory,enabled:false}}); const offPolicy=policy(off,1000);
const l1OnOff=actions.reduce((s,a)=>s+Math.abs(developed[a]-offPolicy[a]),0);
assert.ok(l1OnOff>0.003,`ON/OFF divergence too small: ${l1OnOff}`);
const restarted=new B365UnifiedNeuroCausalCore(); restarted.restore(developedState); const restartedPolicy=policy(restarted,1001);
const l1Restart=actions.reduce((s,a)=>s+Math.abs(restartedPolicy[a]-developed[a]),0);
assert.ok(l1Restart<0.0008,`restart lost development: ${l1Restart}`);
console.log(JSON.stringify({pass:true,status:'B381_EXPERIENCE_DEVELOPMENT_CAUSAL_PASS',accepted,rejected,l1Unverified,l1Developed,l1OnOff,l1Restart,developmental:trained.diagnostics().developmentalMemory},null,2));
