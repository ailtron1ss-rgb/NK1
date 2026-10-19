import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const dir=await mkdtemp(path.join(tmpdir(),'nk-p67-'));
try {
  const core=new OrganismCore(new FileStateStore(path.join(dir,'state.json')),{enableLanguage:false});
  await core.init();
  const before=core.autobiographicalContinuitySummary();
  assert.equal(before.revision,0);
  const predictionId=core.recordPrediction({tick:core.snapshot().state.tick,kind:'world',action:'verify',predicted01:.82,confidence01:.81,context:{probe:'p67'}});
  await core.ingestExternalObservation({sourceId:'observer-a',sourceClass:'device',channel:'sensor',independenceKey:'device:primary',claimKey:'p67:state',observedPostcondition:'state=stable',facts:['state=stable'],confidence01:.95,predictionId,tool:'probe',expectedPostcondition:'state=stable',worldContextAfter:{tick:core.snapshot().state.tick,location:'room',energy:.8,attention:.7,uncertainty:.1,facts:['state=stable'],objects:[],events:[]}});
  const after=core.autobiographicalContinuitySummary();
  assert.ok(after.revision>0);
  assert.ok(after.momentCount>0);
  const moment=core.autobiographicalContinuityRecent(4)[0];
  assert.ok(moment.realityHash);
  assert.ok(core.autobiographicalContinuityRecent(8).some(m=>m.predictionIds.includes(predictionId)));
  assert.ok(moment.continuity01>=0 && moment.continuity01<=1);
  await core.flush();
  const restored=new OrganismCore(new FileStateStore(path.join(dir,'state.json')),{enableLanguage:false});
  await restored.init();
  const rs=restored.autobiographicalContinuitySummary();
  assert.ok(rs.revision>=after.revision);
  assert.equal(rs.lastRealityHash,after.lastRealityHash);
  assert.ok(restored.autobiographicalContinuityRecent(4).some(m=>m.predictionIds.includes(predictionId)));
  console.log(`BIG_PASS_67_AUTOBIOGRAPHICAL_CONTINUITY=PASS revision=${rs.revision} moments=${rs.momentCount} integrity=${rs.autobiographicalIntegrity01.toFixed(3)}`);
} finally { await rm(dir,{recursive:true,force:true}); }
