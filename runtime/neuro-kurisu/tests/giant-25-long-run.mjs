import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';

const store=new MemoryStateStore();
const core=new OrganismCore(store,{checkpointMinIntervalMs:600000,checkpointMaxDirtyCycles:100000,enableLanguage:false});
await core.init();
const t0=performance.now();
let completions=0;
for(let i=0;i<300;i++){
  const lowResource=i%37===0;
  await core.observe({
    text:i%25===0?`Длительное наблюдение ${i}: сравни варианты развития и действуй только при достаточной уверенности.`:undefined,
    novelty:i%17===0?.92:.34,
    surprise:i%29===0?.62:.08,
    embodiment:{bodyEnergy01:lowResource?.24:.76,cognitiveCapacity01:lowResource?.58:.84,thermalStrain01:lowResource?.42:.18,sensoryFreshness01:.88,awake:true,battery01:lowResource?.22:.81,cpuLoad01:.25,ramPressure01:.22}
  });
  await core.feedback({success:.92,reward:.76,surprise:i%29===0?.18:.04,notes:'external-observed-outcome'});
  if(i%25===0){ const s=core.snapshot(); assert.equal(s.schemaVersion,RELEASE_CONTRACT.stateSchema); assert.ok(s.goals.length<=16,'goal population must remain bounded'); completions += s.goals.filter(g=>g.status==='completed').length; }
}
await core.flush();
const elapsed=performance.now()-t0;
const before=core.snapshot();
const restored=new OrganismCore(store,{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableLanguage:false});
await restored.init();
const after=restored.snapshot();
assert.equal(after.schemaVersion,RELEASE_CONTRACT.stateSchema);
assert.equal(after.facets.advanced.p66InteroceptiveHomeostasis.cycles,before.facets.advanced.p66InteroceptiveHomeostasis.cycles);
assert.equal(after.facets.advanced.p68GoalEcology.cycles,before.facets.advanced.p68GoalEcology.cycles);
assert.ok(after.facets.advanced.p67AutonomousGoalGenesis.cycles>=before.facets.advanced.p67AutonomousGoalGenesis.cycles);
assert.ok(after.facets.advanced.p64IntegratedOrganismDynamics.cycles>=before.facets.advanced.p64IntegratedOrganismDynamics.cycles);
const mem=process.memoryUsage();
console.log(JSON.stringify({cycles:before.state.tick,elapsedMs:Number(elapsed.toFixed(2)),cyclesPerSecond:Number((300/(elapsed/1000)).toFixed(2)),activeGoals:before.goals.filter(g=>g.status==='active').length,totalGoals:before.goals.length,p67:before.facets.advanced.p67AutonomousGoalGenesis,p68:before.facets.advanced.p68GoalEcology,modeCounts:before.facets.advanced.p64IntegratedOrganismDynamics.modeCounts,heapUsedMB:Number((mem.heapUsed/1048576).toFixed(2)),rssMB:Number((mem.rss/1048576).toFixed(2))}));
