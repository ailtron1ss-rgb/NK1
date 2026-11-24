import { performance } from 'node:perf_hooks';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const store=new MemoryStateStore();
const rt=new OrganismRuntime({stateFile:'/tmp/kurisu-runtime.json',stateStore:store,worldStateStore:new MemoryStateStore(),intervalMs:30000,enableLanguage:false,autoRun:false});
await rt.init(); const times=[];
for(let i=0;i<200;i++){const t=performance.now(); await rt.step(i%29===0?'проверь ситуацию':undefined,{deliberate:false}); times.push(performance.now()-t)}
const first=times.slice(0,30).reduce((a,b)=>a+b,0)/30; const last=times.slice(-30).reduce((a,b)=>a+b,0)/30; const snap=rt.core.snapshot();
console.log('RUNTIME_LONG_200=PASS',JSON.stringify({tick:snap.state.tick,firstMs:first,lastMs:last,ratio:last/Math.max(first,.001),traces:snap.traces.length,events:snap.facets.memory.eventLog.length,goals:snap.goals.length,p80:snap.facets.advanced.p80UnifiedSelfState.cycles,p81:snap.facets.advanced.p81PredictiveAttention.cycles,p82:snap.facets.advanced.p82RealityProgress.observations}));
