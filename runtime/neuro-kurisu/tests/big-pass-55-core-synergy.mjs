import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core=new OrganismCore(new MemoryStateStore(),{enableLanguage:false,checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:64});
await core.init();
await core.observe({
  text:'Проверь изменение сцены',
  worldContext:{tick:1,location:'lab',energy:.8,attention:.75,uncertainty:.72,facts:['observed:person:present'],objects:[{id:'person-1',label:'person',location:'lab',value:.9,visible:true,collected:false,evidenceKind:'observed',sourceId:'sensor'}],events:['person-entered']},
  vision:{features:new Array(16).fill(.2),width:32,height:32,confidence01:.76,sceneLabel:'lab',objects:[{label:'person',kind:'person',confidence01:.82}],relations:[]},
  embodiment:{bodyEnergy01:.8,cognitiveCapacity01:.85,thermalStrain01:.2,sensoryFreshness01:.9,awake:true,battery01:.8,cpuLoad01:.2,ramPressure01:.2},
});
const p1=core.cognitivePressureSnapshot();
const before=core.p27Snapshot().world.updates;
await core.observe({
  worldContext:{tick:2,location:'lab',energy:.78,attention:.73,uncertainty:.65,facts:['observed:person:present'],objects:[{id:'person-1',label:'person',location:'lab',value:.9,visible:true,collected:false,evidenceKind:'observed',sourceId:'sensor'}],events:['person-moved']},
  vision:{features:new Array(16).fill(.35),width:32,height:32,confidence01:.74,sceneLabel:'lab',objects:[{label:'person',kind:'person',confidence01:.78}],relations:[]},
  embodiment:{bodyEnergy01:.78,cognitiveCapacity01:.84,thermalStrain01:.22,sensoryFreshness01:.86,awake:true,battery01:.79,cpuLoad01:.21,ramPressure01:.22},
});
const p2=core.cognitivePressureSnapshot();
const after=core.p27Snapshot().world.updates;
const gw=core.groundedWorldSummary();
assert(p2.total01>=0&&p2.total01<=1);
assert(p2.informationUrgency01>0);
assert(after>before);
assert(gw.entities>=1&&gw.facts>=1);
console.log('BIG_PASS_55_CORE_SYNERGY=PASS',JSON.stringify({pressure1:p1.total01,pressure2:p2.total01,urgency:p2.informationUrgency01,p27Updates:[before,after],grounded:gw}));
