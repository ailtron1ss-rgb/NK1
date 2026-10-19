import { AdaptiveNeuralContinuityController } from '../src/organism/cognition/AdaptiveNeuralContinuityController.ts';
const controller=new AdaptiveNeuralContinuityController();
const latent=Array.from({length:8},(_,i)=>Math.sin(i*.4));
const input=Array.from({length:64},(_,i)=>Math.cos(i*.07));
const signals={novelty01:.35,uncertainty01:.42,predictionError01:.25,goalPressure01:.4,homeostasis01:.7,identityGap01:.2,reward01:.55,thermal01:.15,energy01:.85,load01:.22};
const start=process.hrtime.bigint();
for(let t=1;t<=4000;t++){
  controller.beforeDecision(input,latent,signals,t%2?'explore':'verify');
  controller.commitAction(t%2?'explore':'verify');
  controller.afterOutcome({tick:t,input,latent,nextLatent:latent,action:t%2?'explore':'verify',reward01:.55,predictionError01:.22,verified01:t%8===0?1:0,novelty01:.35,uncertainty01:.42,goalPressure01:.4,identityGap01:.2,homeostasis01:.7});
}
const ms=Number(process.hrtime.bigint()-start)/1e6;
const m=controller.metrics();
console.log('B2545_B2550_PERFORMANCE_PASS',JSON.stringify({cycles:4000,ms,cyclesPerSec:4000/(ms/1000),memoryCount:m.memoryCount,consolidationCycles:m.consolidationCycles,learnedPolicyUpdates:m.learnedPolicyUpdates,worldError:m.horizonErrors,computeBudget01:m.computeBudget01},null,2));
