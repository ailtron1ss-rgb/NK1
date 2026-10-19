import { B290RealityGatedNeurodevelopment } from '../src/organism/system/B290RealityGatedNeurodevelopment.ts';
const assert=(x,m)=>{if(!x)throw new Error(m)};
const s=new B290RealityGatedNeurodevelopment();
for(let i=1;i<=320;i++){
  const o=s.observe({tick:i,b289Integration01:.72,b289Agency01:.60,b289Identity01:.84,b289Reality01:.67,morphStructuralFitness01:.73,morphNeurons:48,morphSynapses:144,selfAgency01:.62,selfCoherence01:.79,causalVerified01:i%5===0?1:.55,causalCalibration01:.63,eventLineage01:.88,cycleCoverage01:.76,predictionError01:.18+(i%13)/60,uncertainty01:.24+(i%9)/55,novelty01:.25+(i%11)/40,energy01:.82,thermal01:.18});
  assert(['explore','verify','consolidate','reflect','recover','protect'].includes(o.mode),'valid mode');
  s.learnFromOutcome({tick:i,action:o.mode==='explore'?'explore':o.mode==='verify'?'verify':o.mode==='reflect'?'reflect':o.mode==='recover'?'rest':'wait',reward01:.55+(i%7)/40,predictionError01:.15+(i%9)/50,externallyGrounded01:i%5===0?1:.6,identityContinuity01:.84});
}
const modeSamples=[];
for (const profile of [
  {energy01:.18,thermal01:.72,causalVerified01:0,causalCalibration01:.12,novelty01:.25,predictionError01:.22,uncertainty01:.35},
  {energy01:.82,thermal01:.18,causalVerified01:0,causalCalibration01:.18,novelty01:.22,predictionError01:.20,uncertainty01:.34},
  {energy01:.84,thermal01:.12,causalVerified01:1,causalCalibration01:.86,novelty01:.78,predictionError01:.72,uncertainty01:.70},
]) {
  modeSamples.push(s.observe({tick:1000+modeSamples.length,b289Integration01:.52,b289Agency01:.62,b289Identity01:.70,b289Reality01:.66,morphStructuralFitness01:.62,morphNeurons:40,morphSynapses:120,selfAgency01:.65,selfCoherence01:.70,causalVerified01:profile.causalVerified01,causalCalibration01:profile.causalCalibration01,eventLineage01:.80,cycleCoverage01:.65,predictionError01:profile.predictionError01,uncertainty01:profile.uncertainty01,novelty01:profile.novelty01,energy01:profile.energy01,thermal01:profile.thermal01}).mode);
}
assert(new Set(modeSamples).size>=2,'mode controller responds to materially different conditions');
const d=s.diagnostics();
assert(d.cycles===323,'cycles');
assert(d.learningUpdates===320,'learning updates');
assert(d.evidenceStrength01>.45,'evidence strength');
assert(d.causalConfidence01>.45,'causal confidence');
assert(d.realityGate01>.3,'gate');
assert(d.recentDepth<=128,'bounded history');
const explore=s.actionBias('explore'), rest=s.actionBias('rest');
assert(Number.isFinite(explore)&&Number.isFinite(rest),'finite biases');
const snap=s.snapshot(); const r=new B290RealityGatedNeurodevelopment(); r.restore(snap); assert(JSON.stringify(r.diagnostics().modeCounts)===JSON.stringify(d.modeCounts),'persistence');
console.log(JSON.stringify({pass:true,diagnostics:d,exploreBias:explore,restBias:rest},null,2));
