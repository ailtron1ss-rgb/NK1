import { performance } from 'node:perf_hooks';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const rt=new OrganismRuntime({stateFile:'/tmp/nk58-profile.json',stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),intervalMs:30000,enableLanguage:false,autoRun:false});
await rt.init();
for(let i=0;i<20;i++){const t=performance.now(); await rt.step(i%5===0?'проверь ситуацию':undefined,{deliberate:false}); console.log(i+1,(performance.now()-t).toFixed(2), 'tick', rt.core.snapshot().state.tick)}
