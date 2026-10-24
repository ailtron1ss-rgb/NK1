import assert from 'node:assert/strict';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { PersonalCurriculumEngine } from '../src/organism/learning/PersonalCurriculumEngine.ts';

const store=new MemoryStateStore();
const core=new OrganismCore(store,{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableLanguage:false});
await core.init();
const goal={id:'curriculum-goal',title:'Поддерживать и улучшать переносимый способ исследования',reason:'личная история и социальная ответственность',source:'intrinsic',status:'active',importance:.9,urgency:.78,confidence:.66,progress:.12,createdAt:Date.now(),updatedAt:Date.now()};
const saved=await store.load(); saved.goals=[goal]; await store.save(saved);
const resumed=new OrganismCore(store,{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableLanguage:false});
await resumed.init();
for(let i=0;i<5;i++){
  const r=await resumed.observe({text:i%2?'помоги проверить и исследовать':'давай исследуем',novelty:.72,worldContext:{tick:i+1,location:`memory-lab-${i}`,energy:.8,attention:.8,uncertainty:.62,facts:['shared-context'],objects:[],events:[]}});
  assert.ok(r.decision.selected);
  // The core observation cycle itself updates developmental curriculum state.
  // Keep this persistence test focused on restart behavior; outcome/action binding
  // is covered by the dedicated P23 verified-feedback tests.
}
const d=resumed.personalCurriculumDiagnostics();
assert.ok(d.cycles>=5,JSON.stringify(d));
assert.ok(d.threads>=1,JSON.stringify(d));
assert.ok(d.curriculumPressure01>.25,JSON.stringify(d));
await resumed.flush();
const raw=await store.load();
assert.ok(raw.facets.learning.personalCurriculum);
const directRestore = new PersonalCurriculumEngine();
directRestore.restore(raw.facets.learning.personalCurriculum);
assert.ok(directRestore.diagnostics().cycles >= d.cycles,
  JSON.stringify({persisted: raw.facets.learning.personalCurriculum, direct: directRestore.diagnostics(), before: d}));
const restarted=new OrganismCore(store,{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableLanguage:false});
await restarted.init();
const d2=restarted.personalCurriculumDiagnostics();
assert.ok(d2.cycles>=d.cycles,JSON.stringify({before:d,after:d2}));
console.log(`BIG_PASS_122_CORE_CURRICULUM=PASS cycles=${d2.cycles} threads=${d2.threads} pressure=${d2.curriculumPressure01.toFixed(3)} focus=${d2.focusGoalId??'none'} persisted=true`);
