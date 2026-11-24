import assert from 'node:assert/strict';
import { B2501DeepNeuralCausalBranch, defaultB2501State } from '../src/organism/cognition/B2501DeepNeuralCausalBranch.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map((a,i)=>[a,i===1?.72:i===2?.64:.48]));
const ctx=(s,t)=>Array.from({length:16},(_,i)=>((s*13+t*7+i*5)%29)/28);
const rows=[];
for(let seed=1;seed<=6;seed++){
  const n=new B2501DeepNeuralCausalBranch(); n.restore(defaultB2501State());
  for(let t=1;t<=180;t++){
    const x=ctx(seed,t%11);
    const r=n.beforeDecision({tick:t,context01:x,baseUtilities:base,goalVector01:x.slice(0,8),selfVector01:x.slice(2,10),bodyVector01:[.7,.2,.8,.7],worldVector01:x.slice(4,12),uncertainty01:t%7===0?.72:.24,novelty01:t%11===0?.78:.25,predictionError01:t%13===0?.55:.12,motivation01:.55,energy01:.74,cognitiveLoad01:.22,autonomous01:.72});
    n.afterOutcome({tick:t,action:r.selectedAction,reward01:r.selectedAction==='explore'&&t%11===0?.95:.38,predictionError01:.15,verified01:t%5===0?1:0,nextContext01:x,world01:x.slice(0,8),body01:[.7,.2,.8,.7],self01:x.slice(0,8),salience01:.4});
  }
  const snap=n.snapshot(), probe={tick:181,context01:ctx(seed,4),baseUtilities:base,goalVector01:ctx(seed,4).slice(0,8),selfVector01:ctx(seed,4).slice(1,9),bodyVector01:[.6,.3,.75,.65],worldVector01:ctx(seed,4).slice(4,12),uncertainty01:.34,novelty01:.42,predictionError01:.18,motivation01:.58,energy01:.68,cognitiveLoad01:.24,autonomous01:.75};
  const on=n.beforeDecision(probe); n.restore(snap); const lesion=n.evaluateLesion(probe);
  assert.ok(lesion.effect01>.01);
  const rr=new B2501DeepNeuralCausalBranch(); rr.restore(snap); const restart=rr.beforeDecision(probe);
  assert.ok(A.reduce((z,a)=>z+Math.abs(on.neuralUtility[a]-restart.neuralUtility[a]),0)<1e-10);
  rows.push({seed,lesion01:+lesion.effect01.toFixed(5),learningUpdates:snap.learningUpdates,delayUpdates:snap.delayUpdates,primitives:snap.primitives.length,compositions:snap.compositions,precision01:+snap.precision01.toFixed(4)});
}
console.log(JSON.stringify({pass:true,status:'B2501_DEEP_NEURAL_CAUSAL_BRANCH_PASS',minLesion01:Math.min(...rows.map(r=>r.lesion01)),rows},null,2));
