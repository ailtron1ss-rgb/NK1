import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const runtime=new OrganismRuntime({stateFile:'/tmp/nk-b2515-runtime.json',stateStore:new MemoryStateStore(),enableLanguage:false,autoRun:false,intervalMs:30000,cycleResultMode:'full',performanceProfile:'mobile'});
await runtime.init();
for(let i=0;i<8;i++) await runtime.autonomousStep({novelty:i%3/2,uncertainty:.35+.05*(i%4),reward:i%2?.76:.34,embodiment:{bodyEnergy01:.72,cognitiveCapacity01:.81,thermalStrain01:.16,sensoryFreshness01:.84,awake:true,battery01:.76,cpuLoad01:.22,ramPressure01:.20}});
const d={b2515:runtime.core.b2515UnifiedOrganismLatentDiagnostics(),b2516:runtime.core.b2516CausalAutobiographicalDiagnostics(),b2517:runtime.core.b2517SelfAuthoredRuleDiagnostics()};
assert(d.b2515.cycles>0); assert(d.b2516.cycles>0); assert(d.b2515.learningUpdates>0); await runtime.stop(); console.log('B2515_B2517_RUNTIME_PASS',JSON.stringify({b2515Cycles:d.b2515.cycles,b2515Learning:d.b2515.learningUpdates,b2515Precision:d.b2515.precision01,b2516Cycles:d.b2516.cycles,b2516Learning:d.b2516.learningUpdates,b2516Edges:d.b2516.edges,b2517Cycles:d.b2517.cycles,b2517Rules:d.b2517.rulesCompiled,b2517Authorship:d.b2517.selfAuthorship01}));
