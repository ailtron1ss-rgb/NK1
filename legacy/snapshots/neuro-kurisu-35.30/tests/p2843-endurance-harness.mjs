import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { NoopOperationalJournal } from '../src/organism/persistence/NoopOperationalJournal.ts';
const seconds=Math.max(5,Number(process.env.P2843_SOAK_SECONDS??30));
const dir=await mkdtemp(path.join(tmpdir(),'nk-p2843-soak-'));
const started=Date.now(); let cycles=0;
try{
 const r=new OrganismRuntime({stateFile:path.join(dir,'state.json'),worldStateFile:path.join(dir,'world.json'),enableLanguage:false,stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new NoopOperationalJournal(),performanceProfile:'mobile',cycleResultMode:'summary'});
 await r.init();
 while(Date.now()-started<seconds*1000){await r.autonomousStep();cycles++;}
 const neural=r.core.b296NeuralPersonalityAgencyDiagnostics();
 const memory=r.core.p2843NeuralMemoryDiagnostics();
 if(cycles<5||neural.cycles<5||memory.encodings<1) throw new Error('P2843 endurance made insufficient progress');
 console.log(JSON.stringify({ok:true,seconds,cycles,neural,memory,elapsedMs:Date.now()-started}));
 await r.stop();
}finally{await rm(dir,{recursive:true,force:true});}
