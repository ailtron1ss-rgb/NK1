import { rm, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
const dir = await mkdtemp(path.join(tmpdir(),'nk-p5-smoke-'));
try {
  const make=()=>new OrganismRuntime({stateFile:path.join(dir,'state.json'),worldStateFile:path.join(dir,'world.json'),enableLanguage:false,enableSelfProjects:true,enableAgencyModel:true,enableValueEvolution:true,enableIdentityTrajectory:true});
  const r=make(); await r.init();
  for(let i=0;i<18;i++){ await r.step(i%6===0 ? 'Проверь гипотезу и выбирай действие самостоятельно.' : undefined); if(i%3===0) await r.core.feedback({success:0.82,surprise:0.72,reward:0.64,notes:'P5 smoke'}); }
  const s=r.core.snapshot();
  if(!s.facets.evolution?.selfProjects?.projects.length) throw new Error('no self-project formed');
  if(!s.facets.evolution?.agency?.records.length) throw new Error('no agency record');
  if(s.facets.evolution?.selfProjects?.authorshipScore <= 0) throw new Error('no authorship score');
  const projectId=s.facets.evolution.selfProjects.projects[0].id; r.stop();
  const r2=make(); await r2.init(); const s2=r2.core.snapshot(); r2.stop();
  if(!s2.facets.evolution.selfProjects.projects.some(p=>p.id===projectId)) throw new Error('p5 state not persistent');
  console.log('P5_SMOKE=PASS', JSON.stringify({cycles:s2.state.tick,projects:s2.facets.evolution.selfProjects.projects.length,agencyRecords:s2.facets.evolution.agency.records.length,authorshipScore:Number(s2.facets.evolution.selfProjects.authorshipScore.toFixed(3))}));
} finally { await rm(dir,{recursive:true,force:true}); }
