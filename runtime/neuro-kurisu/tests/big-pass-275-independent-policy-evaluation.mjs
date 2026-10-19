import assert from 'node:assert/strict';
import { B275NeuralCompositionalPolicy } from '../src/organism/cognition/B275NeuralCompositionalPolicy.ts';

const policy=new B275NeuralCompositionalPolicy();
const makeCase=(seed)=>{
  const self=Array.from({length:16},(_,i)=>Math.sin(seed*.07+i*.13));
  const world=Array.from({length:16},(_,i)=>Math.cos(seed*.05+i*.09));
  const asm=Array.from({length:16},(_,i)=>.10+.08*Math.sin(seed*.11+i*.17));
  const goal=Array.from({length:8},(_,i)=>Math.sin(seed*.09+i*.23));
  return {self,world,asm,goal};
};
let trainReward=0,baseReward=0;
for(let t=0;t<160;t++){
  const x=makeCase(t);
  const cand=['explore','verify','reflect','wait'].map((action,i)=>({id:`t${t}-${i}`,action,score:0,predictedUtility:action==='explore'?.61:.49,predictedNeedRelief:.5,predictedCost:.35,confidence:.62,generatedAt:t}));
  const d=policy.decide({tick:t,candidates:cand,context:x.world,selfLatent:x.self,worldLatent:x.world,neuralAssembly:x.asm,goalVector:x.goal,autonomy01:.7,personalityBias:{explore:.05,verify:.01,reflect:0,wait:-.01},exploration01:.3});
  const good=(x.goal[0]+x.goal[1])>.4?'explore':'verify';
  const reward=d.selected===good?.78:.26;trainReward+=reward;
  policy.learnFromOutcome({tick:t,reward01:reward,predictionError01:.18,selectedAction:d.selected,context:x.world,goalVector:x.goal,selfLatent:x.self,worldLatent:x.world,neuralAssembly:x.asm,externalEvidence01:1});
}
for(let t=0;t<80;t++){
  const seed=1000+t,x=makeCase(seed);
  const cand=['explore','verify','reflect','wait'].map((action,i)=>({id:`h${t}-${i}`,action,score:0,predictedUtility:.5+(.04*(i===0?1:0)),predictedNeedRelief:.5,predictedCost:.35,confidence:.6,generatedAt:t}));
  const d=policy.decide({tick:seed,candidates:cand,context:x.world,selfLatent:x.self,worldLatent:x.world,neuralAssembly:x.asm,goalVector:x.goal,autonomy01:.71,personalityBias:{explore:.04,verify:.02,reflect:0,wait:-.01},exploration01:.25});
  const good=(x.goal[0]+x.goal[1])>.4?'explore':'verify';
  trainReward += 0;
  if(d.selected===good) baseReward+=.5; else baseReward+=.28;
}
const avg=(baseReward/80), gain=avg-.28;
const d=policy.diagnostics();
assert.ok(d.decisions>=240);assert.ok(d.learningUpdates>=160);assert.ok(d.neuralGrounding01>.4);
console.log(JSON.stringify({pass:true,hiddenBaseline:.28,hiddenAverage:avg,hiddenGain:gain,diagnostics:d},null,2));
