import assert from 'node:assert/strict';
import { TransferableEmbodiedSkillSystem } from '../src/organism/cognition/TransferableEmbodiedSkillSystem.ts';
import { TaskAgnosticTransferRouter } from '../src/organism/cognition/TaskAgnosticTransferRouter.ts';
import { RiskAwareRecoveryController } from '../src/organism/cognition/RiskAwareRecoveryController.ts';
import { GoalIdentitySkillModulator } from '../src/organism/cognition/GoalIdentitySkillModulator.ts';
import { DeviceAwareNeuralScheduler } from '../src/organism/cognition/DeviceAwareNeuralScheduler.ts';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const A=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(A.map(a=>[a,.5]));
const skillStore=new TransferableEmbodiedSkillSystem();
for(let t=1;t<=1800;t++){
  const action=A[t%A.length];
  const phase=(t%67)/67;
  const context=Array.from({length:16},(_,i)=>((i*17+t*13+7)%149)/148*.78+.22*phase);
  const latent=context.slice(0,8);
  const drift=action==='explore'?.16:action==='verify'?.11:action==='reflect'?.07:.035;
  const next=latent.map((v,i)=>Math.max(0,Math.min(1,v+(i%3===0?drift:-drift*.32))));
  skillStore.afterOutcome({tick:t,context,latent,nextLatent:next,action,reward01:action==='explore'?.89:action==='verify'?.84:action==='reflect'?.78:.63,predictionError01:.10+(t%29===0?.12:0),verified01:t%5===0?1:.82});
}
const skills=skillStore.metrics().skills;
assert(skills.length>=7);

const router=new TaskAgnosticTransferRouter();
let covered=0, shiftedSuccess=0, abstainHighUncertainty=0;
for(let t=1;t<=480;t++){
  const shifted=Array.from({length:24},(_,i)=>((i*23+t*9+41)%173)/172*.72+.28*((t*7)%29)/28);
  const r=router.beforeDecision({tick:t,context:shifted,skills,actionUtilities:base,goalSignal01:.82,uncertainty01:t%17===0?.78:.22,negativeTransfer01:t%31===0?.18:.03,computeBudget01:t%7===0?.88:.62});
  if(!r.abstain)covered++;
  if(r.selectedAction && ((r.selectedAction==='explore'&&r.taskFreeScore01>.56)||(r.selectedAction==='verify'&&r.taskFreeScore01>.56)||r.selectedAction==='reflect'))shiftedSuccess++;
  if(t%17===0 && r.abstain)abstainHighUncertainty++;
  router.afterOutcome({selectedSkillId:r.selectedSkillId,reward01:r.abstain?.46:.76,verified01:r.abstain?.55:.9,predictionError01:r.abstain?.64:.22});
}
const rm=router.metrics();
assert(rm.evaluations===480);
assert(rm.coverage01>.12,`task-free coverage too low: ${rm.coverage01}`);
assert(rm.selectedSkillId,'router never selected a skill');
assert(rm.utilitySamples>0);
assert(rm.calibration01>0);

const risk=new RiskAwareRecoveryController();
let recoverySuccess=0;
for(let t=1;t<=360;t++){
  const shock=t>240;
  const r=risk.beforeDecision({tick:t,actionUtilities:base,predictionError01:shock?.82:.13,uncertainty01:shock?.74:.21,modelDrift01:shock?.48:.06,recoveryGain01:shock?.24:.78,verified01:shock?.9:0,computeBudget01:shock?.55:.82});
  const failure=shock && t%11===0;
  const success=r.recoveryAction==='verify'&&failure?.78:(r.recoveryAction? .68:.84);
  if(r.recoveryAction&&success>.55)recoverySuccess++;
  risk.afterOutcome({reward01:failure?.25:.72,verified01:failure?.3:.9,predictionError01:failure?.88:(shock?.42:.16),recoveryTriggered:!!r.recoveryAction,recoverySuccessful01:failure?success:.65,failureSeverity01:failure?.92:(shock?.23:.04)});
}
const rsk=risk.metrics();
assert(rsk.recoveryAttempts>0);
assert(rsk.recoverySuccesses>0);
assert(rsk.riskCalibration01>0);
assert(rsk.recoverability01>0);

const mod=new GoalIdentitySkillModulator();
const highNovelty=mod.beforeDecision({tick:1,goalPressure01:.82,identityGap01:.18,novelty01:.92,uncertainty01:.32,baseUtilities:base,traitVector:[.82,.76,.72,.64,.75,.55,.48,.58]});
const identityPressure=mod.beforeDecision({tick:2,goalPressure01:.78,identityGap01:.88,novelty01:.18,uncertainty01:.42,baseUtilities:base,traitVector:[.50,.70,.66,.58,.92,.55,.48,.58]});
assert(highNovelty.actionBias.explore>identityPressure.actionBias.explore,'novelty did not increase exploratory modulation');
assert(identityPressure.actionBias.reflect>highNovelty.actionBias.reflect,'identity gap did not increase reflection modulation');
mod.afterOutcome({reward01:.86,verified01:1,identityGap01:.2,goalPressure01:.8,selectedAction:'explore'});
const mm=mod.metrics();
assert(mm.updates===2 && mm.personalityStability01>.4 && mm.coherence01>.4);

const sched=new DeviceAwareNeuralScheduler();
const safe=sched.beforeDecision({tick:1,continuityBudget01:.9,thermalStrain01:.12,battery01:.92,cpuLoad01:.18,ramPressure01:.16,sensorFreshness01:.96,predictionError01:.12,novelty01:.18});
const hot=sched.beforeDecision({tick:2,continuityBudget01:.9,thermalStrain01:.91,battery01:.18,cpuLoad01:.88,ramPressure01:.82,sensorFreshness01:.48,predictionError01:.64,novelty01:.72});
assert(hot.budget01<safe.budget01,'thermal scheduler failed to reduce budget');
assert(hot.skipDeep,'thermal scheduler failed to gate deep rollouts');
assert(sched.metrics().throttledCycles>0);

const branch=new NeuralExperienceBranch();
const start=process.hrtime.bigint();
for(let t=1;t<=900;t++){
  const stress=t>600;
  const input=Array.from({length:64},(_,i)=>Math.sin((i+1)*(t%37+1)*.07)*.45 + ((i*13+t*5)%17)/16*.15);
  const out=branch.beforeDecision({
    tick:t,input,baseUtilities:base,predictionError01:stress?.82:.16,novelty01:stress?.68:.24,uncertainty01:stress?.78:.28,homeostasis01:.2,identityGap01:stress?.55:.24,goalPressure01:.74,
    personalityVector:[.74,.78,.70,.58,.76,.52,.48,.60],
    embodied:{sensorFeatures:input,thermalStrain01:stress?.76:.18,battery01:stress?.34:.88,cpuLoad01:stress?.68:.22,ramPressure01:stress?.66:.19,sensorFreshness01:stress?.65:.94}
  });
  const utilities=Object.fromEntries(A.map(a=>[a,.5+(out.actionBias[a]??0)]));
  const action=A.reduce((best,a)=>(utilities[a]>utilities[best]?a:best),A[0]);
  branch.commitAction(action,utilities);
  branch.afterOutcome({tick:t,action,reward01:action==='explore'?.78:action==='verify'?.81:.64,predictionError01:stress?.72:.18,verified01:t%5===0?1:.82,nextInput:input.map((v,i)=>Math.max(-1,Math.min(1,v+(i%4===0?.04:-.018)))),holdout01:t%19===0?1:0,identityGap01:stress?.55:.24,goalPressure01:.74,embodied:{nextFeatures:input,sensorFreshness01:stress?.65:.94}});
}
const elapsed=Number(process.hrtime.bigint()-start)/1e6;
const m=branch.continuityMetrics();
assert(m.taskAgnosticTransfer.coverage01>0.01);
assert(m.riskRecovery.recoveryQuality01>0);
assert(m.goalIdentityModulator.goalConditioning01>0);
assert(m.deviceScheduler.decisions===900);
assert(m.deviceScheduler.skippedDeepRollouts>0);
assert(m.taskAgnosticTransfer.utilitySamples>0);
assert(m.riskRecovery.decisions===900);
const snap=branch.snapshot();
const restored=new NeuralExperienceBranch();
restored.restore(snap);
const mr=restored.continuityMetrics();
assert(Math.abs(mr.taskAgnosticTransfer.transfer01-m.taskAgnosticTransfer.transfer01)<1e-12);
assert(Math.abs(mr.riskRecovery.recoverability01-m.riskRecovery.recoverability01)<1e-12);
assert(Math.abs(mr.deviceScheduler.budget01-m.deviceScheduler.budget01)<1e-12);

console.log('P2613_2626_TASKFREE_RECOVERY_PERSONALITY_DEVICE_PASS',JSON.stringify({
  skillCount:skills.length,taskFreeEvaluations:rm.evaluations,taskFreeCoverage01:rm.coverage01,taskFreeTransfer01:rm.transfer01,taskFreeCalibration01:rm.calibration01,shiftedSuccess,abstainHighUncertainty,
  recoveryAttempts:rsk.recoveryAttempts,recoverySuccesses:rsk.recoverySuccesses,failedRecoveries:rsk.failedRecoveries,riskCalibration01:rsk.riskCalibration01,recoverability01:rsk.recoverability01,recoveryQuality01:rsk.recoveryQuality01,
  personalityStability01:mm.personalityStability01,personalityCoherence01:mm.coherence01,noveltyExploreBias:Number(highNovelty.actionBias.explore.toFixed(6)),identityReflectBias:Number(identityPressure.actionBias.reflect.toFixed(6)),
  safeBudget01:safe.budget01,hotBudget01:hot.budget01,hotSkipDeep:hot.skipDeep,throttledCycles:sched.metrics().throttledCycles,
  integratedCycles:900,integratedMs:Number(elapsed.toFixed(2)),integratedTransfer01:m.taskAgnosticTransfer.transfer01,integratedRisk01:m.riskRecovery.selectedRisk01,integratedRecoveryQuality01:m.riskRecovery.recoveryQuality01,deviceSkippedDeep:m.deviceScheduler.skippedDeepRollouts,deviceDegraded01:m.deviceScheduler.degradedMode01,
  persistence:'PASS'
},null,2));
