import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
const out=path.resolve('research/results/p6-evolution-lab.json');
const conditions=[
  {name:'baseline',config:{}},
  {name:'no-self-projects',config:{enableSelfProjects:false}},
  {name:'no-agency',config:{enableAgencyModel:false}},
  {name:'no-value-evolution',config:{enableValueEvolution:false}},
  {name:'no-identity-trajectory',config:{enableIdentityTrajectory:false}},
];
const rows=[];
for(const c of conditions){
  const mem={value:null}; const store={ load:async()=>mem.value?structuredClone(mem.value):null, save:async v=>{mem.value=structuredClone(v);} };
  const core=new OrganismCore(store,c.config); await core.init();
  await core.beginBatch();
  try { for(let i=0;i<42;i++){ await core.observe({text:i%7===0?'Проверь собственную гипотезу и выбери следующий шаг.':undefined, externalGoal:i%7===0?{title:'self-directed test',importance:.65,urgency:.4}:undefined, worldContext:{tick:i,location:'lab',energy:.7,attention:.8,uncertainty:.5,facts:['stable-simulation'],objects:[],events:[]}}); await core.feedback({success:.74,surprise:i%5===0?.68:.48,reward:.7,notes:'P6 research'}); } } finally { await core.endBatch(); }
  const s=core.snapshot(); rows.push({condition:c.name,cycles:s.state.tick,projects:s.facets.evolution.selfProjects.projects.length,agency:s.facets.evolution.agency.records.length,revisions:s.facets.evolution.valueEvolution.revisions.length,trajectorySamples:s.facets.evolution.identityTrajectory.samples,authorship:s.facets.evolution.selfProjects.authorshipScore});
}
const base=rows[0];
if(base.projects<1) throw new Error('baseline self-project generation missing');
if(rows.find(r=>r.condition==='no-self-projects').projects!==0) throw new Error('self-project lesion failed');
if(rows.find(r=>r.condition==='no-agency').agency!==0) throw new Error('agency lesion failed');
if(rows.find(r=>r.condition==='no-value-evolution').revisions!==0) throw new Error('value evolution lesion failed');
if(rows.find(r=>r.condition==='no-identity-trajectory').trajectorySamples!==0) throw new Error('identity trajectory lesion failed');
await writeFile(out,JSON.stringify({generatedAt:new Date().toISOString(),conditions:rows,caveats:['Functional causal evidence, not subjective consciousness.','Synthetic environment; physical Android longitudinal evidence remains separate.']},null,2));
console.log('P6_EVOLUTION_LAB=PASS', JSON.stringify({baseline:base,lesions:rows.slice(1).map(r=>({condition:r.condition,projects:r.projects,agency:r.agency,revisions:r.revisions,trajectorySamples:r.trajectorySamples}))}));
