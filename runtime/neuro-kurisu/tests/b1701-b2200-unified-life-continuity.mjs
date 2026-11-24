import { B1701B2200UnifiedLifeContinuityCore } from '../src/organism/system/B1701B2200UnifiedLifeContinuityCore.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map(a=>[a,.5]));
const core=new B1701B2200UnifiedLifeContinuityCore();
const subject=core.snapshot().subjectId;
const identity='test-identity-fingerprint';
const bias=Object.fromEntries(A.map(a=>[a,0]));
let lastOut=null;
for(let tick=1;tick<=12000;tick++){
  const context=Array.from({length:8},(_,i)=>((tick+i*3)%97)/96);
  const out=core.beforeDecision({tick,at:tick,context01:context,baseUtilities:base,priorBias:bias,uncertainty01:(tick%17)/16,predictionError01:(tick%13)/12,novelty01:(tick%11)/10,confidence01:.72,energy01:.78,cognitiveLoad01:.22,identityContinuity01:1,subjectId:subject,identityFingerprint:identity,activeGoalIds:['goal-project'],intentionIds:['finish-phase'],activeProjectId:'kurisu-core',preferenceKeys:['curiosity','rigor'],valueKeys:['scientific-rigor','autonomy'],memoryAnchorIds:[`m-${tick%31}`]});
  const action=A[Math.abs(Math.floor((out.actionBias.explore+out.actionBias.verify+tick)%A.length))];
  const reward=action==='explore'&&tick%7!==0?.86:action==='verify'&&tick%5===0?.82:tick%9===0?.18:.58;
  lastOut=core.afterOutcome({tick,at:tick,action,context01:context,nextContext01:context.map((x,i)=>Math.max(0,Math.min(1,x+(i===0?(reward-.5)*.12:0))),),reward01:reward,predictionError01:Math.abs(reward-.58),success01:reward>.5?1:0,verified01:action==='verify'?1:.55,goalIds:['goal-project'],memoryIds:[`m-${tick%31}`]});
}
const diag=core.diagnosticsExtended();
const ver=core.verify();
if(!ver.verified) throw new Error(`continuity verify failed ${JSON.stringify(ver)}`);
const before=core.snapshot();
const envelope=core.exportTransferEnvelope('termux');
const lesion=core.evaluateLesion({tick:12001,at:12001,context01:[.3,.2,.8,.7,.4,.1,.6,.9],baseUtilities:base,priorBias:bias,uncertainty01:.9,predictionError01:.8,novelty01:.7,confidence01:.55,energy01:.7,cognitiveLoad01:.4,identityContinuity01:1,subjectId:subject,identityFingerprint:identity,activeGoalIds:['goal-project'],intentionIds:['finish-phase'],activeProjectId:'kurisu-core',preferenceKeys:['curiosity'],valueKeys:['scientific-rigor']},{'neural-causal':true});
const after=core.snapshot();
console.log('B1701_B2200_UNIFIED_LIFE_CONTINUITY_PASS');
console.log(JSON.stringify({headSeq:diag.headSeq,segments:diag.segments,hotReceipts:diag.hotReceipts,continuity01:diag.continuity01,behaviorContinuity01:diag.behaviorContinuity01,causalContinuity01:diag.causalContinuity01,neuralCausal01:diag.neuralCausal01,worldCalibration01:diag.worldCalibration01,researchPressure01:diag.researchPressure01,curriculumPressure01:diag.curriculumPressure01,skills:after.skills.length,claims:after.selfClaims.length,memory:after.memory.length,transferHead:envelope.headSeq,neuralLesionEffect01:lesion.effect01,restoredSameSeq:after.headSeq===before.headSeq},null,2));
