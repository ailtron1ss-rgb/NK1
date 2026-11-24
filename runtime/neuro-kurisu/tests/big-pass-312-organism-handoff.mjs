import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const obs={embodiment:{bodyEnergy01:.92,cognitiveCapacity01:.92,thermalStrain01:.12,sensoryFreshness01:.86,battery01:.92,cpuLoad01:.16,ramPressure01:.16,awake:true}};
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const make=async(initial)=>{const c=new OrganismCore(new MemoryStateStore(initial?{initial}:{}),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:false,operationalPulseEvery:1,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});await c.init();return c;};
const seedCore=await make();
const initial=seedCore.snapshot();
const baseline=await make(initial);
const baselineCounts=Object.fromEntries(actions.map(a=>[a,0]));
for(let i=0;i<8;i++){const r=await baseline.observeOperational(obs);const a=r.decision?.selected?.action??'wait';baselineCounts[a]++;}
const trained=await make(initial);
const key=trained.adaptivePolicy.contextKey(initial.state,initial.state.needs.goalPressure);
for(let i=0;i<48;i++) trained.adaptivePolicy.observeVerifiedOutcome(key,'explore',.98,.98,true,true);
for(let i=0;i<16;i++) trained.adaptivePolicy.observeVerifiedOutcome(key,'verify',.06,.98,true,true);
const fusion=trained.executiveNeuralFusionB297;
for(let i=0;i<24;i++){fusion.fuse({tick:i+1,candidates:[{action:'explore',score:.54,predictedUtility:.54,confidence01:.9},{action:'verify',score:.53,predictedUtility:.53,confidence01:.9}],sources:{policy:{explore:.12,verify:-.12}},identity01:.9,personality01:.9,agency01:.9,goalPressure01:.8,uncertainty01:.25,novelty01:.65,energy01:.92,cognitiveCapacity01:.92,externalInput:false});fusion.recordOutcome({tick:i+1,action:'explore',reward01:.95,predictionError01:.05,externalEvidence01:1,verified01:1,independent01:1,autonomous01:1});}
trained.persisted.facets.learning.adaptivePolicy=trained.adaptivePolicy.snapshot();trained.persisted.system.executiveNeuralFusionB297=fusion.snapshot();
const trainedCounts=Object.fromEntries(actions.map(a=>[a,0]));let last=null;
for(let i=0;i<8;i++){const r=await trained.observeOperational(obs);const a=r.decision?.selected?.action??'wait';trainedCounts[a]++;last=trained.b312ExecutiveDecisionHandoffDiagnostics();}
const l1=actions.reduce((s,a)=>s+Math.abs((trainedCounts[a]??0)-(baselineCounts[a]??0)),0);
assert.ok(last.evaluations>=8,'B312 handoff evaluations missing');
assert.ok((last.confirmations+last.promotions)>0,'B312 verified policy never reached final handoff');
assert.ok(last.confirmations+last.promotions>0,'B312 verified policy never reached the final handoff');
const snap=trained.snapshot();const restored=await make(snap);const rd=restored.b312ExecutiveDecisionHandoffDiagnostics();
assert.equal(rd.evaluations,last.evaluations,'B312 handoff evaluations lost after restart');
assert.equal(rd.confirmations,last.confirmations,'B312 handoff confirmations lost after restart');
console.log(JSON.stringify({pass:true,baseline:baselineCounts,trained:trainedCounts,l1,promotions:last.promotions,confirmations:last.confirmations,evaluations:last.evaluations,lastReason:last.lastReason,policyCredit:last.lastPolicyCredit01,policyMargin:last.lastPolicyMargin01,restored:{evaluations:rd.evaluations,confirmations:rd.confirmations}},null,2));
process.exit(0);
