import assert from 'node:assert/strict';
import { WorldModelEvidenceGate } from '../src/organism/cognition/WorldModelEvidenceGate.ts';
import { EmbodiedCausalWorldBridge } from '../src/organism/cognition/EmbodiedCausalWorldBridge.ts';

const ACTIONS=['respond','explore','verify','rest','reflect','wait','defer'];
const baseUtilities=Object.fromEntries(ACTIONS.map((a,i)=>[a,.45+i*.03]));
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));

// 1) Evidence gate must learn to favor the model that is currently better calibrated.
const gate=new WorldModelEvidenceGate();
let lowQualityWeight=0;
let highQualityWeight=0;
for(let t=1;t<=2200;t++){
  const first=t<=1100;
  const continuityReward=first?.82:.34;
  const embodiedReward=first?.31:.79;
  const cc=first?.91:.42;
  const ec=first?.36:.93;
  const embRewards=ACTIONS.map((_,i)=>clamp(embodiedReward+(i===2?.05:0)-(i===5?.03:0)));
  const contRewards=ACTIONS.map((_,i)=>clamp(continuityReward+(i===0?.04:0)));
  const out=gate.arbitrate({tick:t,baseUtilities,continuityReward01:continuityReward,continuityConfidence01:cc,continuityDisagreement01:first?.08:.28,embodiedReward01:embodiedReward,embodiedConfidence01:ec,embodiedConsistency01:ec,causalSensitivity01:.4,epistemicValue01:first?.2:.7,computeBudget01:.72,continuityActionRewards01:contRewards,embodiedActionRewards01:embRewards,embodiedActionConfidence01:ACTIONS.map(()=>ec)});
  const realized=t%7<4?(first?.82:.79):(first?.80:.30);
  gate.afterOutcome({reward01:realized,continuityPred01:continuityReward,embodiedPred01:embodiedReward,verified01:t%5===0?1:.6,causalGain01:.25,transfer01:.8});
  if(first) lowQualityWeight+=out.weightEmbodied01; else highQualityWeight+=out.weightEmbodied01;
  for(const a of Object.values(out.actionBias)) assert.ok(Math.abs(a)<=.061,'gate residual escaped bound');
}
const gm=gate.metrics();
assert.ok(gm.observations===2200,'gate observations mismatch');
assert.ok(gm.counterfactualChecks===2200,'counterfactual checks missing');
assert.ok(gm.transfer01>.7,'gate transfer did not accumulate');
assert.ok(gm.agreement01>=0&&gm.calibration01>=0,'gate calibration invalid');
assert.ok(highQualityWeight/1100 > lowQualityWeight/1100,'gate failed to adapt toward later better model');

// 2) Async sensors: stale frames must increase penalty, while novelty/uncertainty must raise compute allocation.
const bridge=new EmbodiedCausalWorldBridge();
const featureBase=Array.from({length:64},(_,i)=>Math.sin(i*.13));
let freshCompute=0, stalePenalty=0, highUrgencyCompute=0;
for(let t=1;t<=480;t++){
  const stale=(t%9<6);
  const urgency=t>360;
  const frame=(k)=>({tick:t,values:new Array(4).fill(0).map((_,j)=>Math.sin(t*.01+k+j)),freshness01:stale&&k%2===0?.18:.94,confidence01:stale&&k%2===0?.35:.91,ageTicks:stale&&k%2===0?7:0,source:['vision','audio','interoception','world','social','context'][k]});
  const out=bridge.beforeDecision({tick:t,features:featureBase.map((v,i)=>v+Math.sin((t+i)*.003)*.02),actionUtilities:baseUtilities,novelty01:urgency?.72:.12,uncertainty01:urgency?.76:.10,predictionError01:urgency?.65:.08,computeBudget01:urgency?.88:.35,sensors:{vision:frame(0),audio:frame(1),interoception:frame(2),world:frame(3),social:frame(4),context:frame(5)}});
  const next=featureBase.map((v,i)=>v+Math.sin((t+i)*.007)*.04);
  bridge.afterOutcome({tick:t,action:ACTIONS[(t*3)%ACTIONS.length],nextFeatures:next,reward01:urgency?.72:.48,verified01:t%11===0?1:.5,predictionError01:urgency?.45:.08,sensorFreshness01:stale?.42:.94});
  if(!stale) freshCompute+=out.computeCost01; else stalePenalty+=out.asyncSensorPenalty01;
  if(urgency) highUrgencyCompute+=out.computeCost01;
}
const bm=bridge.metrics();
assert.ok(bm.transitions===480,'bridge transition count mismatch');
assert.ok(bm.matchedAlternativeCount>0,'matched causal comparisons missing');
assert.ok(bm.transfer01>.65,'embodied transfer too weak');
assert.ok(bm.predictionConsistency01>.70,'prediction consistency too weak');
assert.ok(stalePenalty/240>0,'async penalty did not activate');
assert.ok(highUrgencyCompute/120>freshCompute/240,'high urgency did not increase compute allocation');

// 3) Persistence must retain evidence-gate and embodied bridge state.
const snap={gate:gate.snapshot(),bridge:bridge.snapshot()};
const gate2=new WorldModelEvidenceGate(); gate2.restore(snap.gate);
const bridge2=new EmbodiedCausalWorldBridge(); bridge2.restore(snap.bridge);
assert.equal(gate2.metrics().counterfactualChecks,gm.counterfactualChecks,'gate persistence lost checks');
assert.equal(bridge2.metrics().transitions,bm.transitions,'bridge persistence lost transitions');
assert.ok(Math.abs(bridge2.metrics().transfer01-bm.transfer01)<1e-9,'bridge transfer changed after restore');

console.log('B2567_2574_ACTIONABLE_WORLD_GATE_PASS');
console.log(JSON.stringify({gate:{observations:gm.observations,continuityWeight01:gm.continuityWeight01,embodiedWeight01:gm.embodiedWeight01,agreement01:gm.agreement01,calibration01:gm.calibration01,transfer01:gm.transfer01,selectedModel:gm.selectedModel,promotions:gm.promotions,demotions:gm.demotions},bridge:{transitions:bm.transitions,matchedAlternativeCount:bm.matchedAlternativeCount,causalSensitivity01:bm.causalSensitivity01,transfer01:bm.transfer01,predictionConsistency01:bm.predictionConsistency01,activePerception01:bm.activePerception01,computeCost01:bm.computeCost01,asyncSensorPenalty01:bm.asyncSensorPenalty01,meanFreshCompute:freshCompute/240,meanStalePenalty:stalePenalty/240,meanHighUrgencyCompute:highUrgencyCompute/120}},null,2));
