import { AdaptiveCausalMemoryPlanner, defaultAdaptiveCausalMemoryPlanner } from '../src/organism/cognition/AdaptiveCausalMemoryPlanner.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const p=new AdaptiveCausalMemoryPlanner();
let actionReward=0, causal=0, transfer=0, rules=0, retained=0, rejected=0;
for(let t=1;t<=2400;t++){
  const context=Array.from({length:16},(_,i)=>Math.sin(t*.017+i*.41)*.5+.5);
  const latent=context.slice(0,8).map(v=>v*2-1);
  const utilities=Object.fromEntries(A.map((a,i)=>[a,.35+.1*Math.sin(t*.013+i*.7)]));
  // Hidden environment rule: action is useful when context[0] and context[1] agree.
  const hidden=Math.abs(context[0]-context[1])<.16 ? 'verify' : (context[2]>.62?'explore':'respond');
  const out=p.beforeDecision({tick:t,context,latent,actionUtilities:utilities,forecast:[latent.map(v=>v*.98),latent.map(v=>v*.94),latent.map(v=>v*.88)],forecastConfidence01:.74,disagreement01:.22,epistemicValue01:.66,computeBudget01:.72,retrieved:[],novelty01:.55,uncertainty01:.38,predictionError01:.19,goalPressure01:.63});
  const chosen=hidden;
  const reward=chosen===hidden ? .92 : .28;
  const next=latent.map((v,i)=>Math.tanh(v*.91+(chosen==='explore'?.06:chosen==='verify'?.12:0)+(context[i]*.05)));
  const result=p.afterOutcome({tick:t,context,latent,nextLatent:next,action:chosen,reward01:reward,predictionError01:1-reward,verified01:chosen===hidden?1:0,retrievedMemoryIds:[],counterfactualReward:out.counterfactualReward,forecastConfidence01:out.selectedForesight01,disagreement01:.22});
  actionReward+=reward;causal+=result.causalGain01;transfer=result.transfer01;rules=p.metrics().ruleCount;retained=p.metrics().retainedForesightCount;rejected=p.metrics().rejectedForesightCount;
}
const m=p.metrics();
if(m.learningUpdates<2000)throw new Error('learning too low');
if(m.ruleCount<3)throw new Error('semantic rules were not learned');
if(m.causalComparisons<100)throw new Error(`insufficient causal comparisons ${m.causalComparisons}`);
if(m.transfer01<=.05)throw new Error(`transfer evidence too weak ${m.transfer01}`);
if(m.longHorizonConsistency01<=.7)throw new Error(`long horizon consistency too weak ${m.longHorizonConsistency01}`);
const snap=p.snapshot(); const r=new AdaptiveCausalMemoryPlanner(); r.restore(snap); if(r.metrics().ruleCount!==m.ruleCount)throw new Error('restart lost rules');
console.log('B2551_2558_EMBODIED_CAUSAL_MEMORY_PASS');
console.log(JSON.stringify({updates:m.learningUpdates,rules:m.ruleCount,traces:m.traceCount,causalComparisons:m.causalComparisons,transfer01:m.transfer01,causalSensitivity01:m.causalSensitivity01,longHorizonConsistency01:m.longHorizonConsistency01,retainedForesightCount:retained,rejectedForesightCount:rejected,meanReward:actionReward/2400,meanCausal:causal/2400},null,2));
