import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { NoopOperationalJournal } from '../src/organism/persistence/NoopOperationalJournal.ts';

const dir = await mkdtemp(path.join(tmpdir(), 'p2854-core-'));
const makeRuntime = (stateFile, worldStateFile, initial) => new OrganismRuntime({
  stateFile, worldStateFile, enableLanguage:false,
  stateStore:new MemoryStateStore(initial ? {initial} : undefined),
  worldStateStore:new MemoryStateStore(),
  journal:new NoopOperationalJournal(), performanceProfile:'mobile', cycleResultMode:'summary',
});

try {
  const runtime=makeRuntime(path.join(dir,'state.json'),path.join(dir,'world.json'));
  await runtime.init();
  for(let i=0;i<16;i++) await runtime.autonomousStep();
  const after=runtime.core.neuralExperienceBranchDiagnostics();
  assert.equal(after.version,32);
  assert(after.tick>=16,'core did not reach expected horizon');
  assert(after.hierarchicalSlowMemory.retrievals>=16,'hierarchical slow memory did not retrieve through core');
  assert(after.hierarchicalSlowMemory.updates>0,'hierarchical slow memory did not write through core');
  assert(after.hierarchicalSlowMemory.schemaUpdates>0,'schema level did not consolidate through core');
  assert(after.hierarchicalSlowMemory.actionUpdates>0,'hierarchical action policy did not receive outcome credit');
  assert(after.hierarchicalSlowMemory.estimatedBytes<5000,'hierarchical memory exceeded fixed budget');

  const snapshot=runtime.core.snapshot();
  const restored=makeRuntime(path.join(dir,'state2.json'),path.join(dir,'world2.json'),snapshot);
  await restored.init();
  const rd=restored.core.neuralExperienceBranchDiagnostics();
  assert.equal(rd.version,32);
  assert.equal(rd.hierarchicalSlowMemory.updates,after.hierarchicalSlowMemory.updates);
  assert.equal(rd.hierarchicalSlowMemory.retrievals,after.hierarchicalSlowMemory.retrievals);
  assert.deepEqual(rd.hierarchicalSlowMemory.schemaVisits,after.hierarchicalSlowMemory.schemaVisits);
  assert.equal(rd.hierarchicalSlowMemory.actionUpdates,after.hierarchicalSlowMemory.actionUpdates);

  console.log(JSON.stringify({ok:true,tick:after.tick,version:after.version,hierarchicalSlowMemory:{retrievals:after.hierarchicalSlowMemory.retrievals,updates:after.hierarchicalSlowMemory.updates,schemaUpdates:after.hierarchicalSlowMemory.schemaUpdates,schemaVisits:after.hierarchicalSlowMemory.schemaVisits,actionUpdates:after.hierarchicalSlowMemory.actionUpdates,transferAccepted:after.hierarchicalSlowMemory.transferAccepted,transferRejected:after.hierarchicalSlowMemory.transferRejected,estimatedBytes:after.hierarchicalSlowMemory.estimatedBytes},persisted:true},null,2));
  await restored.stop(); await runtime.stop();
} finally { await rm(dir,{recursive:true,force:true}); }
