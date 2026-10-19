import assert from 'node:assert/strict';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
const store=new MemoryStateStore();
const core=new OrganismCore(store,{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableLanguage:false});
await core.init();
const saved=await store.load();
saved.goals=[
{id:'life-social',title:'Поддерживать отношения и лучше понимать собеседника',reason:'social continuity',source:'social',status:'active',importance:.82,urgency:.65,confidence:.62,progress:.2,createdAt:1,updatedAt:1},
{id:'life-research',title:'Проверять неизвестное и строить более точную модель мира',reason:'research learning',source:'learned',status:'active',importance:.8,urgency:.54,confidence:.61,progress:.16,createdAt:1,updatedAt:1},
{id:'life-self',title:'Развивать собственную автономность и идентичность',reason:'self identity development',source:'intrinsic',status:'active',importance:.76,urgency:.44,confidence:.7,progress:.28,createdAt:1,updatedAt:1}
];
await store.save(saved);
const run=new OrganismCore(store,{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableLanguage:false});
await run.init();
for(let i=0;i<8;i++){
 const text=i%2?'давай проверим новую гипотезу':'помоги мне разобраться и сделать это вместе';
 const r=await run.observe({text,novelty:.62+((i%3)*.05),worldContext:{tick:i+10,location:`life-${i%4}`,energy:.74,attention:.82,uncertainty:.59+(i%2*.08),facts:['persistent-world'],objects:[{id:`o${i%2}`,label:'context-object',visible:true}],events:[{id:`e${i}`,kind:'experience'}]}});
 assert.ok(r.decision.selected);
 await run.feedback({success:i<6?.76:.71,reward:.72,surprise:i===5?.34:.16});
}
const d=run.lifeCourseDiagnostics();
assert.ok(d.cycles>=8,JSON.stringify(d));
assert.ok(d.projectionCount>=3,JSON.stringify(d));
assert.ok(['immediate','near','long','identity'].includes(d.focusHorizon),JSON.stringify(d));
assert.ok(d.conflictCount>=0);
await run.flush();
const raw=await store.load();
assert.ok(raw.facets.learning.lifeCourseNavigator);
const restored=new OrganismCore(store,{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableLanguage:false});
await restored.init();
const d2=restored.lifeCourseDiagnostics();
assert.ok(d2.cycles>=d.cycles);
console.log(`BIG_PASS_124_CORE=PASS cycles=${d2.cycles} focus=${d2.focusGoalId} horizon=${d2.focusHorizon} projections=${d2.projectionCount} conflicts=${d2.conflictCount} persistence=true`);
