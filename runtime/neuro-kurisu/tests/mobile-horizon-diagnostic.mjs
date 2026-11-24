import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational',checkpointMinIntervalMs:60000});
await core.init();
const N=1500; const block=250; const s=[];
for(let i=0;i<N;i++){const t=performance.now();await core.observeOperational({embodiment:{bodyEnergy01:.8,thermalStrain01:.18,cognitiveCapacity01:.82,sensoryFreshness01:.86,awake:true,battery01:.8,cpuLoad01:.22,ramPressure01:.2}});s.push(performance.now()-t);if((i+1)%block===0){const a=s.slice(-block).sort((x,y)=>x-y);const q=a[Math.floor(a.length*.5)]??0;const p95=a[Math.floor(a.length*.95)]??0;const mem=core.snapshotLight().memoryCount;console.log(`block=${i+1} median=${q.toFixed(2)} p95=${p95.toFixed(2)} heap=${(process.memoryUsage().heapUsed/1048576).toFixed(1)} memory=${mem}`);}}
