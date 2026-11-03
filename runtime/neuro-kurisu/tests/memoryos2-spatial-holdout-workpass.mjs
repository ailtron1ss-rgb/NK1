import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const CENTER={frameId:'holdout-lab',x:0,y:0,z:0,radius:8};
const QUERY='locate nearby target beacon';
const SEEDS=[3,17,41,73,109];
const TOP_K=10;
// A synthetic coordinate-frame holdout; never interprets metric coordinates as pixels or global positions.

function rng(seed){
 let state=seed>>>0;
 return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/0x1_0000_0000;};
}
function shuffle(rows,random){
 const out=[...rows];
 for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
 return out;
}
function memory(id,context={}){
 return {
  id,
  content:'sensor observation parcel code '+id,
  kind:'episodic',
  source:'spatial-holdout-fixture',
  tags:[],
  context,
  salience:.55,
  emotionalWeight:.08,
  identityRelevance:.1,
  goalRelevance:.1,
  socialRelevance:.05,
  predictionError:.12,
  confidence:.92,
  epistemicStatus:'belief',
  entities:[],
  semanticLinks:[],
  temporalLinks:[],
  causalLinks:[],
  contradictionLinks:[],
  validFromAt:Date.now()-1000,
  observedAt:Date.now()-500,
  provenanceClass:'device',
  sourceAuthority01:.95,
 };
}
function point(frameId,x,y,z=0){
 return {spatialFrameId:frameId,spatialX:String(x),spatialY:String(y),spatialZ:String(z)};
}
function dataset(seed){
 const random=rng(seed),rows=[];
 for(let i=0;i<16;i++){
  // Seed-specific geometry; the maximum 3D distance stays below radius 8.
  const x=(random()-.5)*6,y=(random()-.5)*6,z=(random()-.5)*2;
  const id='near-'+String(i).padStart(2,'0');
  rows.push({id,relevant:true,context:point('holdout-lab',x,y,z)});
 }
 for(let i=0;i<24;i++){
  // Same-frame negatives stay well outside radius for every seed.
  const x=40+random()*30,y=20+random()*40,z=(random()-.5)*2;
  const id='far-'+String(i).padStart(2,'0');
  rows.push({id,relevant:false,context:point('holdout-lab',x,y,z)});
 }
 for(let i=0;i<24;i++){
  // Numerically nearby negatives remain in a different coordinate frame.
  const x=(random()-.5)*6,y=(random()-.5)*6,z=(random()-.5)*2;
  const id='wrong-frame-'+String(i).padStart(2,'0');
  rows.push({id,relevant:false,context:point('other-lab',x,y,z)});
 }
 for(let i=0;i<16;i++){
  const id='unlocated-'+String(i).padStart(2,'0');
  rows.push({id,relevant:false,context:{}});
 }
 return shuffle(rows,random);
}
function recallAtK(ids,rows,k){
 const expected=new Set(rows.filter(row=>row.relevant).map(row=>row.id));
 const relevant=ids.slice(0,k).filter(id=>expected.has(id)).length;
 return {hits:relevant,recall:relevant/Math.min(k,expected.size)};
}

const results=[];
const seedGeometrySignatures=new Set();
for(const seed of SEEDS){
 const rows=dataset(seed),memoryOS=new MemoryOS2({embeddingProvider:null});
 seedGeometrySignatures.add(rows.filter(row=>row.relevant)
  .map(row=>[row.context.spatialX,row.context.spatialY,row.context.spatialZ??"0"].join(","))
  .sort().join("|"));
 for(const row of rows)memoryOS.encode(memory(row.id,row.context));
 const baseline=memoryOS.previewRetrieveWithDiagnostics(QUERY,TOP_K);
 const baselineMetrics=recallAtK(baseline.items.map(row=>row.id),rows,TOP_K);
 const spatial=memoryOS.previewRetrieveWithDiagnostics(QUERY,TOP_K,0,0,{spatial:CENTER});
 const spatialIds=spatial.items.map(row=>row.id);
 const spatialMetrics=recallAtK(spatialIds,rows,TOP_K);
 const crossFrameFalsePositives=spatialIds.filter(id=>id.startsWith('wrong-frame-')).length;
 const farFalsePositives=spatialIds.filter(id=>id.startsWith('far-')||id.startsWith('unlocated-')).length;
 assert.equal(baselineMetrics.recall,0,'text-only baseline must not infer a physical location from lexical absence');
 assert.equal(spatial.diagnostics.spatialInvalidQuery,false);
 assert.equal(spatial.diagnostics.spatialFrameId,'holdout-lab');
 assert.equal(crossFrameFalsePositives,0,'spatial retrieval must never cross coordinate frames');
 assert.equal(farFalsePositives,0,'objects outside radius or without coordinates must not enter spatial results');
 assert.equal(spatialMetrics.hits,TOP_K,'nearest ten should all be labelled relevant');
 assert.equal(memoryOS.indexDiagnostics().spatialIndex.pass,true);
 results.push({seed,baselineRecallAt10:baselineMetrics.recall,spatialRecallAt10:spatialMetrics.recall,
  delta:spatialMetrics.recall-baselineMetrics.recall,crossFrameFalsePositives,farFalsePositives,
  returned:spatialIds.length,abstainedBaseline:baseline.diagnostics.abstained});
}
const mean=(field)=>results.reduce((sum,row)=>sum+row[field],0)/results.length;
const meanBaseline=mean('baselineRecallAt10'),meanSpatial=mean('spatialRecallAt10'),meanDelta=mean('delta');
assert.ok(meanDelta>0,'five-seed spatial recall delta must be positive');
assert.ok(results.every(row=>row.delta>0),'every holdout seed must improve spatial recall');
assert.ok(results.every(row=>row.crossFrameFalsePositives===0&&row.farFalsePositives===0));
assert.equal(seedGeometrySignatures.size,SEEDS.length,
 'each seed must evaluate a distinct spatial point configuration');
console.log('MEMORYOS2_SPATIAL_HOLDOUT=PASS '+JSON.stringify({
 seedCount:SEEDS.length,topK:TOP_K,meanBaselineRecallAt10:Number(meanBaseline.toFixed(3)),
 meanSpatialRecallAt10:Number(meanSpatial.toFixed(3)),meanRecallDelta:Number(meanDelta.toFixed(3)),
 distinctSeedGeometries:seedGeometrySignatures.size,results,
}));
