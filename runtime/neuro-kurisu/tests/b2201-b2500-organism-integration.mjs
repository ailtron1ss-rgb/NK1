import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
const dir=await mkdtemp(join(tmpdir(),'neuro-kurisu-b2201-'));
const file=join(dir,'state.json');
try{
 const make=()=>new OrganismCore(new FileStateStore(file),{enableLanguage:false,performanceProfile:'mobile',checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1});
 const a=make();await a.init();assert.equal(a.verifyB2201B2500().verified,true);
 for(let i=0;i<4;i++){await a.observe({text:'continue the existing long-term Kurisu project and preserve unfinished intention',novelty:i%6===0?.55:.16,uncertainty:i%5===0?.48:.18,reward:i%7===0?.22:.88,success:i%7===0?.28:.91,surprise:i%4===0?.52:.10},'full');await a.feedback({reward:i%7===0?.22:.88,success:i%7===0?.28:.91,surprise:i%4===0?.52:.10});}
 await a.flush();
 const s1=a.b2201B2500Snapshot();
 assert.ok(s1.lifeSeq>0);assert.ok(s1.commitments.length>0);
 const raw=JSON.parse(await readFile(file,'utf8'));assert.ok(raw.system.b2201B2500LifeCourseSelfModel);
 const b=make();await b.init();assert.equal(b.verifyB2201B2500().verified,true);
}finally{await rm(dir,{recursive:true,force:true});}
