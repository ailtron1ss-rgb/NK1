import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const make=(mode)=>new OrganismRuntime({stateFile:`/tmp/b2503-${mode}.json`,stateStore:new MemoryStateStore(),enableB365FullPath:true,enableB2501DeepNeuralBranch:true,enableB2502EINeuralReplay:mode!=='b2502-off',enableB2503ActionablePrediction:mode!=='b2503-off',cycleResultMode:'full',performanceProfile:'mobile',enableLanguage:false,autoRun:false,intervalMs:30000});
const on=make('on'), no2502=make('b2502-off'), no2503=make('b2503-off');
await on.init(); await no2502.init(); await no2503.init();
for(let t=0;t<6;t++){
  const o={novelty:t%3/3,uncertainty:t%4/4,reward:t%2?.72:.38,embodiment:{bodyEnergy01:.7,cognitiveCapacity01:.75,thermalStrain01:.2,awake:true}};
  await on.autonomousStep(o); await no2502.autonomousStep(o); await no2503.autonomousStep(o);
}
const a2=on.core.b2502EINeuralReplayDiagnostics(),a3=on.core.b2503ActionablePredictiveDiagnostics();
const b2=no2502.core.b2502EINeuralReplayDiagnostics(),b3=no2503.core.b2503ActionablePredictiveDiagnostics();
assert.ok(a2.cycles>=6&&a2.learningUpdates>0&&a2.prototypeCreates>0); assert.ok(a3.cycles>=6&&a3.rollouts>0&&a3.learningUpdates>0);
assert.equal(b2.cycles,0); assert.equal(b3.cycles,0);
console.log(JSON.stringify({pass:true,status:'B2503_RUNTIME_CAUSAL_PASS',on:{b2502:a2,b2503:a3},disabled:{b2502:b2.cycles,b2503:b3.cycles}},null,2));
