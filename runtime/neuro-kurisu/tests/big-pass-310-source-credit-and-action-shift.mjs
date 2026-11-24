import assert from 'node:assert/strict';
import { B297ExecutiveNeuralFusion } from '../src/organism/system/B297ExecutiveNeuralFusion.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const obs={embodiment:{bodyEnergy01:.9,cognitiveCapacity01:.9,thermalStrain01:.15,sensoryFreshness01:.8,battery01:.9,cpuLoad01:.18,ramPressure01:.18,awake:true}};

// B310-1: verified source attribution must reward the source whose signal predicts the outcome.
const fusion=new B297ExecutiveNeuralFusion();
const neutralBaseline=new B297ExecutiveNeuralFusion();
neutralBaseline.fuse({tick:1,candidates:[{action:'explore',score:.5,predictedUtility:.5,confidence01:.9},{action:'respond',score:.5,predictedUtility:.5,confidence01:.9}],sources:{policy:{explore:0,respond:0},self:{explore:0,respond:0}},identity01:.8,personality01:.8,agency01:.8,goalPressure01:.7,uncertainty01:.45,novelty01:.6,energy01:.9,cognitiveCapacity01:.9,externalInput:false});
const neutralBefore=neutralBaseline.diagnostics();
const candidates=[
  {action:'explore',score:.5,predictedUtility:.5,confidence01:.9},
  {action:'respond',score:.5,predictedUtility:.5,confidence01:.9},
];
for(let tick=1;tick<=24;tick++){
  fusion.fuse({tick,candidates,sources:{policy:{explore:.12,respond:-.12},self:{explore:0,respond:0},personality:{explore:0,respond:0}},identity01:.8,personality01:.8,agency01:.8,goalPressure01:.7,uncertainty01:.45,novelty01:.6,energy01:.9,cognitiveCapacity01:.9,externalInput:false});
  fusion.recordOutcome({tick,action:'explore',reward01:.92,predictionError01:.08,externalEvidence01:1,verified01:1,independent01:1,autonomous01:1});
}
const fd=fusion.diagnostics();
assert.ok((fd.sourceCredit?.policy??.5)>.56,'B310 policy source credit did not rise under verified success');
assert.ok((fd.topCreditedSources?.[0]?.[0]??'')==='policy','B310 policy was not top credited source under isolated predictive success');
assert.ok(Math.abs((fd.sourceReliability?.self??.5)-.5)<.001,'B310 silent source was penalized without evidence');
assert.ok((fd.lastEffectiveWeights?.policy??0)>(neutralBefore.lastEffectiveWeights?.policy??0),'B310 verified source credit did not raise policy effective weight');

const negativeFusion=new B297ExecutiveNeuralFusion();
for(let tick=1;tick<=24;tick++){
  negativeFusion.fuse({tick,candidates,sources:{policy:{explore:.12,respond:.12}},identity01:.8,personality01:.8,agency01:.8,goalPressure01:.7,uncertainty01:.45,novelty01:.6,energy01:.9,cognitiveCapacity01:.9,externalInput:false});
  negativeFusion.recordOutcome({tick,action:'respond',reward01:.08,predictionError01:.08,externalEvidence01:1,verified01:1,independent01:1,autonomous01:1});
}
const negativeDiag=negativeFusion.diagnostics();
assert.ok((negativeDiag.sourceCredit?.policy??.5)<.44,'B310 verified negative outcome did not reduce policy source credit');

// B310-2: whole-organism distribution comparison. Baseline and trained branches start from the same state.
const seed=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:false,operationalPulseEvery:1,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await seed.init();
const initial=seed.snapshot();
const baseline=new OrganismCore(new MemoryStateStore({initial}),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:false,operationalPulseEvery:1,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await baseline.init();
const baselineCounts=Object.fromEntries(actions.map(a=>[a,0]));
let baselineFirst=null;
const contexts=[initial.state];
for(let i=0;i<24;i++){
  const r=await baseline.observeOperational(obs);
  const a=r.decision?.action ?? r.workspace?.content?.candidateActions?.[0]?.action ?? 'wait';
  if(i===0) baselineFirst=r.decision?.candidates ?? null;
  baselineCounts[a]=(baselineCounts[a]??0)+1;
  contexts.push(r.state);
}

const trained=new OrganismCore(new MemoryStateStore({initial}),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:false,operationalPulseEvery:1,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await trained.init();
const uniqueContexts=new Set();
for(const state of contexts){
  const key=trained.adaptivePolicy.contextKey(state,state.needs.goalPressure);
  uniqueContexts.add(key);
  for(let j=0;j<24;j++) trained.adaptivePolicy.observeVerifiedOutcome(key,'rest',.98,.98,true,true);
  for(let j=0;j<24;j++) trained.adaptivePolicy.observeVerifiedOutcome(key,'explore',.02,.98,true,true);
  trained.adaptivePolicy.update(key,'rest',.96,key,actions,.22,.72,.1);
  trained.adaptivePolicy.update(key,'explore',.04,key,actions,.22,.72,.1);
}
trained.persisted.facets.learning.adaptivePolicy=trained.adaptivePolicy.snapshot();
const trainedLearningSnapshot=trained.snapshot();
const initialKey=trained.adaptivePolicy.contextKey(initial.state,initial.state.needs.goalPressure);
const preBias={rest:trained.adaptivePolicy.bias(initialKey,'rest',.5),explore:trained.adaptivePolicy.bias(initialKey,'explore',.5)};
const trainedCounts=Object.fromEntries(actions.map(a=>[a,0]));
let trainedFirst=null;
for(let i=0;i<24;i++){
  const r=await trained.observeOperational(obs);
  const a=r.decision?.action ?? r.workspace?.content?.candidateActions?.[0]?.action ?? 'wait';
  if(i===0) { trainedFirst=r.decision?.candidates ?? null; }
  trainedCounts[a]=(trainedCounts[a]??0)+1;
}
const l1=actions.reduce((sum,a)=>sum+Math.abs((trainedCounts[a]??0)-(baselineCounts[a]??0)),0);
const scoreMap=(rows)=>Object.fromEntries((rows??[]).map(x=>[x.action,Number(x.score)]));
const bm=scoreMap(baselineFirst), tm=scoreMap(trainedFirst);
const firstScoreShift=actions.reduce((sum,a)=>sum+Math.abs((tm[a]??0)-(bm[a]??0)),0);
const firstExploreShift=(tm.explore??0)-(bm.explore??0);
const firstRestShift=(tm.rest??0)-(bm.rest??0);
const baselineTop=actions.slice().sort((a,b)=>(baselineCounts[b]??0)-(baselineCounts[a]??0))[0];
const trainedTop=actions.slice().sort((a,b)=>(trainedCounts[b]??0)-(trainedCounts[a]??0))[0];
// One real feedback cycle proves B310 source credit is updated through OrganismCore, not only by a standalone class call.
const liveProbe=await trained.observe({embodiment:obs.embodiment},'operational');
await trained.feedback({success:.92,reward:.84,surprise:.08,evidenceSource:'device-observation'});
const trainedLiveAfterFeedback=trained.b297ExecutiveNeuralFusionDiagnostics();
const trainedFusion=trainedLiveAfterFeedback;
assert.ok(trainedLiveAfterFeedback.sourceCreditUpdates>0,'B310 live OrganismCore feedback did not update source credit');
const lesioned=new OrganismCore(new MemoryStateStore({initial:trainedLearningSnapshot}),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:false,operationalPulseEvery:1,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await lesioned.init();
lesioned.b297ExecutiveNeuralFusionLesion('policy');
const lesionedCounts=Object.fromEntries(actions.map(a=>[a,0]));
for(let i=0;i<24;i++){
  const r=await lesioned.observeOperational(obs);
  const a=r.decision?.action ?? 'wait';
  lesionedCounts[a]=(lesionedCounts[a]??0)+1;
}
const lesionL1=actions.reduce((sum,a)=>sum+Math.abs((trainedCounts[a]??0)-(lesionedCounts[a]??0)),0);
assert.ok(lesionL1>=2,'B310 policy lesion did not materially alter the trained action distribution');
assert.ok((trainedFusion.sourceCredit?.policy??.5)>=0,'B310 live policy source credit invalid');

const restored=new OrganismCore(new MemoryStateStore({initial:trained.snapshot()}),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:false,operationalPulseEvery:1,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await restored.init();
const restoredFusion=restored.b297ExecutiveNeuralFusionDiagnostics();
assert.equal(restoredFusion.sourceCreditUpdates,trainedFusion.sourceCreditUpdates,'B310 source credit updates lost after restart');
assert.ok(Math.abs((restoredFusion.sourceCredit?.policy??0)-(trainedFusion.sourceCredit?.policy??0))<.000001,'B310 policy source credit changed on restart');

console.log(JSON.stringify({pass:true,isolated:{sourceCreditPolicy:fd.sourceCredit.policy,sourceCreditTop:fd.topCreditedSources?.slice(0,4),updates:fd.sourceCreditUpdates,neutralPolicyWeight:neutralBefore.lastEffectiveWeights?.policy,trainedPolicyWeight:fd.lastEffectiveWeights?.policy,negativePolicyCredit:negativeDiag.sourceCredit?.policy},distribution:{baseline:baselineCounts,trained:trainedCounts,lesioned:lesionedCounts,l1,lesionL1,baselineTop,trainedTop,uniqueContexts:uniqueContexts.size,firstScoreShift,firstExploreShift,firstRestShift,preBias},live:{sourceCreditPolicy:trainedFusion.sourceCredit.policy,sourceCreditUpdates:trainedFusion.sourceCreditUpdates,feedbackAction:liveProbe.decision?.selected?.action ?? null},restart:{pass:true}},null,2));
process.exit(0);
