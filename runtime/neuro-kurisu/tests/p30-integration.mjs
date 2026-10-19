import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
const dir=await mkdtemp(join(tmpdir(),'neuro-p30-'));
try{
  const core=new OrganismCore(new FileStateStore(join(dir,'state.json')),{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1});
  await core.init();
  const c=await core.observe({text:'investigate new uncertainty and preserve previous skills',surprise:.6,novelty:.65});
  await core.feedback({success:.82,reward:.84,surprise:.28});
  const d=core.p30Diagnostics();
  const cdl=core.causalDevelopmentDiagnostics();
  const cx=core.causalExperienceSummary();
  assert.ok(d.metrics.cycles>=1); assert.ok(d.trajectory.samples>=1);
  assert.ok(cx.outcomes>=1); assert.ok(cx.records>=1);
  assert.ok(cdl.samples>=1); assert.ok(cdl.coupledUpdates>=1);
  await core.flush();
  const reloaded=new OrganismCore(new FileStateStore(join(dir,'state.json')),{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1});
  await reloaded.init();
  assert.equal(reloaded.snapshot().facets.learning.p30.version,2);
  assert.ok(reloaded.p30Diagnostics().trajectory.samples>=1);
  assert.ok(reloaded.causalExperienceSummary().outcomes>=1);
  assert.ok(reloaded.causalExperienceSummary().records>=1);
  assert.ok(reloaded.causalDevelopmentDiagnostics().samples>=1);
  console.log(`P30_INTEGRATION=PASS action=${c.decision.selected?.action??'none'} samples=${reloaded.p30Diagnostics().trajectory.samples}`);
} finally { await rm(dir,{recursive:true,force:true}); }
