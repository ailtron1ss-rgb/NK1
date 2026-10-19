import { B293SelfWorldPredictiveMicrocircuit } from '../src/organism/system/B293SelfWorldPredictiveMicrocircuit.ts';
const assert=(x,m)=>{if(!x)throw new Error(m)};
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const c=new B293SelfWorldPredictiveMicrocircuit();
let maxError=0;
for(let tick=1;tick<=1000;tick++){
  const action=actions[tick%actions.length];
  const r=c.step({tick,action,selfContinuity01:.76+(tick%17)/180,selfCoherence01:.72+(tick%11)/200,identityFit01:.78,worldCoherence01:.70+(tick%19)/220,realityAlignment01:.74,goalPressure01:tick%23===0?.82:.56,novelty01:tick%29===0?.78:.31,uncertainty01:tick%31===0?.66:.22,predictionError01:tick%13===0?.58:.18,energy01:tick%37===0?.24:.78,thermal01:tick%41===0?.72:.20});
  c.learnFromOutcome({tick,action,reward01:tick%17===0?.34:.72,actualSelf01:tick%19===0?.51:.78,actualWorld01:tick%23===0?.48:.74,predictionError01:tick%13===0?.62:.20,identityContinuity01:.78,novelty01:tick%29===0?.78:.31});
  maxError=Math.max(maxError,r.predictionError01);
  assert(Number.isFinite(r.predictedSelf01)&&Number.isFinite(r.predictedWorld01),'finite predictions');
}
const probeBefore=c.step({tick:1001,action:'explore',selfContinuity01:.76,selfCoherence01:.72,identityFit01:.78,worldCoherence01:.70,realityAlignment01:.74,goalPressure01:.56,novelty01:.31,uncertainty01:.22,predictionError01:.18,energy01:.78,thermal01:.20});
c.lesion(.65);
const probeAfter=c.step({tick:1002,action:'explore',selfContinuity01:.76,selfCoherence01:.72,identityFit01:.78,worldCoherence01:.70,realityAlignment01:.74,goalPressure01:.56,novelty01:.31,uncertainty01:.22,predictionError01:.18,energy01:.78,thermal01:.20});
const delta=Math.abs(probeBefore.predictedWorld01-probeAfter.predictedWorld01)+Math.abs(probeBefore.predictedSelf01-probeAfter.predictedSelf01);
c.clearLesion();
const snap=c.snapshot(); const restored=new B293SelfWorldPredictiveMicrocircuit(); restored.restore(snap);
const d=c.diagnostics();
assert(d.cycles===1002,'1002 cycles including causal probe');
assert(d.learningUpdates===1000,'1000 learning updates');
assert(d.spikes>0,'spiking activity');
assert(d.synapticUpdates>0,'plasticity happened');
assert(d.historyDepth<=128,'bounded history');
assert(delta>0,'lesion must alter predicted self/world response');
assert(restored.metrics().cycles===1002,'persistence cycles');
console.log(JSON.stringify({pass:true,cycles:d.cycles,learningUpdates:d.learningUpdates,spikes:d.spikes,synapticUpdates:d.synapticUpdates,predictionError01:d.predictionError01,causalConfidence01:d.causalConfidence01,maxError,lesionCausalDelta:delta},null,2));
