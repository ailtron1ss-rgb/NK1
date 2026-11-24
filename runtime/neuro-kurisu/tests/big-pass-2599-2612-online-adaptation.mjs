import assert from 'node:assert/strict';
import { EmbodiedCausalWorldBridge } from '../src/organism/cognition/EmbodiedCausalWorldBridge.ts';

const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map(a=>[a,.5]));
const b=new EmbodiedCausalWorldBridge();
let firstError=0,secondError=0;
for(let t=1;t<=520;t++){
  const shifted=t>260;
  const features=Array.from({length:64},(_,i)=>{
    const base=((i*11+t*3)%53)/52;
    return shifted ? Math.max(0,Math.min(1,base+(i%4===0?.22:-.04))) : base;
  });
  const r=b.beforeDecision({tick:t,features,actionUtilities:base,novelty01:shifted?.62:.28,uncertainty01:shifted?.72:.34,predictionError01:shifted?.58:.16,computeBudget01:shifted?.80:.62});
  const action=r.selectedActionHint;
  const shock=t===420;
  const next=shock ? Array.from({length:64},(_,i)=>i%2?1:0) : features.map((v,i)=>Math.max(0,Math.min(1,v+(i%5===0?(shifted?.18:.06):-0.015))));
  b.afterOutcome({tick:t,action,nextFeatures:next,reward01:shock?.18:(action==='explore'?.74:.63),verified01:shock?.25:(t%3===0?1:.72),predictionError01:shock?.92:(shifted?.55:.14)});
  const e=b.metrics().sensorimotorError01;
  if(!shifted)firstError+=e;else secondError+=e;
}
const d=b.metrics();
assert(d.adaptationUpdates>0);
assert(d.onlineAdaptation01>0,'online adaptation remained dormant');
assert(d.modelDrift01>=0);
assert(d.calibrationError01>=0 && d.calibrationError01<=1);
assert(d.failureEvents>0,'distribution shift did not trigger failure telemetry');
assert(d.recoveryGain01>0);
assert(d.horizonConfidence01[4]>0);
const snap=b.snapshot();const r2=new EmbodiedCausalWorldBridge();r2.restore(snap);const d2=r2.metrics();
assert(d2.adaptationUpdates===d.adaptationUpdates);
assert(Math.abs(d2.onlineAdaptation01-d.onlineAdaptation01)<1e-12);
console.log('B2599_2612_ONLINE_ADAPTATION_PASS',JSON.stringify({adaptationUpdates:d.adaptationUpdates,onlineAdaptation01:d.onlineAdaptation01,calibrationError01:d.calibrationError01,modelDrift01:d.modelDrift01,failureEvents:d.failureEvents,recoveryGain01:d.recoveryGain01,firstMeanError:Number((firstError/260).toFixed(6)),shiftedMeanError:Number((secondError/260).toFixed(6)),horizon16Confidence01:d.horizonConfidence01[4]},null,2));
