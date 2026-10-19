import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const dir=await mkdtemp(path.join(os.tmpdir(),'neuro-bp195-learn-'));
const file=path.join(dir,'organism.json');
try{
  const core=new OrganismCore(new FileStateStore(file),{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableTemporalResolutionGovernor:false});
  await core.init();
  for(let i=0;i<48;i++){
    await core.observe({
      text:i%2===0?'Можешь помочь мне с исследованием?':'Почему эксперимент не сработал?',
      socialSignal:.55+(i%3)*.1,
      novelty:.28+(i%4)*.05,
      embodiment:{bodyEnergy01:.84,cognitiveCapacity01:.9,thermalStrain01:.16,sensoryFreshness01:.92,awake:true,battery01:.86,cpuLoad01:.18,ramPressure01:.18}
    });
    await core.feedback({success:i%4===0?.82:.7,reward:i%4===0?.78:.64,surprise:i%5===0?.18:.1});
  }
  const d=core.socialPredictiveNeuralDiagnostics();
  assert.equal(d.sampleCount,48);
  assert.equal(d.learningSteps,48);
  assert.ok(d.validated);
  assert.ok(d.meanPredictionError01<.26);
  console.log(`BIG_PASS_195_SOCIAL_LEARNING_CORE=PASS samples=${d.sampleCount} learning=${d.learningSteps} error=${d.meanPredictionError01.toFixed(3)} validated=${d.validated}`);
}finally{await rm(dir,{recursive:true,force:true});}
