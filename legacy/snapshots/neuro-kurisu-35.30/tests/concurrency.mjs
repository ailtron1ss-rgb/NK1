import os from 'node:os'; import path from 'node:path'; import {mkdtemp,rm} from 'node:fs/promises';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
const d=await mkdtemp(path.join(os.tmpdir(),'nk-conc-')); const r=new OrganismRuntime({stateFile:path.join(d,'s.json'),worldStateFile:path.join(d,'w.json')});
try{await r.init(); const out=await Promise.all(Array.from({length:12},(_,i)=>r.step(`msg ${i}`))); if(new Set(out.map(x=>x.cycle.state.tick)).size!==12) throw new Error('duplicate-or-racy-ticks'); if(r.core.snapshot().state.tick!==12) throw new Error('queue-count'); console.log('CONCURRENCY=PASS');}finally{r.stop();await rm(d,{recursive:true,force:true});}
