import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const cycles=1000;
const core=new OrganismCore(new MemoryStateStore(),{enableLanguage:false,enableSelfProjects:false,enableSemanticMemory:true,performanceProfile:'mobile',cycleResultMode:'operational',checkpointMinIntervalMs:600000,checkpointMaxDirtyCycles:4096,operationalPulseEvery:16,includeAdvancedCycleSnapshot:false});
await core.init();
const times=[];
for(let i=0;i<cycles;i++){
  const t=performance.now();
  await core.observeOperational({text:i%75===0?`R25 endurance ${i} continuity`:''});
  times.push(performance.now()-t);
}
const snap=core.snapshot();
const warm=times.slice(200,500).reduce((a,b)=>a+b,0)/300;
const tail=times.slice(-300).reduce((a,b)=>a+b,0)/300;
const sorted=[...times].sort((a,b)=>a-b);
const p95=sorted[Math.floor(sorted.length*.95)];
const ratio=tail/Math.max(.001,warm);
assert.ok(snap.state.tick>=cycles);
assert.ok(times.every(Number.isFinite));
assert.ok(ratio<4.5,`slowdown ${ratio.toFixed(3)}x exceeded endurance bound`);
assert.ok(Number.isFinite(p95));
assert.ok((snap.system.operationSemanticEvidence?.length??0)>0);
console.log(JSON.stringify({pass:true,cycles,tick:snap.state.tick,warmMeanMs:warm,tailMeanMs:tail,slowdownRatio:ratio,p95Ms:p95,operationEvidence:snap.system.operationSemanticEvidence?.length??0,deviceCertified:false}));
