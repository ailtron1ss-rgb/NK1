import assert from 'node:assert/strict';
import { TransferableEmbodiedSkillSystem } from '../src/organism/cognition/TransferableEmbodiedSkillSystem.ts';

const ACTIONS=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(ACTIONS.map(a=>[a,.5]));
const sys=new TransferableEmbodiedSkillSystem();

// Source curriculum: the same action effects recur across changing contexts.
for(let t=1;t<=1600;t++){
  const phase=(t%40)/40;
  const action=ACTIONS[t%ACTIONS.length];
  const context=Array.from({length:16},(_,i)=>((i*7+t*3)%31)/30*.72+.18*phase);
  const latent=context.slice(0,8);
  const drift=(action==='explore'?.11:action==='verify'?.07:action==='reflect'?.04:.025);
  const nextLatent=latent.map((v,i)=>Math.max(0,Math.min(1,v+(i%3===0?drift:-drift*.35))));
  sys.afterOutcome({tick:t,context,latent,nextLatent,action,reward01:action==='explore'?.86:action==='verify'?.81:.64,predictionError01:.16+(t%17===0?.06:0),verified01:t%3===0?1:.7});
  sys.beforeDecision({tick:t,context,latent,actionUtilities:base,goalPressure01:.72,uncertainty01:.62,computeBudget01:.72,predictionError01:.48,novelty01:.18});
}

const before=sys.metrics();
assert(before.skills.length>=7,'expected reusable procedural skills');
assert(before.optionCoverage01>0.02,'option coverage did not become live');
assert(before.transfer01>0.08,'transfer signal did not become live');

let holdoutSuccess=0;
for(let t=1;t<=280;t++){
  const sourceAction=ACTIONS[(t*5)%ACTIONS.length];
  const context=Array.from({length:16},(_,i)=>(((i*7+t*3+5)%31)/30*.72)+.12); // shifted context, not exact source key
  const latent=context.slice(0,8);
  const out=sys.evaluateHoldout({context,latent,action:sourceAction,reward01:sourceAction==='explore'?.84:.77,predictionError01:.22,verified01:1});
  if(out.success) holdoutSuccess++;
}
const after=sys.metrics();
assert(after.holdoutEvaluations===280);
assert(holdoutSuccess>=70,`weak transferable holdout: ${holdoutSuccess}`);

for(let t=2000;t<2050;t++) sys.afterOutcome({tick:t,context:[.8,.3,.7,.4,.6,.2,.7,.3],latent:[.8,.3,.7,.4,.6,.2,.7,.3],nextLatent:[.15,.9,.1,.8,.2,.7,.1,.9],action:'respond',reward01:.22,predictionError01:.85,verified01:.2});
const final=sys.metrics();
assert(final.recoveries>0,'recovery trigger never activated');
assert(final.recoveryQuality01>=0 && final.recoveryQuality01<=1);
assert(final.skillDiversity01>0.5);

console.log('B2587_2598_TRANSFERABLE_EMBODIED_BRAIN_PASS',JSON.stringify({
  skills:final.skills.length,skillDiversity01:final.skillDiversity01,transfer01:final.transfer01,optionCoverage01:final.optionCoverage01,
  holdoutEvaluations:final.holdoutEvaluations,holdoutSuccesses:final.holdoutSuccesses,holdoutRate01:final.holdoutSuccesses/final.holdoutEvaluations,
  interventionProbes:final.interventionProbes,recoveries:final.recoveries,recoveryQuality01:final.recoveryQuality01,negativeTransfer01:final.negativeTransfer01
},null,2));
