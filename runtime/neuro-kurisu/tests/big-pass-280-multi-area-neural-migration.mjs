import assert from 'node:assert/strict';
import { B280MultiAreaNeuralCircuit } from '../src/organism/cognition/B280MultiAreaNeuralCircuit.ts';
const b=new B280MultiAreaNeuralCircuit();
for(let t=1;t<=40;t++){
  const r=b.step({tick:t,vector:Array.from({length:16},(_,i)=>Math.sin(t*.12+i)),selfLatent:Array(16).fill(.2),worldLatent:Array(16).fill(.3),goalVector:Array(16).fill(.1),novelty01:.6,uncertainty01:.3,autonomy01:.7,dopamine01:.6,norepinephrine01:.5,acetylcholine01:.7,predictionError01:.1});
  b.learnFromOutcome({tick:t,reward01:.7,predictionError01:.1,action:r.selectedAction});
}
const a=b.snapshot(); const b2=new B280MultiAreaNeuralCircuit(); b2.restore(a); const c=b2.snapshot();
assert.deepEqual(c,a);
console.log(JSON.stringify({ok:true,cycles:c.cycles,learningUpdates:c.learningUpdates,coherence:c.crossAreaCoherence01,ebalance:c.excitationInhibitionBalance01}));
