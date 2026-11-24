import { OrganismRuntime } from './src/organism/core/OrganismRuntime.ts';
const path='/tmp/profile-state.json';
const r=new OrganismRuntime({id:'profile',stateFile:path,enableLanguage:false,autoRun:false});
await r.init();
const report=(tag)=>{const m=process.memoryUsage();const s=r.core.snapshot();const sizes={}; for(const [k,v] of Object.entries(s.facets?.advanced??{})){try{sizes[`advanced.${k}`]=Buffer.byteLength(JSON.stringify(v));}catch{}} for(const [k,v] of Object.entries(s.facets?.memory??{})){try{sizes[`memory.${k}`]=Buffer.byteLength(JSON.stringify(v));}catch{}} console.log(tag,JSON.stringify({rss:m.rss,heapUsed:m.heapUsed,external:m.external,arrayBuffers:m.arrayBuffers,sizes:Object.fromEntries(Object.entries(sizes).sort((a,b)=>b[1]-a[1]).slice(0,25)),advancedMemoryOSItems:s.facets?.advanced?.memoryOS?.items?.length??0,eventLog:s.facets?.memory?.eventLog?.length??0,memories:s.memories?.length??0}));};
report('init');
for(let i=0;i<30;i++) { await r.autonomousStep(); if(i===9||i===29) report(`cycle-${i+1}`); }
await r.stop();
if(global.gc) global.gc();
report('stopped-gc');
