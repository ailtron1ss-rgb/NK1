import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{cycleResultMode:'operational',checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:64});
await core.init();
const targets=[
 ['memoryOS.retrieve','memoryOS','retrieve'],
 ['multiTimescale.retrieve','memories','retrieve'],
 ['semanticMemory.retrieve','semanticMemory','retrieve'],
 ['unifiedMemory.snapshot','unifiedMemory','snapshot'],
 ['worldModel2.snapshot','worldModel2','snapshot'],
 ['p70.snapshot','p70MemoryLifecycleGovernor','snapshot'],
 ['advancedProjectionScheduler.snapshot','advancedProjectionScheduler','snapshot'],
];
const totals=Object.fromEntries(targets.map(([k])=>[k,{ms:0,calls:0}]));
const originals=[];
for(const [label,objName,method] of targets){const obj=core[objName];if(!obj||typeof obj[method]!=='function')continue;const orig=obj[method].bind(obj);originals.push(()=>obj[method]=orig);obj[method]=(...args)=>{const t=performance.now();try{return orig(...args);}finally{const d=performance.now()-t;totals[label].ms+=d;totals[label].calls++;}};}
for(let i=0;i<120;i++) await core.observeOperational({text:i%17===0?`profile ${i}`:undefined,reward:i%23===0?.7:undefined,embodiment:{bodyEnergy01:.8,thermalStrain01:.18,cognitiveCapacity01:.82,sensoryFreshness01:.86,awake:true,battery01:.8,cpuLoad01:.22,ramPressure01:.2}});
for(const restore of originals)restore();
console.log('HORIZON_PROFILE=PASS cycles=120');
for(const [k,v] of Object.entries(totals).sort((a,b)=>b[1].ms-a[1].ms)) console.log(`${k} totalMs=${v.ms.toFixed(2)} calls=${v.calls} avgMs=${(v.ms/Math.max(1,v.calls)).toFixed(3)}`);
