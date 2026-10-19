import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const dir=await mkdtemp(join(tmpdir(),'neuro-kurisu-continuity-'));
const file=join(dir,'state.json');
try{
 const a=new OrganismCore(new FileStateStore(file),{enableLanguage:false,performanceProfile:'mobile',checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1});
 await a.init();
 const first=a.persistentContinuityDiagnostics();
 assert.equal(first.verified,true);
 for(let i=0;i<12;i++) await a.autonomousHeartbeat();
 await a.flush();
 const before=a.persistentContinuitySnapshot();
 assert.ok(before.headSeq>=2);
 const raw=JSON.parse(await readFile(file,'utf8'));
 assert.equal(raw.system.persistentContinuityKernel.headSeq,before.headSeq);
 const b=new OrganismCore(new FileStateStore(file),{enableLanguage:false,performanceProfile:'mobile',checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1});
 await b.init();
 const afterResume=b.persistentContinuityDiagnostics();
 assert.equal(afterResume.verified,true);
 assert.ok(afterResume.commits>=before.commits);
 assert.equal(afterResume.sessionCount,before.sessionCount+1);
 await b.autonomousHeartbeat();
 await b.flush();
 const after=b.persistentContinuityDiagnostics();
 assert.equal(after.verified,true);
 assert.ok(after.headSeq>before.headSeq);
 assert.equal(after.brokenLinks,0);
 console.log('PERSISTENT_CONTINUITY_ORGANISM_PASS');
 console.log(JSON.stringify({beforeHead:before.headSeq,afterHead:after.headSeq,sessions:after.sessionCount,resumes:after.resumes,verified:after.verified,restartContinuity01:after.restartContinuity01,continuity01:after.continuity01}));
}finally{await rm(dir,{recursive:true,force:true});}
