import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const cycles=Math.max(8,Math.min(96,Number(process.env.B305_CYCLES??48)));
const store=new MemoryStateStore();
const core=new OrganismCore(store,{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:true,operationalPulseEvery:4,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await core.init();
const timings=[];let full=0,micro=0;
for(let i=0;i<cycles;i++){
  const pressure=i>Math.floor(cycles*.65);
  const t=performance.now();
  const result=await core.observeOperational({
    text:i%8===0?'Termux benchmark: verify an uncertain consequence and continue autonomously.':undefined,
    novelty:i%9===0?.72:.28,surprise:i%13===0?.62:.10,
    embodiment:{bodyEnergy01:pressure?.62:.86,cognitiveCapacity01:pressure?.70:.86,thermalStrain01:pressure?.76:.18,battery01:pressure?.34:.84,cpuLoad01:pressure?.78:.20,ramPressure01:pressure?.82:.18,sensoryFreshness01:.84,awake:true}
  });
  timings.push(performance.now()-t);
  if(result.workspace.content.temporalResolution==='micro')micro++;else full++;
}
const snapshot=core.snapshot();
const sorted=[...timings].sort((a,b)=>a-b);
const mem=process.memoryUsage();
let android={platform:process.platform,arch:process.arch,node:process.version};
if(process.platform==='android')android={...android,termux:true};
console.log(JSON.stringify({pass:true,androidOrHost:android,cycles,full,micro,meanMs:timings.reduce((a,b)=>a+b,0)/Math.max(1,timings.length),p95Ms:sorted[Math.floor(sorted.length*.95)],rssBytes:mem.rss,heapUsedBytes:mem.heapUsed,externalBytes:mem.external,payloadBytes:JSON.stringify(snapshot).length,temporal:core.temporalResolutionSnapshot(),resource:core.resourceAllocationSnapshot(),criticalPath:core.b305CriticalPathDiagnostics()},null,2));
process.exit(0);
