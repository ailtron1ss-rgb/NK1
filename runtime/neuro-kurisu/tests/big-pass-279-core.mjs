import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const store=new MemoryStateStore();
const core=new OrganismCore(store,{performanceProfile:'mobile',checkpointMinIntervalMs:60000});
await core.init();
for(let i=0;i<14;i++){
  core.b279NeuralAttractorStep({tick:i,vector:Array.from({length:16},(_,j)=>Math.tanh(Math.sin((i+2)*(j+1)*.3))),goalVector:Array.from({length:8},(_,j)=>Math.tanh(Math.cos((i+1)*(j+1)))),selfLatent:Array(8).fill(.1),worldLatent:Array.from({length:8},(_,j)=>j%2?.5:-.3),novelty01:.35,uncertainty01:.2,autonomy01:.7,action:i%2?'explore':'verify'});
  core.b279NeuralAttractorLearn({tick:i,reward01:i%3===0?.72:.58,predictionError01:.2,action:i%2?'explore':'verify',externalEvidence01:.8});
}
const d=core.b279NeuralAttractorDiagnostics();
assert.ok(d.learningUpdates>=14,'core should learn');
assert.ok(d.consolidationCount>=0);
const snap=core.snapshot();
const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',checkpointMinIntervalMs:60000});
await restored.init();
assert.deepEqual(restored.b279NeuralAttractorDiagnostics(),d,'core restart diagnostics');
console.log(JSON.stringify({ok:true,diagnostics:d},null,2));
