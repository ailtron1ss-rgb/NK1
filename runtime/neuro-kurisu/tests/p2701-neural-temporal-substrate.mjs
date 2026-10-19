import assert from 'node:assert/strict';
import { NeuralTemporalSubstrate } from '../src/organism/cognition/NeuralTemporalSubstrate.ts';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const input=Array.from({length:64},(_,k)=>Math.sin(k*.17));
const s=new NeuralTemporalSubstrate();
let before=s.diagnostics();
for(let t=1;t<=80;t++) s.step(input.map((v,k)=>v*Math.sin(t*.09+k*.013)),t);
const mid=s.diagnostics();
assert.equal(mid.neurons,32); assert(mid.spikeCount>0,'temporal substrate must actually spike');
for(let i=0;i<30;i++) s.learn(input,.85,.12,.95);
const after=s.diagnostics();
assert(after.learningUpdates>0,'temporal substrate must learn');
assert.notEqual(after.meanWeightAbs01,before.meanWeightAbs01,'weights must be stateful');
const snap=s.snapshot(); const restored=new NeuralTemporalSubstrate(); restored.restore(snap);
assert.deepEqual(restored.snapshot(),snap,'temporal substrate persistence failed');

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const u=Object.fromEntries(actions.map(a=>[a,.5]));
const branch=new NeuralExperienceBranch();
for(let t=1;t<=12;t++){
  const x=input.map((v,k)=>v*.4+Math.sin(t*.11+k*.021)*.1);
  const out=branch.beforeDecision({tick:t,input:x,baseUtilities:u,predictionError01:.22,novelty01:.35,uncertainty01:.2,homeostasis01:.2,identityGap01:.25,goalPressure01:.45});
  const action=actions[t%actions.length];
  branch.commitAction(action,out.actionBias);
  branch.afterOutcome({tick:t,action,reward01:t%3===0?.9:.62,predictionError01:.18,verified01:.9,nextInput:x.map(v=>v*.99),identityGap01:.25,goalPressure01:.45});
}
const d=branch.diagnostics();
assert(d.temporalSubstrate.learningUpdates>0,'P2701 substrate must be wired into organism');
const rs=branch.snapshot(); const branch2=new NeuralExperienceBranch(); branch2.restore(rs);
assert.deepEqual(branch2.snapshot().temporalSubstrate,rs.temporalSubstrate,'branch restart must preserve P2701 state');
console.log('P2701 neural temporal substrate PASS',JSON.stringify({before,mid,after,branchTemporal:d.temporalSubstrate}));
