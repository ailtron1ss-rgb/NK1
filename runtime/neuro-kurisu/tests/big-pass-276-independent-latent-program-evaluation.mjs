import assert from 'node:assert/strict';
import { B276LatentActionProgramSynthesizer } from '../src/organism/cognition/B276LatentActionProgramSynthesizer.ts';

const make=(family,hidden)=>({
  goalVector:family===0?[.82,.18,.74,.22,.61,.38,.18,.51]:[.21,.77,.36,.68,.15,.71,.43,.59],
  selfLatent:Array.from({length:16},(_,i)=>Math.sin(i*.13+family*.7)),
  worldLatent:Array.from({length:16},(_,i)=>Math.cos(i*.09+family*.4)+(hidden?.03:0)),
  neuralAssembly:Array.from({length:16},(_,i)=>.11+(i%4)*.05+(hidden?.02:0)),
  personalityBias:family===0?{explore:.05,verify:.03,reflect:.01}:{explore:.01,verify:.06,reflect:.03},
  autonomy01:.7,noveltyNeed01:hidden?.72:.6,
  promotedSkills: family===0?[{id:'known-a',actions:['explore','verify'],reliability01:.86},{id:'known-b',actions:['reflect','respond'],reliability01:.77}]:[{id:'known-a',actions:['explore','verify'],reliability01:.84},{id:'known-c',actions:['wait','verify'],reliability01:.74}],
});
const p=new B276LatentActionProgramSynthesizer();
for(let t=0;t<80;t++){
  const r=p.propose({tick:t,...make(t%2, false)});
  const reward=r.primitivePlan.includes('explore')?.78:.6;
  p.observeTrial({tick:t,programId:r.programId,reward01:reward,independentGain01:reward-.5,predictionError01:.17,robustness01:.82,personalityAlignment01:.74,selfAlignment01:.78});
}
const before=p.diagnostics();
const hiddenEval=[];
for(let t=100;t<120;t++){
  const r=p.propose({tick:t,...make(t%2,true)});
  const score=r.primitivePlan.includes('verify')||r.primitivePlan.includes('explore')?.64:.43;
  hiddenEval.push(score);
  p.observeTrial({tick:t,programId:r.programId,reward01:score,independentGain01:score-.5,predictionError01:.21,robustness01:.77,personalityAlignment01:.69,selfAlignment01:.73});
}
const avg=hiddenEval.reduce((a,b)=>a+b,0)/hiddenEval.length;
const baseline=.45;
const d=p.diagnostics();
assert.ok(d.imaginedPrograms>=90);assert.ok(d.composeDepthMax>=2);assert.ok(d.verificationConfidence01>.4);
assert.ok(avg>baseline);
console.log(JSON.stringify({pass:true,hiddenAverage:avg,baseline,gain:avg-baseline,before,after:d},null,2));
