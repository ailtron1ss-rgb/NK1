import { AdaptiveNeuralContinuityController } from '../src/organism/cognition/AdaptiveNeuralContinuityController.ts';
const assert=(c,m)=>{if(!c)throw new Error(m)};
const controller=new AdaptiveNeuralContinuityController();
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const makeInput=(phase,t)=>Array.from({length:64},(_,i)=>Math.tanh(Math.sin(t*.021+i*.091+phase*2.7)));
const makeLatent=(phase,t)=>Array.from({length:8},(_,i)=>Math.tanh(Math.cos(t*.017+i*.37+phase*2.1)));
const run=(phase,start,count)=>{
  for(let n=0;n<count;n++){
    const tick=start+n,input=makeInput(phase,tick),latent=makeLatent(phase,tick),nextLatent=makeLatent(phase,tick+1);
    const highValue=phase===0;
    const signals={novelty01:highValue?.48:.72,uncertainty01:highValue?.18:.55,predictionError01:highValue?.10:.42,goalPressure01:highValue?.62:.35,homeostasis01:.76,identityGap01:highValue?.58:.16,reward01:highValue?.86:.44,thermal01:.16,energy01:.84,load01:.22};
    controller.beforeDecision(input,latent,signals,actions[tick%actions.length]);
    controller.commitAction(actions[tick%actions.length]);
    controller.afterOutcome({tick,input,latent,nextLatent,action:actions[tick%actions.length],reward01:signals.reward01,predictionError01:signals.predictionError01,verified01:highValue||tick%11===0?1:0,novelty01:signals.novelty01,uncertainty01:signals.uncertainty01,goalPressure01:signals.goalPressure01,identityGap01:signals.identityGap01,homeostasis01:signals.homeostasis01});
  }
};
run(0,1,600);
const before=controller.diagnostics();
const phaseAProtected=before.memoryBank.filter(m=>m.createdTick<=600&&m.protected01>.65).length;
run(1,601,1800);
const after=controller.diagnostics();
const retainedA=after.memoryBank.filter(m=>m.createdTick<=600&&m.protected01>.60).length;
assert(phaseAProtected>0,'phase A did not create protected anchors');
assert(retainedA>0,'phase A protected anchors were completely forgotten');
assert(after.antiForgetting01>0.35,'anti-forgetting gate collapsed');
assert(after.memoryBank.length<=48,'memory capacity exceeded');
assert(after.consolidationCycles>0,'sleep consolidation missing');
console.log('B2546_B2550_ANTI_FORGETTING_PASS',JSON.stringify({phaseAProtected,retainedA,memoryCount:after.memoryBank.length,antiForgetting01:after.antiForgetting01,anchorDrift01:after.anchorDrift01,antiForgetEvents:after.antiForgetEvents,consolidationCycles:after.consolidationCycles},null,2));
