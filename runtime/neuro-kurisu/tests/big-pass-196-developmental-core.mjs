import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const dir=await mkdtemp(path.join(os.tmpdir(),'neuro-bp196-core-'));
const file=path.join(dir,'organism.json');
try{
  const opts={enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableTemporalResolutionGovernor:false};
  const core=new OrganismCore(new FileStateStore(file),opts); await core.init();
  for(let i=0;i<48;i++){
    await core.observe({
      text:i%3===0?'Проверим гипотезу и найдем ошибку.':i%3===1?'Продолжим исследование.':'Нужно закрепить результат.',
      novelty:.3+(i%4)*.05,
      embodiment:{bodyEnergy01:.84,cognitiveCapacity01:.9,thermalStrain01:.14,sensoryFreshness01:.95,awake:true,battery01:.9,cpuLoad01:.18,ramPressure01:.18}
    });
    const world=(tick)=>({tick,location:'lab',energy:.84,attention:.78,uncertainty:.16,facts:['controlled-development'],objects:[],events:['development-cycle']});
    await core.feedback({success:.82,reward:.72,surprise:.08,worldTransition:{action:'respond',before:world(i*2),after:world(i*2+1),reward:.72,surprise:.08,at:Date.now()}});
  }
  await core.flush();
  const p36=core.p36SelfDevelopmentSnapshot();
  const cert=core.p36SelfDevelopmentDiagnostics().developmentalMaturity;
  assert.ok(p36.developmentalMaturity);
  assert.equal(p36.developmentalMaturity.verifiedOutcomeCount,48);
  assert.ok(cert.stage!=='seed');
  const persisted=JSON.parse(await (await import('node:fs/promises')).readFile(file,'utf8'));
  assert.ok(persisted.facets.learning.p36.developmentalMaturity);
  const restored=new OrganismCore(new FileStateStore(file),opts); await restored.init();
  assert.deepEqual(restored.p36SelfDevelopmentSnapshot().developmentalMaturity,core.p36SelfDevelopmentSnapshot().developmentalMaturity);
  console.log(`BIG_PASS_196_DEVELOPMENTAL_CORE=PASS cycles=48 verified=${cert.verifiedOutcomeCount} stage=${cert.stage} score=${cert.score01.toFixed(3)}`);
} finally { await rm(dir,{recursive:true,force:true}); }
