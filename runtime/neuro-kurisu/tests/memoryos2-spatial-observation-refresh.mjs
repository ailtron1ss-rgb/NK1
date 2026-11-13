import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

function observation(observedAt,x){
  return {
    content:'Grounded spatial position for entity track-1.',
    kind:'episodic',
    source:'grounded-world-spatial-observation',
    tags:['grounded-world','spatial-observation'],
    entities:['track-1','chair'],
    context:{
      spatialFrameId:'lab-frame',
      spatialX:String(x),
      spatialY:'2',
      spatialZ:'0',
      groundedEntityId:'track-1',
      groundedEvidenceKind:'observed',
    },
    salience:.58,
    emotionalWeight:.04,
    identityRelevance:.02,
    goalRelevance:.06,
    socialRelevance:.02,
    predictionError:.08,
    confidence:.91,
    epistemicStatus:'belief',
    semanticLinks:[],
    temporalLinks:[],
    causalLinks:[],
    validFromAt:observedAt,
    validUntilAt:observedAt+90_000,
    observedAt,
    provenanceClass:'device',
    sourceAuthority01:.91,
    independenceKey:'grounded-spatial:track-1:vision',
    evidenceFreshnessAt:observedAt,
    evidenceSources:[{
      source:'grounded-world:vision',
      provenanceClass:'device',
      sourceAuthority01:.91,
      independenceKey:'grounded-spatial:track-1:vision',
      observedAt,
      evidenceFreshnessAt:observedAt,
    }],
  };
}

const now=Date.now()-10_000;
const memory=new MemoryOS2({embeddingProvider:null});
const first=memory.encode(observation(now,1));
const secondAt=now+1000;
const second=memory.encode(observation(secondAt,4));

assert.equal(second.id,first.id,'a repeated grounded entity must reconsolidate into one canonical memory');
assert.equal(memory.size(),1,'repeated positions must not create duplicate memories');
assert.equal(second.observedAt,secondAt,'newer observation time must replace stale observation time');
assert.equal(second.validFromAt,secondAt,'the current validity window must start at the newer observation');
assert.equal(second.validUntilAt,secondAt+90_000,'the freshness expiry must extend from the latest observation');
assert.equal(second.context.spatialX,'4','the current spatial point must move with the observed track');
assert.equal(memory.indexDiagnostics().spatialIndex.pass,true,'the derived index must remain aligned with the canonical point');

const delayed=memory.encode(observation(now+500,2));
assert.equal(delayed.id,first.id,'a delayed observation must still resolve to the canonical entity memory');
assert.equal(delayed.observedAt,secondAt,'an older observation must not rewind observedAt');
assert.equal(delayed.validFromAt,secondAt,'an older observation must not rewind the current validity start');
assert.equal(delayed.validUntilAt,secondAt+90_000,'an older observation must not shorten the current validity window');
assert.equal(delayed.context.spatialX,'4','an older observation must not move the entity back to a stale coordinate');
assert.equal(memory.indexDiagnostics().spatialIndex.pass,true,'stale observations must not desynchronize the derived index');
console.log('MEMORYOS2_SPATIAL_OBSERVATION_REFRESH=PASS');
