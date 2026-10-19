import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
const dir=await mkdtemp(path.join(tmpdir(),'nk-restart-')); const sf=path.join(dir,'s.json'), wf=path.join(dir,'w.json');
try {
 const a=new OrganismRuntime({stateFile:sf,worldStateFile:wf,enableLanguage:false}); await a.init();
 for(let i=0;i<20;i++) await a.step(); const before=a.core.snapshot().state.tick; await a.stop();
 const b=new OrganismRuntime({stateFile:sf,worldStateFile:wf,enableLanguage:false}); await b.init();
 const after=b.core.snapshot().state.tick; if(after!==before) throw new Error(`restart mismatch ${before} -> ${after}`);
 await b.step(); if(b.core.snapshot().state.tick!==before+1) throw new Error('post-restart step failed');
 console.log('CLEAN_RESTART_PERSISTENCE=PASS'); await b.stop();
} finally {await rm(dir,{recursive:true,force:true});}
