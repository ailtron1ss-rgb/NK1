import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

const dir=await mkdtemp(path.join(tmpdir(),'nk-p2876-'));
try {
  const runtime=new OrganismRuntime({stateFile:path.join(dir,'state.json'),worldStateFile:path.join(dir,'world.json'),enableLanguage:false,autoRun:false,performanceProfile:'mobile',cycleResultMode:'summary'});
  await runtime.init();
  for(let i=0;i<8;i++) await runtime.autonomousStep();
  const d=runtime.core.mobileRetentionDiagnostics();
  for(const key of ['cognitiveDomainClosureRecentLength','p40ClaimsLength','p40SituationsLength','p40HypothesesLength','embodiedTransitionsLogLength','replayBufferLength']) assert.ok(Number.isInteger(d[key]) && d[key]>=0, `invalid ${key}`);
  assert.ok(d.cognitiveDomainClosureRecentLength<=16);
  assert.ok(d.p40ClaimsLength<=256 || d.p40ClaimsLength<=512);
  assert.ok(d.embodiedTransitionsLogLength<=64);
  assert.ok(d.replayBufferLength<=192);
  await runtime.stop();
  console.log(`P2876_MOBILE_DIAGNOSTIC_HOTPATH=PASS closure=${d.cognitiveDomainClosureRecentLength} claims=${d.p40ClaimsLength} embodied=${d.embodiedTransitionsLogLength} replay=${d.replayBufferLength}`);
} finally { await rm(dir,{recursive:true,force:true}); }
