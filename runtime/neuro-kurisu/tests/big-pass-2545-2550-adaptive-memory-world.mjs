import { AdaptiveNeuralContinuityController, defaultAdaptiveNeuralContinuity } from '../src/organism/cognition/AdaptiveNeuralContinuityController.ts';

const assert=(c,m)=>{if(!c)throw new Error(m)};
const clamp=x=>Math.max(0,Math.min(1,x));
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const controller=new AdaptiveNeuralContinuityController();
controller.restore(defaultAdaptiveNeuralContinuity());

let previousErr=Infinity;
let opSet=new Set();
for(let tick=1;tick<=1400;tick++){
  const latent=Array.from({length:8},(_,i)=>Math.tanh(Math.sin(tick*.037+i*.41)+(i%3)*.08));
  const input=Array.from({length:64},(_,i)=>Math.tanh(Math.sin(tick*.019+i*.07)+Math.cos(tick*.011+i)));
  const nextLatent=latent.map((v,i)=>clamp(.62*v+.24*Math.sin(tick*.013+i*.3)+.12*((tick+i)%7)/6)*2-1);
  const signals={
    novelty01:clamp(.04+.70*Math.abs(Math.sin(tick*.041))),
    uncertainty01:clamp(.2+.65*Math.abs(Math.cos(tick*.027))),
    predictionError01:clamp(.18+.42*Math.abs(Math.sin(tick*.023))),
    goalPressure01:clamp(.3+.45*Math.abs(Math.sin(tick*.017))),
    homeostasis01:clamp(.45+.4*Math.cos(tick*.015)),
    identityGap01:clamp(.2+.35*Math.abs(Math.sin(tick*.009))),
    reward01:clamp(.55+.35*Math.sin(tick*.031)),
    thermal01:.18,energy01:.82,load01:.25,
  };
  const pre=controller.beforeDecision(input,latent,signals,actions[tick%actions.length]);
  opSet.add(pre.operation);
  controller.commitAction(actions[tick%actions.length]);
  controller.afterOutcome({tick,input,latent,nextLatent,action:actions[tick%actions.length],reward01:signals.reward01,predictionError01:signals.predictionError01,verified01:tick%7===0?1:0,novelty01:signals.novelty01,uncertainty01:signals.uncertainty01,goalPressure01:signals.goalPressure01,identityGap01:signals.identityGap01,homeostasis01:signals.homeostasis01});
  if(tick%10===0){
    const m=controller.metrics();
    const avg=m.horizonErrors.reduce((a,b)=>a+b,0)/m.horizonErrors.length;
    previousErr=Math.min(previousErr,avg);
    assert(Number.isFinite(avg),'non-finite world error');
    assert(m.memoryCount>=0 && m.memoryCount<=48,'memory capacity violated');
    assert(m.computeBudget01>=0 && m.computeBudget01<=1,'compute budget invalid');
  }
}

const m=controller.metrics();
assert(opSet.size>=3,`memory policy explored too few operations: ${[...opSet].join(',')}`);
assert(m.memoryCount>0,'memory bank did not learn');
assert(m.horizonConfidence01.every(Number.isFinite),'invalid horizon confidence');
assert(m.learnedPolicyUpdates>=1400,'memory policy did not learn online');
assert(m.antiForgetting01>=0 && m.antiForgetting01<=1,'anti-forgetting out of range');
assert(m.consolidationCycles>0,'sleep consolidation never ran');
assert(m.epistemicValue01>=0 && m.epistemicValue01<=1,'epistemic value invalid');

const snap=controller.snapshot();
const restored=new AdaptiveNeuralContinuityController();
restored.restore(snap);
const r=restored.metrics();
assert(r.memoryCount===m.memoryCount,'persistence memory count mismatch');
assert(Math.abs(r.antiForgetting01-m.antiForgetting01)<1e-9,'persistence anti-forgetting mismatch');

console.log('B2545_B2550_ADAPTIVE_MEMORY_WORLD_PASS');
console.log(JSON.stringify({memoryCount:m.memoryCount,memoryHits:m.memoryHits,operations:m.operations,lastOperation:m.lastOperation,opSet:[...opSet],horizonErrors:m.horizonErrors,horizonConfidence01:m.horizonConfidence01,antiForgetting01:m.antiForgetting01,anchorDrift01:m.anchorDrift01,consolidationCycles:m.consolidationCycles,consolidationMerges:m.consolidationMerges,computeBudget01:m.computeBudget01,replayBudget:m.replayBudget,sleepBudget:m.sleepBudget,epistemicValue01:m.epistemicValue01,disagreement01:m.disagreement01,learnedPolicyUpdates:m.learnedPolicyUpdates,antiForgetEvents:m.antiForgetEvents},null,2));
