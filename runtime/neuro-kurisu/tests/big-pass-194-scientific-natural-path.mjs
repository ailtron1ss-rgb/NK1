import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { rm } from 'node:fs/promises';
const dir='/tmp/nk-b194-natural-path'; await rm(dir,{recursive:true,force:true});
const stateFile=`${dir}/organism.json`,worldStateFile=`${dir}/world.json`; const store=new FileStateStore(stateFile);
const runtime=new OrganismRuntime({stateFile,worldStateFile,stateStore:store,enableLanguage:false}); await runtime.init();
for(let t=1;t<=40;t++){
 await runtime.core.observe({worldContext:{tick:t,location:'lab',energy:.76,attention:.72,uncertainty:.4+(t%5)*.06,facts:['anomaly'],objects:[{id:`o${t}`,label:'target',location:'lab',value:.5,visible:true,collected:false}],events:['anomaly']},embodiment:{bodyEnergy01:.76,cognitiveCapacity01:.72,thermalStrain01:.22+(t%4)*.05,sensoryFreshness01:.68,awake:true,battery01:.76,cpuLoad01:.2,ramPressure01:.21},vision:{features:[.7,.2,.4],confidence01:.9,sceneLabel:'lab',objects:[{label:'target',kind:'object',confidence01:.88,x:.2,y:.4,z:.1}]},audio:{samples:[.1,.3,.7,.2],confidence01:.9,events:[{label:'anomaly',confidence01:.9}]}});
 await runtime.core.feedback({success:.74+(t%4)*.04,reward:.70+(t%3)*.05,surprise:.20+(t%4)*.03,notes:'natural scientific path'});
}
const d=runtime.core.autonomousScientificBrainDiagnostics(); assert.equal(d.cycles,40); assert.ok(d.lastDecision); assert.equal(d.samples,0);
await runtime.core.flush(); const saved=await store.load(); assert.ok(saved?.facets?.learning?.autonomousScientificBrain); assert.equal(saved.facets.learning.autonomousScientificBrain.cycles,40);
console.log(`B194_NATURAL_SCIENCE_DECISION=PASS cycles=${d.cycles} decisionDomain=${d.lastDecision.domain} action=${d.lastDecision.action} samples=${d.samples}`);
