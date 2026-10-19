import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile'});
await core.init();
for(let i=0;i<160;i++){
  core.b270NeuralGerminalStep(Array.from({length:32},(_,j)=>Math.sin(i*.03+j*.13)*.7),Array.from({length:12},(_,j)=>Math.max(0,Math.sin(i*.05+j*.31)*.5+.5)),['respond','explore','verify','reflect'][i%4]);
  core.b270NeuralGerminalSnapshot();
  core.b269SpikingNeuralStep(Array.from({length:24},(_,j)=>Math.sin(i*.05+j*.2)*.7),['respond','explore','verify','reflect'][i%4]);
  core.b270NeuralGerminalDiagnostics();
  if(i%3===2){ const a=['respond','explore','verify','reflect'][i%4]; const e=Math.abs(Math.sin(i*.1))*.65; core.b269SpikingNeuralLearn(.35+.5*((i%13)/12),e,a); core.b270NeuralGerminalLearn(.35+.5*((i%13)/12),e,a); }
}
const d=core.b270NeuralGerminalDiagnostics();
assert.ok(d.cycles>0,'B270 not executed in core');
assert.ok(d.learningUpdates>0,'B270 did not learn from outcomes');
const bias=core.b270NeuralGerminalBias(d.proposedAction);
assert.ok(Number.isFinite(bias),'invalid B270 action bias');
const snap=core.snapshot();
const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile'});
await core2.init();
const d2=core2.b270NeuralGerminalDiagnostics();
assert.equal(d2.learningUpdates,d.learningUpdates,'B270 learning not persisted');
assert.equal(d2.cycles,d.cycles,'B270 cycle state not persisted');
console.log(JSON.stringify({pass:true,diagnostics:d,bias,restored:d2},null,2));
