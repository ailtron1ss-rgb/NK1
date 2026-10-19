import assert from 'node:assert/strict';
import { B269SpikingPlasticNeuralSubstrate, defaultB269SpikingPlastic } from '../src/organism/cognition/B269SpikingPlasticNeuralSubstrate.ts';

const net=new B269SpikingPlasticNeuralSubstrate();
const before=net.probe();
let totalSpikes=0, totalUpdates=0;
for(let t=0;t<800;t++){
  const x=Array.from({length:24},(_,i)=>Math.sin(t*.071+i*.17)*.75 + Math.cos(t*.021+i*.11)*.12);
  const action=['respond','explore','verify','rest','reflect','wait','defer'][t%7];
  const r=net.step({vector:x,tick:t,action, dopamine01:.45+(t%17)/18,norepinephrine01:.5+(t%11)/22,acetylcholine01:.55+(t%13)/20,novelty01:.35+(t%9)/15,uncertainty01:.38+(t%7)/14,predictionError01:.25+Math.abs(Math.sin(t*.1))*.55});
  totalSpikes+=r.spikes.reduce((a,b)=>a+b,0);
  if(t%3===2){const l=net.learnFromOutcome({reward01:.3+.4*((t%9)/8),predictionError01:Math.abs(.5-r.prediction01),tick:t,action});totalUpdates+=l.updates;}
}
const after=net.probe();
const lesion=net.lesion(.35);
const snap=net.snapshot(); const restored=new B269SpikingPlasticNeuralSubstrate(); restored.restore(snap);
assert.ok(after.spikeRate01>0, 'no spike events were produced');
assert.ok(after.synapticUpdates>0 && totalUpdates>0, 'no synaptic plasticity');
assert.ok(after.structuralUpdates>0, 'structural plasticity did not engage');
assert.ok(after.synapticUpdates>before.synapticUpdates, 'plasticity did not engage');
assert.ok(after.homeostaticError01<.25, 'homeostatic firing diverged');
assert.ok(after.sparsity01>.65, 'activity became too dense');
assert.ok(Math.abs(restored.probe().firingRate01-after.firingRate01)<1e-12, 'restore mismatch');
assert.ok(lesion.baselineActiveSynapses>lesion.lesionedActiveSynapses && lesion.causalDrop01>=0, 'lesion instrumentation invalid');
console.log(JSON.stringify({pass:true,before,after,totalSpikes,totalUpdates,lesion,restored:restored.probe()},null,2));
