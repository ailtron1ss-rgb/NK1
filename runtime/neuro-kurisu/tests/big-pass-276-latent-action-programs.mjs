import assert from 'node:assert/strict';
import { B276LatentActionProgramSynthesizer } from '../src/organism/cognition/B276LatentActionProgramSynthesizer.ts';

const p=new B276LatentActionProgramSynthesizer();
const base={
  goalVector:[.8,.1,.7,.2,.6,.4,.2,.5],
  selfLatent:Array.from({length:16},(_,i)=>Math.sin(i*.17)),
  worldLatent:Array.from({length:16},(_,i)=>Math.cos(i*.11)),
  neuralAssembly:Array.from({length:16},(_,i)=>.12+(i%5)*.04),
  personalityBias:{explore:.08,verify:.03,reflect:.02,respond:-.01},
  autonomy01:.76,noveltyNeed01:.82,
  promotedSkills:[
    {id:'skill-alpha',actions:['explore','verify'],reliability01:.84},
    {id:'skill-beta',actions:['reflect','respond'],reliability01:.79},
    {id:'skill-gamma',actions:['verify','explore','reflect'],reliability01:.75},
  ],
};
const proposal=p.propose({tick:1,...base});
assert.ok(proposal.programId);
assert.ok(proposal.depth>=2);
assert.ok(proposal.primitivePlan.length>=2);
const program=p.snapshot().programs.find(x=>x.id===proposal.programId);
assert.ok(program);
let ev;
for(let i=0;i<2;i++) ev=p.observeTrial({tick:2+i,programId:proposal.programId,reward01:.78,independentGain01:.12,predictionError01:.12,robustness01:.86,personalityAlignment01:.79,selfAlignment01:.81});
assert.ok(ev?.verified);
const tr=p.transfer({tick:5,programId:proposal.programId,newGoalVector:[-.3,.72,.2,.6,.1,.65,.2,.4],selfLatent:base.selfLatent,worldLatent:base.worldLatent,neuralAssembly:base.neuralAssembly,independentGain01:.10,robustness01:.84});
assert.ok(tr.gain01>=0);
for(let t=6;t<36;t++)p.propose({...base,tick:t,noveltyNeed01:.55+(t%3)*.1});
const d=p.diagnostics();
assert.ok(d.imaginedPrograms>=10);assert.ok(d.verifiedPrograms>=1);assert.ok(d.composeDepthMax>=2);assert.ok(d.neuralGrounding01>.45);assert.ok(d.programNovelty01>0);
const snap=p.snapshot();const q=new B276LatentActionProgramSynthesizer();q.restore(snap);assert.deepEqual(q.snapshot(),snap);
console.log(JSON.stringify({pass:true,proposal,evaluation:ev,transfer:tr,diagnostics:d},null,2));
