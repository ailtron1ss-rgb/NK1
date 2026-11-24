import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { ExternalObserverFabric } from '../src/organism/system/ExternalObserverFabric.ts';

const dir=await mkdtemp(path.join(tmpdir(),'nk-p64-adapters-'));
try {
  const file=path.join(dir,'probe.txt');
  const payload='neuro-kurisu-observer-probe';
  await writeFile(file,payload,'utf8');
  const observer=new ExternalObserverFabric();
  const fsObs=await observer.observeFilesystem({path:file,sourceId:'os-smoke',claimKey:'probe'});
  assert.equal(fsObs.channel,'filesystem');
  assert.match(String(fsObs.observedPostcondition),/type=file/);
  assert.match(String(fsObs.observedPostcondition),new RegExp('size='+payload.length));

  const pidObs=await observer.observeProcess({pid:process.pid,sourceId:'proc-smoke',claimKey:'self'});
  assert.equal(pidObs.channel,'process');
  assert.match(String(pidObs.observedPostcondition),/alive=true/);

  const assessment=observer.assess(fsObs.id,'path='+file+';type=file;size='+payload.length);
  assert.equal(assessment.verified,true);
  assert.ok(assessment.confidence01 >= .72);
  assert.equal(observer.summary().observations,2);
  assert.equal(observer.summary().verifiedCount,1);
  console.log('BIG_PASS_64_EXTERNAL_OBSERVER_ADAPTERS=PASS filesystem=1 process=1 verified=1');
} finally { await rm(dir,{recursive:true,force:true}); }
