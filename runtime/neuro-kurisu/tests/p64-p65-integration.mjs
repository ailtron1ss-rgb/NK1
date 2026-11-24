import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const dir = await mkdtemp(path.join(tmpdir(),'nk-p64-p65-'));
const stateFile=path.join(dir,'state.json');
const worldFile=path.join(dir,'world.json');
try {
  const a=new OrganismRuntime({stateFile,worldStateFile:worldFile,enableLanguage:false,checkpointMinIntervalMs:0});
  await a.init();
  await a.step('Я хочу проверить новую идею осторожно.');
  await a.step();
  await a.step('Продолжай и проверь результат.');
  const s=a.core.snapshot();
  const p64=s.facets.advanced.p64IntegratedOrganismDynamics;
  const p65=s.facets.advanced.p65EpistemicLedger;
  if(p64.cycles < 3) throw new Error('P64 did not participate in runtime');
  if(p64.modeCounts && Object.values(p64.modeCounts).reduce((a,b)=>a+b,0) < 3) throw new Error('P64 modes not recorded');
  if(p65.observations < 2 || p65.predictions < 1) throw new Error('P65 evidence/prediction ledger not populated');
  const before=p65.claimsData.length;
  await a.flush();
  a.stop();
  const b=new OrganismRuntime({stateFile,worldStateFile:worldFile,enableLanguage:false,checkpointMinIntervalMs:0});
  await b.init();
  const r=b.core.snapshot();
  if(r.facets.advanced.p64IntegratedOrganismDynamics.cycles < 3) throw new Error('P64 persistence failed');
  if(r.facets.advanced.p65EpistemicLedger.claimsData.length < before) throw new Error('P65 persistence failed');
  b.stop();
  console.log('P64_P65_INTEGRATION=PASS');
} finally { await rm(dir,{recursive:true,force:true}); }
