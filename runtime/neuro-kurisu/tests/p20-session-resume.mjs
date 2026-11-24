import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const dir=await mkdtemp(path.join(os.tmpdir(),'nk-p20-session-'));
const sf=path.join(dir,'organism.json'); const wf=path.join(dir,'world.json');
try {
  const first=new OrganismRuntime({stateFile:sf,worldStateFile:wf,enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1});
  await first.init();
  await first.step('Запомни, что сессия была сегодня.');
  await first.core.endTemporalSession('test-shutdown',true);
  first.stop();
  const saved=JSON.parse(await readFile(sf,'utf8'));
  const original=saved.facets.advanced.temporalContinuity.lastCheckpointAt;
  saved.facets.advanced.temporalContinuity.lastCheckpointAt=original-2*60*60*1000;
  await writeFile(sf,JSON.stringify(saved,null,2),'utf8');
  const second=new OrganismRuntime({stateFile:sf,worldStateFile:wf,enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1});
  await second.init();
  const temporal=second.core.temporalContinuitySnapshot();
  assert.equal(temporal.gapSincePreviousClass,'hours');
  assert.ok(temporal.gapSincePreviousMs>=2*60*60*1000);
  assert.equal(second.core.snapshot().state.tick,1);
  await second.core.endTemporalSession('test-finish',true); second.stop();
  console.log(`P20_SESSION_RESUME=PASS gapClass=${temporal.gapSincePreviousClass} gapMs=${temporal.gapSincePreviousMs} tick=1`);
} finally { await rm(dir,{recursive:true,force:true}); }
