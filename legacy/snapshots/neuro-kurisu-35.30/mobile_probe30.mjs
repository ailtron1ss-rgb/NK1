import { OrganismRuntime } from './src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from './src/organism/persistence/MemoryStateStore.ts';
import { NoopOperationalJournal } from './src/organism/persistence/NoopOperationalJournal.ts';
const r=new OrganismRuntime({stateFile:'/tmp/mobile-probe.json',worldStateFile:'/tmp/mobile-probe.world.json',enableLanguage:false,stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new NoopOperationalJournal(),performanceProfile:'mobile',cycleResultMode:'summary'});
await r.init();
for(let i=0;i<30;i++){const s=Date.now();await r.autonomousStep(); console.log(JSON.stringify({i:i+1,ms:Date.now()-s,rss:process.memoryUsage().rss,heap:process.memoryUsage().heapUsed,tick:r.core.snapshot().state.tick}));}
console.log('DONE'); r.stop();
