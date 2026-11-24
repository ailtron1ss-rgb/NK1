import { B299CausalPersonalityDevelopmentLoop } from '../src/organism/system/B299CausalPersonalityDevelopmentLoop.ts';

const make = () => new B299CausalPersonalityDevelopmentLoop();
const run = ({selfModelAlignment01, goalLearningQuality01, n=24}) => {
  const b = make();
  for (let i=0;i<n;i++) {
    b.observeOutcome({tick:i,action:'reflect',reward01:.84,predictionError01:.12,causalConfidence01:.82,identityContinuity01:.86,externalEvidence01:0,worldTransition:true,independent:true,autonomous:true,predictedUtility01:.72,neuralPlasticity01:.74,selfModelAlignment01,goalLearningQuality01,context:{autonomy:.62,epistemic:.48}});
  }
  return b.diagnostics();
};
const aligned=run({selfModelAlignment01:.92,goalLearningQuality01:.90});
const mismatched=run({selfModelAlignment01:.50,goalLearningQuality01:.50});
const a=aligned.dominantPhenotype?.preference11 ?? 0;
const m=mismatched.dominantPhenotype?.preference11 ?? 0;
if (!(Math.abs(a) > Math.abs(m)+0.002)) throw new Error(`self-model/personality coupling too weak aligned=${a} mismatched=${m}`);
console.log(`B340_SELF_MODEL_PERSONALITY_CONSOLIDATION=PASS aligned=${a.toFixed(6)} mismatched=${m.toFixed(6)} delta=${(Math.abs(a)-Math.abs(m)).toFixed(6)}`);
