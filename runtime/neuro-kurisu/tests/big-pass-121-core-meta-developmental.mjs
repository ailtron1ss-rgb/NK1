import assert from 'node:assert/strict';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const store=new MemoryStateStore();
const core=new OrganismCore(store,{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableLanguage:false});
await core.init();
const first=await core.observe({text:'исследуй новую закономерность и проверь её',novelty:.82,worldContext:{tick:1,location:'lab',energy:.82,attention:.82,uncertainty:.7,facts:['sensor stable'],objects:[{id:'sensor',label:'sensor',location:'lab',value:.7,visible:true,collected:false}],events:[]}});
assert.ok(first.decision.selected);
await core.feedback({success:.84,reward:.82,surprise:.08,worldTransition:{action:first.decision.selected.action,before:{tick:1,location:'lab',energy:.82,attention:.82,uncertainty:.7,facts:['sensor stable'],objects:[],events:[]},after:{tick:2,location:'lab-2',energy:.79,attention:.8,uncertainty:.4,facts:['sensor stable','verified'],objects:[],events:['transition']},reward:.82,surprise:.08,at:Date.now()}});
const saved=await store.load();
saved.goals=[{id:'meta-goal',title:'Освоить переносимый способ исследования',reason:'meta curriculum',source:'intrinsic',status:'active',importance:.9,urgency:.82,confidence:.84,progress:0,createdAt:Date.now(),updatedAt:Date.now()},...(saved.goals??[])];
await store.save(saved);
const restored=new OrganismCore(store,{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableLanguage:false});
await restored.init();
for(let i=0;i<3;i++){
  const r=await restored.observe({novelty:.6+i*.04,worldContext:{tick:4+i,location:`lab-${i+3}`,energy:.76,attention:.78,uncertainty:.55,facts:['new-context'],objects:[],events:[]}});
  assert.ok(r.decision.selected);
  await restored.feedback({success:.78+i*.03,reward:.76+i*.03,surprise:.15});
}
const diag=restored.metaDevelopmentalDiagnostics();
assert.ok(diag.cycles>=3,JSON.stringify(diag));
assert.ok(Array.isArray(diag.agenda));
assert.ok(diag.focusGoalId==='meta-goal' || diag.agenda.some(x=>x.goalId==='meta-goal'));
await restored.flush();
const saved2=await store.load();
assert.ok(saved2.facets.learning.metaDevelopmental);
assert.ok(saved2.facets.learning.metaDevelopmental.cycles>=1);
const core2=new OrganismCore(store,{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableLanguage:false});
await core2.init();
const d2=core2.metaDevelopmentalDiagnostics();
assert.ok(d2.cycles>=diag.cycles,JSON.stringify({before:diag,after:d2}));
console.log(`BIG_PASS_121_CORE=PASS cycles=${d2.cycles} agenda=${d2.agenda.length} focus=${d2.focusGoalId??'none'} allocation=${d2.learningAllocation01.toFixed(3)} persisted=true`);
