import assert from 'node:assert/strict';
import { B2504UnifiedSelfWorldPredictiveField } from '../src/organism/cognition/B2504UnifiedSelfWorldPredictiveField.ts';
import { B2505CompositionalReplayComposer } from '../src/organism/cognition/B2505CompositionalReplayComposer.ts';
import { B2506NeuralBottleneckEscalator } from '../src/organism/cognition/B2506NeuralBottleneckEscalator.ts';
import { B2507ConsolidationScheduler } from '../src/organism/cognition/B2507ConsolidationScheduler.ts';
import { B2508AdaptiveNeuralComputeGovernor } from '../src/organism/cognition/B2508AdaptiveNeuralComputeGovernor.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer'];
const bu=Object.fromEntries(A.map((a,k)=>[a,k===2?.74:.48]));
const st=t=>Array.from({length:32},(_,k)=>Math.max(0,Math.min(1,.5+.22*Math.sin(t*.13+k*.21))));
const b4=new B2504UnifiedSelfWorldPredictiveField();
let firstErr=0,lastErr=0;
for(let t=1;t<=90;t++){
  const s=st(t), next=st(t+1); const o=b4.beforeDecision({tick:t,state01:s,baseUtilities:bu,uncertainty01:.25,predictionError01: t<15?.55:.18,novelty01:.35,energy01:.8,cognitiveLoad01:.2,goalPressure01:.6});
  const r=o.selectedAction==='verify'?.92:.22; const pred=o.predictedUtility[o.selectedAction]??.5; const e=Math.abs(r-pred); if(t===1)firstErr=e; if(t===90)lastErr=e;
  b4.afterOutcome({tick:t,action:o.selectedAction,reward01:r,nextState01:next,verified01:t%3===0?1:0,predictionError01:e});
}
const d4=b4.diagnostics(), l4=b4.lesionFraction();
assert.ok(d4.cycles===90 && d4.learningUpdates===90 && d4.rollouts>0); assert.ok(l4.effect01>0.001); assert.ok(d4.calibration01>0.45);
const b5=new B2505CompositionalReplayComposer();
for(let t=1;t<=120;t++){
  const s=st(t),o=b5.beforeDecision({tick:t,state01:s,actionUtilities:bu,uncertainty01:.3,novelty01:.45,goalPressure01:.6});
  const r=o.selectedAction==='verify'?.95:.18;
  b5.afterOutcome({tick:t,action:o.selectedAction,reward01:r,nextState01:st(t+1),verified01:t%4===0?1:0,predictionError01:Math.abs(r-(o.predictedUtility[o.selectedAction]??.5))});
  if(t%10===0)b5.consolidate(4);
}
const d5=b5.diagnostics(),l5=b5.lesionFraction();
assert.ok(d5.primitiveCreates>0&&d5.primitiveHits>0&&d5.compositions>0&&d5.replaySteps>0); assert.ok(l5.effect01>0.001);
const b6=new B2506NeuralBottleneckEscalator();
for(let t=1;t<=40;t++) b6.beforeDecision({tick:t,baseUtilities:bu,neuralUtilities:A.map(()=>bu),neuralConfidences:A.map(()=>.85),uncertainty01:.12,predictionError01:.10,causalEffects01:[.15,.12,.10,.09,.08],performanceProfile:'balanced',energy01:.85,thermal01:.15});
const d6a=b6.diagnostics(); b6.afterOutcome({tick:41,reward01:.9,predicted01:.88,verified01:1,predictionError01:.02}); assert.ok(d6a.authority01>.28);
for(let t=42;t<=65;t++) b6.beforeDecision({tick:t,baseUtilities:bu,neuralUtilities:A.map(()=>Object.fromEntries(A.map(a=>[a,.5]))),neuralConfidences:A.map(()=>.25),uncertainty01:.85,predictionError01:.8,causalEffects01:[0,0,0,0,0],performanceProfile:'mobile',energy01:.22,thermal01:.82});
const d6b=b6.diagnostics(); assert.ok(d6b.authority01<d6a.authority01);
const b7=new B2507ConsolidationScheduler(); const p7=b7.plan({tick:1,uncertainty01:.82,predictionError01:.78,novelty01:.7,energy01:.7,cognitiveLoad01:.3,thermal01:.2,resting01:1}); assert.ok(p7.budget>=4&&p7.mode!=='awake');
const p7g=b7.plan({tick:2,uncertainty01:.1,predictionError01:.1,novelty01:.1,energy01:.9,cognitiveLoad01:.2,thermal01:.1,resting01:0}); assert.equal(p7g.mode,'awake');
const b8=new B2508AdaptiveNeuralComputeGovernor(); const q8=b8.beforeDecision({tick:1,profile:'quality',energy01:.8,thermal01:.1,uncertainty01:.75,predictionError01:.7,cognitiveLoad01:.2,novelty01:.6}); const q8g=b8.beforeDecision({tick:2,profile:'mobile',energy01:.18,thermal01:.88,uncertainty01:.8,predictionError01:.7,cognitiveLoad01:.7,novelty01:.5}); assert.ok(q8.horizon>=3); assert.ok(q8g.horizon===1&&q8g.runDeepNeural===false);
console.log(JSON.stringify({pass:true,status:'B2504_B2508_NEURAL_STACK_PASS',b2504:{diagnostics:d4,lesion:l4,firstErr,lastErr},b2505:{diagnostics:d5,lesion:l5},b2506:{good:d6a,bad:d6b},b2507:{highPressure:p7,lowPressure:p7g},b2508:{quality:q8,guarded:q8g}},null,2));
