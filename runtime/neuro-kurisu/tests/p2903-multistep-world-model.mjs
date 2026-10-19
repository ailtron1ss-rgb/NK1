import assert from 'node:assert/strict';
import { B261UnifiedWorldModel } from '../src/organism/cognition/B261UnifiedWorldModel.ts';
const actions=['wait','explore','verify','respond','rest','reflect','defer'];
const reward=(before,seq)=>{
  let value=0;
  for(let i=0;i<seq.length;i++){
    const a=actions.indexOf(seq[i]);
    const state=before[(a*3+i*5)%24]??0;
    value+= (i===seq.length-1?.56:.28) + state*.18 + (seq[i]==='verify'?.08:0) - (seq[i]==='wait'?.06:0);
    if(i>0 && seq[i-1]==='explore' && seq[i]==='verify') value+=.10;
  }
  return Math.max(0,Math.min(1,value/seq.length));
};
const samples=[];
for(let i=0;i<64;i++){
  const before=Array.from({length:24},(_,j)=>((i*7+j*3)%29)/28);
  const rawSequences=[
    ['explore','verify','respond'],
    ['verify','respond','rest'],
    ['wait','wait','respond'],
    ['reflect','verify','respond'],
    ['explore','rest','verify'],
  ];
  const rotation=i%rawSequences.length;
  const sequences=[...rawSequences.slice(rotation),...rawSequences.slice(0,rotation)].map(seq=>({actions:seq,actualReward01:reward(before,seq)}));
  samples.push({before,sequences});
}
const m=new B261UnifiedWorldModel();
for(let epoch=0;epoch<22;epoch++){
  for(let i=0;i<48;i++){
    const before=samples[i].before;
    for(const action of actions){
      const ai=actions.indexOf(action);
      const after=before.map((v,j)=>Math.tanh(v*.80+(j===ai?0.22:0)+((j+ai)%5===0?.06:0)));
      const r=Math.max(0,Math.min(1,.18+before[(ai*2)%24]*.30+(action==='verify'?.28:0)+(action==='explore'?.12:0)));
      m.train(before,action,after,r,i+epoch*100,'online');
    }
  }
}
const result=m.sequenceActionabilityBenchmark(samples.slice(48));
assert.equal(result.samples,16);
assert.ok(Number.isFinite(result.modelRegret01));
assert.ok(Number.isFinite(result.meanCounterfactualGap01));
assert.ok(result.actionHitRate01>=0.40,'multi-step planner should be able to select a near-optimal sequence on held-out states');
const plan=m.planSequence(samples[63].before,['explore','verify','respond']);
assert.equal(plan.steps.length,3);
assert.equal(plan.sequence.length,3);
assert.ok(plan.terminalState.every(Number.isFinite));
assert.ok(plan.predictedValue01>=0&&plan.predictedValue01<=1);
console.log(JSON.stringify({pass:true,heldOut:16,...result,planValue01:plan.predictedValue01,diagnostics:m.diagnostics()}));
