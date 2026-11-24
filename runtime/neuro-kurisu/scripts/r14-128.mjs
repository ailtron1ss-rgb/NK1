import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational',checkpointMaxDirtyCycles:64,checkpointMinIntervalMs:60000}); await core.init();
for(let i=0;i<128;i++){const t=performance.now(); await core.observe({text:i%32===0?`x ${i}`:undefined,reward:i%17===0?.65:undefined,surprise:i%13===0?.24:.04,novelty:.35+(i%7)*.03,embodiment:{bodyEnergy01:.8-(i%19)*.006,cognitiveCapacity01:.82,thermalStrain01:.16,sensoryFreshness01:.88,awake:true,battery01:.78,cpuLoad01:.2,ramPressure01:.22}},'operational'); console.log(i+1,(performance.now()-t).toFixed(1));}
await core.flush();
