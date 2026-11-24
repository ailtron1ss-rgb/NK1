import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const cfg={performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:false,operationalPulseEvery:1,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000};
const core=new OrganismCore(new MemoryStateStore(),cfg); await core.init();
const obs={embodiment:{bodyEnergy01:.84,cognitiveCapacity01:.86,thermalStrain01:.18,sensoryFreshness01:.88,awake:true,battery01:.82,cpuLoad01:.22,ramPressure01:.2}};
let learned=0, rehearsalSamples=0, last=null;
for(let i=0;i<14;i++){
  const r=await core.observeOperational({...obs,surprise:i%4===0?.34:.12,novelty:i%5===0?.48:.18});
  last=r;
  await core.feedback({reward:i%3===0?.82:.64,surprise:i%4===0?.34:.12,notes:'b345-runtime-outcome'});
  const d=core.b299CausalPersonalityDiagnostics();
  learned=d.learningUpdates;
  rehearsalSamples += core.decisionActionPipelineDiagnostics?.().rehearsal?.length ?? 0;
}
assert(learned>=10,'B299 did not receive real runtime learning');
const snap=core.snapshot();
const p=snap.system.causalPersonalityDevelopmentB299.actionPhenotypes;
assert(p.some(x=>x.samples>0),'No learned action phenotype reached persistence state');
console.log(JSON.stringify({pass:true,learningUpdates:learned,lastSelected:last?.decision?.selected?.action??null,diagnostics:core.b299CausalPersonalityDiagnostics()},null,2));
