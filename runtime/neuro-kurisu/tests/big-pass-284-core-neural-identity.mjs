import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core.init();
for(let i=0;i<18;i++){
  core.b284NeuralIdentityDiagnostics();
  await core.observe({text:i%4===0?'Нужно проверить неизвестное и запомнить результат.':'Продолжай исследование и сохрани важное.'});
  await core.feedback({success:i%5===0?.84:.66,surprise:i%4===0?.12:.2});
}
const d=core.b284NeuralIdentityDiagnostics();
assert(d.steps>=18); assert(d.learningUpdates>=18); assert(d.autobiographicalContinuity01>.5); assert(d.identityStability01>.5); assert(d.identityRevision>=1); assert(d.identityRevision<10);
const snap=core.snapshot(); const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await restored.init();
assert.deepEqual(restored.b284NeuralIdentityDiagnostics(),d);
const ablation=restored.b284NeuralIdentityAblation(d.identityLatent); assert(ablation>=0);
console.log(JSON.stringify({pass:true,steps:d.steps,learningUpdates:d.learningUpdates,replayUpdates:d.replayUpdates,identityRevision:d.identityRevision,continuity01:d.autobiographicalContinuity01,stability01:d.identityStability01,personalityGrounding01:d.personalityGrounding01,ablationDrop01:ablation,restart:true}));
