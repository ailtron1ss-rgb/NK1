import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { GROUNDED_SPATIAL_MEMORY_SOURCE } from '../src/organism/memory/GroundedSpatialMemoryBridge.ts';

const core=new OrganismCore(new MemoryStateStore(),{enableLanguage:false});
await core.init();
try{
 const world=(x,evidenceKind)=>({
  tick:1,location:'lab',energy:.8,attention:.75,uncertainty:.12,
  facts:['calibrated laboratory frame'],
  objects:[{
   id:'chair-track-1',label:'chair',location:'lab',value:0,valueKnown:false,
   visible:true,visibilityKnown:true,collected:false,collectionKnown:false,
   confidence01:.92,evidenceKind,sourceId:'calibrated-world-receipt:42',
   coordinateFrameId:'lab-map',x,y:2,z:0,
  }],
 });
 await core.observe({worldContext:world(1,'observed')});
 const afterObserved=core.snapshot();
 const observedMemories=afterObserved.facets.advanced.memoryOS.items.filter(row=>row.source===GROUNDED_SPATIAL_MEMORY_SOURCE);
 assert.equal(observedMemories.length,1,'a live Core observation must project the grounded coordinate into canonical MemoryOS2');
 assert.equal(observedMemories[0].context.spatialX,'1');
 assert.equal(observedMemories[0].context.spatialFrameId,'lab-map');

 await core.observe({worldContext:world(20,'model-output')});
 const afterModelOutput=core.snapshot();
 const retained=afterModelOutput.facets.advanced.memoryOS.items.filter(row=>row.source===GROUNDED_SPATIAL_MEMORY_SOURCE);
 assert.equal(retained.length,1,'model-only position output must not create another spatial memory');
 assert.equal(retained[0].context.spatialX,'1','model-only coordinates must not overwrite an observed canonical position');
 assert.equal(retained[0].context.groundedEvidenceKind,'observed');
 console.log('GROUNDED_SPATIAL_CORE_TICK=PASS');
}finally{
 await core.close?.();
}
