import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
const dir=await mkdtemp(path.join(tmpdir(),'nk-restart-')); const sf=path.join(dir,'s.json'), wf=path.join(dir,'w.json');
try {
 const a=new OrganismRuntime({stateFile:sf,worldStateFile:wf,enableLanguage:false}); await a.init();
 for(let i=0;i<20;i++) await a.step();
 const before=a.core.snapshot().state.tick;
 const substrateBeforeStop=a.unifiedCognitiveSubstrateSnapshot();
 if(substrateBeforeStop.lastTick<=0) throw new Error('substrate did not integrate a runtime cycle');
 await a.stop();
 const substratePath=sf+'.cognitive-substrate.json';
 const persistedSubstrate=JSON.parse(await readFile(substratePath,'utf8'));
 if(persistedSubstrate.lastTick!==substrateBeforeStop.lastTick) throw new Error('substrate sidecar was not flushed at stop');
 const b=new OrganismRuntime({stateFile:sf,worldStateFile:wf,enableLanguage:false}); await b.init();
 const substrateAfterRestart=b.unifiedCognitiveSubstrateSnapshot();
 if(substrateAfterRestart.lastTick!==persistedSubstrate.lastTick) throw new Error('substrate sidecar did not restore across restart');
 const after=b.core.snapshot().state.tick; if(after!==before) throw new Error(`restart mismatch ${before} -> ${after}`);
 await b.step(); if(b.core.snapshot().state.tick!==before+1) throw new Error('post-restart step failed');
 console.log('CLEAN_RESTART_PERSISTENCE=PASS'); await b.stop();
} finally {await rm(dir,{recursive:true,force:true});}
