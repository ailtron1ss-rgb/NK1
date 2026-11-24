import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';

const dir=await mkdtemp(path.join(os.tmpdir(),'nk-p8-'));
const runtime=new OrganismRuntime({stateFile:path.join(dir,'state.json'),worldStateFile:path.join(dir,'world.json')});
try{
 await runtime.init();
 for(let i=0;i<30;i++) await runtime.step(i%4===0?`Научная проверка ${i}`:undefined);
 const s=runtime.core.snapshot();
 const c=s.facets.cognition;
 if(s.schemaVersion!==RELEASE_CONTRACT.stateSchema) throw new Error('schema');
 if(c.cognitiveField.salience01<=0) throw new Error('cognitive-field-not-updated');
 if(c.budget.updatedAt<=0) throw new Error('budget-not-updated');
 if(c.immune.validatedCount<=0) throw new Error('immune-not-updated');
 if(c.sources.traces.length===0) throw new Error('source-monitor-empty');
 if(c.skills.skills.length===0) throw new Error('skills-empty');
 if(c.scientific.projects.length===0) throw new Error('scientific-method-empty');
 if(c.residualWorld.totalSamples<=0) throw new Error('residual-world-empty');
 if(!s.facets.evolution.network.lastBroadcast) throw new Error('network-broadcast-missing');
 console.log(`P8_GENESIS=PASS tick=${s.state.tick} pressures=${c.cognitiveField.pressures.length} skills=${c.skills.skills.length} science=${c.scientific.projects.length} residualSamples=${c.residualWorld.totalSamples}`);
}finally{runtime.stop();await rm(dir,{recursive:true,force:true});}
