import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { rm } from 'node:fs/promises';
const dir='/tmp/neuro-kurisu-p38-integration'; await rm(dir,{recursive:true,force:true});
const stateFile=`${dir}/organism.json`; const worldStateFile=`${dir}/world.json`;
const store=new FileStateStore(stateFile);
const runtime=new OrganismRuntime({stateFile,worldStateFile,stateStore:store,enableLanguage:false}); await runtime.init();
await runtime.core.observe({
  worldContext:{tick:1,location:'lab',energy:.72,attention:.74,uncertainty:.15,facts:['sensor conflict'],objects:[{id:'d1',label:'door',location:'lab',value:.5,visible:true,collected:false}],events:['anomaly']},
  embodiment:{bodyEnergy01:.72,cognitiveCapacity01:.74,thermalStrain01:.33,sensoryFreshness01:.6,awake:true,battery01:.72,cpuLoad01:.24,ramPressure01:.22},
  vision:{features:[.7,.2,.4],confidence01:.92,sceneLabel:'lab',objects:[{label:'door',kind:'object',confidence01:.5,x:.2,y:.4,z:.1}]},
  audio:{samples:[.1,.3,.7,.2],confidence01:.92,events:[{label:'anomaly',confidence01:.92}]}
});
const before=runtime.core.p38Diagnostics();
const proposal=runtime.core.p38Propose();
assert.ok(proposal,'runtime should expose an autonomous research proposal');
const trial=runtime.core.p38RunSandbox(proposal.id,7);
assert.ok(trial,'runtime should execute the proposed bounded sandbox trial');
assert.equal(trial.runs,3);
assert.equal(trial.independent,false);
assert.equal(trial.replicaDeltas.length,3);
assert.ok(trial.replicationConsistency01>=2/3);
await runtime.core.feedback({success:.84,reward:.8,surprise:.2,notes:'successful sandbox-relevant outcome'});
const after=runtime.core.p38Diagnostics();
assert.ok(after.cycles>=before.cycles);
assert.ok(after.trials>=1);
const snap=runtime.core.snapshot();
assert.ok(snap.facets.learning.p38);
await runtime.core.flush();
const saved=await store.load();
assert.ok(saved?.facets.learning.p38);
console.log(`P38_INTEGRATION=PASS hypotheses=${after.hypotheses} trials=${after.trials} evidence=${after.evidence}`);
