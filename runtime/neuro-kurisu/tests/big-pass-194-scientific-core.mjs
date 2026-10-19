import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { rm } from 'node:fs/promises';
const dir='/tmp/neuro-kurisu-b194-scientific-core'; await rm(dir,{recursive:true,force:true});
const stateFile=`${dir}/organism.json`, worldStateFile=`${dir}/world.json`;
const store=new FileStateStore(stateFile); const runtime=new OrganismRuntime({stateFile,worldStateFile,stateStore:store,enableLanguage:false}); await runtime.init();
for(let t=1;t<=18;t++){
  await runtime.core.observe({
    worldContext:{tick:t,location:'lab',energy:.74,attention:.71,uncertainty:.4+(t%4)*.06,facts:['anomaly'],objects:[{id:`o${t}`,label:'target',location:'lab',value:.5,visible:true,collected:false}],events:['anomaly']},
    embodiment:{bodyEnergy01:.74,cognitiveCapacity01:.71,thermalStrain01:.2+(t%3)*.06,sensoryFreshness01:.66,awake:true,battery01:.74,cpuLoad01:.2,ramPressure01:.2},
    vision:{features:[.7,.2,.4],confidence01:.9,sceneLabel:'lab',objects:[{label:'target',kind:'object',confidence01:.88,x:.2,y:.4,z:.1}]},
    audio:{samples:[.1,.3,.7,.2],confidence01:.9,events:[{label:'anomaly',confidence01:.9}]}
  });
  await runtime.core.feedback({success:.72+(t%5)*.04,reward:.68+(t%4)*.05,surprise:.18+(t%3)*.05,notes:'scientific-core integration'});
}
for(let i=0;i<12;i++) runtime.core.autonomousScientificBrainDecideCurrent();
const proposal=runtime.core.p38Propose();
assert.ok(proposal,'p38 proposal should remain callable through the real core');
const trial=runtime.core.p38RunSandbox(proposal.id,42);
assert.ok(trial,'p38 sandbox should feed the scientific brain through the public core path');
const d=runtime.core.autonomousScientificBrainDiagnostics();
assert.ok(d.cycles>0);
assert.ok(d.samples>=1);
const snap=runtime.core.snapshot();
assert.ok(snap.facets.learning.autonomousScientificBrain);
await runtime.core.flush();
const saved=await store.load();
assert.ok(saved?.facets?.learning?.autonomousScientificBrain);
const parsed=saved.facets.learning.autonomousScientificBrain;
assert.equal(parsed.version,1);
console.log(`B194_SCIENTIFIC_CORE=PASS cycles=${d.cycles} samples=${d.samples} accepted=${d.acceptedUpdates} rejected=${d.rejectedUpdates} priority=${d.lastDecision?.priority01?.toFixed(3) ?? 'n/a'}`);
