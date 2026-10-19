import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const dir=await mkdtemp(path.join(os.tmpdir(),'neuro-bp195-'));
const file=path.join(dir,'organism.json');
try{
 const core=new OrganismCore(new FileStateStore(file),{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableTemporalResolutionGovernor:false});
 await core.init();
 for(let i=0;i<36;i++){
  await core.observe({
   text:i%2===0?'Можешь помочь мне разобраться с экспериментом?':'Почему это не работает?',
   socialSignal:.45+(i%4)*.12,
   reward:i%3===0?.8:.55,
   success:i%3===0?.8:.58,
   novelty:.2+(i%5)*.08,
   embodiment:{bodyEnergy01:.82,cognitiveCapacity01:.88,thermalStrain01:.18,sensoryFreshness01:.9,awake:true,battery01:.81,cpuLoad01:.22,ramPressure01:.2}
  });
 }
 await core.flush();
 const diag=core.socialPredictiveNeuralDiagnostics();
 assert.ok(diag.sampleCount>10);
 assert.equal(diag.learningSteps,0);
 const state=core.snapshot();
 assert.ok(state.facets.cognition.socialPredictiveNeural?.sampleCount===diag.sampleCount);
 const persisted=JSON.parse(await readFile(file,'utf8'));
 assert.equal(persisted.facets.cognition.socialPredictiveNeural.sampleCount,diag.sampleCount);
 const restored=new OrganismCore(new FileStateStore(file),{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableTemporalResolutionGovernor:false});
 await restored.init();
 assert.deepEqual(restored.socialPredictiveNeuralSnapshot(),core.socialPredictiveNeuralSnapshot());
 const neural=restored.socialPredictiveNeuralDiagnostics();
 assert.equal(neural.sampleCount,diag.sampleCount);
 console.log(`BIG_PASS_195_SOCIAL_CORE=PASS cycles=36 samples=${diag.sampleCount} error=${diag.meanPredictionError01.toFixed(3)} validated=${diag.validated}`);
} finally { await rm(dir,{recursive:true,force:true}); }
