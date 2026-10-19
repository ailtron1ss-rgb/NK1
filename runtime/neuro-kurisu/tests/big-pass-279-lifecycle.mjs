import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const store=new MemoryStateStore();
const core=new OrganismCore(store,{performanceProfile:'mobile',checkpointMinIntervalMs:60000,cycleResultMode:'operational'});
await core.init();
for(let i=0;i<8;i++){
  await core.observe({text:i%2===0?'explore a new hypothesis':'verify the last outcome',worldEvent:{type:'observation',payload:{signal:i%3,confidence:.7}}},'operational');
  await core.feedback({success:i%3===0?0.75:0.6,reward:i%3===0?.72:.58,surprise:i%2?0.2:0.38,evidenceSource:'local'});
}
const d=core.b279NeuralAttractorDiagnostics();
assert.ok(d.cycles>0,'B279 was not reached by live OrganismCore cycle');
assert.ok(d.learningUpdates>0,'B279 did not learn from live outcomes');
const snap=core.snapshot();
const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',checkpointMinIntervalMs:60000,cycleResultMode:'operational'});
await core2.init();
assert.deepEqual(core2.b279NeuralAttractorDiagnostics(),d,'B279 live state did not survive restart');
console.log(JSON.stringify({ok:true,cycles:d.cycles,learningUpdates:d.learningUpdates,consolidations:d.consolidationCount,stability01:d.stability01,homeostaticError01:d.homeostaticError01,restored:true},null,2));
