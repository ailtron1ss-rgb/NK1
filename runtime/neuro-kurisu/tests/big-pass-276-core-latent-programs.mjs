import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});await core.init();
for(let i=0;i<20;i++){
  await core.observe({text:i%2?'Combine a previous useful strategy with a new verification step.':'Explore a different approach, compare it with memory, and preserve what generalizes.',novelty:.48+(i%5)*.06,surprise:.2+(i%4)*.08,embodiment:{bodyEnergy01:.86-i*.012,cognitiveCapacity01:.84,thermalStrain01:.18,sensoryFreshness01:.9,awake:true,battery01:.74,cpuLoad01:.23,ramPressure01:.2}},'operational');
  await core.feedback({success:i%4===0?.76:.68,reward:i%3===0?.72:.61,surprise:.16+(i%5)*.06,evidenceSource:'unknown'});
}
const d0=core.b276LatentProgramDiagnostics();
const manual=core.b276LatentProgramPropose({tick:999,goalVector:[.7,.2,.6,.4,.5,.3,.2,.8],selfLatent:Array(16).fill(.2),worldLatent:Array(16).fill(.3),neuralAssembly:Array(16).fill(.4),personalityBias:{explore:.04,verify:.02,reflect:.01},autonomy01:.74,noveltyNeed01:.78,promotedSkills:[{id:'core-a',actions:['explore','verify'],reliability01:.84},{id:'core-b',actions:['reflect','respond'],reliability01:.78},{id:'core-c',actions:['verify','wait'],reliability01:.77}]});
const d=core.b276LatentProgramDiagnostics();
assert.ok(d.proposals>d0.proposals);assert.ok(d.imaginedPrograms>d0.imaginedPrograms);assert.ok(d.realTrials>0);assert.ok(d.neuralGrounding01>.4);assert.ok(d.composeDepthMax>=2);assert.ok(manual.depth>=2);
const snap=core.snapshot();const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'});await core2.init();
assert.deepEqual(core2.b276LatentProgramDiagnostics(),d);
console.log(JSON.stringify({pass:true,diagnostics:d,restored:core2.b276LatentProgramDiagnostics(),personality:core.personalitySummary()},null,2));
