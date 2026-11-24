import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const dir=await mkdtemp(path.join(os.tmpdir(),'neuro-pass94-server-'));
try{
  const runtime=new OrganismRuntime({stateFile:path.join(dir,'state.json'),worldStateFile:path.join(dir,'world.json'),enableLanguage:false});
  await runtime.init();
  await runtime.core.observe({text:'Как это работает?',embodiment:{bodyEnergy01:.84,cognitiveCapacity01:.9,thermalStrain01:.18,sensoryFreshness01:.9,awake:true,battery01:.84,cpuLoad01:.2,ramPressure01:.2}});
  const d=runtime.core.socialMindDiagnostics();
  assert.ok(d.personCount>=1);
  assert.ok(d.episodeCount>=1);
  assert.ok(Number.isFinite(d.socialDemand01));
  await runtime.core.flush();
  console.log(`BIG_PASS_94_SERVER=PASS persons=${d.personCount} episodes=${d.episodeCount} demand=${d.socialDemand01.toFixed(3)}`);
}finally{await rm(dir,{recursive:true,force:true});}
