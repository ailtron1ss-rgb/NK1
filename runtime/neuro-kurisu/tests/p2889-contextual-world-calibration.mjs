import assert from 'node:assert/strict';
import { WorldCausalCalibration } from '../src/organism/system/WorldCausalCalibration.ts';

const c=new WorldCausalCalibration();
for(let i=0;i<12;i++){
  const id=`p:${i}`;
  c.track({predictionId:id,action:'move',predicted01:.82,confidence01:.82,at:i+1});
  c.observe({predictionId:id,action:'move',actual01:.9,source:'observation',verified01:.8,independent01:.8,evidence01:.85,matchedContextKey:'rainy-city',at:i+2});
}
const ctx=c.contextDiagnostics()['move|rainy-city'];
assert.ok(ctx && ctx.n===12);
const raw=.3;
const calibrated=c.calibratedConfidence('move',raw,'rainy-city');
assert.ok(calibrated>raw);
assert.equal(c.calibratedConfidence('move',raw,'unknown-context'),raw);
const snap=c.snapshot();
const r=new WorldCausalCalibration(); r.restore(snap);
assert.equal(r.contextDiagnostics()['move|rainy-city'].n,12);
console.log(JSON.stringify({ok:true,context:ctx,raw,calibrated,actionReadiness:c.actionReadiness('move',6,'rainy-city')}));
