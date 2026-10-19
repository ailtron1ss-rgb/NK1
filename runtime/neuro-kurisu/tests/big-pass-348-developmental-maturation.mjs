import { B299CausalPersonalityDevelopmentLoop } from '../src/organism/system/B299CausalPersonalityDevelopmentLoop.ts';
const core=new B299CausalPersonalityDevelopmentLoop();
const actions=['explore','verify','reflect','respond','rest','wait','defer'];
for(let i=0;i<28;i++){
  const action=actions[i%actions.length];
  core.observeOutcome({tick:i,action,reward01:action==='verify'?.82:.68,predictionError01:i%5===0?.22:.08,causalConfidence01:.86,identityContinuity01:.88,externalEvidence01:i%3===0?1:0,worldTransition:i%2===0,independent:i%4===0,autonomous:true,predictedUtility01:.6,neuralPlasticity01:.82,selfModelAlignment01:.86,goalLearningQuality01:.84,context:{epistemic:.72,autonomy:.55,social:.18,maintenance:.12}});
}
const d=core.diagnostics();
if(d.developmentalMaturity01<=0.05) throw new Error('maturity did not develop');
if(d.developmentalDiversity01<=0.05) throw new Error('diversity did not develop');
if(!['learning','calibrating','consolidating','generalizing'].includes(d.developmentalStage)) throw new Error('stage did not advance');
const snap=core.snapshot(); const restored=new B299CausalPersonalityDevelopmentLoop(); restored.restore(snap); const r=restored.diagnostics();
if(Math.abs(r.developmentalMaturity01-d.developmentalMaturity01)>1e-9) throw new Error('maturity persistence failed');
console.log('B348_DEVELOPMENTAL_MATURATION=PASS',JSON.stringify({maturity:d.developmentalMaturity01,stage:d.developmentalStage,evidence:d.developmentalEvidence01,diversity:d.developmentalDiversity01,persisted:r.developmentalMaturity01}));
