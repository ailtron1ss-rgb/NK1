import assert from 'node:assert/strict';
import { B261UnifiedWorldModel } from '../src/organism/cognition/B261UnifiedWorldModel.ts';
const actions=['wait','explore','verify','respond','rest','reflect','defer'];
const reward=(before,seq)=>{
  let value=0;
  for(let i=0;i<seq.length;i++){
    const ai=actions.indexOf(seq[i]);
    value+=(i===seq.length-1?.64:.22)+(before[(ai*5+i*3)%24]??0)*.16+(seq[i]==='verify'?.07:0)-(seq[i]==='wait'?.05:0);
    if(i>0&&seq[i-1]==='explore'&&seq[i]==='verify')value+=.09;
    if(i>2&&seq[i-2]==='verify'&&seq[i-1]==='respond'&&seq[i]==='reflect')value+=.07;
  }
  return Math.max(0,Math.min(1,value/seq.length));
};
const lengths=[5,6,7,8];
const samples=[];
for(let i=0;i<96;i++){
  const before=Array.from({length:24},(_,j)=>((i*11+j*7)%37)/36);
  const base=[
    ['explore','verify','respond','reflect','rest','verify','respond','wait'],
    ['verify','respond','explore','verify','respond','rest','reflect','wait'],
    ['reflect','verify','respond','explore','verify','respond','rest','defer'],
    ['wait','explore','verify','respond','reflect','verify','respond','rest'],
  ];
  const sequences=lengths.map((len,k)=>({actions:base[(i+k)%base.length].slice(0,len),actualReward01:reward(before,base[(i+k)%base.length].slice(0,len))}));
  samples.push({before,sequences});
}
const m=new B261UnifiedWorldModel();
for(let epoch=0;epoch<28;epoch++){
  for(let i=0;i<72;i++){
    const before=samples[i].before;
    for(const action of actions){
      const ai=actions.indexOf(action);
      const after=before.map((v,j)=>Math.tanh(v*.76+(j===ai?.20:0)+((j+ai+epoch)%7===0?.05:0)));
      const r=Math.max(0,Math.min(1,.16+before[(ai*3)%24]*.34+(action==='verify'?.26:0)+(action==='explore'?.10:0)+(action==='respond'?.05:0)));
      m.train(before,action,after,r,i+epoch*100,'online');
    }
  }
}
const holdout=samples.slice(72);
const result=m.sequenceActionabilityBenchmark(holdout);
assert.equal(result.samples,24);
assert.ok(result.actionHitRate01>=.40);
assert.ok(result.modelRegret01>=0&&result.modelRegret01<=1);
assert.ok(result.uplift01>=0);
const planLengths=lengths.map((len,k)=>m.planSequence(holdout[k].before,holdout[k].sequences[k].actions));
assert.deepEqual(planLengths.map(p=>p.steps.length),lengths);
assert.ok(planLengths.every(p=>p.terminalState.every(Number.isFinite)&&Number.isFinite(p.predictedValue01)));
console.log(JSON.stringify({pass:true,holdout:holdout.length,...result,lengths,plans:planLengths.map(p=>({length:p.steps.length,value01:p.predictedValue01,uncertainty01:p.uncertainty01})),diagnostics:m.diagnostics()}));
