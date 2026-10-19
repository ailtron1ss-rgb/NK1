import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});
await core.init();
for(let i=0;i<3;i++){
  await core.observe({text:i===0?'explore an unfamiliar object':'verify the previous result',novelty:.55,uncertainty:.35,embodiment:{awake:true,bodyEnergy01:.82,cognitiveCapacity01:.72,thermalStrain01:.18,sensoryFreshness01:.7,battery01:.82,cpuLoad01:.25,ramPressure01:.22}},'operational');
}
const d=core.b349NeuralDevelopmentalDiagnostics();
assert.equal(d.version,1);
assert(d.cycles>0);
assert(Number.isFinite(d.lastNeuralContribution01));
const snap=core.snapshot();
assert(snap.system.b349NeuralDevelopmentalSpine);
const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'});
await core2.init();
const restored=core2.b349NeuralDevelopmentalDiagnostics();
assert.equal(restored.cycles,d.cycles);
console.log(JSON.stringify({pass:true,b349:d,restoredCycles:restored.cycles,tick:snap.state.tick},null,2));
