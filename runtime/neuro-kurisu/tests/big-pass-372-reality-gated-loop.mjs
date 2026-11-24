import assert from 'node:assert/strict';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
import { RealityEvidenceLedger } from '../src/organism/system/RealityEvidenceLedger.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const vector = Array.from({length:64},(_,i)=>Math.sin(i*.17));
const makePrimed = () => {
  const core = new B365UnifiedNeuroCausalCore();
  for (let tick=1; tick<=20; tick += 1) core.step({tick,vector:vector.map((v,i)=>v+Math.sin(tick*.07+i*.03)*.08),novelty01:.65,uncertainty01:.45,predictionError01:.32,autonomy01:.78});
  return core;
};

// OFF/SHAM: the same observed consequence must not alter neural policy when physical proof is absent.
const off = makePrimed();
const offBefore = off.snapshot();
for (let i=21;i<=36;i+=1) {
  off.learnEmbodiedConsequence({tick:i,action:'explore',predictedEffect01:.35,actualEffect01:.92,verified01:0,independent01:0,source:'node-host'});
}
const offAfter = off.snapshot();
assert.deepEqual(offAfter.actionReadout,offBefore.actionReadout,'unverified host evidence changed neural action readout');
assert.equal(off.diagnostics().realityActionLearning.rejectedUnverified,16);

// ON: independently verified Android evidence must update the canonical B365 readout.
const on = makePrimed();
const onBefore = on.snapshot();
let accepted=0, updateCalls=0;
for (let i=21;i<=52;i+=1) {
  const r=on.learnEmbodiedConsequence({tick:i,action:'explore',predictedEffect01:.35,actualEffect01:.92,verified01:1,independent01:1,source:'android-termux'});
  accepted += r.accepted ? 1 : 0;
  updateCalls += r.updates;
}
const onAfter = on.snapshot();
let delta=0;
for(let a=0;a<onAfter.actionReadout.length;a++) for(let i=0;i<onAfter.actionReadout[a].length;i++) delta += Math.abs(onAfter.actionReadout[a][i]-onBefore.actionReadout[a][i]);
assert.equal(accepted,32,'verified physical evidence was not accepted');
assert.ok(updateCalls>0,'verified physical evidence produced no neural updates');
assert.ok(delta>0,'verified physical evidence did not change canonical neural policy substrate');
assert.ok(on.diagnostics().realityActionLearning.verifiedUpdates>0);
const shamProbe=makePrimed();
const onProbe=makePrimed();
for (let i=21;i<=52;i+=1) onProbe.learnEmbodiedConsequence({tick:i,action:'explore',predictedEffect01:.35,actualEffect01:.92,verified01:1,independent01:1,source:'android-termux'});
const shamStep=shamProbe.step({tick:60,vector,novelty01:.45,uncertainty01:.35,predictionError01:.25,autonomy01:.78,learningEnabled:false});
const onStep=onProbe.step({tick:60,vector,novelty01:.45,uncertainty01:.35,predictionError01:.25,autonomy01:.78,learningEnabled:false});
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const policyL1=actions.reduce((sum,a)=>sum+Math.abs(shamStep.actionProbabilities[a]-onStep.actionProbabilities[a]),0);
assert.ok(policyL1>0.001,'verified physical consequence did not alter future B365 policy probabilities');

// RESTART/PERSISTENCE: the learned embodied consequence state survives serialization.
const persisted = on.snapshot();
const restored = new B365UnifiedNeuroCausalCore();
restored.restore(persisted);
assert.deepEqual(restored.diagnostics().realityActionLearning,on.diagnostics().realityActionLearning);

// Evidence ledger regression: host fallback is derived, physical source is external/device only when explicitly proven.
const ledger = new RealityEvidenceLedger();
ledger.record({tick:1,realityClass:'derived',claim:'host-resource-sample-derived',confidence01:.2,independenceKey:'host:1'});
ledger.record({tick:2,realityClass:'device-observation',claim:'device-resource-sample',confidence01:.91,independenceKey:'device:2'});
assert.equal(ledger.claimAssessment('host-resource-sample-derived').promotionAllowed,false);
assert.equal(ledger.claimAssessment('device-resource-sample').promotionAllowed,true);

const runtime=new OrganismRuntime({stateFile:'/tmp/nk-b372-reality-gate.json',stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),enableLanguage:false,autoRun:false,performanceProfile:'balanced'});
await runtime.init();
const beforeRuntime=runtime.realityEvidenceLedgerSnapshot();
const runtimeStep=await runtime.autonomousStep();
const afterRuntime=runtime.realityEvidenceLedgerSnapshot();
assert.equal(afterRuntime.recent.some(r=>r.claim==='device-resource-sample' && r.realityClass==='device-observation'),false,'host runtime created physical device evidence');
assert.ok(afterRuntime.recent.some(r=>r.claim==='host-resource-sample-derived' && r.realityClass==='derived'),'host runtime did not preserve derived evidence classification');
const runtimeNeural=runtime.core.b365UnifiedNeuroCausalDiagnostics().realityActionLearning;
assert.ok(runtimeNeural.rejectedUnverified>=1,'runtime host embodiment was not rejected by physical learning gate');

console.log(JSON.stringify({
  pass:true,
  status:'B372_REALITY_GATED_NEURAL_LOOP_PASS',
  sham:{rejectedUnverified:off.diagnostics().realityActionLearning.rejectedUnverified,policyDelta01:0},
  verified:{accepted,updateCalls,policyDelta01:+delta.toFixed(8),verifiedUpdates:on.diagnostics().realityActionLearning.verifiedUpdates},
  persistence:{equal:true},
  policyCausality:{l1:+policyL1.toFixed(8)},
  runtimeHostGate:{beforeRecords:beforeRuntime.recent.length,afterRecords:afterRuntime.recent.length,rejectedUnverified:runtimeNeural.rejectedUnverified,lastAction:runtimeStep.cycle.state.lastAction},
  evidenceGate:{hostPromotion:ledger.claimAssessment('host-resource-sample-derived').promotionAllowed,devicePromotion:ledger.claimAssessment('device-resource-sample').promotionAllowed}
},null,2));
