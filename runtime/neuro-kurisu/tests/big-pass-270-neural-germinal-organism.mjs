import assert from 'node:assert/strict';
import { B270NeuralGerminalOrganism } from '../src/organism/cognition/B270NeuralGerminalOrganism.ts';
const net=new B270NeuralGerminalOrganism();
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
let autonomous=0, successes=0;
for(let t=1;t<=1200;t++){
  const uncertainty=.15+.72*((t%97)/96);
  const novelty=.08+.86*((Math.sin(t*.041)+1)/2);
  const err=.08+.74*Math.abs(Math.sin(t*.083));
  const action=actions[t%actions.length];
  const r=net.step({tick:t,vector:Array.from({length:32},(_,i)=>Math.sin(t*.019+i*.17)*.65+Math.cos(i*.07)*.12),neuralAssembly:Array.from({length:12},(_,i)=>Math.max(0,Math.sin(t*.013+i*.37)*.5+.5)),predictionError01:err,uncertainty01:uncertainty,energy01:.62+.28*Math.cos(t*.009),novelty01:novelty,goalPressure01:.2+.6*((t%53)/52),socialNeed01:.15+.65*((t%41)/40),memoryContinuity01:.72+.2*Math.sin(t*.005),identityContinuity01:.7+.22*Math.cos(t*.004),realityAlignment01:.78+.16*Math.sin(t*.006),action});
  if(r.autonomy01>.6) autonomous++;
  const reward=action===r.proposedAction ? .72 : .42;
  if(reward>.6) successes++;
  if(t%2===0) net.learnFromOutcome({tick:t,action,reward01:reward,predictionError01:Math.abs(err-.25)*.9});
}
const d=net.diagnostics();
assert.ok(d.cycles===1200,'cycles mismatch');
assert.ok(d.learningUpdates>500,'insufficient learning');
assert.ok(d.neuralEmbryoDiversity01>.25,'neural embryos did not diversify');
assert.ok(d.personalityCoherence01>.45,'personality coherence collapsed');
assert.ok(d.identityCoherence01>.45,'identity coherence collapsed');
assert.ok(d.autonomy01>.35,'autonomy remained inert');
assert.ok(new Set(Object.values(d.traitValues).map(v=>Number(v.toFixed(3)))).size>=4,'traits did not differentiate');
const snap=net.snapshot(); const restored=new B270NeuralGerminalOrganism(); restored.restore(snap);
assert.deepEqual(restored.autonomousSnapshot(),net.autonomousSnapshot(),'autonomous snapshot did not persist');
console.log(JSON.stringify({pass:true,diagnostics:d,autonomousSelections:autonomous,successfulSelections:successes,restored:restored.autonomousSnapshot()},null,2));
