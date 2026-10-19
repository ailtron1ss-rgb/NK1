import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const runtime=new OrganismRuntime({stateFile:'/tmp/nk-b2522-runtime.json',stateStore:new MemoryStateStore(),enableLanguage:false,autoRun:false,intervalMs:30000,cycleResultMode:'full',performanceProfile:'mobile'});
await runtime.init();
for(let i=0;i<6;i++){
  await runtime.autonomousStep({novelty:.18+.03*(i%9),uncertainty:.28+.04*(i%7),reward:i%4===0?.82:.42,embodiment:{bodyEnergy01:.70,cognitiveCapacity01:.82,thermalStrain01:.18,sensoryFreshness01:.86,awake:true,battery01:.74,cpuLoad01:.24,ramPressure01:.22}});
}
const d=runtime.core.neuralExperienceBranchDiagnostics();
assert(d.cycles>=6,'unified neural branch was not executed by runtime');
assert(d.learningUpdates>0,'unified neural branch did not learn');
assert(d.replayBuffer.length>0,'experience memory was not populated');
assert(d.pressure.length===6,'pressure field contract broken');
const lesion=runtime.core.neuralExperienceBranchLesion(.35);
assert(Number.isFinite(lesion.causalDrop01),'causal lesion produced invalid evidence');
runtime.stop();
console.log('B2522_RUNTIME_INTEGRATION_PASS',JSON.stringify({cycles:d.cycles,learningUpdates:d.learningUpdates,replay:d.replayBuffer.length,pressure:d.pressure,coherence01:d.coherence01,generalization01:d.generalization01,causalDrop01:lesion.causalDrop01}));
