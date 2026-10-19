import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { IntegritySentinel } from '../src/organism/system/IntegritySentinel.ts';
const dir=await mkdtemp(path.join(tmpdir(),'nk-p6-')); const sf=path.join(dir,'state.json'), wf=path.join(dir,'world.json');
try {
  const r=new OrganismRuntime({stateFile:sf,worldStateFile:wf,enableLanguage:false}); await r.init();
  for(let i=0;i<36;i++) await r.step(i%5===0 ? 'Выбери самостоятельно, что важнее проверить и почему.' : undefined);
  const s=r.core.snapshot();
  if(s.state.version!==RELEASE_CONTRACT.stateSchema || s.schemaVersion!==RELEASE_CONTRACT.stateSchema) throw new Error('schema contract mismatch');
  if(!s.facets.memory || !s.facets.embodiment || !s.facets.learning || !s.facets.consciousness || !s.facets.evolution) throw new Error('facet contract missing');
  if(!s.system.lastStateHash || !s.system.replaySignature) throw new Error('integrity/replay provenance missing');
  if(!s.facets.memory.eventLog.some(e=>e.type==='action-authorized')) throw new Error('action authorization event missing');
  if(s.facets.evolution.selfProjects.projects.length<1) throw new Error('intrinsic project did not emerge');
  if(s.facets.evolution.identityTrajectory.samples<10) throw new Error('identity trajectory did not update');
  const sentinel=new IntegritySentinel(); if(sentinel.hash(s)!==s.system.lastStateHash) throw new Error('stored provenance hash does not match current state'); const beforeHash=s.system.lastStateHash; await r.stop();
  const r2=new OrganismRuntime({stateFile:sf,worldStateFile:wf,enableLanguage:false}); await r2.init();
  const after=r2.core.snapshot(); if(sentinel.hash(after)!==after.system.lastStateHash) throw new Error('restart provenance hash invalid');
  if(after.system.schemaVersion!==RELEASE_CONTRACT.stateSchema || after.system.release!==RELEASE_CONTRACT.application) throw new Error('restart release contract mismatch');
  if(after.state.tick!==s.state.tick) throw new Error(`restart tick mismatch ${s.state.tick} -> ${after.state.tick}`);
  r2.stop();
  console.log('P6_ORGANISM=PASS', JSON.stringify({ticks:s.state.tick,projects:s.facets.evolution.selfProjects.projects.length,agency:s.facets.evolution.agency.autonomousChoiceRate.toFixed(3),revisions:s.facets.evolution.valueEvolution.revisions.length,identity:s.facets.evolution.identityTrajectory.continuity.toFixed(3),stage:s.system.evolution.stage}));
} finally { await rm(dir,{recursive:true,force:true}); }
