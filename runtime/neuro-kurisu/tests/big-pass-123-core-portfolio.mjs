import assert from 'node:assert/strict';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const store=new MemoryStateStore();
const core=new OrganismCore(store,{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableLanguage:false});
await core.init();
const saved=await store.load();
saved.goals=[
{id:'portfolio-social',title:'Понимать и поддерживать отношения',reason:'social connection and learning',source:'intrinsic',status:'active',importance:.75,urgency:.62,confidence:.58,progress:.18,createdAt:Date.now(),updatedAt:Date.now()},
{id:'portfolio-world',title:'Улучшать модель мира через проверку',reason:'research evidence',source:'learned',status:'active',importance:.72,urgency:.57,confidence:.54,progress:.14,createdAt:Date.now(),updatedAt:Date.now()}
];
await store.save(saved);
const resumed=new OrganismCore(store,{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableLanguage:false});
await resumed.init();
for(let i=0;i<6;i++){
 const r=await resumed.observe({text:i%2?'помоги разобраться с этим вместе':'давай проверим гипотезу',novelty:.64,worldContext:{tick:i+20,location:`portfolio-${i%3}`,energy:.78,attention:.82,uncertainty:.63,facts:['shared-evidence'],objects:[{id:'obj',label:'test-object'}],events:[{id:`e${i}`,kind:'interaction'}]}});
 assert.ok(r.decision.selected);
 await resumed.feedback({success:i<4?.72:.68,reward:.69,surprise:.16});
}
const d=resumed.developmentalPortfolioDiagnostics();
assert.ok(d.cycles>=6,JSON.stringify(d));
assert.ok(d.topDomains.length===3,JSON.stringify(d));
await resumed.flush();
const raw=await store.load();
assert.ok(raw.facets.learning.developmentalPortfolio);
const restarted=new OrganismCore(store,{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableLanguage:false});
await restarted.init();
const d2=restarted.developmentalPortfolioDiagnostics();
assert.ok(d2.cycles>=d.cycles,JSON.stringify({before:d,after:d2}));
console.log(`BIG_PASS_123_CORE_PORTFOLIO=PASS cycles=${d2.cycles} selected=${d2.selectedDomain} allocation=${d2.allocation01.toFixed(3)} persisted=true`);
