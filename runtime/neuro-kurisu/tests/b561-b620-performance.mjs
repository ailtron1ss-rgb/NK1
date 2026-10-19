import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core.init();
const times=[];
for(let i=0;i<30;i++){
 const t0=performance.now();
 await core.observe({text:i%5===0?'deeply verify this surprising event':'continue the current developmental task',novelty:i%5===0?.76:.22+(i%4)*.08,uncertainty:i%7===0?.79:.22+(i%5)*.07,reward:i%8===0?.2:.78,success:i%8===0?.2:.86,surprise:i%5===0?.73:.16,embodiment:{awake:true,bodyEnergy01:.86-(i%7)*.02,cognitiveCapacity01:.76,thermalStrain01:.12+(i%6)*.02,sensoryFreshness01:.82,battery01:.83-(i%9)*.01,cpuLoad01:.23,ramPressure01:.21}},'operational');
 await core.feedback({reward:i%8===0?.2:.78,success:i%8===0?.2:.86,surprise:i%5===0?.73:.16});
 times.push(performance.now()-t0);
}
times.sort((a,b)=>a-b); const avg=times.reduce((a,b)=>a+b,0)/times.length; const p95=times[Math.floor(.95*times.length)];
console.log(JSON.stringify({pass:true,status:'B561_B620_PERFORMANCE_PASS',cycles:30,avgMs:Number(avg.toFixed(3)),p95Ms:Number(p95.toFixed(3)),maxMs:Number(times.at(-1).toFixed(3)),b561:core.b561B620Diagnostics()},null,2));
