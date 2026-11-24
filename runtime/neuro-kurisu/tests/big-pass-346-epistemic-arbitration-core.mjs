import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const cfg={performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:false,operationalPulseEvery:1,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000};
const core=new OrganismCore(new MemoryStateStore(),cfg); await core.init();
const obs={embodiment:{bodyEnergy01:.84,cognitiveCapacity01:.86,thermalStrain01:.18,sensoryFreshness01:.88,awake:true,battery01:.82,cpuLoad01:.22,ramPressure01:.2}};
let last=null;
for(let i=0;i<12;i++){
  last=await core.observeOperational({...obs,surprise:i%3===0?.44:.18,novelty:i%4===0?.58:.22});
  await core.feedback({reward:i%3===0?.62:.66,surprise:i%3===0?.44:.18,notes:'b346-epistemic-runtime'});
}
const d=core.decisionActionPipelineDiagnostics?.();
assert(d && Array.isArray(d.lastEpistemic));
assert(d.lastEpistemic.length>0);
assert(d.epistemicActiveCount>=0);
console.log('B346_CORE_EPISTEMIC=PASS',JSON.stringify({cycles:12,selected:last?.decision?.selected?.action??null,epistemicActiveCount:d.epistemicActiveCount,lastEpistemic:d.lastEpistemic},null,2));
