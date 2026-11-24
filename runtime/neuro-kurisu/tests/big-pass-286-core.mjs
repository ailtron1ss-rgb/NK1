import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core.init();
for(let i=0;i<24;i++){
  await core.observe({text:i%4===0?'Обещание и будущие планы меняются из-за другого человека.':i%3===0?'Я должна решить, что сохранить в себе, а что изменить.':'Учитывай прошлый опыт и будущую себя.'});
  await core.feedback({success:i%7===0?.36:.78,surprise:i%5===0?.42:.12});
}
const d=core.b286SelfConflictDiagnostics(); assert(d.steps>=24); assert(d.relationCount>=1); assert(d.identityConflict01>=0); assert(d.valueIntegrity01>0); assert(d.revisionCount>0);
const snap=core.snapshot(); const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await restored.init(); assert.deepEqual(restored.b286SelfConflictDiagnostics(),d);
console.log(JSON.stringify({pass:true,steps:d.steps,learningUpdates:d.learningUpdates,revisionCount:d.revisionCount,relationCount:d.relationCount,identityConflict01:d.identityConflict01,valueIntegrity01:d.valueIntegrity01,selfContinuity01:d.selfContinuity01,futureCoherence01:d.futureCoherence01,personalityInfluence01:d.personalityInfluence01,restart:true}));
