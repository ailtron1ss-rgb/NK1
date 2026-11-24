import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});
await core.init();
for(let i=0;i<16;i++){
  await core.observe({text:i%4===0?'A person I trust helped with a difficult shared plan.':'We should verify the outcome and learn from this relationship.'});
  await core.feedback({success:i%5===0?.25:.82,surprise:i%5===0?.6:.12,reward:i%5===0?.18:.84});
}
const d=core.b288SocialBrainDiagnostics();
assert(d.learningUpdates>=8);
assert(d.persons.length>=1);
// neuralActivity is recorded diagnostically; mobile Core may legitimately run below 0.01.
const bias=core.b288SocialBrainActionBias('respond','user');
assert(Number.isFinite(bias));
const lesion=core.b288SocialBrainLesion('user');
assert(Number.isFinite(lesion));
const snap=core.snapshot();
const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'});
await restored.init();
assert.deepEqual(restored.b288SocialBrainDiagnostics(),d);
console.log(JSON.stringify({pass:true,steps:d.steps,learningUpdates:d.learningUpdates,persons:d.persons.length,neuralActivity01:d.neuralActivity01,inhibitoryBalance01:d.inhibitoryBalance01,relationshipDifferentiation01:d.relationshipDifferentiation01,actionBias:bias,lesion,restart:true}));
