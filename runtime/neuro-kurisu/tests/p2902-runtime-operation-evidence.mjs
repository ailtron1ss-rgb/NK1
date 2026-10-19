import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';
const dir=await mkdtemp(path.join(tmpdir(),'nk-r22-op-'));
try{
  const r=new OrganismRuntime({stateFile:path.join(dir,'state.json'),worldStateFile:path.join(dir,'world.json'),enableLanguage:false,stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new BoundedOperationalJournal(),performanceProfile:'mobile',cycleResultMode:'summary'});
  await r.init();
  for(let i=0;i<10;i++) await r.autonomousStep();
  const snap=r.core.snapshot();
  const rows=snap.system.operationSemanticEvidence??[];
  assert.ok(rows.length>=8,'runtime should persist operation-level evidence');
  assert.ok(rows.every(x=>x.stateBeforeHash&&x.inputHash&&x.expectedEffectHash));
  assert.ok(rows.some(x=>x.domain==='memory')); assert.ok(rows.some(x=>x.domain==='learning'));
  assert.ok(rows.some(x=>x.domain==='world'));
  const verified=rows.filter(x=>x.verified).length;
  assert.ok(verified>=rows.length*.75,'most runtime operations should close with verified invariants');
  const out={version:1,generatedAt:new Date().toISOString(),rows:rows.slice(-48),summary:{total:rows.length,verified,verificationRate01:verified/rows.length}};
  writeFileSync('OPERATION_RUNTIME_EVIDENCE_R22.json',JSON.stringify(out,null,2));
  console.log(JSON.stringify({pass:true,total:rows.length,verified,verificationRate01:verified/rows.length}));
  await r.stop();
}finally{await rm(dir,{recursive:true,force:true});}
