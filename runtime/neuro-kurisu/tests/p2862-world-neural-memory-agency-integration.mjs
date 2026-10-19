import { blendLatent01, previousWorldFeedback, buildGoalFeedback, neuralMemoryContext } from '../src/organism/cognition/P2862WorldNeuralMemoryAgencyBridge.ts';
import { B2525LearnedLatentTransitionField } from '../src/organism/cognition/B2525LearnedLatentTransitionField.ts';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';

const assert=(x,m)=>{if(!x)throw new Error(m)};
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(actions.map(a=>[a,.5]));

const world=Array.from({length:32},(_,i)=>.35+(i%5)*.08);
const neural=Array.from({length:64},(_,i)=>.2+(i%7)*.09);
const memory=Array.from({length:48},(_,i)=>.3+(i%3)*.07);
const fused=blendLatent01(world,neural,memory);
assert(fused.length===32,'fused latent width');
const feedback=previousWorldFeedback(fused,.82,.21,16);
assert(feedback.confidence01>.8 && feedback.predictionError01<.3,'world feedback conversion');
const goal=buildGoalFeedback(.82,.21,.72,.71);
assert(goal.epistemicPressure01<.55,'goal feedback should not overreact to confident model');
const memoryCtx=neuralMemoryContext(neural,.77,.71,.21);
assert(memoryCtx.length===8 && memoryCtx.every(x=>x>=0&&x<=1),'memory-neural context bounded');

const t=new B2525LearnedLatentTransitionField();
const n=new B365UnifiedNeuroCausalCore();
const pre=blendLatent01(world,neural,memory);
const b0=t.beforeDecision({tick:1,context:pre,baseUtilities:base,uncertainty01:.7,novelty01:.6,predictionError01:.55,computeBudget01:.9});
t.afterOutcome({tick:1,preContext:pre,postContext:pre.map((x,i)=>Math.min(1,x+(i===3?.08:0))),action:'verify',reward01:.9,predictionError01:.12});
const b1=t.beforeDecision({tick:2,context:pre,baseUtilities:base,uncertainty01:.4,novelty01:.3,predictionError01:.25,computeBudget01:.9});
assert(t.diagnostics().writes===1,'transition field did not learn');
assert(Math.abs(b1.actionBias.verify)+Math.abs(b1.actionBias.explore)>0,'learned world transition did not affect policy');

const r0=n.step({tick:1,vector:Array.from({length:64},(_,i)=>i<32?.5:feedback.vector01[i-32]??.5),actionContext:{verify:{worldUtility01:.72,worldConfidence01:.82,worldUncertainty01:.18},explore:{worldUtility01:.55,worldConfidence01:.74,worldUncertainty01:.26}},developmentContext01:[feedback.vector01[0]??.5,feedback.vector01[1]??.5,feedback.vector01[2]??.5,feedback.vector01[3]??.5,feedback.confidence01,feedback.predictionError01,feedback.novelty01,feedback.coherence01],learningEnabled:false});
const r1=n.step({tick:2,vector:Array.from({length:64},(_,i)=>i<32?.5:feedback.vector01[i-32]??.5),actionContext:{verify:{worldUtility01:.55,worldConfidence01:.35,worldUncertainty01:.65},explore:{worldUtility01:.71,worldConfidence01:.73,worldUncertainty01:.27}},developmentContext01:[feedback.vector01[0]??.5,feedback.vector01[1]??.5,feedback.vector01[2]??.5,feedback.vector01[3]??.5,feedback.confidence01,feedback.predictionError01,feedback.novelty01,feedback.coherence01],learningEnabled:false});
assert(r0.latent.length===96 && r1.latent.length===96,'B365 latent width');
assert(Math.abs(r1.latent.reduce((a,x,i)=>a+Math.abs(x-(r0.latent[i]??0)),0))>0.0001,'world feedback not reaching neural substrate');
console.log(`P2862_INTEGRATION=PASS transitionConfidence=${t.diagnostics().transitionConfidence01.toFixed(3)} neuralDelta=${r1.latent.reduce((a,x,i)=>a+Math.abs(x-(r0.latent[i]??0)),0).toFixed(4)}`);
