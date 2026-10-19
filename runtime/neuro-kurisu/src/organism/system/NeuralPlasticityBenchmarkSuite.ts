import { B296NeuralPersonalityAgencyNucleus } from './B296NeuralPersonalityAgencyNucleus.ts';
import { NeuralMemoryContinuityCore } from './NeuralMemoryContinuityCore.ts';
import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const dist=(a:number[],b:number[])=>Math.sqrt(a.reduce((s,v,i)=>s+(v-(b[i]??0))**2,0)/Math.max(1,a.length));
const mean=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;

export interface NeuralBenchmarkReport {
 version:1;
 multiTimescale:{trainedRecall01:number;ablatedRecall01:number;gain01:number};
 antiForgetting:{AtoBtoCA01:number;ablation01:number;retentionGain01:number};
 lesionRecovery:{lesionEffect01:number;structuralDamage01:number;recovery01:number};
 sequence:{order01:number;causalLinks:number};
 falseMemory:{semanticDepth:number;rejected:number;unverifiedPromoted:boolean};
 restart:{memoryEquivalent01:number;neuralEquivalent01:number};
 overall01:number;
}

export class NeuralPlasticityBenchmarkSuite {
 private train(n:B296NeuralPersonalityAgencyNucleus,start:number,count:number,rate=1){
  for(let i=0;i<count;i++){
   const tick=start+i;
   n.step({tick,currentAction:ACTIONS[i%2],b269Assembly:[.1,.7,.2,.4],b270SelfLatent:[.3,.5,.8],b289Latent:[.2,.6,.4],b291Agency01:.7,b291IdentityFit01:.8,b291PersonalityFit01:.75,b293PredictedSelf01:.65,b293PredictedWorld01:.65,b293PredictionError01:.22,b294CausalConfidence01:.82,b295Budget01:.8,novelty01:.45,uncertainty01:.25,energy01:.8,goalPressure01:.65});
   n.learnFromOutcome({tick,action:ACTIONS[i%2],reward01:i%3===0?.92:.7,predictionError01:.18,identityContinuity01:.82,causalConfidence01:.86,externalEvidence01:1,learningRate01:rate});
  }
 }
 run():NeuralBenchmarkReport{
  const trained=new B296NeuralPersonalityAgencyNucleus();
  this.train(trained,1,72,1);
  const trainedSnap=trained.snapshot();
  const learned=clamp(trained.diagnostics().learningUpdates/72);
  const ablated=new B296NeuralPersonalityAgencyNucleus();
  this.train(ablated,1,72,0);
  const ablatedRecall=clamp(ablated.diagnostics().learningUpdates/72);
  const multi={trainedRecall01:learned,ablatedRecall01:ablatedRecall,gain01:clamp(.5+learned-ablatedRecall)};

  const seqMem=new NeuralMemoryContinuityCore();
  let prev:string|null=null;
  for(let i=0;i<9;i++){
   const e=seqMem.encode({tick:i+1,context:[i<3?1:0,i>=3&&i<6?1:0,i>=6?1:0,.4],action:'verify',reward01:.8,predictionError01:.2,verified01:.9,novelty01:.5,source:'benchmark',sequenceKey:'A-B-C',predecessorId:prev,protected01:.8});
   prev=e.id;
  }
  const seq=seqMem.sequenceRecall('A-B-C');

  const anti=new NeuralMemoryContinuityCore();
  for(let i=0;i<12;i++) anti.encode({tick:i+1,context:[1,0,.2],action:'verify',reward01:.8,predictionError01:.2,verified01:.9,novelty01:.5,source:'A'});
  for(let i=0;i<24;i++) anti.encode({tick:20+i,context:[0,1,.7],action:'respond',reward01:.4,predictionError01:.5,verified01:.7,novelty01:.4,source:'B'});
  for(let i=0;i<24;i++) anti.encode({tick:50+i,context:[0,0,1],action:'explore',reward01:.6,predictionError01:.4,verified01:.8,novelty01:.3,source:'C'});
  anti.consolidate(100,.9);
  const antiScore=mean(anti.semanticRecall([1,0,.2],4).map(x=>x.score01));
  const antiAblation=new NeuralMemoryContinuityCore();
  for(let i=0;i<12;i++) antiAblation.encode({tick:i+1,context:[1,0,.2],action:'verify',reward01:.8,predictionError01:.2,verified01:.9,novelty01:.5,source:'A'});
  for(let i=0;i<48;i++) antiAblation.encode({tick:20+i,context:[0,1,.7],action:'respond',reward01:.4,predictionError01:.5,verified01:.7,novelty01:.4,source:'B'});
  const antiAblationScore=mean(antiAblation.semanticRecall([1,0,.2],4).map(x=>x.score01));
  const antiForgetting={AtoBtoCA01:antiScore,ablation01:antiAblationScore,retentionGain01:clamp(antiScore-antiAblationScore+.5)};

  const lesionNet=new B296NeuralPersonalityAgencyNucleus();
  this.train(lesionNet,1,48,1);
  const before=ACTIONS.map(a=>lesionNet.actionBias(a));
  const lesion=lesionNet.lesion(.5);
  for(let i=0;i<8;i++) lesionNet.step({tick:60+i,currentAction:'verify',b269Assembly:[.1,.7,.2,.4],b270SelfLatent:[.3,.5,.8],b289Latent:[.2,.6,.4],b291Agency01:.7,b291IdentityFit01:.8,b291PersonalityFit01:.75,b293PredictedSelf01:.65,b293PredictedWorld01:.65,b293PredictionError01:.22,b294CausalConfidence01:.82,b295Budget01:.8,novelty01:.45,uncertainty01:.25,energy01:.8,goalPressure01:.65});
  const lesioned=ACTIONS.map(a=>lesionNet.actionBias(a));
  const lesionEffect=clamp(dist(before,lesioned));
  const structuralDamage=clamp(lesion.disabledSynapses/Math.max(1,lesion.disabledSynapses+lesion.activeSynapses));
  lesionNet.clearLesion();
  for(let i=0;i<16;i++) lesionNet.step({tick:70+i,currentAction:'verify',b269Assembly:[.1,.7,.2,.4],b270SelfLatent:[.3,.5,.8],b289Latent:[.2,.6,.4],b291Agency01:.7,b291IdentityFit01:.8,b291PersonalityFit01:.75,b293PredictedSelf01:.65,b293PredictedWorld01:.65,b293PredictionError01:.22,b294CausalConfidence01:.82,b295Budget01:.8,novelty01:.45,uncertainty01:.25,energy01:.8,goalPressure01:.65});
  const recovered=ACTIONS.map(a=>lesionNet.actionBias(a));
  const recovery=clamp(1-dist(before,recovered)/(dist(before,lesioned)+1e-6));

  const falseMem=new NeuralMemoryContinuityCore();
  for(let i=0;i<24;i++) falseMem.encode({tick:i+1,context:[i/24,.2,.3],action:'respond',reward01:.8,predictionError01:.2,verified01:.9,novelty01:.5,source:'verified'});
  falseMem.consolidate(2,.9);
  falseMem.encode({tick:100,context:[.99,.01,.01],action:'respond',reward01:.5,predictionError01:.9,verified01:.05,novelty01:.1,source:'unverified'});
  falseMem.consolidate(101,.9);
  const fd=falseMem.diagnostics();
  const unverifiedPromoted=falseMem.snapshot().semantic.some(s=>s.sourceKinds.includes('unverified'));

  const restored=new B296NeuralPersonalityAgencyNucleus();
  restored.restore(trainedSnap);
  const neuralEq=clamp(1-dist(trainedSnap.actionReadout.flat(),restored.snapshot().actionReadout.flat()));
  const m1=anti.snapshot();
  const m2=new NeuralMemoryContinuityCore();
  m2.restore(m1);
  const q1=anti.recall([1,0,.2],4,90),q2=m2.recall([1,0,.2],4,90);
  const memEq=clamp(1-Math.abs(mean(q1.map(x=>x.score01))-mean(q2.map(x=>x.score01))));
  const overall=clamp(mean([multi.gain01,antiForgetting.retentionGain01,seq.order01,structuralDamage,recovery,memEq]));
  return {version:1,multiTimescale:multi,antiForgetting,lesionRecovery:{lesionEffect01:lesionEffect,structuralDamage01:structuralDamage,recovery01:recovery},sequence:{order01:seq.order01,causalLinks:seqMem.diagnostics().causalLinks},falseMemory:{semanticDepth:fd.semanticDepth,rejected:fd.falseMemoryRejections,unverifiedPromoted},restart:{memoryEquivalent01:memEq,neuralEquivalent01:neuralEq},overall01:overall};
 }
}
