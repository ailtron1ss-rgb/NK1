import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const dir=await mkdtemp(join(tmpdir(),'neuro-kurisu-b1701-integration-'));
const file=join(dir,'state.json');
try{
  const make=()=>new OrganismCore(new FileStateStore(file),{enableLanguage:false,performanceProfile:'mobile',checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1});
  const a=make();
  await a.init();
  const before=a.b1701B2200Diagnostics();
  assert.equal(a.verifyB1701B2200().verified,true);
  for(let i=0;i<18;i++){ await a.observe({text:i%3?'continue current development':'new situation requires reconsideration',novelty:i%4===0?.70:.16,uncertainty:i%5===0?.71:.20,reward:i%4===0?.16:.86,success:i%4===0?.20:.88,surprise:i%3===0?.67:.11},'full'); await a.feedback({reward:i%4===0?.16:.86,success:i%4===0?.20:.88,surprise:i%3===0?.67:.11}); }
  await a.flush();
  const snapA=a.b1701B2200Snapshot();
  assert.ok(snapA.headSeq>0);
  const raw=JSON.parse(await readFile(file,'utf8'));
  assert.ok(raw.system.b1701B2200UnifiedLifeContinuity);
  assert.equal(raw.system.b1701B2200UnifiedLifeContinuity.headSeq,snapA.headSeq);

  const b=make();
  await b.init();
  const resume=b.b1701B2200Diagnostics();
  assert.equal(b.verifyB1701B2200().verified,true);
  for(let i=0;i<10;i++){ await b.observe({text:i%2?'resume the existing internal project':'evaluate a changed situation',novelty:i%3===0?.62:.18,uncertainty:i%4===0?.64:.20,reward:i%3===0?.18:.84,success:i%3===0?.22:.86,surprise:i%2===0?.61:.12},'full'); await b.feedback({reward:i%3===0?.18:.84,success:i%3===0?.22:.86,surprise:i%2===0?.61:.12}); }
  await b.flush();
  const after=b.b1701B2200Diagnostics();
  assert.equal(b.verifyB1701B2200().verified,true);
  assert.ok(after.headSeq>snapA.headSeq);
  const snapB=b.b1701B2200Snapshot();
  assert.equal(snapB.stats.rejectedReceipts,0);
  assert.equal(snapB.sessionEpoch,snapA.sessionEpoch+1);
  console.log('B1701_B2200_ORGANISM_PASS');
  console.log(JSON.stringify({beforeHead:snapA.headSeq,afterHead:after.headSeq,sessions:snapB.sessionEpoch,resumes:snapB.stats.resumes,verified:b.verifyB1701B2200().verified,behavior:after.behaviorContinuity01,identity:after.identityContinuity01,neural:after.neuralCausal01}));
}finally{await rm(dir,{recursive:true,force:true});}
