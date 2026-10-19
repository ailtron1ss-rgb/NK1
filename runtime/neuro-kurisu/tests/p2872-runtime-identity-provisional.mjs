import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core = new OrganismCore(new MemoryStateStore(), { performanceProfile:'mobile', cycleResultMode:'operational' });
await core.init();
for (let i=0;i<18;i++) {
  await core.observe({text:i%4===0?'Проверь и сохрани результат.':'Продолжай исследование.'});
  await core.feedback({success:i%5===0?.84:.66,surprise:i%4===0?.12:.2});
}
const d=core.b284NeuralIdentityDiagnostics();
assert(d.identityRevision>=1);
assert(d.revisionCooldownUntilTick>0);
const snap=core.snapshot();
const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'});
await restored.init();
assert.deepEqual(restored.b284NeuralIdentityDiagnostics(),d);
console.log(`P2872_RUNTIME_IDENTITY_PROVISIONAL=PASS revision=${d.identityRevision} steps=${d.steps} cooldown=${d.revisionCooldownUntilTick}`);
