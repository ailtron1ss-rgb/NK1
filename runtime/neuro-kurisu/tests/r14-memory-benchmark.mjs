import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const os=new MemoryOS2();
const base={salience:.45,emotionalWeight:.05,identityRelevance:.08,goalRelevance:.22,socialRelevance:.08,predictionError:.18,confidence:.74,epistemicStatus:'belief',source:'r14-bench',entities:[],semanticLinks:[],temporalLinks:[],causalLinks:[]};
for(let i=0;i<1600;i++){
  os.encode({...base,kind:i%11===0?'semantic':'episodic',content:`memory event ${i} project ${i%19} action ${i%7} identifier ARG-${2026+(i%3)}-${String(i).padStart(4,'0')} deployment ${(i%5)}`});
}
assert.equal(os.size(),1600);
const queries=['ARG-2026-0999','project 7 action 3 deployment','memory event 143 recent deployment','identifier ARG-2027-1400','project 12 action 5'];
const timings=[]; let totalResults=0; let maxCandidates=0;
for(let round=0;round<100;round++){
  const q=queries[round%queries.length];
  const t=performance.now();
  const result=os.retrieve(q,8);
  timings.push(performance.now()-t); totalResults+=result.length; maxCandidates=Math.max(maxCandidates,os.retrievalDiagnostics().candidateCount);
}
timings.sort((a,b)=>a-b);
const p50=timings[Math.floor(timings.length*.50)]??0;
const p95=timings[Math.floor(timings.length*.95)]??0;
assert(totalResults>0);
assert(maxCandidates<=192);
console.log(JSON.stringify({pass:true,items:os.size(),queries:timings.length,p50Ms:p50,p95Ms:p95,maxCandidates,totalResults,hybrid:os.retrievalDiagnostics()}));
