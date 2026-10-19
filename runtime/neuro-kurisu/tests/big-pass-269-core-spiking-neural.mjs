import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile'});
await core.init();
const vec=Array.from({length:24},(_,i)=>Math.sin(i*.31)*.6);
for(let i=0;i<180;i++){
  core.b269SpikingNeuralStep(vec.map((v,j)=>v+Math.sin(i*.08+j*.11)*.08),['respond','explore','verify','reflect'][i%4]);
  if(i%2===1) core.b269SpikingNeuralLearn(.3+.55*((i%11)/10),Math.abs(Math.sin(i*.13))*.6,['respond','explore','verify','reflect'][i%4]);
}
const d=core.b269SpikingNeuralDiagnostics();
const lesion=core.b269SpikingNeuralLesion(.30);
assert.ok(d.spikeRate01>0 && d.synapticUpdates>0);
assert.ok(d.sparsity01>.65 && d.homeostaticError01<.25);
const snap=core.snapshot();
const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile'});
await core2.init();
const d2=core2.b269SpikingNeuralDiagnostics();
assert.equal(d2.synapticUpdates,d.synapticUpdates);
assert.equal(d2.historyLength,d.historyLength);
console.log(JSON.stringify({pass:true,diagnostics:d,lesion,restored:d2},null,2));
