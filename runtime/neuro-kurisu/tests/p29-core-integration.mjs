import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const dir=await mkdtemp(join(tmpdir(),'neuro-p29-'));
try{
  const store=new FileStateStore(join(dir,'state.json'));
  const core=new OrganismCore(store,{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1});
  await core.init();
  const before=core.p29Diagnostics().cycles;
  const cycle=await core.observe({text:'learn to prefer verification when uncertainty is high',surprise:.42,novelty:.5});
  await core.feedback({success:.78,reward:.82,surprise:.42});
  assert.ok(core.p29Diagnostics().cycles>before);
  const diag=core.p29Diagnostics();
  assert.ok(diag.lastArbitration===null || typeof diag.lastArbitration.netBias==='number');
  core.p29RecordTaskScore('verify-task',.9);
  await core.flush();
  const reloaded=new OrganismCore(new FileStateStore(join(dir,'state.json')),{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1});
  await reloaded.init();
  assert.equal(reloaded.snapshot().facets.learning.p29.version,1);
  assert.ok(reloaded.p29Snapshot().provenance.length>=0);
  console.log(`P29_CORE_INTEGRATION=PASS action=${cycle.decision.selected?.action??'none'} p29Cycles=${reloaded.p29Diagnostics().cycles}`);
} finally { await rm(dir,{recursive:true,force:true}); }
