import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const dir=await mkdtemp(path.join(tmpdir(),'nk-p66-'));
try{
  const core=new OrganismCore(new FileStateStore(path.join(dir,'state.json')),{enableLanguage:false});
  await core.init();
  const before=core.persistentRealitySummary();
  assert.equal(before.revision,0);
  const id=core.recordPrediction({tick:core.snapshot().state.tick,kind:'world',action:'verify',predicted01:.9,confidence01:.88,context:{probe:'p66'}});
  const linked=core.persistentRealitySnapshot().beliefs.find(b=>b.predictionIds.includes(id));
  assert.ok(linked,'world prediction linked to persistent reality');
  await core.ingestExternalObservation({sourceId:'device-a',sourceClass:'device',channel:'sensor',independenceKey:'sensor:a',claimKey:'probe:p66',observedPostcondition:'state=ok',facts:['state=ok'],confidence01:.96,predictionId:id,tool:'probe',expectedPostcondition:'state=ok',worldContextAfter:{tick:core.snapshot().state.tick,location:'room',energy:.8,attention:.7,uncertainty:.1,facts:['state=ok'],objects:[],events:[]}});
  const after=core.persistentRealitySummary();
  assert.ok(after.revision>0);
  assert.ok(after.anchoredCount>=1 || after.beliefCount>=1);
  assert.ok(core.persistentRealityContinuity(8).length>=0);
  await core.flush();
  const restored=new OrganismCore(new FileStateStore(path.join(dir,'state.json')),{enableLanguage:false});
  await restored.init();
  const rs=restored.persistentRealitySummary();
  assert.ok(rs.revision>=after.revision);
  assert.equal(restored.snapshot().system.schemaVersion,restored.snapshot().state.version);
  console.log(`BIG_PASS_66_PERSISTENT_REALITY=PASS revision=${rs.revision} beliefs=${rs.beliefCount} anchored=${rs.anchoredCount} breaks=${rs.continuityBreaks}`);
} finally { await rm(dir,{recursive:true,force:true}); }
