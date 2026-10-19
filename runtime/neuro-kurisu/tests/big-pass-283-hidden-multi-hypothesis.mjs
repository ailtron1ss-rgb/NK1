import assert from 'node:assert/strict';
import { B283CompetingPredictiveHypotheses } from '../src/organism/cognition/B283CompetingPredictiveHypotheses.ts';
const make=(t,mode)=>Array.from({length:16},(_,i)=>Math.tanh(Math.sin((i+1)*(t+.7)*.13+mode*.8)+Math.cos(t*.03+i*.21)));
const w=new B283CompetingPredictiveHypotheses();
for(let t=0;t<420;t++){
  const hidden=t%3;
  const g=make(t,hidden);
  const s=make(t,hidden+1).map(x=>x*.3), world=make(t+3,hidden+2).map(x=>x*.35), goal=make(t+7,hidden).map(x=>x*.4), mem=make(t+11,hidden+1).map(x=>x*.25);
  w.step({tick:t,globalLatent:g,selfLatent:s,worldLatent:world,goalVector:goal,memoryLatent:mem,reward01:.6,uncertainty01:hidden===2?.62:.18,autonomy01:.74,personalityVector:make(t,hidden+3).map(x=>x*.2),learningEnabled:true});
}
const d=w.diagnostics();
const hiddenError=1-d.activeHypothesis.evidence01; const baseline=.5;
assert(d.steps===420); assert(d.hypothesisSwitches>=2); assert(d.posteriorEntropy01>0); assert(d.diversity01>0); assert(d.selfAlignment01>0); assert(d.memoryContinuity01>0);
console.log(JSON.stringify({pass:true,steps:d.steps,hiddenError,baseline,gain:baseline-hiddenError,hypothesisSwitches:d.hypothesisSwitches,posteriorEntropy01:d.posteriorEntropy01,diversity01:d.diversity01,selfAlignment01:d.selfAlignment01,personalityFit01:d.personalityFit01,memoryContinuity01:d.memoryContinuity01}));
