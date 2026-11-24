import assert from 'node:assert/strict';
import { B297ExecutiveNeuralFusion } from '../src/organism/system/B297ExecutiveNeuralFusion.ts';
import { AdaptivePolicyEngine } from '../src/organism/learning/AdaptivePolicyEngine.ts';

const candidates=[
  {action:'explore',score:.5,predictedUtility:.5,confidence01:.9},
  {action:'verify',score:.506,predictedUtility:.506,confidence01:.9},
  {action:'wait',score:.49,predictedUtility:.49,confidence01:.9},
];
const fusion=new B297ExecutiveNeuralFusion();
const sources={
  policy:{explore:.11,verify:-.11,wait:0},
  predictive:{explore:0,verify:0,wait:0},
  causal:{explore:0,verify:0,wait:0},
};
const input={tick:1,candidates,sources,identity01:.8,personality01:.8,agency01:.8,goalPressure01:.7,uncertainty01:.4,novelty01:.7,energy01:.9,cognitiveCapacity01:.9,externalInput:false};
const normal=fusion.fuse(input);
const normalTop=normal.selectedAction;
assert.equal(normalTop,'explore','B311 canonical policy did not influence executive ranking');
const lesionedFusion=new B297ExecutiveNeuralFusion();
lesionedFusion.lesion('policy');
const lesioned=lesionedFusion.fuse({...input,tick:2});
assert.notEqual(lesioned.selectedAction,'explore','B311 policy lesion left canonical policy influence unchanged');
fusion.clearLesions();
for(let i=1;i<=18;i++) fusion.recordOutcome({tick:i,action:'explore',reward01:.92,predictionError01:.08,externalEvidence01:1,verified01:1,independent01:1,autonomous01:1});
const fd=fusion.diagnostics();
assert.ok((fd.sourceCredit?.policy??.5)>.55,'B311 policy source credit did not consolidate');
assert.ok((fd.lastEffectiveWeights?.policy??0)>.7,'B311 policy effective weight too weak');

const policy=new AdaptivePolicyEngine();
const a='e2|c1|u2|n2|g1|s1';
const neighbor='e2|c1|u2|n1|g1|s1';
for(let i=0;i<24;i++) policy.observeVerifiedOutcome(a,'explore',.95,.95,true,true);
const transfer=policy.generalizedBiasDiagnostics(neighbor,'explore',.5);
assert.ok((transfer.bias??0)>.001,'B311 verified policy did not generalize to a neighboring context');
const restored=new AdaptivePolicyEngine(); restored.restore(policy.snapshot());
const transferRestored=restored.generalizedBiasDiagnostics(neighbor,'explore',.5);
assert.ok((transferRestored.bias??0)>.001,'B311 neighboring-context policy transfer was lost after restore');
console.log(JSON.stringify({pass:true,executive:{normalTop,lesionedTop:lesioned.selectedAction,policyCredit:fd.sourceCredit?.policy,policyWeight:fd.lastEffectiveWeights?.policy,sourceCount:fd.sourceCount},generalization:{bias:transfer.bias,neighbors:transfer.neighbors.length,restoredBias:transferRestored.bias}},null,2));
process.exit(0);
