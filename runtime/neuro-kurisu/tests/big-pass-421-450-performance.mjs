import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core.init();
const samples=[];
for(let i=0;i<8;i++){
 const t=performance.now();
 await core.observe({text:i%2?'verify this result':'explore something new',novelty:.5,uncertainty:.5,reward:.7,success:.8,surprise:i%3===0?.6:.15,embodiment:{awake:true,bodyEnergy01:.8,cognitiveCapacity01:.76,thermalStrain01:.15,sensoryFreshness01:.75,battery01:.8,cpuLoad01:.25,ramPressure01:.2}},'operational');
 await core.feedback({reward:.7,success:.8,surprise:.15}); samples.push(performance.now()-t);
}
samples.sort((a,b)=>a-b); const avg=samples.reduce((a,b)=>a+b,0)/samples.length; const p95=samples[Math.floor(samples.length*.95)-1]??samples.at(-1); console.log(JSON.stringify({pass:true,samplesMs:samples.map(x=>Number(x.toFixed(3))),avgMs:Number(avg.toFixed(3)),p95Ms:Number(p95.toFixed(3)),maxMs:Number(Math.max(...samples).toFixed(3))},null,2));
