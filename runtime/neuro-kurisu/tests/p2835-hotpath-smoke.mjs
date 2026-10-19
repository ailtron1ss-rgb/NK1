import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(actions.map((a,i)=>[a,.25+i*.05]));
const v=t=>Array.from({length:64},(_,k)=>.3*Math.sin(k*.07+t*.02)+.1*Math.cos(k*.04-t*.01));
const b=new NeuralExperienceBranch();
const start=performance.now();
for(let t=0;t<40;t++){
  b.beforeDecision({tick:t,input:v(t),baseUtilities:base,predictionError01:.2,novelty01:.3,uncertainty01:.25,homeostasis01:.45,identityGap01:.1,goalPressure01:.35,reward01:.5,embodied:{cpuLoad01:.3,ramPressure01:.2,battery01:.85,sensorFreshness01:.95}});
  b.afterOutcome({tick:t+1,action:t%2?'explore':'respond',reward01:.82,predictionError01:.18,verified01:.92,nextInput:v(t+1)});
}
const d=b.diagnostics();
console.log(`P2835_HOTPATH_SMOKE=PASS ms=${(performance.now()-start).toFixed(1)} outcomes=${d.transferSafetySynergy.outcomes} teacher=${d.selfKnowledgeCoreset.teacherUpdates} coreset=${d.selfKnowledgeCoreset.coresetWrites}`);
