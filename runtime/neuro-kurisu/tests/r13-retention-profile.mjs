import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational',checkpointMaxDirtyCycles:64,checkpointMinIntervalMs:60000});await core.init();
const seen=new WeakSet();
function scan(v,path,depth,out){
 if(!v||typeof v!=='object'||depth>5||seen.has(v)) return; seen.add(v);
 if(Array.isArray(v)){ if(v.length>0) out.push({path,kind:'array',size:v.length}); }
 else if(v instanceof Map||v instanceof Set){ if(v.size>0) out.push({path,kind:v instanceof Map?'map':'set',size:v.size}); }
 for(const k of Reflect.ownKeys(v)){ if(typeof k!=='string') continue; let x; try{x=v[k]}catch{continue};
   if(x&&typeof x==='object') scan(x,path+'.'+k,depth+1,out);
 }
}
const body={bodyEnergy01:.8,cognitiveCapacity01:.82,thermalStrain01:.16,sensoryFreshness01:.88,awake:true,battery01:.78,cpuLoad01:.2,ramPressure01:.22};
for(let i=0;i<128;i++){
 const t=performance.now(); await core.observe({text:i%32===0?`retention ${i}`:undefined,reward:i%17===0?.65:undefined,surprise:i%13===0?.24:.04,novelty:.35+(i%7)*.03,embodiment:{...body,bodyEnergy01:.8-(i%19)*.006}},'operational');
 if((i+1)%32===0){ if(global.gc)global.gc(); const out=[];scan(core,'core',0,out);out.sort((a,b)=>b.size-a.size); const m=process.memoryUsage(); console.log(JSON.stringify({cycle:i+1,rss:+(m.rss/1048576).toFixed(1),heap:+(m.heapUsed/1048576).toFixed(1),top:out.slice(0,80)})); }
 if(performance.now()-t>1000) console.error('slow',i+1,(performance.now()-t).toFixed(1));
}
