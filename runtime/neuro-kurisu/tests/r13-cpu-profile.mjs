import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational',checkpointMaxDirtyCycles:64,checkpointMinIntervalMs:60000});
await core.init();
const body={bodyEnergy01:.8,cognitiveCapacity01:.82,thermalStrain01:.16,sensoryFreshness01:.88,awake:true,battery01:.78,cpuLoad01:.2,ramPressure01:.22};
const times=[];
for(let i=0;i<96;i++){const t=performance.now();await core.observe({text:i%32===0?`cpu ${i}`:undefined,reward:i%17===0?.65:undefined,surprise:i%13===0?.24:.04,novelty:.35+(i%7)*.03,embodiment:{...body,bodyEnergy01:.8-(i%19)*.006}},'operational');times.push(performance.now()-t);if((i+1)%16===0) console.log(JSON.stringify({cycle:i+1,avg16:+(times.slice(-16).reduce((a,b)=>a+b,0)/16).toFixed(1),max16:+Math.max(...times.slice(-16)).toFixed(1),rss:+(process.memoryUsage().rss/1048576).toFixed(1)}));}
