import assert from 'node:assert/strict';
import { WorldCausalCalibration } from '../src/organism/system/WorldCausalCalibration.ts';

const c=new WorldCausalCalibration();
for(let i=0;i<1;i++){
  c.track({predictionId:`p${i}`,action:'explore',predicted01:.72,confidence01:.8,intervention:true,at:1000+i});
  c.observe({predictionId:`p${i}`,action:'explore',actual01:.69,source:'intervention',confidence01:.8,verified01:1,independent01:1,evidence01:.92,matchedContextKey:'lab-a',at:1000+i});
}
const first=c.actionReadiness('explore',6,'lab-a');
for(let i=1;i<6;i++){
  c.track({predictionId:`p${i}`,action:'explore',predicted01:.72,confidence01:.8,intervention:true,at:1000+i});
  c.observe({predictionId:`p${i}`,action:'explore',actual01:.69+(i%2)*.01,source:'intervention',confidence01:.8,verified01:1,independent01:1,evidence01:.92,matchedContextKey:'lab-a',at:1000+i});
}
const repeated=c.actionReadiness('explore',6,'lab-a');
assert.ok(first<repeated,'repeated matched trials must increase causal readiness');
assert.ok(first<.5,'one verified trial must not fully promote causal readiness');
assert.ok(repeated>.7,'six high-quality matched trials should establish strong readiness');
const rows=c.snapshot();
assert.equal(rows.interventions,6);
assert.equal(rows.resolved,6);
assert.ok(rows.byAction.explore.readiness01>0.7);
console.log(JSON.stringify({ok:true,firstReadiness:first,repeatedReadiness:repeated,stats:rows.byAction.explore}));
