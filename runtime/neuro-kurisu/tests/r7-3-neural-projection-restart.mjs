import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const dir=await mkdtemp(join(tmpdir(),'neuro-r73-'));
const path=join(dir,'organism.json');
try{
  const config={performanceProfile:'mobile',cycleResultMode:'operational',checkpointMinIntervalMs:600000,checkpointMaxDirtyCycles:256};
  const firstStore=new FileStateStore(path,{backupEverySaves:99,directoryFsyncEverySaves:99});
  const first=new OrganismCore(firstStore,config);
  await first.init();
  for(let i=0;i<4;i++) await first.observe({novelty:.28+i*.04,surprise:.08,embodiment:{bodyEnergy01:.86,cognitiveCapacity01:.86,thermalStrain01:.18,battery01:.84,cpuLoad01:.2,ramPressure01:.18,sensoryFreshness01:.84,awake:true}});
  await first.flush();
  const before=first.neuralExperienceBranchDiagnostics();
  const second=new OrganismCore(new FileStateStore(path,{backupEverySaves:99,directoryFsyncEverySaves:99}),config);
  await second.init();
  const after=second.neuralExperienceBranchDiagnostics();
  assert.equal(after.cycles,before.cycles);
  assert.equal(after.tick,before.tick);
  assert.deepEqual(after.lastExperience?.input,before.lastExperience?.input);
  console.log(JSON.stringify({PASS:true,cycles:after.cycles,tick:after.tick,inputLength:after.lastExperience?.input?.length??0}));
} finally { await rm(dir,{recursive:true,force:true}); }
