import assert from 'node:assert/strict';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
const ACTIONS=['respond','explore','verify','rest','reflect','wait','defer'];
const run=(body,seed)=>Array.from({length:64},(_,i)=>{
  if(i===0)return body.energy; if(i===1)return body.thermal; if(i===2)return body.capacity; if(i===3)return body.uncertainty; return Math.max(-1,Math.min(1,(((seed+i*7)%23)/11)-1));
});
const rows=[];
for(let seed=1;seed<=6;seed++){
  const net=new B365UnifiedNeuroCausalCore();
  for(let t=1;t<=96;t++){
    net.step({tick:t,vector:run({energy:.55,thermal:.3,capacity:.72,uncertainty:t%4===0?.55:.2},seed),novelty01:t%24===0?.82:.3,uncertainty01:t%7===0?.7:.22,predictionError01:.2,goalPressure01:.35,learningEnabled:true});
    net.learnFromOutcome({tick:t,action:t%2?'rest':'explore',reward01:t%2?.7:.45,predictionError01:.1,verified01:t%8===0?1:0,externalEvidence01:t%16===0?1:0});
  }
  const nominal=net.step({tick:97,vector:run({energy:.82,thermal:.12,capacity:.9,uncertainty:.2},seed),novelty01:.2,uncertainty01:.2,predictionError01:.1,goalPressure01:.25,learningEnabled:false});
  const stressed=net.step({tick:98,vector:run({energy:.16,thermal:.88,capacity:.35,uncertainty:.76},seed),novelty01:.7,uncertainty01:.76,predictionError01:.46,goalPressure01:.42,learningEnabled:false});
  const l1=ACTIONS.reduce((s,a)=>s+Math.abs(nominal.actionProbabilities[a]-stressed.actionProbabilities[a]),0);
  const diag=net.diagnostics();
  assert.ok(l1>.008,`seed ${seed}: interoceptive stress failed to move neural policy ${l1}`);
  assert.ok(diag.structuralUpdates>0,`seed ${seed}: structural lifecycle produced no synaptic update`);
  rows.push({seed,l1:Number(l1.toFixed(6)),nominal:nominal.selectedAction,stressed:stressed.selectedAction,structuralUpdates:diag.structuralUpdates,activeSynapses:diag.activeSynapses,totalSynapses:diag.totalSynapses,plasticity:Number(diag.plasticity01.toFixed(6)),recurrentCoherence:Number(diag.recurrentCoherence01.toFixed(6))});
}
console.log(JSON.stringify({pass:true,status:'B365_NEURAL_HOMEOSTASIS_STRUCTURAL_PASS',seeds:rows.length,minInteroceptiveL1:Math.min(...rows.map(r=>r.l1)),rows},null,2));
