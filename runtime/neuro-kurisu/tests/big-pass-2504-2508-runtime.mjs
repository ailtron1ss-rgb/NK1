import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const make=()=>new OrganismRuntime({stateFile:'/tmp/nk-b2508-runtime.json',stateStore:new MemoryStateStore(),enableLanguage:false,autoRun:false,intervalMs:30000,cycleResultMode:'full',performanceProfile:'balanced',enableB365FullPath:true,enableB2501DeepNeuralBranch:true,enableB2502EINeuralReplay:true,enableB2503ActionablePrediction:true,enableB2504UnifiedPredictiveField:true,enableB2505CompositionalReplay:true,enableB2506NeuralBottleneck:true,enableB2507ConsolidationScheduler:true,enableB2508AdaptiveCompute:true});
const r=make(); await r.init();
for(let t=0;t<8;t++) await r.autonomousStep({novelty:t%3/3,uncertainty:t%5/5,reward:t%2?.72:.34,embodiment:{bodyEnergy01:.72,cognitiveCapacity01:.8,thermalStrain01:.18,awake:true}});
const d={b2504:r.core.b2504UnifiedPredictiveDiagnostics(),b2505:r.core.b2505CompositionalReplayDiagnostics(),b2506:r.core.b2506NeuralBottleneckDiagnostics(),b2507:r.core.b2507ConsolidationDiagnostics(),b2508:r.core.b2508AdaptiveComputeDiagnostics()};
assert.ok(d.b2504.cycles>0&&d.b2504.learningUpdates>0&&d.b2504.rollouts>0); assert.ok(d.b2505.cycles>0&&d.b2505.learningUpdates>0); assert.ok(d.b2506.cycles>0); assert.ok(d.b2508.cycles>0); assert.ok(d.b2507.tick>0);
console.log(JSON.stringify({pass:true,status:'B2504_B2508_RUNTIME_PASS',diagnostics:d},null,2)); await r.stop();
