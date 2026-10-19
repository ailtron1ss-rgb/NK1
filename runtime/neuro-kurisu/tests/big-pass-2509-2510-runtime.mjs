import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const runtime=new OrganismRuntime({stateFile:'/tmp/nk-b2509-runtime.json',stateStore:new MemoryStateStore(),enableLanguage:false,autoRun:false,intervalMs:30000,cycleResultMode:'full',performanceProfile:'balanced',enableB365FullPath:true,enableB2501DeepNeuralBranch:true,enableB2502EINeuralReplay:true,enableB2503ActionablePrediction:true,enableB2504UnifiedPredictiveField:true,enableB2505CompositionalReplay:true,enableB2506NeuralBottleneck:true,enableB2507ConsolidationScheduler:true,enableB2508AdaptiveCompute:true,enableB2509EmbodiedHomeostasis:true,enableB2510DevelopmentalPersonality:true});
await runtime.init();
for(let t=0;t<10;t++) await runtime.autonomousStep({novelty:(t%4)/4,uncertainty:(t%5)/5,reward:t%2?.74:.32,embodiment:{bodyEnergy01:.72,cognitiveCapacity01:.81,thermalStrain01:.16+.01*(t%3),sensoryFreshness01:.84,awake:true,battery01:.76,cpuLoad01:.22,ramPressure01:.20}});
const d9=runtime.core.b2509EmbodiedHomeostasisDiagnostics(),d10=runtime.core.b2510DevelopmentalPersonalityDiagnostics(),d6=runtime.core.b2506NeuralBottleneckDiagnostics();
assert.ok(d9.cycles>0&&d9.learningUpdates>0); assert.ok(d10.samples>0); assert.ok(d6.cycles>0);
console.log(JSON.stringify({pass:true,status:'B2509_B2510_RUNTIME_PASS',b2509:d9,b2510:d10,b2506:d6},null,2)); await runtime.stop();
