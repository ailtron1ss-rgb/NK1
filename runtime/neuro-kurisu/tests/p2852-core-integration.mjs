import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const dir=await mkdtemp(path.join(tmpdir(),'p2852-core-'));
try{
  const runtime=new OrganismRuntime({stateFile:path.join(dir,'state.json'),worldStateFile:path.join(dir,'world.json'),enableLanguage:false,stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new BoundedOperationalJournal(),performanceProfile:'mobile',cycleResultMode:'summary'});
  await runtime.init();
  for(let i=0;i<8;i++) await runtime.autonomousStep();
  const after=runtime.core.neuralExperienceBranchDiagnostics();
  assert.equal(after.version,32);
  assert(after.crossModalUpdates>0,'cross-modal binding did not execute in core');
  assert(after.offlineConsolidation.cycles>0,'offline consolidation did not execute in core');
  assert(after.multiscalePlasticityUpdates>=8,'multiscale plasticity did not execute in core');
  assert(after.slowMemoryConsolidation.retrievals>0,'slow memory consolidation did not execute in core');
  const ab=runtime.core.neuralExperienceBranchDiagnostics();
  assert(ab.offlineConsolidation.cycles>0);
  const snap=runtime.core.snapshot();
  const restored=new OrganismRuntime({stateFile:path.join(dir,'state2.json'),worldStateFile:path.join(dir,'world2.json'),enableLanguage:false,stateStore:new MemoryStateStore({initial:snap}),worldStateStore:new MemoryStateStore(),journal:new BoundedOperationalJournal(),performanceProfile:'mobile',cycleResultMode:'summary'});
  await restored.init();
  const rd=restored.core.neuralExperienceBranchDiagnostics();
  assert.equal(rd.version,32);
  assert.equal(rd.offlineConsolidation.replaySamples,after.offlineConsolidation.replaySamples,'offline consolidation did not persist');
  assert.equal(rd.multiscalePlasticityUpdates,after.multiscalePlasticityUpdates,'multiscale plasticity did not persist');
  assert.equal(rd.slowMemoryConsolidation.updates,after.slowMemoryConsolidation.updates,'slow memory consolidation did not persist');
  console.log(JSON.stringify({ok:true,tick:after.tick,offline:after.offlineConsolidation,multiscale:{fast01:after.fastPlasticity01,medium01:after.mediumPlasticity01,slow01:after.slowPlasticity01,updates:after.multiscalePlasticityUpdates},coreDiagnostics:{offlineCycles:ab.offlineConsolidation.cycles,replaySamples:ab.offlineConsolidation.replaySamples},persisted:true},null,2));
  await restored.stop(); await runtime.stop();
}finally{await rm(dir,{recursive:true,force:true});}
