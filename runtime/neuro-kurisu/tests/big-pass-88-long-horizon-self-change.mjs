import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const mk=async()=>{const c=new OrganismCore(new MemoryStateStore(),{cycleResultMode:'operational',enableLanguage:false,checkpointMinIntervalMs:0}); await c.init(); return c;};
const a=await mk(), b=await mk();
const sa=a.snapshot(), sb=b.snapshot();
const mkRev=(value,before,after,id)=>({id,value,before,after,delta:after-before,success:.94,surprise:.82,at:1000});
a.applyVerifiedValueRevision(mkRev('curiosity',sa.facets.memory.adaptiveValues.curiosity,.995,'h88-a-curiosity'));
a.applyVerifiedValueRevision(mkRev('autonomy',sa.facets.memory.adaptiveValues.autonomy,.99,'h88-a-autonomy'));
b.applyVerifiedValueRevision(mkRev('curiosity',sb.facets.memory.adaptiveValues.curiosity,.66,'h88-b-curiosity'));
b.applyVerifiedValueRevision(mkRev('autonomy',sb.facets.memory.adaptiveValues.autonomy,.72,'h88-b-autonomy'));
let observed=false;
for(let i=0;i<8;i++){
  const obs={worldContext:{location:'development-lab',objects:[{label:'uncertainty',visible:true}],events:[{label:'new-evidence',confidence:.9}]},novelty:.72};
  const ra=await a.observe(obs,'operational');
  const rb=await b.observe(obs,'operational');
  const ga=ra.goals.find(g=>g.title.includes('собственный эксперимент')) ?? ra.goals[1];
  const gb=rb.goals.find(g=>g.title.includes('собственный эксперимент')) ?? rb.goals[1];
  if(ga&&gb && Math.abs((ga.importance??0)-(gb.importance??0))>.0005) observed=true;
}
const va=a.snapshot().facets.memory.adaptiveValues;
const vb=b.snapshot().facets.memory.adaptiveValues;
assert.notEqual(va.curiosity,vb.curiosity);
assert.notEqual(va.autonomy,vb.autonomy);
const au=a.snapshot().facets.learning.selfAuthorship.revisions.length;
const bu=b.snapshot().facets.learning.selfAuthorship.revisions.length;
assert.ok(au>=1 && bu>=1,'both histories must preserve authored self-change');
assert.ok(observed,'same future context should expose downstream goal-priority divergence');
console.log(`BIG_PASS_88_LONG_HORIZON=PASS goalDivergence=${observed} authoredA=${au} authoredB=${bu}`);
