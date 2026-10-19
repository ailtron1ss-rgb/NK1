import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const dir=await mkdtemp(join(tmpdir(),'neuro-pass18-projection-'));
try {
  const store=new MemoryStateStore();
  const core=new OrganismCore(store,{performanceProfile:'mobile',cycleResultMode:'full',checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:16,enableLanguage:false});
  await core.init();
  for(let i=1;i<=96;i++) await core.observe({
    text:i%12===0?`projection continuity ${i}`:undefined,
    reward:i%9===0?.64:undefined,
    surprise:i%11===0?.21:.05,
    novelty:.38+(i%5)*.04,
    embodiment:{bodyEnergy01:.8,cognitiveCapacity01:.82,thermalStrain01:.17,sensoryFreshness01:.89,awake:true,battery01:.78,cpuLoad01:.21,ramPressure01:.2},
  },'full');

  const liveP64=core.p64Snapshot();
  const liveKernel=core.cognitiveKernelSnapshot();
  assert.ok(liveP64.history.length>=90,'live P64 history was unexpectedly shortened');
  assert.ok(liveKernel.p61.frames.length>=90,'live P61 frames were unexpectedly shortened');

  await core.flush();
  const persisted=await store.load();
  assert.ok(persisted);
  const advanced=persisted.facets.advanced;
  assert.ok(advanced.p51GroundedCausalWorkspace.evidence.length<=64);
  assert.ok(advanced.p52CounterfactualDevelopment.trajectory.length<=64);
  assert.ok(advanced.p61IntegratedMind.frames.length<=32);
  assert.ok(advanced.p64IntegratedOrganismDynamics.history.length<=32);
  assert.ok(advanced.p65EpistemicLedger.claimsData.length<=160);
  assert.ok(advanced.p65EpistemicLedger.recentIds.length<=256);

  const restoredStore=new MemoryStateStore({initial:persisted});
  const restored=new OrganismCore(restoredStore,{performanceProfile:'mobile',cycleResultMode:'full',checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:16,enableLanguage:false});
  await restored.init();
  assert.equal(restored.snapshot().state.tick,96);
  assert.ok(restored.snapshot().facets.advanced.p64IntegratedOrganismDynamics.cycles>=96);
  assert.ok(restored.snapshot().facets.advanced.p65EpistemicLedger.predictions>=1);

  console.log(JSON.stringify({
    pass:true,
    tick:persisted.state.tick,
    live:{p61Frames:liveKernel.p61.frames.length,p64History:liveP64.history.length},
    persisted:{p51Evidence:advanced.p51GroundedCausalWorkspace.evidence.length,p52Trajectory:advanced.p52CounterfactualDevelopment.trajectory.length,p61Frames:advanced.p61IntegratedMind.frames.length,p64History:advanced.p64IntegratedOrganismDynamics.history.length,p65Claims:advanced.p65EpistemicLedger.claimsData.length,p65RecentIds:advanced.p65EpistemicLedger.recentIds.length},
  },null,2));
} finally { await rm(dir,{recursive:true,force:true}); }
