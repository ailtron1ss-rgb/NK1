import assert from 'node:assert/strict';
import { P2855ContextualActionPolicyController } from '../src/organism/cognition/P2855ContextualActionPolicyController.ts';

const A=7;
const cueFor=(ctx,noise=0)=>Array.from({length:64},(_,i)=>Math.max(-1,Math.min(1,(((ctx*0.19+Math.sin(i*0.23+ctx*0.71))*0.55)+(i<16?(ctx/7)*0.4:0))+noise*Math.sin(i*0.37))));
const phase='wake';
const target=ctx=>ctx%7;
const argmax=v=>v.reduce((bi,x,i)=>x>v[bi]?i:bi,0);
const prng=seed=>{let x=seed|0;return()=>{x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);x^=x>>>13;return (x>>>0)/0xffffffff;};};

const train=({contexts=5,steps=1200,epsilon=.12}={})=>{
  const c=new P2855ContextualActionPolicyController(),rand=prng(90210);
  let reward=0;
  for(let t=0;t<steps;t++){
    const ctx=t%contexts,cue=cueFor(ctx,(rand()-.5)*.08),bias=c.actionBias(ctx,A,c===ctx?1:.9,phase,cue);
    let action=argmax(bias);
    if(rand()<epsilon)action=Math.floor(rand()*A);
    const r=action===target(ctx)?1:.08;
    reward+=r;
    c.observe(ctx,cue,action,r,1-r,1,phase,1);
  }
  return {c,trainReward:reward/steps};
};

const {c,trainReward}=train();
const evalContexts=[0,1,2,3,4];
let correct=0,total=0,retained=0;
for(const ctx of evalContexts){
  for(let rep=0;rep<8;rep++){
    const b=c.readOnlyActionBias(ctx,A,cueFor(ctx,(rep-4)*.012));
    if(argmax(b)===target(ctx))correct++;
    total++;
  }
}
for(let rep=0;rep<8;rep++){
  const b=c.readOnlyActionBias(0,A,cueFor(0,(rep-4)*.015));
  if(argmax(b)===0)retained++;
}
assert.ok(trainReward>.55,`training reward too low: ${trainReward}`);
assert.ok(correct/total>=.9,`holdout action accuracy too low: ${correct}/${total}`);
assert.ok(retained===8,`context-0 retention failed: ${retained}/8`);
const snap=c.snapshot();
const restored=new P2855ContextualActionPolicyController();restored.restore(snap);
assert.deepEqual(restored.snapshot(),snap);
const metrics=c.metrics();
assert.ok(metrics.updates>=1200);
assert.ok(metrics.memoryBytes<=12*1024);
assert.ok(metrics.transferAccepted>0);
console.log(JSON.stringify({
  trainingReward01:trainReward,
  holdoutAccuracy01:correct/total,
  context0Retention01:retained/8,
  updates:metrics.updates,
  transferAccepted:metrics.transferAccepted,
  transferRejected:metrics.transferRejected,
  confidence01:metrics.confidence01,
  memoryBytes:metrics.memoryBytes,
  persisted:true
},null,2));
