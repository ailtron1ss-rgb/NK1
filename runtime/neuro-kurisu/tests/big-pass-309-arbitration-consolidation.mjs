import assert from 'node:assert/strict';
import { B297ExecutiveNeuralFusion, defaultB297State } from '../src/organism/system/B297ExecutiveNeuralFusion.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const baseCandidates=actions.slice(0,2).map(action=>({action,score: action==='explore' ? .5 : .49,predictedUtility:.5,confidence01:.82}));
const redundantSources={
  self:Object.fromEntries(actions.map(a=>[a,a==='explore'?.10:0])),
  personality:Object.fromEntries(actions.map(a=>[a,a==='explore'?.10:0])),
  agency:Object.fromEntries(actions.map(a=>[a,a==='explore'?.10:0])),
  policy:Object.fromEntries(actions.map(a=>[a,a==='explore'?.10:0])),
};
const neutralSources={self:Object.fromEntries(actions.map(a=>[a,0]))};

const policyControl=new B297ExecutiveNeuralFusion();
const policyCandidates=[{action:'respond',score:.5,predictedUtility:.5,confidence01:.8},{action:'explore',score:.5,predictedUtility:.5,confidence01:.8}];
const policyDriven=policyControl.fuse({tick:1,candidates:policyCandidates,sources:{policy:{explore:.12}},identity01:.8,personality01:.8,agency01:.8,goalPressure01:.7,uncertainty01:.4,novelty01:.5,energy01:.8,cognitiveCapacity01:.85,externalInput:false});
assert.equal(policyDriven.selectedAction,'explore','B309 policy source did not reach executive selected-action arbitration');
const policyLesionedEngine=new B297ExecutiveNeuralFusion();
policyLesionedEngine.lesion('policy');
const policyLesioned=policyLesionedEngine.fuse({tick:1,candidates:policyCandidates,sources:{policy:{explore:.12}},identity01:.8,personality01:.8,agency01:.8,goalPressure01:.7,uncertainty01:.4,novelty01:.5,energy01:.8,cognitiveCapacity01:.85,externalInput:false});
assert.equal(policyLesioned.selectedAction,'respond','B309 policy lesion did not remove policy-driven executive selection');

const redundant=new B297ExecutiveNeuralFusion();
for(let tick=1;tick<=90;tick++){
  redundant.fuse({tick,candidates:baseCandidates,sources:redundantSources,identity01:.8,personality01:.8,agency01:.8,goalPressure01:.7,uncertainty01:.4,novelty01:.5,energy01:.8,cognitiveCapacity01:.85,externalInput:false});
}
const redundantDiag=redundant.diagnostics();
assert.equal(redundantDiag.sourceCount,11,'B309 policy source is not part of canonical executive fusion');
assert.ok(redundantDiag.redundantPairs.length>0,'B309 did not identify repeated source pairs');
assert.ok(redundantDiag.consolidationEvents>0,'B309 did not consolidate repeated source contributions');
assert.ok(redundantDiag.lastDeduplicatedContribution01>.001,'B309 duplicate suppression remained inactive');
assert.ok(redundantDiag.sourceConsolidation01>.30,'B309 source consolidation score remained too low');
assert.ok((redundantDiag.lastEffectiveWeights.policy??0)>.45,'B309 policy source lost all executive weight');

const policyBefore=redundant.snapshot().lastEffectiveWeights.policy ?? 0;
const lesion=redundant.lesion('policy');
const lesioned=redundant.fuse({tick:91,candidates:baseCandidates,sources:redundantSources,identity01:.8,personality01:.8,agency01:.8,goalPressure01:.7,uncertainty01:.4,novelty01:.5,energy01:.8,cognitiveCapacity01:.85,externalInput:false});
assert.equal(lesion.lesioned,true,'policy lesion did not activate');
assert.ok(Math.abs((lesioned.actions[0]?.fusedSignal01??0))<1,'B309 lesion produced invalid fused signal');
assert.ok((redundant.snapshot().lastEffectiveWeights.policy??0)<policyBefore*.05,'policy lesion did not suppress canonical policy source weight');
redundant.clearLesions();

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:true,operationalPulseEvery:2,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await core.init();
const context='e2|c1|u2|n2|g1|s1';
const policy=core.adaptivePolicy;
for(let i=0;i<20;i++) policy.observeVerifiedOutcome(context,'explore',.95,.92,true,true);
for(let i=0;i<20;i++) policy.observeVerifiedOutcome(context,'respond',.05,.92,true,true);
let full=0;
for(let i=0;i<32;i++){
  const result=await core.observeOperational(i%2===0?{text:'Use the learned verified consequence and choose deliberately.',novelty:.18,surprise:.07,embodiment:{bodyEnergy01:.88,cognitiveCapacity01:.88,thermalStrain01:.18,sensoryFreshness01:.88,battery01:.84,cpuLoad01:.22,ramPressure01:.22,awake:true}}:{embodiment:{bodyEnergy01:.88,cognitiveCapacity01:.88,thermalStrain01:.18,sensoryFreshness01:.88,battery01:.84,cpuLoad01:.22,ramPressure01:.22,awake:true}});
  if(result.workspace.content.temporalResolution!=='micro') full++;
}
const d=core.b297ExecutiveNeuralFusionDiagnostics();
const s=core.b297ExecutiveNeuralFusionSnapshot();
assert.ok(full>=12,'B309 live core did not produce enough full cycles');
assert.ok(d.lastEffectiveWeights && 'policy' in d.lastEffectiveWeights,'B309 live fusion did not expose policy source weight');
assert.ok((d.lastEffectiveWeights.policy??0)>0,'B309 live policy source has zero effective weight');
assert.ok(d.sourceConsolidation01>=0,'B309 consolidation metric invalid');
assert.ok(s.lastSignals?.explore?.policy!==undefined,'B309 policy source was not persisted in fusion signals');

const restored=new OrganismCore(new MemoryStateStore({initial:core.snapshot()}),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:true,operationalPulseEvery:2,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await restored.init();
const restoredD=restored.b297ExecutiveNeuralFusionDiagnostics();
assert.equal(restoredD.consolidationEvents,d.consolidationEvents,'B309 consolidation state lost after restart');
assert.ok((restoredD.lastEffectiveWeights.policy??0)>=0,'B309 restored policy weight invalid');

console.log(JSON.stringify({
  pass:true,
  unit:{sourceCount:redundantDiag.sourceCount,redundantPairs:redundantDiag.redundantPairs.slice(0,5),consolidationEvents:redundantDiag.consolidationEvents,lastDeduplicatedContribution01:redundantDiag.lastDeduplicatedContribution01,sourceConsolidation01:redundantDiag.sourceConsolidation01,policyWeightBeforeLesion:policyBefore,policyWeightAfterLesion:redundant.snapshot().lastEffectiveWeights.policy??0},
  core:{full,sourceConsolidation01:d.sourceConsolidation01,consolidationEvents:d.consolidationEvents,policyWeight:d.lastEffectiveWeights.policy??0,policySignal:s.lastSignals?.explore?.policy??0},
  restart:{pass:true,consolidationEvents:restoredD.consolidationEvents}
},null,2));
process.exit(0);
