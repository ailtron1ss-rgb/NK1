import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const cfg={performanceProfile:'mobile',cycleResultMode:'operational',checkpointMaxDirtyCycles:64,checkpointMinIntervalMs:60000};
const store=new MemoryStateStore();
const core=new OrganismCore(store,cfg);await core.init();
const snapshot=(label,i)=>{
  if(global.gc) global.gc();
  const m=process.memoryUsage();
  const counts={};
  const inspect=(obj,path='core',depth=0)=>{
    if(!obj || typeof obj!=='object' || depth>3 || counts.__seen>2000)return;
    counts.__seen=(counts.__seen||0)+1;
    for(const k of Object.keys(obj)){
      if(/cache|buffer|trace|history|event|queue|ledger|log|memory|snapshot|workspace|telemetry|replay/i.test(k)){
        const v=obj[k];
        if(Array.isArray(v)) counts[path+'.'+k]=v.length;
        else if(v instanceof Map||v instanceof Set) counts[path+'.'+k]=v.size;
        else if(v&&typeof v==='object'&&depth<2) inspect(v,path+'.'+k,depth+1);
      }
    }
  };
  inspect(core);
  delete counts.__seen;
  console.log(JSON.stringify({label,cycle:i,rssMB:+(m.rss/1048576).toFixed(1),heapMB:+(m.heapUsed/1048576).toFixed(1),externalMB:+(m.external/1048576).toFixed(1),arrayBuffersMB:+(m.arrayBuffers/1048576).toFixed(1),counts}));
};
const body={bodyEnergy01:.8,cognitiveCapacity01:.82,thermalStrain01:.16,sensoryFreshness01:.88,awake:true,battery01:.78,cpuLoad01:.2,ramPressure01:.22};
snapshot('start',0);
for(let i=0;i<256;i++){
  const t=performance.now();
  await core.observe({text:i%32===0?`profile checkpoint ${i}`:undefined,reward:i%17===0?.65:undefined,surprise:i%13===0?.24:.04,novelty:.35+(i%7)*.03,embodiment:{...body,bodyEnergy01:.8-(i%19)*.006,battery01:.78}},'operational');
  if((i+1)%16===0) snapshot('checkpoint',i+1);
  if(performance.now()-t>1000) console.error('SLOW',i+1,(performance.now()-t).toFixed(1));
}
snapshot('end',256);
