import { performance } from 'node:perf_hooks';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const store=new MemoryStateStore();
const rt=new OrganismRuntime({stateFile:'/tmp/kurisu-pass58-100.json',stateStore:store,worldStateStore:new MemoryStateStore(),intervalMs:30000,enableLanguage:false,autoRun:false});
await rt.init(); const times=[];
for(let i=0;i<100;i++){const t=performance.now(); await rt.step(i%29===0?'проверь ситуацию':undefined,{deliberate:false}); times.push(performance.now()-t)}
const first=times.slice(0,20).reduce((a,b)=>a+b,0)/20; const last=times.slice(-20).reduce((a,b)=>a+b,0)/20; const snap=rt.core.snapshot();
console.log('BIG_PASS_58_CORE_100=PASS',JSON.stringify({tick:snap.state.tick,firstMs:first,lastMs:last,ratio:last/Math.max(first,.001),traces:snap.traces.length,events:snap.facets.memory.eventLog.length,goals:snap.goals.length}));
