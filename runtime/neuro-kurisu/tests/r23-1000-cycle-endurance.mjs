import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{enableLanguage:false,enableSelfProjects:false,enableSemanticMemory:true,performanceProfile:'mobile',cycleResultMode:'operational',checkpointMinIntervalMs:600000,checkpointMaxDirtyCycles:1024,operationalPulseEvery:8,includeAdvancedCycleSnapshot:false});
await core.init();
const times=[];
for(let i=0;i<1000;i++){
  const t=performance.now();
  await core.observeOperational({text:i%50===0?'remember continuity audit trace':''});
  times.push(performance.now()-t);
}
const snap=core.snapshot();
assert.ok(snap.state.tick>=1000,'organism should advance through 1000 operational cycles');
assert.ok(times.every(Number.isFinite));
const warm=times.slice(100,200).reduce((a,b)=>a+b,0)/100;
const tail=times.slice(-100).reduce((a,b)=>a+b,0)/100;
const ratio=tail/Math.max(.001,warm);
assert.ok(ratio<3.5,'1000-cycle slowdown must remain bounded');
console.log(JSON.stringify({pass:true,cycles:1000,tick:snap.state.tick,warmMeanMs:warm,tailMeanMs:tail,slowdownRatio:ratio,deviceCertified:false,operationEvidence:snap.system.operationSemanticEvidence?.length??0}));
