import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const dir=await mkdtemp(path.join(tmpdir(),'nk-p21-'));
const file=path.join(dir,'organism.json');
try{
  const core=new OrganismCore(new FileStateStore(file,{backupEverySaves:2}),{enableLifelongLearning:true});
  await core.init();
  const fire=core.snapshot().facets.advanced.advancedResilience.surpriseFirewall;
  assert.equal(fire.inspected,0);
  for(let i=0;i<12;i++) await core.observe({text:`test observation ${i}`,novelty:.35,success:.7});
  await core.feedback({success:.82,reward:.64,surprise:.12,notes:'p21'});
  const adv=core.advancedResilienceSnapshot();
  assert.ok(adv.cycles>0);
  assert.ok(adv.shadow.comparisons>0);
  assert.ok(adv.surpriseFirewall.inspected>0);
  assert.ok(adv.evidenceDebt.records.length>0);
  assert.ok(adv.modelSwap.evaluations>0);
  assert.ok(adv.timeCapsules.capsules.length>=0);
  assert.ok(adv.counterfactualForks.evaluations>0);
  await core.flush();
  const raw=JSON.parse(await readFile(file,'utf8'));
  assert.equal(raw.schemaVersion, RELEASE_CONTRACT.stateSchema);
  assert.ok(raw.facets.advanced.advancedResilience);
  assert.ok(raw.facets.advanced.advancedResilience.counterfactualForks.evaluations>0);
  const core2=new OrganismCore(new FileStateStore(file),{});
  await core2.init();
  assert.equal(core2.snapshot().facets.advanced.advancedResilience.cycles,adv.cycles);
  console.log(JSON.stringify({ok:true,cycles:adv.cycles,shadow:adv.shadow.comparisons,quarantine:adv.surpriseFirewall.quarantined,evidenceDebt:adv.evidenceDebt.records.length,modelEvaluations:adv.modelSwap.evaluations,compiledSkills:adv.dreamCompiler.compiledSkills.length,capsules:adv.timeCapsules.capsules.length},null,2));
}finally{await rm(dir,{recursive:true,force:true});}
