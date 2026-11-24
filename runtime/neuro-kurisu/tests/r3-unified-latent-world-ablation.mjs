import assert from 'node:assert/strict';
import { UnifiedLatentWorldState } from '../src/organism/world/UnifiedLatentWorldState.ts';
import { B2524NonparametricWorldExperienceMemory } from '../src/organism/cognition/B2524NonparametricWorldExperienceMemory.ts';
import { B2525LearnedLatentTransitionField } from '../src/organism/cognition/B2525LearnedLatentTransitionField.ts';
import { B2522AdaptiveWorldModelMixtureRouter } from '../src/organism/cognition/B2522AdaptiveWorldModelMixtureRouter.ts';
import { B2523MultiHorizonCounterfactualVerifier } from '../src/organism/cognition/B2523MultiHorizonCounterfactualVerifier.ts';

const A=['respond','explore','verify','rest','reflect','wait','defer'];
const baseUtilities=Object.fromEntries(A.map(a=>[a,.5]));
const ctx={tick:1,location:'latent-ablation-lab',energy:.81,attention:.36,uncertainty:.18,
  facts:['goal:verify','resource:high-value'],objects:[{id:'o1',label:'rare-token',location:'lab',value:.9,visible:true,collected:false,evidenceKind:'observed'}],
  events:['novel-observation'],};

const worldA=new UnifiedLatentWorldState();
const latent=worldA.observe({tick:1,at:1,context:ctx,grounding01:.92,p27Latent:new Array(32).fill(.2).map((x,i)=>x+(i%5)*.03)});
const canonical=worldA.latentVector();
const lesioned=new Array(32).fill(.5);
const biasSum=(x)=>A.reduce((s,a)=>s+Math.abs(x[a]??0),0);

const seedMemory=(C)=>{const m=new B2524NonparametricWorldExperienceMemory();for(let n=0;n<24;n++)m.afterOutcome({tick:n+1,context:C.map((v,i)=>Math.max(0,Math.min(1,v+(n%3-1)*.01))),action:A[n%7],reward01:.52+(n%2)*.32,predictionError01:.12+(n%3)*.04});return m;};
const seedTransition=(C)=>{
  const m=new B2525LearnedLatentTransitionField();
  for(let n=0;n<24;n++){
    const preContext=C.map((v)=>Math.max(0,Math.min(1,v+(n%3-1)*.01)));
    const postContext=C.map((v,i)=>Math.max(0,Math.min(1,v+(i%4===0 ? .04 : -.012))));
    m.afterOutcome({tick:n+1,preContext,postContext,action:A[n%7],reward01:.52+(n%2)*.32,predictionError01:.12+(n%3)*.04});
  }
  return m;
};

const mOn=seedMemory(canonical),mOff=seedMemory(lesioned);
const tOn=seedTransition(canonical),tOff=seedTransition(lesioned);
const in24=(context)=>({tick:50,context,baseUtilities,uncertainty01:.7,novelty01:.7,computeBudget01:.9});
const out24On=mOn.beforeDecision(in24(canonical)).actionBias;
const out24Off=mOff.beforeDecision(in24(lesioned)).actionBias;
const in25=(context)=>({tick:50,context,baseUtilities,uncertainty01:.7,novelty01:.7,predictionError01:.2,computeBudget01:.9});
const out25On=tOn.beforeDecision(in25(canonical)).actionBias;
const out25Off=tOff.beforeDecision(in25(lesioned)).actionBias;

const router=(context)=>{const r=new B2522AdaptiveWorldModelMixtureRouter();return r.beforeDecision({tick:50,baseUtilities,canonicalLatent:context,canonicalUncertainty01:.18,canonicalCoherence01:latent.coherence01,persistentBias:out24On,counterfactualBias:out25On,sensorimotorBias:out24On,generativeBias:out25On,persistentConfidence01:.75,counterfactualConfidence01:.72,sensorimotorConfidence01:.70,generativeConfidence01:.68,uncertainty01:.7,novelty01:.7,predictionError01:.2,computeBudget01:.9}).actionBias;};
const out22On=router(canonical);
const out22Off=router(lesioned);
const v=(context)=>{const r=new B2523MultiHorizonCounterfactualVerifier();return r.beforeDecision({tick:50,baseUtilities,uncertainty01:.7,predictionError01:.2,goalPressure01:.8,modelConfidence01:.8,routerDisagreement01:.25,computeBudget01:.9,canonicalLatent:context,canonicalUncertainty01:.18,canonicalCoherence01:latent.coherence01}).actionBias;};
const out23On=v(canonical),out23Off=v(lesioned);

const effects={p2524:biasSum(A.reduce((o,a)=>{o[a]=(out24On[a]??0)-(out24Off[a]??0);return o;},{})),p2525:biasSum(A.reduce((o,a)=>{o[a]=(out25On[a]??0)-(out25Off[a]??0);return o;},{})),p2522:biasSum(A.reduce((o,a)=>{o[a]=(out22On[a]??0)-(out22Off[a]??0);return o;},{})),p2523:biasSum(A.reduce((o,a)=>{o[a]=(out23On[a]??0)-(out23Off[a]??0);return o;},{}))};
assert.notEqual(latent.vector.join(','),lesioned.join(','));
assert(Object.values(effects).some(v=>v>1e-5));
assert(effects.p2522>0 || effects.p2523>0);
console.log('R3_UNIFIED_LATENT_ABLATION_PASS');
console.log(JSON.stringify({latentId:latent.id,coherence01:latent.coherence01,effects,canonicalMean:canonical.reduce((a,b)=>a+b,0)/32,lesionedMean:.5}));
