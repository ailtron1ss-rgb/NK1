import assert from 'node:assert/strict';
import { B2515UnifiedOrganismLatentFabric, B2516CausalAutobiographicalGraph, B2517SelfAuthoredRuleCompiler } from '../src/organism/cognition/index.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x)=>Math.max(0,Math.min(1,x));
const v=(seed,n)=>Array.from({length:n},(_,i)=>((Math.sin(seed*1.37+i*.71)+1)/2));
const mkStack=()=>({f:new B2515UnifiedOrganismLatentFabric(),g:new B2516CausalAutobiographicalGraph(),r:new B2517SelfAuthoredRuleCompiler()});
const frame=(s,t,goalSeed,noiseSeed)=>s.f.beforeDecision({tick:t,neuralLatent:v(noiseSeed,32),worldLatent:v(21+noiseSeed%3,32),bodyLatent:v(31+noiseSeed%2,8),selfLatent:v(41,24),semanticLatent:v(51+noiseSeed%2,24),futureLatent:v(61,24),identityLatent:v(71,24),goalLatent:v(goalSeed,24),personalityLatent:v(81,16),baseUtilities:Object.fromEntries(A.map(a=>[a,.5])),uncertainty01:.5,predictionError01:.22,novelty01:.35,autonomy01:.85});
const s=mkStack();
for(let t=1;t<=240;t++){
  const hidden=t%2===0?'verify':'explore';
  const fr=frame(s,t,hidden==='verify'?11:12,t%7);
  const action=hidden;
  s.f.afterOutcome({tick:t,action,reward01:.9,predictionError01:.08,verified01:1,autonomous01:1,nextLatent:fr.latent});
  s.g.afterOutcome({tick:t,stateLatent:fr.latent,nextStateLatent:fr.latent,action,reward01:.9,predictionError01:.08,verified01:1,autonomous01:1});
  s.r.afterOutcome({tick:t,latent:fr.latent,goalLatent:v(hidden==='verify'?11:12,24),action,reward01:.9,predictionError01:.08,verified01:1,autonomous01:1,identityContinuity01:.92,goalConsistency01:.9});
}
let reward=0,correct=0,randomReward=0,randomCorrect=0;
for(let t=241;t<=640;t++){
  const hidden=t%2===0?'verify':'explore';
  const fr=frame(s,t,hidden==='verify'?11:12,100+(t%17));
  const b=Object.fromEntries(A.map(a=>[(a),fr.actionBias[a]??0]));
  const compilerBias=s.r.beforeDecision({tick:t,latent:fr.latent,goalLatent:v(hidden==='verify'?11:12,24),uncertainty01:.45,predictionError01:.18,goalPressure01:.55,autonomy01:.9,identity01:.92}).actionBias;
  const scores=A.map(a=>({a,s:(b[a]??0)+(compilerBias[a]??0)})).sort((x,y)=>y.s-x.s);
  const selected=['verify','explore'].includes(scores[0].a)?scores[0].a:(t%2?'verify':'explore');
  const r=selected===hidden?1:.05; reward+=r;correct+=Number(selected===hidden);
  randomReward+=.525; randomCorrect+=.5;
  s.f.afterOutcome({tick:t,action:selected,reward01:r,predictionError01:selected===hidden?.08:.55,verified01:1,autonomous01:1,nextLatent:fr.latent});
  s.g.afterOutcome({tick:t,stateLatent:fr.latent,nextStateLatent:fr.latent,action:selected,reward01:r,predictionError01:selected===hidden?.08:.55,verified01:1,autonomous01:1});
  s.r.afterOutcome({tick:t,latent:fr.latent,goalLatent:v(hidden==='verify'?11:12,24),action:selected,reward01:r,predictionError01:selected===hidden?.08:.55,verified01:1,autonomous01:1,identityContinuity01:.92,goalConsistency01:selected===hidden?.9:.5});
}
const baseCorrect=randomCorrect, baseReward=randomReward;
assert(correct>300);
assert(reward>baseReward*1.25);
assert(s.r.diagnostics().rulesCompiled>0);
console.log('B2515_B2517_HOLDOUT_PASS',JSON.stringify({reward,baselineReward:baseReward,rewardGain:reward-baseReward,rewardGainPct:(reward/baseReward-1)*100,correct,baselineCorrect:baseCorrect,correctRate:correct/400,rulesCompiled:s.r.diagnostics().rulesCompiled,consolidations:s.r.diagnostics().consolidations,selfAuthorship:s.r.diagnostics().selfAuthorship01}));
