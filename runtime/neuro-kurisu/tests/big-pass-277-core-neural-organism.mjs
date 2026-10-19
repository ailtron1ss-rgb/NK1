import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});await core.init();
for(let i=0;i<18;i++){await core.observe({text:i%2?'Build a new internal operator from a useful verified program and test it.':'Compare existing abilities and discover a new way to reach the current goal.',novelty:.58+(i%4)*.06,surprise:.18+(i%3)*.07,embodiment:{bodyEnergy01:.88-i*.012,cognitiveCapacity01:.83,thermalStrain01:.17,sensoryFreshness01:.9,awake:true,battery01:.76,cpuLoad01:.22,ramPressure01:.2}},'operational');await core.feedback({success:i%5===0?.78:.69,reward:i%3===0?.74:.63,surprise:.15+(i%4)*.055,evidenceSource:'unknown'});}
const d=core.b277NeuralOperatorDiagnostics();assert.ok(d.cycles>=18);assert.ok(d.operatorGenerations>=1);assert.ok(d.learningUpdates>=1);assert.ok(d.neuralSparsity01>.45);assert.ok(d.selfGrounding01>.45);
const snap=core.snapshot();const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'});await core2.init();assert.deepEqual(core2.b277NeuralOperatorDiagnostics(),d);
console.log(JSON.stringify({pass:true,diagnostics:d,restored:core2.b277NeuralOperatorDiagnostics(),personality:core.personalitySummary()},null,2));
