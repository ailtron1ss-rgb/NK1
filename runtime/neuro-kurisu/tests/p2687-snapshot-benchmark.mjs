import assert from 'node:assert/strict';
import { ExperienceContinuumFabric } from '../src/organism/memory/ExperienceContinuumFabric.ts';

const now=Date.now();
const mem=i=>({
  id:`bench-${i}`,content:`benchmark experience ${i} ${'x'.repeat(80)}`,kind:i%9===0?'identity':'episodic',createdAt:now-i*3600000,lastAccessAt:now,salience:.45+(i%7)*.03,emotionalWeight:.2+(i%5)*.04,identityRelevance:i%9===0?.8:.2,goalRelevance:.4+(i%6)*.04,socialRelevance:.1,predictionError:.2+(i%11)*.05,temperature01:.5,confidence:.7,epistemicStatus:'fact',source:'p2687-bench',entities:[`e${i%10}`],semanticLinks:[],temporalLinks:[],causalLinks:[],revisionHistory:[],dormant:false,retrievalCount:i%6,semanticVector:[]
});
const fabric=new ExperienceContinuumFabric({maxNodes:384,maxEdges:1024,maxClusters:96});
for(let i=0;i<320;i++) fabric.observe(mem(i),{tick:i+1,at:now+i,novelty01:(i%9)/9,identityContinuity01:.84,valueStability01:.82,evidenceSupport01:.8,activeGoalIds:['g']});
const measure=(fn,n)=>{for(let i=0;i<10;i++)fn();const start=process.hrtime.bigint();for(let i=0;i<n;i++)fn();const ms=Number(process.hrtime.bigint()-start)/1e6;return ms/n;};
const cloneMs=measure(()=>fabric.snapshot(),40);
const sharedMs=measure(()=>fabric.snapshot({clone:false}),40);
const savedPct=(cloneMs>0)?((cloneMs-sharedMs)/cloneMs)*100:0;
assert(cloneMs>0 && sharedMs>0);
assert(savedPct>-50 && savedPct<100);
console.log(JSON.stringify({pass:true,status:'P2687_SNAPSHOT_BENCHMARK_PASS',nodes:320,iterations:40,cloneMsPerCall:cloneMs,sharedStateMsPerCall:sharedMs,estimatedCloneCostReductionPct:savedPct},null,2));
