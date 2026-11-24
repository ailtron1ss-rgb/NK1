import assert from 'node:assert/strict';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const vec=(mode,seed)=>Array.from({length:64},(_,i)=>{
  if(mode==='stress'){ if(i===0)return -.84; if(i===1)return .88; if(i===2)return -.45; }
  if(mode==='calm'){ if(i===0)return .8; if(i===1)return -.1; if(i===2)return .9; }
  return Math.max(-1,Math.min(1,(((seed+i*11)%29)/14)-1));
});

const rows=[];
for(let seed=1;seed<=6;seed++){
  const net=new B365UnifiedNeuroCausalCore();
  for(let t=1;t<=160;t++){
    const mode=t%2?'calm':'stress';
    const r=net.step({tick:t,vector:vec(mode,seed),novelty01:mode==='stress'?.76:.28,uncertainty01:mode==='stress'?.74:.2,predictionError01:mode==='stress'?.46:.1,goalPressure01:mode==='stress'?.62:.3,learningEnabled:true});
    net.learnFromOutcome({tick:t,action:mode==='stress'?'rest':'explore',reward01:mode==='stress'?.9:.78,predictionError01:mode==='stress'?.05:.08,verified01:1,externalEvidence01:1});
  }
  const calm=net.step({tick:161,vector:vec('calm',seed),novelty01:.18,uncertainty01:.16,predictionError01:.07,goalPressure01:.25,learningEnabled:false});
  const stress=net.step({tick:162,vector:vec('stress',seed),novelty01:.82,uncertainty01:.8,predictionError01:.52,goalPressure01:.65,learningEnabled:false});
  const l1=actions.reduce((s,a)=>s+Math.abs(calm.actionProbabilities[a]-stress.actionProbabilities[a]),0);
  const calmMax=Math.max(...actions.map(a=>calm.actionProbabilities[a]));
  const stressMax=Math.max(...actions.map(a=>stress.actionProbabilities[a]));
  const diag=net.diagnostics();
  assert.ok(diag.neuralConfidence01>.2,`seed ${seed}: neural confidence too low`);
  assert.ok(diag.actionEntropy01<.995,`seed ${seed}: policy remains too diffuse ${diag.actionEntropy01}`);
  assert.ok(calmMax>.18 && stressMax>.18,`seed ${seed}: no action commitment`);
  assert.ok(l1>.002,`seed ${seed}: policy context separation too small ${l1}`);
  rows.push({seed,l1:Number(l1.toFixed(6)),calmMax:Number(calmMax.toFixed(6)),stressMax:Number(stressMax.toFixed(6)),entropy:Number(diag.actionEntropy01.toFixed(6)),confidence:Number(diag.neuralConfidence01.toFixed(6))});
}
console.log(JSON.stringify({pass:true,status:'B366_NEURAL_ACTION_COMMITMENT_PASS',seeds:rows.length,rows},null,2));
