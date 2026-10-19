import assert from 'node:assert/strict';
import { B2509EmbodiedHomeostaticActionField } from '../src/organism/cognition/B2509EmbodiedHomeostaticActionField.ts';
import { B2510DevelopmentalPersonalityCoupling } from '../src/organism/cognition/B2510DevelopmentalPersonalityCoupling.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const bu=Object.fromEntries(A.map((a,k)=>[a,k===1?.68:k===3?.58:.46]));
const needs=()=>({energy:.68,cognitiveLoad:.25,uncertainty:.30,socialNeed:.25,novelty:.42,identityCoherence:.72,goalPressure:.54});
const emb=()=>({bodyEnergy01:.68,cognitiveCapacity01:.76,thermalStrain01:.18,sensoryFreshness01:.82,awake:true,battery01:.74,cpuLoad01:.24,ramPressure01:.22});
const b9=new B2509EmbodiedHomeostaticActionField(); let first=0,last=0;
for(let t=1;t<=240;t++){
  const o=b9.beforeDecision({tick:t,baseUtilities:bu,needs:needs(),embodiment:emb(),sensorFreshness01:.82,visionSignal01:.72,audioSignal01:.44,uncertainty01:.30,predictionError01:t<30?.52:.16,goalPressure01:.54,b2504Prediction:bu,computeBudget01:.62});
  const chosen=o.selectedAction; const reward=chosen==='rest'?.78:chosen==='explore'?.82:.34; const next=[.72,.17,.82,.84,.78,.20,.19,1,.28,.38,.50,.16].map(x=>Math.max(0,Math.min(1,x+(chosen==='rest'?0.03:chosen==='explore'?-.02:0))));
  if(t===1)first=o.actionBias[chosen]??0; if(t===240)last=o.actionBias[chosen]??0; b9.afterOutcome({tick:t,action:chosen,nextBody:next,reward01:reward,verified01:t%3===0?1:0,predictionError01:Math.abs(reward-(o.predictedUtility[chosen]??.5))});
}
const d9=b9.diagnostics(), lesion9=b9.lesionFraction(.5); assert.ok(d9.cycles===240&&d9.learningUpdates>=70&&d9.verifiedSamples>=70); assert.ok(d9.proactiveRegulation01>0.45&&d9.sensorReliability01>0.55); assert.ok(lesion9.utilityEffect01>0.0001);
const b10=new B2510DevelopmentalPersonalityCoupling(); let stage='';
for(let t=1;t<=420;t++){
  const b299TraitSignals={curiosity:.20,truth:.14,reflection:.08,care:.10,preservation:-.02,persistence:.16,caution:.06,autonomy:.22,epistemic:.18,social:.12,initiative:.15,restraint:.04};
  const o=b10.beforeDecision({tick:t,baseUtilities:bu,b299TraitSignals,b299Stability01:.72,agency01:.72,authorship01:.64,selfContinuity01:.76,autonomy01:.74,uncertainty01:.25,novelty01:.44,goalPressure01:.58,predictionError01:.16,socialNeed01:.28,verifiedHistory01:Math.min(1,t/160)});
  const reward=o.selectedAction==='verify'?.84:o.selectedAction==='explore'?.79:o.selectedAction==='rest'?.70:.39;
  b10.afterOutcome({tick:t,action:o.selectedAction,reward01:reward,predictionError01:Math.abs(reward-(bu[o.selectedAction]??.5)),verified01:t%4===0?1:0,autonomous01:t%5===0?.9:.7,causalMatch01:t%4===0?.86:.62,selfContinuity01:.76,goalPressure01:.58,novelty01:.44,socialNeed01:.28,b299TraitSignals}); stage=o.developmentalConfidence01;
}
const d10=b10.diagnostics(),lesion10=b10.lesionFraction(.5); assert.ok(d10.samples===420&&d10.verifiedSamples>90&&d10.consolidationSteps>15); assert.ok(d10.maturity01>.12&&d10.stability01>.45&&d10.selfAuthoredDevelopment01>.1); assert.ok(lesion10.actionBiasEffect01>0.001);
console.log(JSON.stringify({pass:true,status:'B2509_B2510_EMBODIED_PERSONALITY_PASS',b2509:{diagnostics:d9,firstBias:first,lastBias:last,lesion:lesion9},b2510:{diagnostics:d10,lastConfidence:stage,lesion:lesion10}},null,2));
