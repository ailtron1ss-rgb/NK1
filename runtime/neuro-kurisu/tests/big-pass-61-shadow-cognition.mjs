import assert from 'node:assert/strict';
import { ShadowOrganismEngine } from '../src/organism/system/ShadowOrganism.ts';
import { CognitiveExecutionPlanner } from '../src/organism/core/CognitiveExecutionPlanner.ts';
import { organismSystemContracts } from '../src/organism/core/OrganismSystemContract.ts';

const baseState={tick:10,needs:{energy:.82,uncertainty:.42,cognitiveLoad:.28}};
const lowCandidates=[
  {id:'a',action:'verify',score:.70,predictedUtility:.80,predictedNeedRelief:.78,predictedCost:.18,confidence:.90,generatedAt:Date.now()},
  {id:'b',action:'explore',score:.50,predictedUtility:.54,predictedNeedRelief:.48,predictedCost:.62,confidence:.52,generatedAt:Date.now()},
  {id:'c',action:'rest',score:.42,predictedUtility:.40,predictedNeedRelief:.35,predictedCost:.05,confidence:.52,generatedAt:Date.now()},
];
const shadow=new ShadowOrganismEngine();
const d=shadow.decide({state:baseState,candidates:lowCandidates,actualAction:'verify',pressure01:.30});
assert.equal(d.panel.length,5);
assert.equal(d.escalation,false);
assert.equal(shadow.snapshot().lastEscalationTick,-999999);
assert.ok(d.disagreement01<.45);

const high=shadow.decide({state:{...baseState, tick:11, needs:{energy:.82,uncertainty:.92,cognitiveLoad:.32}},candidates:[
  {id:'h1',action:'explore',score:.65,predictedUtility:.94,predictedNeedRelief:.10,predictedCost:.82,confidence:.30,generatedAt:Date.now()},
  {id:'h2',action:'verify',score:.64,predictedUtility:.30,predictedNeedRelief:.90,predictedCost:.10,confidence:.92,generatedAt:Date.now()},
  {id:'h3',action:'rest',score:.41,predictedUtility:.42,predictedNeedRelief:.15,predictedCost:.05,confidence:.55,generatedAt:Date.now()},
],actualAction:'explore',pressure01:.90});
assert.equal(high.escalation,true);
assert.ok(high.disagreement01>=.6);
const cooled=shadow.decide({state:{...baseState, tick:12},candidates:[
  {id:'h1',action:'explore',score:.65,predictedUtility:.94,predictedNeedRelief:.10,predictedCost:.82,confidence:.30,generatedAt:Date.now()},
  {id:'h2',action:'verify',score:.64,predictedUtility:.30,predictedNeedRelief:.90,predictedCost:.10,confidence:.92,generatedAt:Date.now()},
  {id:'h3',action:'rest',score:.41,predictedUtility:.42,predictedNeedRelief:.15,predictedCost:.05,confidence:.55,generatedAt:Date.now()},
],actualAction:'explore',pressure01:.90});
assert.equal(cooled.escalation,false);
assert.ok(high.disagreement01>.3);

shadow.observeOutcome({tick:10,actualSuccess:.90,actualAction:'verify'});
assert.ok(shadow.snapshot().meanRegret01>=0);
const restored=new ShadowOrganismEngine();
restored.restore(shadow.snapshot());
assert.equal(restored.snapshot().comparisons,3);

const planner=new CognitiveExecutionPlanner();
const frame={version:1,tick:11,at:Date.now(),externalInput:false,signalMask:0,domains:{self:true,world:true,memory:true,agency:true,embodiment:true,research:true,governance:true},surprise01:.2,novelty01:.3,predictionError01:.25,uncertainty01:.72,goalPressure01:.30,energy01:.82,cognitiveCapacity01:.82,thermal01:.20,ramPressure01:.20,complexity01:.28,expectedInformationGain01:.35,reason:'fixture'};
const pressure={
  version:1,total01:.82,dominantType:'prediction-error',informationUrgency01:.76,
  domains:{self:.42,world:.88,memory:.31,agency:.42,embodiment:.20,research:.72,governance:.34},
  actionBias:{respond:.05,explore:.45,verify:.82,rest:.15,reflect:.40,wait:.12,defer:.10},
  sources:{count:2,unresolvedCount:1,agingPredictions:1,groundingUncertainty01:.48,groundingConflict01:.16,shadowDisagreement01:high.disagreement01,shadowEscalation01:high.escalation?1:0}
};
const plan=planner.compile(frame,{mode:'balanced',reason:'shadow-regression',run:{research:true,'world-rollout':true,shadow:true,project:false},remainingBudget01:.90,priority01:.6,activeDomains:['self','world','memory','agency','embodiment','research','governance']},.90,pressure,organismSystemContracts());
assert.equal(plan.run.shadow,true);
assert.equal(plan.run['slow-cognition'],true);
console.log('BIG_PASS_61_SHADOW=PASS',JSON.stringify({low:{action:d.shadowAction,disagreement:d.disagreement01,entropy:d.entropy01,escalation:d.escalation},high:{action:high.shadowAction,disagreement:high.disagreement01,entropy:high.entropy01,escalation:high.escalation},slowCognition:plan.run['slow-cognition']}));
