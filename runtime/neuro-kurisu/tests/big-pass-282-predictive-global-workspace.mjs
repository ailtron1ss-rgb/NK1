import assert from 'node:assert/strict';
import { B282PredictiveGlobalWorkspace } from '../src/organism/cognition/B282PredictiveGlobalWorkspace.ts';
const baseAreas=()=>({sensorium:[1,0,1,0,0,1,0,0],memory:[0,1,1,0,1,0,0,0],association:[1,1,0,0,0,0,1,0],selfAction:[0,0,1,1,0,0,0,1]});
const w=new B282PredictiveGlobalWorkspace();
for(let t=0;t<240;t++){
  const areas=baseAreas();
  if(t%11===0){ areas.association=areas.association.map((v,i)=>i%2?v:1-v); }
  w.step({tick:t,areaSpikes:areas,selfLatent:[.2,.1,.4,.3,.2,.5,.1,.2],worldLatent:[.4,.2,.1,.3,.2,.1],goalVector:[.6,.2,.1,.3],novelty01:t%23===0?.8:.25,uncertainty01:t%17===0?.7:.2,predictionError01:.18,reward01:.58,autonomy01:.72,learningEnabled:true});
  if(t%8===0) w.learnFromOutcome({tick:t,reward01:.62,predictionError01:.14,action:t%2?'explore':'verify'});
}
const d=w.diagnostics();
assert(d.steps===240); assert(d.learningUpdates>0); assert(d.predictionUpdates>0); assert(d.ignitionCount>0); assert(d.ignition01>0.6); assert(d.globalCoherence01>0); assert(d.globalPrediction01>0);
const lesion=w.lesionCoalition('association',.5); assert(lesion.causalDrop01>=0);
const snap=w.snapshot(); const r=new B282PredictiveGlobalWorkspace(); r.restore(snap); assert.deepEqual(r.snapshot(),snap);
console.log(JSON.stringify({pass:true,steps:d.steps,learningUpdates:d.learningUpdates,predictionUpdates:d.predictionUpdates,ignitionCount:d.ignitionCount,ignition01:d.ignition01,globalCoherence01:d.globalCoherence01,globalPrediction01:d.globalPrediction01,coalition:d.lastCoalition,lesionDrop01:lesion.causalDrop01,roundTrip:true}));
