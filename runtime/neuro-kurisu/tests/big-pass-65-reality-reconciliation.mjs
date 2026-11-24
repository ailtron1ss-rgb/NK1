import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const dir=await mkdtemp(path.join(tmpdir(),'nk-p65-'));
try {
  const core=new OrganismCore(new FileStateStore(path.join(dir,'state.json')),{enableLanguage:false});
  await core.init();
  const predictionId=core.recordPrediction({tick:core.snapshot().state.tick,kind:'world',action:'verify',predicted01:.9,confidence01:.86,context:{probe:'p65'}});
  const result=await core.ingestExternalObservation({sourceId:'sensor-a',sourceClass:'device',channel:'sensor',independenceKey:'sensor:primary',claimKey:'probe:state',observedPostcondition:'state=ok',confidence01:.98,predictionId,actionRef:'missing-action',tool:'probe',expectedPostcondition:'state=ok'});
  assert.equal(result.assessment?.verified,true);
  assert.ok(result.reconciliation);
  assert.equal(result.predictionResolution?.actual01,1);
  assert.equal(core.predictionLedgerSnapshot().pending.some(p=>p.id===predictionId),false);
  assert.equal(core.predictionDebtSnapshot().records.find(r=>r.predictionId===predictionId)?.status,'resolved');
  await core.flush();
  const restored=new OrganismCore(new FileStateStore(path.join(dir,'state.json')),{enableLanguage:false});
  await restored.init();
  assert.equal(restored.predictionLedgerSnapshot().resolved.some(p=>p.id===predictionId),true);
  assert.equal(restored.externalObserverSummary().corroboratedClaims,0);
  console.log('BIG_PASS_65_REALITY_RECONCILIATION=PASS predictionResolved=1 debt=resolved');
} finally { await rm(dir,{recursive:true,force:true}); }
