import assert from 'node:assert/strict';
import { DecisionActionPipeline } from '../src/organism/core/DecisionActionPipeline.ts';
import { B299CausalPersonalityDevelopmentLoop } from '../src/organism/system/B299CausalPersonalityDevelopmentLoop.ts';

const b=new B299CausalPersonalityDevelopmentLoop();
for(let i=0;i<18;i++) b.observeOutcome({tick:i,action:'explore',reward01:.84,predictionError01:.12,causalConfidence01:.82,identityContinuity01:.86,externalEvidence01:.2,worldTransition:true,independent:true,autonomous:true,predictedUtility01:.70,neuralPlasticity01:.74,selfModelAlignment01:.86,goalLearningQuality01:.84,context:{autonomy:.72,epistemic:.48,social:.16,maintenance:.12}});
const estimates=['explore','verify','reflect'].map(action=>({action,...b.predictOutcome(action,{autonomy:.72,epistemic:.48,social:.16,maintenance:.12})}));
assert(estimates.find(x=>x.action==='explore')?.samples>=3);
const pipe=new DecisionActionPipeline();
const candidates=[
 {id:'explore',action:'explore',score:.602,predictedUtility:.60,confidence01:.7,generatedAt:1},
 {id:'verify',action:'verify',score:.600,predictedUtility:.60,confidence01:.7,generatedAt:1},
 {id:'reflect',action:'reflect',score:.599,predictedUtility:.60,confidence01:.7,generatedAt:1},
];
const result=pipe.rank(candidates,[],estimates);
const rehearsal=result.rehearsal.find(x=>x.action==='explore');
assert(rehearsal?.adjustment>0);
console.log('B345_RELEASE=PASS',JSON.stringify({top:result.candidates[0].action,rehearsal,estimates},null,2));
