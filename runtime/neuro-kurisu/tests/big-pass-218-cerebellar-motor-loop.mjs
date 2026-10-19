import { CerebellarBasalGangliaMotorLoop } from '../src/organism/system/CerebellarBasalGangliaMotorLoop.ts';
import { CerebellarPredictiveController } from '../src/organism/system/CerebellarPredictiveController.ts';
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const cereb=new CerebellarPredictiveController();
const motor=new CerebellarBasalGangliaMotorLoop();
let last;
for(let i=0;i<24;i++){
  const p=cereb.calibrate([{action:'explore',score:.7,predictedUtility:.72,confidence01:.8}],{predictionError01:.48-i*.015,uncertainty01:.42,novelty01:.35,bodyEnergy01:.82,thermal01:.2,cognitiveCapacity01:.88,tick:i+1});
  const row=p.rows[0];
  const out=cereb.recordOutcome('explore',.72,.86-.012*i,.25,i+1);
  last=motor.observe({action:'explore',predictedUtility01:.72,cerebellarForwardError01:row.forwardError01,cerebellarCorrection01:row.correction01,basalGangliaGate01:.68,reward01:.86-.012*i,surprise01:.25,energy01:.82,cognitiveCapacity01:.88,tick:i+1});
}
const learned=motor.diagnostics();
const fresh=new CerebellarBasalGangliaMotorLoop();
const freshFrame=fresh.observe({action:'explore',predictedUtility01:.72,cerebellarForwardError01:.52,cerebellarCorrection01:0,basalGangliaGate01:.5,reward01:.5,surprise01:.02,energy01:.82,cognitiveCapacity01:.88,tick:100});
assert(learned.bestSkill01>.5,'motor skill did not improve');
assert(last.motorGain01>freshFrame.motorGain01,'learned motor gain did not exceed fresh baseline');
const lesion=new CerebellarBasalGangliaMotorLoop(); lesion.setLesion(true);
const lesionFrame=lesion.observe({action:'explore',predictedUtility01:.72,cerebellarForwardError01:.12,cerebellarCorrection01:.4,basalGangliaGate01:.9,reward01:.9,surprise01:.5,energy01:.9,cognitiveCapacity01:.9,tick:200});
assert(lesion.diagnostics().outcomeUpdates===0,'lesion should block plasticity');
const snap=motor.snapshot(); const restored=new CerebellarBasalGangliaMotorLoop(); restored.restore(snap);
assert(restored.diagnostics().outcomeUpdates===learned.outcomeUpdates,'motor loop persistence mismatch');
const d=learned;
console.log(JSON.stringify({pass:'BIG_PASS_218_CEREBELLAR_BASAL_GANGLIA_MOTOR_LOOP',learning:{bestSkill01:d.bestSkill01,outcomeUpdates:d.outcomeUpdates,sparseSkips:d.sparseSkips,lastGain:last.motorGain01,freshGain:freshFrame.motorGain01},causal:{lesionPlasticity:lesion.diagnostics().outcomeUpdates,lesionGain:lesionFrame.motorGain01,lesionLearningCredit:lesionFrame.learningCredit01},persistence:{outcomeUpdates:restored.diagnostics().outcomeUpdates},verified:true},null,2));
