import assert from 'node:assert/strict';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const store=new MemoryStateStore();
const core=new OrganismCore(store,{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1});
await core.init();
const before=core.p35Snapshot();
await core.p35Ingest({vision:{sceneLabel:'lab',confidence01:.88,objects:[{label:'microscope',kind:'object',confidence01:.9}]},audio:{events:[{label:'door-close',confidence01:.75}]},worldContext:{location:'lab',objects:[],events:['arrival']},body:{location:'lab',energy01:.8,thermal01:.12,capacity01:.9,awake:true}});
const after=core.p35Snapshot();
assert.ok(after.semanticUpdates>before.semanticUpdates);
assert.ok(after.entities.some(e=>e.label==='microscope'));
const cycle=await core.observe({text:'I am in the lab',worldContext:{tick:1,location:'lab',energy:.8,attention:.8,uncertainty:.2,facts:['lab'],objects:[],events:[]},vision:{features:[.1,.2,.3],confidence01:.9,sceneLabel:'lab',objects:[{label:'microscope',kind:'object',confidence01:.85}]},audio:{samples:[0,.1,-.1,.2],events:[{label:'door-close',confidence01:.8}]},embodiment:{bodyEnergy01:.8,cognitiveCapacity01:.9,thermalStrain01:.12,sensoryFreshness01:1,awake:true,battery01:.8,cpuLoad01:.2,ramPressure01:.2}});
assert.ok(cycle.decision.selected);
assert.ok(core.p35Snapshot().tick>=2);
await core.flush();
const saved=await store.load();
assert.ok(saved.facets.embodiment.p35.entities.length>=1);
console.log('P35_INTEGRATION=PASS',JSON.stringify({action:cycle.decision.selected.action,entities:core.p35Snapshot().entities.length,scene:core.p35Snapshot().scene.label}));
