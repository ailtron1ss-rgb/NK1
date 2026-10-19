import assert from 'node:assert/strict';
import { B296NeuralPersonalityAgencyNucleus, defaultB296State } from '../src/organism/system/B296NeuralPersonalityAgencyNucleus.ts';
import { NeuralMemoryContinuityCore } from '../src/organism/system/NeuralMemoryContinuityCore.ts';
import { ActivePerceptionExecutor } from '../src/organism/system/ActivePerceptionExecutor.ts';

const n=new B296NeuralPersonalityAgencyNucleus();
for(let i=0;i<96;i++) n.step({tick:i+1,currentAction:i%2?'respond':'verify',b269Assembly:[.1,.4,.7,.2],b270SelfLatent:[.3,.6,.2],b289Latent:[.5,.2,.8],b291Agency01:.7,b291IdentityFit01:.72,b291PersonalityFit01:.68,b293PredictedSelf01:.6,b293PredictedWorld01:.55,b293PredictionError01:.3,b294CausalConfidence01:.8,b295Budget01:.7,novelty01:.4,uncertainty01:.3,energy01:.8,goalPressure01:.6});
const before=n.diagnostics();
for(let i=0;i<96;i++) n.learnFromOutcome({tick:i+1,action:i%2?'respond':'verify',reward01:i%3===0?.9:.65,predictionError01:.18,identityContinuity01:.8,causalConfidence01:.85,externalEvidence01:1,learningRate01:.9});
const after=n.diagnostics();
assert(after.synapticUpdates>0); assert(after.consolidationCycles>0); assert(after.slowPlasticity01>0); assert(after.activeSynapses>0); assert(after.calciumMean01>=0 && after.calciumMean01<=1);
const mem=new NeuralMemoryContinuityCore();
for(let i=0;i<12;i++) mem.encode({tick:i,context:[.1+i*.01,.2,.8,.4],action:'verify',reward01:.8,predictionError01:.25,verified01:.9,novelty01:.6});
const recalled=mem.recall([.16,.2,.8,.4]); assert(recalled.length>0 && recalled[0].score01>.5);
const cons=mem.consolidate(12,.8); assert(cons.semanticDepth>0);
const snap=mem.snapshot(); const mem2=new NeuralMemoryContinuityCore(); mem2.restore(snap); assert.equal(mem2.diagnostics().episodeDepth,12); assert(mem2.recall([.16,.2,.8,.4]).length>0);
const ap=new ActivePerceptionExecutor(); const ranked=ap.rankCandidates([{modality:'vision',reason:'reduce uncertainty',expectedInformationGain01:.85,estimatedCost01:.2},{modality:'audio',reason:'cheap',expectedInformationGain01:.5,estimatedCost01:.1}],.8); assert.equal(ranked[0].modality,'vision');
console.log(JSON.stringify({ok:true,neural:{before,after},memory:mem2.diagnostics(),activePerceptionTop:ranked[0]}));
