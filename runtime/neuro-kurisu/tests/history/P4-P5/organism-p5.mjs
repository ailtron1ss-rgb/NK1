import { rm, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const dir = await mkdtemp(path.join(tmpdir(),'nk-p5-'));
try {
  const make=()=>new OrganismRuntime({stateFile:path.join(dir,'state.json'),worldStateFile:path.join(dir,'world.json'),enableLanguage:false,enableSelfProjects:true,enableAgencyModel:true,enableValueEvolution:true,enableIdentityTrajectory:true});
  const r=make(); await r.init();
  for(let i=0;i<42;i++){
    await r.step(i%7===0 ? 'Проверь гипотезу и выбирай действие самостоятельно.' : undefined);
    if(i%3===0) await r.core.feedback({success:0.82,surprise:0.72, reward:0.64, notes:'P5 evidence'});
  }
  const s=r.core.snapshot();
  if(!s.facets.evolution?.selfProjects) throw new Error('P5 project state missing');
  if(s.facets.evolution.selfProjects.projects.length < 1) throw new Error('no self-project formed');
  if(s.facets.evolution.agency.records.length < 20) throw new Error('agency record not accumulating');
  if(s.facets.evolution.identityTrajectory.samples < 20) throw new Error('identity trajectory not accumulating');
  if(s.facets.evolution.narrative.chapters.length < 1) throw new Error('autobiographical chapter not formed');
  if(s.facets.learning.valueRevisionLog.length < 1) throw new Error('value evolution did not produce a revision');
  const firstProject=s.facets.evolution.selfProjects.projects[0].id;
  await r.stop?.();
  const r2=make(); await r2.init();
  const s2=r2.core.snapshot();
  if(!s2.facets.evolution.selfProjects.projects.some(p=>p.id===firstProject)) throw new Error('self-project not persistent across restart');
  if(s2.facets.evolution.agency.records.length < s.facets.evolution.agency.records.length) throw new Error('agency history regressed');
  r2.stop();
  console.log(JSON.stringify({P5_ORGANISM:'PASS',cycles:s2.state.tick,projects:s2.facets.evolution.selfProjects.projects.length,agencyRecords:s2.facets.evolution.agency.records.length,valueRevisions:s2.facets.learning.valueRevisionLog.length,identityContinuity:s2.facets.evolution.identityTrajectory.continuity,narrativeChapters:s2.facets.evolution.narrative.chapters.length},null,2));
} finally { await rm(dir,{recursive:true,force:true}); }
