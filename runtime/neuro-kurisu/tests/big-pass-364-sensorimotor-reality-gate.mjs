import assert from 'node:assert/strict';
import { EmbodimentRuntime } from '../src/organism/body/EmbodimentRuntime.ts';
import { EmbodiedActionExecutor } from '../src/organism/body/EmbodiedActionExecutor.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const body=new EmbodimentRuntime();
await body.init();
const executor=new EmbodiedActionExecutor(body);
const exploratory=await executor.execute('explore',{allowCamera:false});
if(exploratory.source==='android-termux'){
  assert.ok(['executed','failed'].includes(exploratory.status));
  if(exploratory.status==='executed') assert.equal(exploratory.realityClass,'device-observation');
}else{
  assert.equal(exploratory.status,'unavailable');
  assert.notEqual(exploratory.realityClass,'device-observation');
}
const rest=await executor.execute('rest');
assert.equal(rest.status,'executed');
assert.equal(rest.reason,'embodied-rest-state-transition');
assert.equal(rest.after.awake,false);

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational',checkpointMinIntervalMs:0,predictivePlanningHorizon:5});
await core.init();
core.setEmbodiedActionResult(rest);
const snap=core.snapshot();
assert.equal(snap.facets.embodiment.embodiedAction?.action,'rest');
assert.equal(snap.facets.embodiment.embodiedAction?.after.awake,false);
const restart=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational',checkpointMinIntervalMs:0,predictivePlanningHorizon:5});
await restart.init();
assert.equal(restart.snapshot().facets.embodiment.embodiedAction?.action,'rest');
assert.equal(restart.snapshot().facets.embodiment.embodiedAction?.status,'executed');
console.log(JSON.stringify({pass:true,status:'B364_SENSORIMOTOR_REALITY_GATE_PASS',source:exploratory.source,explore:{status:exploratory.status,realityClass:exploratory.realityClass,reason:exploratory.reason},rest:{status:rest.status,awakeAfter:rest.after.awake,effect01:rest.effect01},restartPersisted:true},null,2));
