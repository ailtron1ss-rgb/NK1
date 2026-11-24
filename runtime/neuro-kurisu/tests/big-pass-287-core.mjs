import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});
await core.init();
for(let i=0;i<18;i++){
  await core.observe({text:i%3===0?'Our relationship and shared plans changed after a difficult outcome.':'Continue to learn from this relationship and future plans.'});
  await core.feedback({success:i%5===0?.2:.76,surprise:i%5===0?.65:.15,reward:i%5===0?.1:.8});
}
const d=core.b287RelationshipDiagnostics();
assert(d.relationCount>=1);
assert(d.learningUpdates>=8);
assert(d.relationshipDifferentiation01>=0);
const respondBias=core.b287RelationshipActionBias('respond','user');
const verifyBias=core.b287RelationshipActionBias('verify','user');
assert(Number.isFinite(respondBias)&&Number.isFinite(verifyBias));
assert(Math.abs(respondBias-verifyBias)>0.0001);
const ablation=core.b287RelationshipAblation('user');
const snap=core.snapshot();
const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'});
await restored.init();
assert.deepEqual(restored.b287RelationshipDiagnostics(),d);
console.log(JSON.stringify({pass:true,steps:d.steps,learningUpdates:d.learningUpdates,relationCount:d.relationCount,relationshipDifferentiation01:d.relationshipDifferentiation01,globalIdentityInfluence01:d.globalIdentityInfluence01,causalAblationDrop01:d.causalAblationDrop01,respondBias,verifyBias,biasDelta:Math.abs(respondBias-verifyBias),restart:true}));
