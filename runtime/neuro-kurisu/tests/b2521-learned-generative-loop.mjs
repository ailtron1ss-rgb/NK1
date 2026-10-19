import { B2521LearnedGenerativeOrganismLoop } from '../src/organism/cognition/B2521LearnedGenerativeOrganismLoop.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map(a=>[a,.5]));
const x=new B2521LearnedGenerativeOrganismLoop();
for(let t=1;t<=120;t++){
  const latent=Array.from({length:32},(_,i)=>((i*3+t)%17)/16);
  x.beforeDecision({tick:t,latent,baseUtilities:base,goalPressure01:.82,uncertainty01:.62,predictionError01:.18,horizon:5});
  const next=latent.map((v,i)=>Math.max(0,Math.min(1,v+(i===0?.12:i===3?-.08:0))));
  x.afterOutcome({tick:t,latent,nextLatent:next,action:t%2?'explore':'verify',reward01:t>50?.9:.35,predictionError01:.12,verified01:t>20?1:0});
}
const d=x.diagnostics(); const lesion=x.lesion(.5);
console.log('DEBUG',JSON.stringify({d,lesion})); if(d.learningUpdates<100||d.transitions<20||d.generativeAccuracy01<.05||d.counterfactualUse01<=0||lesion.causalDrop01<=0) throw new Error('B2521 gate failed');
console.log('B2521_LEARNED_GENERATIVE_LOOP_PASS',JSON.stringify({cycles:d.cycles,rollouts:d.rollouts,learningUpdates:d.learningUpdates,transitions:d.transitions,accuracy:d.generativeAccuracy01,coverage:d.modelCoverage01,counterfactualUse:d.counterfactualUse01,causalDrop01:lesion.causalDrop01}));
