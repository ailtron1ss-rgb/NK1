import assert from "node:assert/strict";
import { MemorySpatialIndex } from "../src/organism/developmental/MemorySpatialIndex.ts";
import { MemoryOS2 } from "../src/organism/developmental/MemoryOS2.ts";
const now=Date.now();
const makeMemory=(id,content,context={})=>({
 id,content,kind:"episodic",source:"spatial-recall-regression",tags:[],context,
 salience:.6,emotionalWeight:.2,identityRelevance:.2,goalRelevance:.2,socialRelevance:.1,
 predictionError:.1,confidence:.9,epistemicStatus:"belief",entities:[],semanticLinks:[],
 temporalLinks:[],causalLinks:[],contradictionLinks:[],validFromAt:now-10000,
 observedAt:now-1000,provenanceClass:"device",sourceAuthority01:.95
});
const point=(frameId,x,y,z=0)=>({spatialFrameId:frameId,spatialX:String(x),spatialY:String(y),spatialZ:String(z)});
{
 const index=new MemorySpatialIndex();
 index.upsert("near",point("room-A",1,0));index.upsert("middle",point("room-A",4,0));
 index.upsert("edge",point("room-A",5,0));index.upsert("wrong-frame",point("room-B",0,0));
 index.upsert("too-far",point("room-A",5.01,0));
 const hits=index.query({frameId:"room-A",x:0,y:0,radius:5});
 assert.deepEqual(hits.map(row=>row.id),["near","middle","edge"]);
 assert.equal(hits[0].distance,1);assert.equal(hits[0].relevance01,.8);
 assert.equal(index.query({frameId:"room-B",x:0,y:0,radius:1})[0]?.id,"wrong-frame");
 assert.deepEqual(index.query({frameId:"room-A",x:0,y:0,radius:0}),[]);
 assert.deepEqual(index.query({frameId:"room-A",x:0,y:0,radius:25}),[]);
 assert.equal(index.diagnostics([
  {id:"near",context:point("room-A",1,0)},{id:"middle",context:point("room-A",4,0)},
  {id:"edge",context:point("room-A",5,0)},{id:"wrong-frame",context:point("room-B",0,0)},
  {id:"too-far",context:point("room-A",5.01,0)}
 ]).pass,true);
 index.upsert("near",point("room-A",40,0));
 assert.equal(index.query({frameId:"room-A",x:0,y:0,radius:5}).some(row=>row.id==="near"),false);
 assert.equal(index.remove("near"),true);
}
{
 const memory=new MemoryOS2({embeddingProvider:null});
 memory.encode(makeMemory("chair","A wooden chair beside the laboratory desk.",point("lab-1",1,0)));
 memory.encode(makeMemory("lamp","A desk lamp near the window.",point("lab-1",3,0)));
 memory.encode(makeMemory("tree","A tree outside the building.",point("garden-1",1,0)));
 const nearby=memory.previewRetrieveWithDiagnostics("nearest objects",8,0,0,{spatial:{frameId:"lab-1",x:0,y:0,radius:5}});
 assert.deepEqual(nearby.items.map(row=>row.id),["chair","lamp"]);
 assert.equal(nearby.diagnostics.spatialCandidateCount,2);
 assert.equal(nearby.diagnostics.spatialInvalidQuery,false);
 const baseline=memory.previewRetrieveWithDiagnostics("nearest objects",8);
 assert.equal(baseline.items.some(row=>row.id==="chair"),false);
 memory.updateContext("chair",{spatialX:"40"});
 const moved=memory.previewRetrieve("nearest objects",8,0,0,{spatial:{frameId:"lab-1",x:0,y:0,radius:5}});
 assert.equal(moved.some(row=>row.id==="chair"),false);
 const restored=new MemoryOS2({embeddingProvider:null});restored.restore(memory.snapshot());
 assert.equal(restored.indexDiagnostics().pass,true);
 assert.equal(restored.indexDiagnostics().spatialIndex.pass,true);
 const after=restored.previewRetrieve("nearest objects",8,0,0,{spatial:{frameId:"lab-1",x:40,y:0,radius:5}});
 assert.equal(after.some(row=>row.id==="chair"),true);
 assert.equal(restored.forgetById("chair","spatial-index-regression"),true);
 assert.equal(restored.indexDiagnostics().spatialIndex.pass,true);
 assert.equal(restored.previewRetrieve("nearest objects",8,0,0,{spatial:{frameId:"lab-1",x:40,y:0,radius:5}}).some(row=>row.id==="chair"),false);
}
{
 const memory=new MemoryOS2({embeddingProvider:null});
 memory.encode(makeMemory("same","A recurrent memory about a quiet room.",point("room",1,1)));
 memory.encode(makeMemory("same","A recurrent memory about a quiet room.",point("room",6,1)));
 assert.equal(memory.previewRetrieve("nearest room",4,0,0,{spatial:{frameId:"room",x:6,y:1,radius:2}})[0]?.id,"same");
 assert.equal(memory.indexDiagnostics().spatialIndex.pass,true);
}

{
 const index=new MemorySpatialIndex();
 const canonical=[];
 for(let i=0;i<10_000;i++){
  const context=point("scale-floor",(i%100)*2,Math.floor(i/100)*2,0);
  const id="scale-"+String(i).padStart(5,"0");
  index.upsert(id,context);canonical.push({id,context});
 }
 assert.equal(index.diagnostics(canonical).pass,true,"10k-row derived index must match canonical coordinates");
 const samples=[];
 for(let i=0;i<60;i++){
  const started=performance.now();
  const hits=index.query({frameId:"scale-floor",x:100,y:100,z:0,radius:24},64);
  samples.push(performance.now()-started);
  assert.equal(hits.length<=64,true,"query output must remain bounded at 10k rows");
  assert.equal(hits.every(row=>row.id.startsWith("scale-")),true);
 }
 samples.sort((a,b)=>a-b);
 const p95Ms=Number(samples[Math.min(samples.length-1,Math.ceil(samples.length*.95)-1)].toFixed(3));
 assert.ok(p95Ms<100,"bounded 10k-row grid lookup p95 must stay below 100ms on CI");
 console.log("MEMORYOS2_SPATIAL_SCALE=PASS",JSON.stringify({indexed:canonical.length,queryLimit:64,p95Ms}));
}

{
 const memory=new MemoryOS2({embeddingProvider:null});
 memory.encode(makeMemory("invalid-spatial","A note without coordinates."));
 const invalid=memory.previewRetrieveWithDiagnostics("unrelated place request",4,0,0,{
  spatial:{frameId:"room",x:0,y:0,radius:1000}
 });
 assert.equal(invalid.diagnostics.spatialInvalidQuery,true,"invalid spatial queries must be visible in diagnostics");
 assert.equal(invalid.items.some(row=>row.id==="invalid-spatial"),false,
  "an invalid spatial query must not bypass the grounded answerability gate");
}

{
 // Accessor-backed coordinates must be rejected without invoking the getter,
 // and an invalid replacement must not erase the last valid index entry.
 const index=new MemorySpatialIndex();
 const valid=point("room-A",1,0);
 assert.equal(index.upsert("stable",valid),true);
 let getterInvoked=false;
 const hostile={...valid};
 Object.defineProperty(hostile,"spatialFrameId",{enumerable:true,get(){
  getterInvoked=true;throw new Error("untrusted spatial getter executed");
 }});
 let accepted=false;
 assert.doesNotThrow(()=>{accepted=index.upsert("stable",hostile);},
  "hostile coordinate getters must be rejected instead of executed");
 assert.equal(accepted,false,"malformed spatial replacement must be refused");
 assert.equal(getterInvoked,false,"spatial context getters must never execute");
 assert.deepEqual(index.query({frameId:"room-A",x:0,y:0,radius:5}).map(row=>row.id),["stable"],
  "refused replacement must preserve the last validated spatial point");
 assert.equal(index.diagnostics([{id:"stable",context:valid}]).pass,true);
 const hostileProxy=new Proxy({...valid},{getPrototypeOf(){
  throw new Error("untrusted spatial proxy inspected");
 }});
 accepted=true;
 assert.doesNotThrow(()=>{accepted=index.upsert("stable",hostileProxy);},
  "hostile spatial proxies must be rejected instead of inspected unsafely");
 assert.equal(accepted,false,"hostile proxy replacement must be refused");
 assert.deepEqual(index.query({frameId:"room-A",x:0,y:0,radius:5}).map(row=>row.id),["stable"],
  "proxy rejection must preserve the last validated spatial point");
}

console.log("MEMORYOS2_SPATIAL_RETRIEVAL=PASS");
