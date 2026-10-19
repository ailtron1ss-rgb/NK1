import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const config={performanceProfile:'mobile',cycleResultMode:'summary',enableLanguage:false,checkpointMinIntervalMs:0,spineOnly:false};
const base=new OrganismCore(new MemoryStateStore(),config);
await base.init();
const initial=base.snapshot();
const cold=new OrganismCore(new MemoryStateStore({initial}),config);
const warm=new OrganismCore(new MemoryStateStore({initial}),config);
await cold.init();
await warm.init();
const contextKey=warm.worldCausalCalibrationContextKey();
const action='verify';
for(let i=0;i<12;i++){
  const id=`r18-live-${i}`;
  warm.trackWorldCausalPrediction({predictionId:id,action,predicted01:.75,confidence01:.82,persist:false});
  warm.recordGroundedWorldCausalOutcome({predictionId:id,action,actual01:.82,source:'observation',verified01:.9,independent01:.9,evidence01:.85,matchedContextKey:contextKey});
}
const coldResult=await cold.observe({});
const warmResult=await warm.observe({});
const coldCandidate=coldResult.decision?.candidates?.find((candidate)=>candidate.action===action);
const warmCandidate=warmResult.decision?.candidates?.find((candidate)=>candidate.action===action);
assert.ok(coldCandidate&&warmCandidate);

const warmDiag=warm.worldCausalCalibrationSnapshot().byContext[`${action}|${contextKey}`];
assert.equal(warmDiag?.n,12);
assert.ok((warmDiag?.readiness01??0)>.6);
console.log(JSON.stringify({ok:true,contextKey,samples:warmDiag?.n,readiness01:warmDiag?.readiness01,coldConfidence:coldCandidate.confidence,warmConfidence:warmCandidate.confidence,delta:warmCandidate.confidence-coldCandidate.confidence,selectedCold:coldResult.decision?.selected?.action,selectedWarm:warmResult.decision?.selected?.action}));
